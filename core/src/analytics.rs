use crate::state::AppState;
use axum::{ extract::{ Path, State }, Json };
use serde::Deserialize;
use serde_json::{ json, Value };
use std::io::Write;
use std::sync::Arc;
use tempfile::NamedTempFile;
use sqlx::Row;

#[derive(Deserialize)]
pub struct QueryRequest {
  pub query: String,
}

pub async fn run_query(
  State(state): State<Arc<AppState>>,
  Path((_repo_name, commit_id_str, file_path)): Path<(String, String, String)>,
  Json(payload): Json<QueryRequest>
) -> Result<Json<Value>, String> {
  let commit_uuid = uuid::Uuid::parse_str(&commit_id_str).map_err(|_| "Invalid Commit UUID")?;

  let row = sqlx
    ::query(r#"SELECT b.hash FROM commit_files cf JOIN blobs b ON cf.blob_hash = b.hash
           WHERE cf.commit_id = $1 AND cf.file_path = $2"#)
    .bind(commit_uuid)
    .bind(file_path)
    .fetch_optional(&state.db).await
    .map_err(|e| e.to_string())?
    .ok_or("File not found in this commit")?;

  let file_hash: String = row.get("hash");

  let content = state.bucket
    .get_object(&file_hash).await
    .map_err(|e| format!("Storage Error: {}", e))?
    .to_vec();

  let result_json = tokio::task
    ::spawn_blocking(move || {
      let mut temp_file = NamedTempFile::new().map_err(|e| e.to_string())?;
      temp_file.write_all(&content).map_err(|e| e.to_string())?;
      temp_file.flush().map_err(|e| e.to_string())?;
      let temp_path = temp_file.path().to_str().unwrap().to_string();

      let conn = duckdb::Connection::open_in_memory().map_err(|e| e.to_string())?;
      let _ = conn.execute("INSTALL json; LOAD json;", []);

      let create_table_sql = format!("CREATE TABLE dataset AS SELECT * FROM read_csv_auto('{}', header=true);", temp_path);
      conn.execute(&create_table_sql, []).map_err(|e| format!("CSV Loading Failed: {}", e))?;

      let user_query = payload.query.replace("read_csv_auto('input_file')", "dataset").replace("read_csv_auto('dataset')", "dataset");
      let wrapped_query = format!("SELECT cast(to_json(t) as VARCHAR) FROM ({}) t", user_query);

      let mut stmt = conn.prepare(&wrapped_query).map_err(|e| format!("SQL Prepare Error: {}", e))?;
      let mut rows = stmt.query([]).map_err(|e| format!("Query Exec Error: {}", e))?;
      let mut results = Vec::new();

      while let Some(row) = rows.next().map_err(|e| format!("Row Fetch Error: {}", e))? {
        let json_str: String = row.get(0).unwrap_or("{}".to_string());
        if let Ok(val) = serde_json::from_str::<Value>(&json_str) {
          results.push(val);
        }
      }

      Ok::<Value, String>(json!({ "status": "success", "rows_count": results.len(), "data": results }))
    }).await
    .map_err(|e| format!("Task Error: {}", e))??;

  Ok(Json(result_json))
}

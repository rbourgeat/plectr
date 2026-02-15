use axum::{ body::Body, http::{ header, StatusCode, HeaderMap }, response::IntoResponse, extract::{ Path, State }, Json };
use serde::Deserialize;
use serde_json::{ json, Value };
use std::sync::Arc;
use std::collections::HashMap;
use sqlx::Row;
use uuid::Uuid;
use crate::{ diff, state::AppState, auth::{ AuthUser, RepoReadGuard, RepoWriteGuard, RepoAdminGuard, RepoPerm, Claims } };
use base64::{ Engine as _, engine::general_purpose };
use crate::mirror;
use crate::pipeline; 

#[derive(Deserialize)]
pub struct CreateRepoRequest {
  pub name: String,
  pub description: Option<String>,
  pub is_public: bool,
}

#[derive(Deserialize)]
pub struct FileEntry {
  pub path: String,
  pub hash: String,
}

#[derive(Deserialize)]
pub struct CreateCommitRequest {
  pub message: String,
  pub author_name: String,
  pub author_email: String,
  pub parent_commit_id: Option<String>,
  pub files: Vec<FileEntry>,
}

#[derive(Deserialize)]
pub struct MergeRequest {
  pub divergent_commit_id: String,
  pub remote_commit_id: String,
  pub decisions: HashMap<String, String>,
}

#[derive(Deserialize)]
pub struct CompareRequest {
  pub local_hash: String,
  pub remote_hash: String,
}

pub async fn list_repos(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Json<Value> {
  let user_id = if let Some(auth_header) = headers.get("Authorization") {
    if let Ok(str_val) = auth_header.to_str() {
      if str_val.starts_with("Bearer ") {
        let token = &str_val[7..];
        let parts: Vec<&str> = token.split('.').collect();
        if parts.len() == 3 {
          if let Ok(decoded) = general_purpose::URL_SAFE_NO_PAD.decode(parts[1]) {
            if let Ok(claims) = serde_json::from_slice::<Claims>(&decoded) { Uuid::parse_str(&claims.sub).ok() } else { None }
          } else {
            None
          }
        } else {
          None
        }
      } else {
        None
      }
    } else {
      None
    }
  } else {
    None
  };

  let query =
    r#"
        SELECT 
            r.id, r.name, r.description, r.is_public,
            to_char(COALESCE(MAX(c.created_at), r.created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_updated,
            (
                SELECT split_part(cf.file_path, '.', 2) as ext
                FROM commit_files cf
                JOIN commits c2 ON cf.commit_id = c2.id
                WHERE c2.repo_id = r.id
                GROUP BY ext ORDER BY COUNT(*) DESC LIMIT 1
            ) as primary_extension
        FROM repositories r
        LEFT JOIN commits c ON r.id = c.repo_id
        -- Jointure pour vérifier les permissions
        LEFT JOIN repository_members rm ON r.id = rm.repo_id AND rm.user_id = $1
        WHERE 
            r.is_public = TRUE 
            OR 
            rm.user_id IS NOT NULL -- L'utilisateur est membre (viewer/editor/admin)
        GROUP BY r.id, r.name, r.description, r.is_public, r.created_at
        ORDER BY last_updated DESC
    "#;

  let rows = sqlx::query(query).bind(user_id).fetch_all(&state.db).await.unwrap_or_default();

  let json_repos: Vec<Value> = rows
    .iter()
    .map(|r| {
      let ext: Option<String> = r.get("primary_extension");
      let lang = match ext.as_deref() {
        Some("rs") => "Rust",
        Some("py") => "Python",
        Some("ts") | Some("tsx") => "TypeScript",
        Some("js") => "JavaScript",
        Some("csv") | Some("parquet") => "Data",
        Some("safetensors") => "AI Model",
        _ => "Empty",
      };

      json!({
            "id": r.get::<Uuid, _>("id"),
            "name": r.get::<String, _>("name"),
            "description": r.get::<Option<String>, _>("description"),
            "is_public": r.get::<bool, _>("is_public"),
            "last_updated": r.get::<String, _>("last_updated"),
            "language": lang
        })
    })
    .collect();

  Json(json!(json_repos))
}

pub async fn create_repo(State(state): State<Arc<AppState>>, auth: AuthUser, Json(payload): Json<CreateRepoRequest>) -> Result<Json<Value>, (StatusCode, String)> {
  sqlx
    ::query("INSERT INTO users (id, username, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW()")
    .bind(auth.id)
    .bind(&auth.username)
    .bind(&auth.email)
    .execute(&state.db).await
    .ok();

  let mut tx = state.db.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let row_res = sqlx
    ::query("INSERT INTO repositories (name, description, is_public) VALUES ($1, $2, $3) RETURNING id")
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(payload.is_public)
    .fetch_one(&mut *tx).await;
  let row = match row_res {
    Ok(r) => r,
    Err(sqlx::Error::Database(db_err)) if db_err.code().as_deref() == Some("23505") => {
      return Err((StatusCode::CONFLICT, format!("Repository '{}' already exists.", payload.name)));
    }
    Err(e) => {
      return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
    }
  };

  let repo_id: Uuid = row.get("id");

  sqlx
    ::query("INSERT INTO repository_members (repo_id, user_id, role) VALUES ($1, $2, 'admin')")
    .bind(repo_id)
    .bind(auth.id)
    .execute(&mut *tx).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  Ok(Json(json!({ "status": "created", "repo_id": repo_id })))
}

pub async fn get_head_commit(State(state): State<Arc<AppState>>, guard: RepoReadGuard, Path(repo_name): Path<String>) -> Result<Json<Value>, (StatusCode, String)> {
  let row = sqlx
    ::query(
      r#"
      SELECT
        c.id,
        c.message,
        c.created_at
      FROM commits c
      WHERE c.repo_id = $1
        AND c.is_divergent = FALSE
      ORDER BY c.created_at DESC
      LIMIT 1
      "#
    )
    .bind(guard.repo_id)
    .fetch_optional(&state.db).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  let access = match guard.perm {
    RepoPerm::Admin => "admin",
    RepoPerm::Write => "editor",
    RepoPerm::Read => "viewer",
    RepoPerm::None => "none",
  };

  match row {
    Some(r) =>
      Ok(
        Json(
          json!({
        "status": "active",
        "repo_id": guard.repo_id,
        "commit_id": r.get::<Uuid, _>("id"),
        "message": r.get::<String, _>("message"),
        "date": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
        "access_level": access
      })
        )
      ),
    None => Ok(Json(json!({
        "status": "empty",
        "repo_id": guard.repo_id,
        "commit_id": null, 
        "message": "Repository is void",
        "access_level": access
      }))),
  }
}

pub async fn list_commit_files(State(state): State<Arc<AppState>>, Path((_repo_name, commit_id_str)): Path<(String, String)>) -> Result<Json<Value>, String> {
  let commit_uuid = Uuid::parse_str(&commit_id_str).map_err(|_| "Invalid UUID")?;
  let rows = sqlx
    ::query(r#"SELECT cf.file_path, b.hash, b.size, b.mime_type
           FROM commit_files cf JOIN blobs b ON cf.blob_hash = b.hash
           WHERE cf.commit_id = $1 ORDER BY cf.file_path ASC"#)
    .bind(commit_uuid)
    .fetch_all(&state.db).await
    .map_err(|e| e.to_string())?;

  let file_list: Vec<Value> = rows
    .iter()
    .map(|r| {
      let path = r.get::<String, _>("file_path");
      let ftype = if path.ends_with(".safetensors") { "ai" } else if path.ends_with(".csv") { "data" } else { "code" };
      json!({ "path": path, "size": r.get::<i64, _>("size"), "hash": r.get::<String, _>("hash"), "type": ftype })
    })
    .collect();
  Ok(Json(json!(file_list)))
}

pub async fn create_commit(
  State(state): State<Arc<AppState>>,
  _guard: RepoWriteGuard,
  Path(repo_name): Path<String>,
  Json(payload): Json<CreateCommitRequest>
) -> Result<Json<Value>, (StatusCode, String)> {
  let mut tx = state.db.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  let repo_row = sqlx
    ::query("SELECT id FROM repositories WHERE name = $1")
    .bind(&repo_name)
    .fetch_optional(&mut *tx).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Repo not found".to_string()))?;

  let repo_id: Uuid = repo_row.get("id");

  let head_row = sqlx
    ::query("SELECT id FROM commits WHERE repo_id = $1 ORDER BY created_at DESC LIMIT 1")
    .bind(repo_id)
    .fetch_optional(&mut *tx).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  let current_head: Option<Uuid> = head_row.map(|r| r.get("id"));

  let mut parent_uuid = payload.parent_commit_id.and_then(|id| Uuid::parse_str(&id).ok());
  if let Some(pid) = parent_uuid {
    let exists = sqlx
      ::query("SELECT 1 FROM commits WHERE id = $1")
      .bind(pid)
      .fetch_optional(&mut *tx).await
      .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
      .is_some();
    if !exists {
      parent_uuid = None;
    }
  }

  let is_divergent = match (current_head, parent_uuid) {
    (Some(head), Some(parent)) if head == parent => false,
    (None, _) => false,
    _ => true,
  };

  let row = sqlx
    ::query("INSERT INTO commits (repo_id, message, author_name, author_email, tree_hash, parent_id, is_divergent) 
         VALUES ($1, $2, $3, $4, 'root', $5, $6) RETURNING id")
    .bind(repo_id)
    .bind(&payload.message)
    .bind(&payload.author_name)
    .bind(&payload.author_email)
    .bind(parent_uuid)
    .bind(is_divergent)
    .fetch_one(&mut *tx).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  let commit_id: Uuid = row.get("id");

  for file in payload.files {
    sqlx
      ::query("INSERT INTO commit_files (commit_id, file_path, blob_hash) VALUES ($1, $2, $3)")
      .bind(commit_id)
      .bind(&file.path)
      .bind(&file.hash)
      .execute(&mut *tx).await
      .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  }

  tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  mirror::trigger_sync_background(state.clone(), repo_id).await;

  let state_ci = state.clone();
  tokio::spawn(async move {
      if let Err(e) = pipeline::trigger_pipeline(state_ci, repo_id, commit_id).await {
          tracing::error!("❌ CI Pipeline Failed to trigger: {}", e);
      }
  });

  Ok(Json(json!({ "status": "success", "commit_id": commit_id, "is_divergent": is_divergent })))
}

pub async fn get_file_content(State(state): State<Arc<AppState>>, Path((_repo_name, commit_id_str, file_path)): Path<(String, String, String)>) -> impl IntoResponse {
  let commit_uuid = match Uuid::parse_str(&commit_id_str) {
    Ok(u) => u,
    Err(_) => {
      return (StatusCode::BAD_REQUEST, "Invalid UUID").into_response();
    }
  };

  let row_opt = sqlx
    ::query("SELECT b.hash, b.mime_type FROM commit_files cf JOIN blobs b ON cf.blob_hash = b.hash WHERE cf.commit_id = $1 AND cf.file_path = $2")
    .bind(commit_uuid)
    .bind(file_path)
    .fetch_optional(&state.db).await
    .unwrap_or(None);

  let row = match row_opt {
    Some(r) => r,
    None => {
      return (StatusCode::NOT_FOUND, "File not found").into_response();
    }
  };

  let hash: String = row.get("hash");
  let mime: String = row.get::<Option<String>, _>("mime_type").unwrap_or("application/octet-stream".to_string());

  let content = match state.bucket.get_object(&hash).await {
    Ok(res) => res.to_vec(),
    Err(e) => {
      return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }
  };

  let mut h = header::HeaderMap::new();
  h.insert(header::CONTENT_TYPE, header::HeaderValue::from_str(&mime).unwrap());
  (h, Body::from(content)).into_response()
}

pub async fn get_file_metadata(State(state): State<Arc<AppState>>, Path((_repo_name, commit_id_str, file_path)): Path<(String, String, String)>) -> Result<Json<Value>, String> {
  let row = sqlx
    ::query("SELECT b.metadata, b.size, b.mime_type FROM commit_files cf JOIN blobs b ON cf.blob_hash = b.hash WHERE cf.commit_id = $1 AND cf.file_path = $2")
    .bind(Uuid::parse_str(&commit_id_str).unwrap())
    .bind(file_path)
    .fetch_optional(&state.db).await
    .map_err(|e| e.to_string())?
    .ok_or("Not found")?;

  Ok(Json(json!({ 
        "size": row.get::<i64, _>("size"), 
        "mime": row.get::<Option<String>, _>("mime_type"), 
        "metadata": row.get::<Option<Value>, _>("metadata") 
    })))
}

pub async fn list_repo_commits(State(state): State<Arc<AppState>>, Path(repo_name): Path<String>) -> Result<Json<Value>, String> {
  let rows = sqlx
    ::query(
      r#"
      SELECT 
        c.id, c.message, c.author_name, c.author_email, c.is_divergent, 
        to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date,
        (SELECT COUNT(*) FROM commit_files cf WHERE cf.commit_id = c.id) as file_count,
        u.avatar_url
      FROM commits c 
      JOIN repositories r ON c.repo_id = r.id 
      LEFT JOIN users u ON c.author_name = u.username -- Tentative de lier à un avatar réel
      WHERE r.name = $1 
      ORDER BY c.created_at DESC
      "#
    )
    .bind(&repo_name)
    .fetch_all(&state.db).await
    .map_err(|e| e.to_string())?;

  let json_commits: Vec<Value> = rows
    .iter()
    .map(
      |r|
        json!({ 
      "id": r.get::<Uuid, _>("id"), 
      "message": r.get::<String, _>("message"), 
      "author": r.get::<String, _>("author_name"), 
      "email": r.get::<String, _>("author_email"),
      "is_divergent": r.get::<bool, _>("is_divergent"), 
      "date": r.get::<String, _>("date"),
      "stats": {
        "files": r.get::<i64, _>("file_count")
      },
      "avatar": r.get::<Option<String>, _>("avatar_url")
    })
    )
    .collect();

  Ok(Json(json!(json_commits)))
}

#[derive(Deserialize)]
pub struct AddMemberRequest {
  pub email: String,
  pub role: String,
}

pub async fn add_repo_member(
  State(state): State<Arc<AppState>>,
  guard: RepoAdminGuard,
  Path(_repo_name): Path<String>,
  Json(payload): Json<AddMemberRequest>
) -> Result<Json<Value>, (StatusCode, String)> {
  let user_row = sqlx
    ::query("SELECT id FROM users WHERE email = $1")
    .bind(&payload.email)
    .fetch_optional(&state.db).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  let user_id = match user_row {
    Some(row) => row.get::<Uuid, _>("id"),
    None => {
      return Err((StatusCode::NOT_FOUND, "User not found (must login once)".to_string()));
    }
  };

  sqlx
    ::query(
      r#"
        INSERT INTO repository_members (repo_id, user_id, role) 
        VALUES ($1, $2, $3::repo_role_enum)
        ON CONFLICT (repo_id, user_id) DO UPDATE SET role = EXCLUDED.role
        "#
    )
    .bind(guard.0.repo_id)
    .bind(user_id)
    .bind(&payload.role)
    .execute(&state.db).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  Ok(Json(json!({ "status": "member_added", "user": payload.email, "role": payload.role })))
}

pub async fn list_repo_members(State(state): State<Arc<AppState>>, guard: RepoReadGuard, Path(_repo_name): Path<String>) -> Result<Json<Value>, String> {
  let rows = sqlx
    ::query(
      r#"
        SELECT u.username, u.email, rm.role::text, u.avatar_url
        FROM repository_members rm
        JOIN users u ON rm.user_id = u.id
        WHERE rm.repo_id = $1
        ORDER BY rm.role DESC, u.username ASC
        "#
    )
    .bind(guard.repo_id)
    .fetch_all(&state.db).await
    .map_err(|e| e.to_string())?;

  let members: Vec<Value> = rows
    .iter()
    .map(
      |r|
        json!({
        "username": r.get::<String, _>("username"),
        "email": r.get::<String, _>("email"),
        "role": r.get::<String, _>("role"), 
        "avatar": r.get::<Option<String>, _>("avatar_url")
    })
    )
    .collect();

  Ok(Json(json!(members)))
}

pub async fn merge_commits(State(state): State<Arc<AppState>>, _guard: RepoWriteGuard, Path(repo_name): Path<String>, Json(payload): Json<MergeRequest>) -> Result<Json<Value>, (StatusCode, String)> {
  let mut tx = state.db.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  let repo_row = sqlx
    ::query("SELECT id FROM repositories WHERE name = $1")
    .bind(&repo_name)
    .fetch_optional(&mut *tx).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  let repo_id: Uuid = match repo_row {
    Some(r) => r.get("id"),
    None => {
      return Err((StatusCode::NOT_FOUND, "Repo not found".to_string()));
    }
  };

  let remote_uuid = Uuid::parse_str(&payload.remote_commit_id).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid Remote ID".to_string()))?;
  let local_uuid = Uuid::parse_str(&payload.divergent_commit_id).map_err(|_| (StatusCode::BAD_REQUEST, "Invalid Local ID".to_string()))?;

  let remote_files_rows = sqlx
    ::query("SELECT file_path, blob_hash FROM commit_files WHERE commit_id = $1")
    .bind(remote_uuid)
    .fetch_all(&mut *tx).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  let local_files_rows = sqlx
    ::query("SELECT file_path, blob_hash FROM commit_files WHERE commit_id = $1")
    .bind(local_uuid)
    .fetch_all(&mut *tx).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  let mut final_tree: HashMap<String, String> = HashMap::new();
  for row in &remote_files_rows {
    final_tree.insert(row.get("file_path"), row.get("blob_hash"));
  }
  let remote_paths: std::collections::HashSet<String> = remote_files_rows
    .iter()
    .map(|r| r.get("file_path"))
    .collect();
  for row in &local_files_rows {
    let path: String = row.get("file_path");
    if !remote_paths.contains(&path) {
      final_tree.insert(path, row.get("blob_hash"));
    }
  }
  for (path, resolved_hash) in payload.decisions {
    final_tree.insert(path, resolved_hash);
  }

  let message = format!("Merge resonance from local divergence ({})", &payload.divergent_commit_id[..8]);

  let commit_row = sqlx
    ::query(
      "INSERT INTO commits (repo_id, message, author_name, author_email, tree_hash, parent_id, is_divergent) 
         VALUES ($1, $2, 'Plectr Merge System', 'merge@plectr.io', 'merged', $3, FALSE) RETURNING id"
    )
    .bind(repo_id)
    .bind(message)
    .bind(remote_uuid)
    .fetch_one(&mut *tx).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  let new_commit_id: Uuid = commit_row.get("id");
  for (path, hash) in final_tree {
    sqlx
      ::query("INSERT INTO commit_files (commit_id, file_path, blob_hash) VALUES ($1, $2, $3)")
      .bind(new_commit_id)
      .bind(path)
      .bind(hash)
      .execute(&mut *tx).await
      .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  }
  sqlx
    ::query("UPDATE commits SET is_divergent = FALSE WHERE id = $1")
    .bind(local_uuid)
    .execute(&mut *tx).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  Ok(Json(json!({ "status": "merged", "commit_id": new_commit_id })))
}

pub async fn compare_blobs(State(state): State<Arc<AppState>>, Json(payload): Json<CompareRequest>) -> Result<Json<Value>, (StatusCode, String)> {
  let get_content = |hash: &str| {
    let hash = hash.to_string();
    let state = state.clone();
    async move {
      match state.bucket.get_object(&hash).await {
        Ok(bytes) => String::from_utf8(bytes.to_vec()).unwrap_or_else(|_| "".to_string()),
        Err(_) => "".to_string(),
      }
    }
  };
  let local_content = get_content(&payload.local_hash).await;
  let remote_content = get_content(&payload.remote_hash).await;
  let diff_result = diff::compute_text_diff(&remote_content, &local_content);
  Ok(Json(json!({ "diff": diff_result, "local_content": local_content, "remote_content": remote_content })))
}

#[derive(Deserialize)]
pub struct UpdateRepoRequest {
  pub is_public: Option<bool>,
  pub description: Option<String>,
}

pub async fn update_repo(
  State(state): State<Arc<AppState>>,
  _guard: RepoAdminGuard,
  Path(repo_name): Path<String>,
  Json(payload): Json<UpdateRepoRequest>
) -> Result<Json<Value>, (StatusCode, String)> {
  let row = sqlx
    ::query("UPDATE repositories 
       SET is_public = COALESCE($1, is_public), 
         description = COALESCE($2, description) 
       WHERE name = $3 
       RETURNING id")
    .bind(payload.is_public)
    .bind(payload.description)
    .bind(&repo_name)
    .fetch_optional(&state.db).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  match row {
    Some(_) => Ok(Json(json!({ "status": "updated" }))),
    None => Err((StatusCode::NOT_FOUND, "Repository not found".to_string())),
  }
}

pub async fn delete_repo(State(state): State<Arc<AppState>>, _guard: RepoAdminGuard, Path(repo_name): Path<String>) -> Result<Json<Value>, (StatusCode, String)> {
  let result = sqlx
    ::query("DELETE FROM repositories WHERE name = $1")
    .bind(&repo_name)
    .execute(&state.db).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  if result.rows_affected() == 0 {
    return Err((StatusCode::NOT_FOUND, "Repository not found".to_string()));
  }

  Ok(Json(json!({ "status": "deleted", "repo": repo_name })))
}

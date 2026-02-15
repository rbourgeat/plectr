use axum::{
  extract::{ ws::{ WebSocket, WebSocketUpgrade, Message }, State, Query, Path, Multipart },
  response::IntoResponse,
  Json,
  http::StatusCode,
};
use std::sync::Arc;
use crate::state::AppState;
use futures::{ sink::SinkExt, stream::StreamExt };
use serde::Deserialize;
use serde_json::{ json, Value };
use tokio::sync::mpsc;
use uuid::Uuid;
use sqlx::Row;

#[derive(Deserialize)]
pub struct RunnerConnectParams {
  token: String,
  name: String,
}

#[derive(Deserialize, Debug)]
struct PipelineConfig {
  pipeline: PipelineDef,
}
#[derive(Deserialize, Debug)]
struct PipelineDef {
  name: String,
  jobs: Vec<JobDef>,
}
#[derive(Deserialize, Debug)]
struct JobDef {
  name: String,
  image: String,
  stage: String,
  script: Vec<String>,
  artifacts: Option<Vec<String>>,
}

pub async fn runner_ws_handler(
  ws: WebSocketUpgrade,
  Query(params): Query<RunnerConnectParams>,
  State(state): State<Arc<AppState>>
) -> impl IntoResponse {
  let row = sqlx::query("SELECT id FROM runners WHERE token = $1").bind(&params.token).fetch_optional(&state.db).await.unwrap_or(None);

  let runner_id: Uuid = match row {
    Some(r) => r.get("id"),
    None => {
      tracing::warn!("🚫 Unauthorized runner attempt: {}", params.name);
      return axum::http::StatusCode::UNAUTHORIZED.into_response();
    }
  };

  ws.on_upgrade(move |socket| handle_socket(socket, state, runner_id, params.name))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>, runner_id: Uuid, runner_name: String) {
  tracing::info!("🔌 Runner connected: {} ({})", runner_name, runner_id);

  let (mut sender, mut receiver) = socket.split();

  let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

  state.active_runners.insert(runner_id, tx);

  let _ = sqlx
    ::query("UPDATE runners SET is_active = TRUE, last_heartbeat_at = NOW() WHERE id = $1")
    .bind(runner_id)
    .execute(&state.db).await;

  let mut send_task = tokio::spawn(async move {
    while let Some(msg) = rx.recv().await {
      if sender.send(msg).await.is_err() {
        break;
      }
    }
  });

  let state_clone = state.clone();
  let mut recv_task = tokio::spawn(async move {
    while let Some(Ok(msg)) = receiver.next().await {
      if let Message::Text(text) = msg {
        let _ = handle_runner_message(&state_clone, &text).await;
      }
    }
  });

  tokio::select! {
      _ = &mut send_task => {},
      _ = &mut recv_task => {},
  }

  tracing::info!("❌ Runner disconnected: {}", runner_name);
  state.active_runners.remove(&runner_id);
  let _ = sqlx::query("UPDATE runners SET is_active = FALSE WHERE id = $1").bind(runner_id).execute(&state.db).await;
}

async fn handle_runner_message(state: &Arc<AppState>, text: &str) {
  let data: serde_json::Value = serde_json::from_str(text).unwrap_or(json!({}));

  match data["type"].as_str() {
    Some("job_log") => {
      let job_id = data["job_id"].as_str().unwrap_or("?");
      let content = data["content"].as_str().unwrap_or("");

      let _ = sqlx
        ::query("UPDATE jobs SET logs = COALESCE(logs, '') || $1 WHERE id = $2")
        .bind(content)
        .bind(Uuid::parse_str(job_id).unwrap_or_default())
        .execute(&state.db).await;
    }
    Some("job_completed") => {
      let job_id_str = data["job_id"].as_str().unwrap();
      let job_id = Uuid::parse_str(job_id_str).unwrap_or_default();
      let status = data["status"].as_str().unwrap();
      let exit_code = data["exit_code"].as_i64().unwrap_or(1);

      tracing::info!("🏁 Job {} finished: {}", job_id, status);

      let _ = sqlx
        ::query("UPDATE jobs SET status = $1::job_status_enum, finished_at = NOW(), exit_code = $2 WHERE id = $3")
        .bind(status)
        .bind(exit_code as i32)
        .bind(job_id)
        .execute(&state.db).await;

      if let Ok(row) = sqlx::query("SELECT pipeline_id FROM jobs WHERE id = $1").bind(job_id).fetch_one(&state.db).await {
        let pipeline_id: Uuid = row.get("pipeline_id");
        update_pipeline_status(state, pipeline_id).await;
      }
    }
    _ => {}
  }
}

pub async fn list_pipelines(State(state): State<Arc<AppState>>, Path(repo_name): Path<String>) -> Result<Json<Value>, String> {
  let rows = sqlx
    ::query(
      r#"
    SELECT p.id, p.status::text, p.commit_id, p.created_at, p.finished_at,
        c.message as commit_message, c.author_name
    FROM pipelines p
    JOIN repositories r ON p.repo_id = r.id
    JOIN commits c ON p.commit_id = c.id
    WHERE r.name = $1
    ORDER BY p.created_at DESC
    LIMIT 20
  "#
    )
    .bind(repo_name)
    .fetch_all(&state.db).await
    .map_err(|e| e.to_string())?;

  let pipelines: Vec<Value> = rows
    .iter()
    .map(
      |r|
        json!({
    "id": r.get::<Uuid, _>("id"),
    "status": r.get::<String, _>("status"),
    "commit_id": r.get::<Uuid, _>("commit_id"),
    "commit_message": r.get::<String, _>("commit_message"),
    "author": r.get::<String, _>("author_name"),
    "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
    "finished_at": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("finished_at").map(|d| d.to_rfc3339()),
  })
    )
    .collect();

  Ok(Json(json!(pipelines)))
}

pub async fn get_pipeline_details(
  State(state): State<Arc<AppState>>,
  Path((_repo_name, pipeline_id)): Path<(String, Uuid)>
) -> Result<Json<Value>, String> {
  let jobs_rows = sqlx
    ::query(
      r#"
    SELECT id, name, stage, status::text, started_at, finished_at, exit_code, logs
    FROM jobs WHERE pipeline_id = $1 ORDER BY started_at ASC
  "#
    )
    .bind(pipeline_id)
    .fetch_all(&state.db).await
    .map_err(|e| e.to_string())?;

  let jobs: Vec<Value> = jobs_rows
    .iter()
    .map(
      |r|
        json!({
    "id": r.get::<Uuid, _>("id"),
    "name": r.get::<String, _>("name"),
    "stage": r.get::<String, _>("stage"),
    "status": r.get::<String, _>("status"),
    "logs": r.get::<Option<String>, _>("logs"),
    "duration": calculate_duration(r.get("started_at"), r.get("finished_at")),
    "exit_code": r.get::<Option<i32>, _>("exit_code")
  })
    )
    .collect();

  Ok(Json(json!({ "jobs": jobs })))
}

fn calculate_duration(start: Option<chrono::DateTime<chrono::Utc>>, end: Option<chrono::DateTime<chrono::Utc>>) -> String {
  match (start, end) {
    (Some(s), Some(e)) => format!("{}s", (e - s).num_seconds()),
    (Some(_), None) => "Running...".to_string(),
    _ => "0s".to_string(),
  }
}

pub async fn trigger_pipeline(state: Arc<AppState>, repo_id: Uuid, commit_id: Uuid) -> Result<(), String> {
  let repo_name: String = sqlx
    ::query("SELECT name FROM repositories WHERE id = $1")
    .bind(repo_id)
    .fetch_one(&state.db).await
    .map_err(|e| e.to_string())?
    .get("name");

  let row = sqlx
    ::query(
      "SELECT b.hash FROM commit_files cf JOIN blobs b ON cf.blob_hash = b.hash WHERE cf.commit_id = $1 AND cf.file_path = 'plectr.yaml'"
    )
    .bind(commit_id)
    .fetch_optional(&state.db).await
    .map_err(|e| e.to_string())?;

  let hash = match row {
    Some(r) => r.get::<String, _>("hash"),
    None => {
      return Ok(());
    }
  };

  let content_bytes = state.bucket
    .get_object(&hash).await
    .map_err(|e| e.to_string())?
    .to_vec();
  let config: PipelineConfig = serde_yaml::from_slice(&content_bytes).map_err(|e| format!("Invalid YAML: {}", e))?;

  let pipeline_row = sqlx
    ::query("INSERT INTO pipelines (repo_id, commit_id, status) VALUES ($1, $2, 'running') RETURNING id")
    .bind(repo_id)
    .bind(commit_id)
    .fetch_one(&state.db).await
    .map_err(|e| e.to_string())?;
  let pipeline_id: Uuid = pipeline_row.get("id");

  // TODO: upgrade to prod this
  let system_token = crate::auth::create_system_token().map_err(|e| e.to_string())?;

  for job in config.pipeline.jobs {
    let runner_entry = state.active_runners.iter().next();
    let (runner_id, runner_tx) = match runner_entry {
      Some(r) => (*r.key(), r.value().clone()),
      None => {
        tracing::warn!("⚠️ No runner");
        continue;
      }
    };

    let job_row = sqlx
      ::query(
        "INSERT INTO jobs (pipeline_id, name, stage, image, script, status, runner_id) VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING id"
      )
      .bind(pipeline_id)
      .bind(&job.name)
      .bind(&job.stage)
      .bind(&job.image)
      .bind(serde_json::to_value(&job.script).unwrap())
      .bind(runner_id)
      .fetch_one(&state.db).await
      .map_err(|e| e.to_string())?;

    let job_id: Uuid = job_row.get("id");

    let payload =
      json!({
      "type": "job_request",
      "payload": {
        "job_id": job_id.to_string(),
        "image": job.image,
        "script": job.script,
        "artifacts": job.artifacts,
        "env": ["RUST_LOG=info", "CI=true"],
        "context": {
          "repo_name": repo_name,
          "commit_id": commit_id.to_string(),
          "api_url": "http://plectr-core:3000",
          "auth_token": system_token,
        }
      }
    });

    runner_tx.send(Message::Text(payload.to_string())).ok();
  }
  Ok(())
}

async fn update_pipeline_status(state: &Arc<AppState>, pipeline_id: Uuid) {
  let jobs = sqlx
    ::query("SELECT status::text FROM jobs WHERE pipeline_id = $1")
    .bind(pipeline_id)
    .fetch_all(&state.db).await
    .unwrap_or_default();

  let mut all_success = true;
  let mut any_failed = false;
  let mut any_running = false;

  for row in jobs {
    let s: String = row.get("status");
    match s.as_str() {
      "failed" | "cancelled" => {
        any_failed = true;
      }
      "running" | "pending" => {
        any_running = true;
      }
      "success" => {}
      _ => {}
    }
    if s != "success" {
      all_success = false;
    }
  }

  let new_status = if any_failed && !any_running {
    "failed"
  } else if all_success && !any_running {
    "success"
  } else {
    return;
  };

  let _ = sqlx
    ::query("UPDATE pipelines SET status = $1::job_status_enum, finished_at = NOW() WHERE id = $2")
    .bind(new_status)
    .bind(pipeline_id)
    .execute(&state.db).await;
}

pub async fn upload_job_artifact(
  State(state): State<Arc<AppState>>,
  Path(job_id): Path<Uuid>,
  mut multipart: Multipart
) -> Result<Json<Value>, (StatusCode, String)> {
  let _ = sqlx
    ::query("SELECT 1 FROM jobs WHERE id = $1")
    .bind(job_id)
    .fetch_optional(&state.db).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Job not found".to_string()))?;

  let mut uploaded = Vec::new();

  while let Ok(Some(field)) = multipart.next_field().await {
    let filename = field.file_name().unwrap_or("artifact").to_string();

    match crate::storage::ingest_file(state.clone(), field).await {
      Ok(info) => {
        let _ = sqlx
          ::query("INSERT INTO job_artifacts (job_id, name, blob_hash, size, mime_type) VALUES ($1, $2, $3, $4, $5)")
          .bind(job_id)
          .bind(&filename)
          .bind(&info.hash)
          .bind(info.size)
          .bind(&info.mime_type)
          .execute(&state.db).await;

        uploaded.push(filename);
      }
      Err(e) => tracing::error!("Failed to ingest artifact: {}", e),
    }
  }

  Ok(Json(json!({ "status": "uploaded", "files": uploaded })))
}

pub async fn list_repo_releases(State(state): State<Arc<AppState>>, Path(repo_name): Path<String>) -> Result<Json<Value>, String> {
  let rows = sqlx
    ::query(
      r#"
    SELECT 
      ja.id, ja.name, ja.size, ja.blob_hash, ja.created_at,
      j.id as job_id, p.commit_id, c.message as commit_message
    FROM job_artifacts ja
    JOIN jobs j ON ja.job_id = j.id
    JOIN pipelines p ON j.pipeline_id = p.id
    JOIN commits c ON p.commit_id = c.id
    JOIN repositories r ON p.repo_id = r.id
    WHERE r.name = $1 AND j.status = 'success'
    ORDER BY ja.created_at DESC
    LIMIT 50
  "#
    )
    .bind(&repo_name)
    .fetch_all(&state.db).await
    .map_err(|e| e.to_string())?;

  let releases: Vec<Value> = rows
    .iter()
    .map(|r| {
      json!({
        "id": r.get::<Uuid, _>("id"),
        "name": r.get::<String, _>("name"),
        "size": r.get::<i64, _>("size"),
        "hash": r.get::<String, _>("blob_hash"),
        "date": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
        "commit_id": r.get::<Uuid, _>("commit_id"),
        "commit_msg": r.get::<String, _>("commit_message"),
        "download_url": format!("/repos/{}/releases/{}/download", repo_name, r.get::<Uuid, _>("id")) 
      })
    })
    .collect();

  Ok(Json(json!(releases)))
}

pub async fn download_artifact(
  State(state): State<Arc<AppState>>,
  Path((_repo_name, artifact_id)): Path<(String, Uuid)>
) -> impl IntoResponse {
  let row = sqlx
    ::query("SELECT blob_hash, name, mime_type FROM job_artifacts WHERE id = $1")
    .bind(artifact_id)
    .fetch_optional(&state.db).await
    .unwrap_or(None);

  if let Some(r) = row {
    let hash: String = r.get("blob_hash");
    let name: String = r.get("name");
    let mime: String = r.get::<Option<String>, _>("mime_type").unwrap_or("application/octet-stream".to_string());

    if let Ok(bytes) = state.bucket.get_object(&hash).await {
      let mut headers = axum::http::HeaderMap::new();
      headers.insert(axum::http::header::CONTENT_TYPE, mime.parse().unwrap());
      headers.insert(axum::http::header::CONTENT_DISPOSITION, format!("attachment; filename=\"{}\"", name).parse().unwrap());
      return (headers, axum::body::Body::from(bytes.to_vec())).into_response();
    }
  }
  (StatusCode::NOT_FOUND, "Artifact not found").into_response()
}

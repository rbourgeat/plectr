use axum::{ extract::{ State, Path }, Json, http::StatusCode };
use serde_json::{ json, Value };
use std::sync::Arc;
use crate::{ state::AppState, auth::AuthUser };
use uuid::Uuid;
use rand::{ distributions::Alphanumeric, Rng };
use sqlx::Row;

pub async fn list_runners(State(state): State<Arc<AppState>>, user: AuthUser) -> Result<Json<Value>, (StatusCode, String)> {
  check_admin(&state, user.id).await?;

  let runners = sqlx
    ::query(
      r#"
    SELECT 
      id, name, platform, hostname, version, tags,
      last_heartbeat_at,
      (EXTRACT(EPOCH FROM (NOW() - last_heartbeat_at)) < 30) as is_online,
      (SELECT COUNT(*) FROM jobs WHERE runner_id = runners.id AND status = 'running') as active_jobs
    FROM runners
    ORDER BY is_online DESC, name ASC
    "#
    )
    .fetch_all(&state.db).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  let json_runners: Vec<Value> = runners
    .iter()
    .map(
      |r|
        json!({
    "id": r.get::<Uuid, _>("id"),
    "name": r.get::<String, _>("name"),
    "platform": r.get::<Option<String>, _>("platform"),
    "hostname": r.get::<Option<String>, _>("hostname"),
    "online": r.get::<Option<bool>, _>("is_online").unwrap_or(false),
    "last_seen": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_heartbeat_at").map(|d| d.to_rfc3339()),
    "active_jobs": r.get::<i64, _>("active_jobs"),
    "tags": r.get::<Option<Vec<String>>, _>("tags")
  })
    )
    .collect();

  Ok(Json(json!(json_runners)))
}

pub async fn create_runner_token(
  State(state): State<Arc<AppState>>,
  user: AuthUser,
  Json(payload): Json<serde_json::Value>
) -> Result<Json<Value>, (StatusCode, String)> {
  check_admin(&state, user.id).await?;

  let name = payload["name"].as_str().unwrap_or("unnamed-runner");
  let rand_string: String = rand::thread_rng().sample_iter(&Alphanumeric).take(32).map(char::from).collect();
  let token = format!("plectr_run_{}", rand_string);

  sqlx
    ::query("INSERT INTO runners (name, token, platform) VALUES ($1, $2, 'unknown')")
    .bind(name)
    .bind(&token)
    .execute(&state.db).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  Ok(Json(json!({ "token": token, "name": name })))
}

pub async fn delete_runner(
  State(state): State<Arc<AppState>>,
  user: AuthUser,
  Path(runner_id): Path<Uuid>
) -> Result<Json<Value>, (StatusCode, String)> {
  check_admin(&state, user.id).await?;
  sqlx
    ::query("DELETE FROM runners WHERE id = $1")
    .bind(runner_id)
    .execute(&state.db).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
  Ok(Json(json!({ "status": "deleted" })))
}

async fn check_admin(state: &Arc<AppState>, user_id: Uuid) -> Result<(), (StatusCode, String)> {
  let is_admin = sqlx
    ::query("SELECT is_system_admin FROM users WHERE id = $1")
    .bind(user_id)
    .fetch_optional(&state.db).await
    .unwrap_or(None)
    .map(|r| r.get::<Option<bool>, _>("is_system_admin").unwrap_or(false))
    .unwrap_or(false);

  if !is_admin {
    return Err((StatusCode::FORBIDDEN, "System Admin privileges required".to_string()));
  }
  Ok(())
}

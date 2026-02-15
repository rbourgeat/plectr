use axum::{ extract::{ Path, State }, http::StatusCode, response::IntoResponse, Json };
use serde_json::json;
use std::sync::Arc;
use crate::state::AppState;

pub async fn check_repo_name(State(state): State<Arc<AppState>>, Path(name): Path<String>) -> impl IntoResponse {
  let exists = sqlx::query("SELECT 1 FROM repositories WHERE name = $1").bind(&name).fetch_optional(&state.db).await.unwrap_or(None).is_some();

  if exists {
    (StatusCode::CONFLICT, Json(json!({ "available": false, "message": "Repository name already taken" })))
  } else {
    (StatusCode::OK, Json(json!({ "available": true, "message": "Name available" })))
  }
}

pub async fn check_username(State(state): State<Arc<AppState>>, Path(username): Path<String>) -> impl IntoResponse {
  let exists = sqlx::query("SELECT 1 FROM users WHERE username = $1").bind(&username).fetch_optional(&state.db).await.unwrap_or(None).is_some();

  if exists {
    (StatusCode::CONFLICT, Json(json!({ "available": false, "message": "Username already taken" })))
  } else {
    (StatusCode::OK, Json(json!({ "available": true, "message": "Username available" })))
  }
}

use axum::{ extract::{ State, Path }, Json, http::StatusCode };
use serde::{ Deserialize };
use serde_json::{ json, Value };
use std::sync::Arc;
use std::path::Path as StdPath;
use uuid::Uuid;
use sqlx::Row;
use tokio::process::Command;
use tokio::fs;
use anyhow::{ anyhow, Context, Result };
use tempfile::TempDir;

use crate::{ state::AppState, auth::RepoAdminGuard, crypto };

#[derive(Deserialize)]
pub struct MirrorConfig {
  pub remote_url: String,
  pub token: String,
  pub enabled: bool,
}

pub async fn save_mirror_config(
  State(state): State<Arc<AppState>>,
  guard: RepoAdminGuard,
  Path(_repo_name): Path<String>,
  Json(payload): Json<MirrorConfig>
) -> Result<Json<Value>, (StatusCode, String)> {
  let encrypted = crypto::encrypt(&payload.token).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Crypto Error: {}", e)))?;

  sqlx
    ::query(
      r#"
    INSERT INTO repo_mirrors (repo_id, remote_url, encrypted_token, iv, is_enabled)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (repo_id) DO UPDATE SET
      remote_url = EXCLUDED.remote_url,
      encrypted_token = EXCLUDED.encrypted_token,
      iv = EXCLUDED.iv,
      is_enabled = EXCLUDED.is_enabled,
      last_status = 'pending',
      last_error = NULL
    "#
    )
    .bind(guard.0.repo_id)
    .bind(&payload.remote_url)
    .bind(&encrypted.ciphertext)
    .bind(&encrypted.iv)
    .bind(payload.enabled)
    .execute(&state.db).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  Ok(Json(json!({ "status": "configured", "encrypted": true })))
}

pub async fn get_mirror_status(State(state): State<Arc<AppState>>, guard: RepoAdminGuard, Path(_repo_name): Path<String>) -> Result<Json<Value>, (StatusCode, String)> {
  let row = sqlx
    ::query("SELECT remote_url, is_enabled, last_sync_at, last_status, last_error FROM repo_mirrors WHERE repo_id = $1")
    .bind(guard.0.repo_id)
    .fetch_optional(&state.db).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

  match row {
    Some(r) =>
      Ok(
        Json(
          json!({
      "configured": true,
      "remote_url": r.get::<String, _>("remote_url"),
      "enabled": r.get::<bool, _>("is_enabled"),
      "last_sync": r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_sync_at"),
      "status": r.get::<String, _>("last_status"),
      "error": r.get::<Option<String>, _>("last_error")
    })
        )
      ),
    None => Ok(Json(json!({ "configured": false }))),
  }
}

pub async fn trigger_sync_background(state: Arc<AppState>, repo_id: Uuid) {
  tokio::spawn(async move {
    if let Err(e) = process_sync(state.clone(), repo_id).await {
      tracing::error!("❌ Mirror Sync Failed for {}: {}", repo_id, e);

      let _ = sqlx::query("UPDATE repo_mirrors SET last_status = 'failed', last_error = $2 WHERE repo_id = $1").bind(repo_id).bind(e.to_string()).execute(&state.db).await;
    }
  });
}

async fn process_sync(state: Arc<AppState>, repo_id: Uuid) -> Result<()> {
  let config = sqlx
    ::query("SELECT remote_url, encrypted_token, iv FROM repo_mirrors WHERE repo_id = $1 AND is_enabled = TRUE")
    .bind(repo_id)
    .fetch_optional(&state.db).await?
    .ok_or_else(|| anyhow!("Sync disabled or not configured"))?;

  let remote_url_raw: String = config.get("remote_url");
  let enc_token: String = config.get("encrypted_token");
  let iv: String = config.get("iv");

  let token = crypto::decrypt(&enc_token, &iv).context("Failed to decrypt access token")?;

  let commit = sqlx
    ::query("SELECT id, message, author_name, author_email FROM commits WHERE repo_id = $1 ORDER BY created_at DESC LIMIT 1")
    .bind(repo_id)
    .fetch_optional(&state.db).await?
    .ok_or_else(|| anyhow!("Repository is void"))?;

  let commit_id: Uuid = commit.get("id");
  let author_name: String = commit.get("author_name");
  let author_email: String = commit.get("author_email");
  let message: String = commit.get("message");

  let temp_dir = TempDir::new().context("Failed to create temp dir")?;
  let repo_path = temp_dir.path();
  tracing::info!("🔄 Syncing {} in ephemeral workspace {:?}", repo_id, repo_path);

  let files = sqlx::query("SELECT cf.file_path, b.hash FROM commit_files cf JOIN blobs b ON cf.blob_hash = b.hash WHERE cf.commit_id = $1").bind(commit_id).fetch_all(&state.db).await?;

  for file in files {
    let path: String = file.get("file_path");
    let hash: String = file.get("hash");

    let full_path = repo_path.join(&path);
    if let Some(parent) = full_path.parent() {
      fs::create_dir_all(parent).await?;
    }

    let content = state.bucket.get_object(&hash).await.map_err(|e| anyhow!("S3 Error: {}", e))?;
    fs::write(&full_path, content.as_slice()).await?;
  }

  run_git(repo_path, &["init"], false).await?;

  run_git(repo_path, &["config", "user.name", &author_name], false).await?;
  run_git(repo_path, &["config", "user.email", &author_email], false).await?;

  run_git(repo_path, &["branch", "-m", "main"], false).await?;

  let clean_url = remote_url_raw.trim_start_matches("https://").trim_start_matches("http://");
  let authenticated_url = format!("https://oauth2:{}@{}", token, clean_url);

  run_git(repo_path, &["remote", "add", "origin", &authenticated_url], true).await?;

  run_git(repo_path, &["add", "."], false).await?;
  run_git(repo_path, &["commit", "-m", &format!("{} (Plectr Sync)", message)], false).await?;

  tracing::info!("🚀 Pushing to remote...");
  run_git(repo_path, &["push", "--force", "origin", "main"], true).await?;

  let _ = sqlx::query("UPDATE repo_mirrors SET last_sync_at = NOW(), last_status = 'success', last_error = NULL WHERE repo_id = $1").bind(repo_id).execute(&state.db).await;

  tracing::info!("✅ Mirror Sync Successful for {}", repo_id);
  Ok(())
}

async fn run_git(cwd: &StdPath, args: &[&str], sensitive: bool) -> Result<()> {
  let output = Command::new("git").current_dir(cwd).args(args).output().await.context("Failed to execute git binary")?;

  if !output.status.success() {
    if sensitive {
      return Err(anyhow!("Git Error: Command failed (Arguments hidden for security). Check remote URL permissions."));
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    return Err(anyhow!("Git Error [{}]: {}", args[0], stderr.trim()));
  }
  Ok(())
}

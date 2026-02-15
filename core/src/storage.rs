use crate::state::AppState;
use anyhow::{ Context, Result };
use axum::extract::multipart::Field;
use futures::StreamExt;
use std::sync::Arc;
use crate::ai;

pub struct BlobInfo {
  pub hash: String,
  pub size: i64,
  pub mime_type: String,
  pub existed: bool,
}

pub async fn ingest_file(state: Arc<AppState>, mut field: Field<'_>) -> Result<BlobInfo> {
  let file_name = field.file_name().unwrap_or("unknown").to_string();
  let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();

  let mut data = Vec::new();
  while let Some(chunk) = field.next().await {
    data.extend_from_slice(&chunk.context("Failed to read chunk")?);
  }
  let size = data.len() as i64;
  let hash = blake3::hash(&data).to_hex().to_string();

  let mut metadata = serde_json::Value::Null;
  if file_name.ends_with(".safetensors") {
    if let Ok(info) = ai::analyze_safetensors(&data) {
      metadata = info;
    }
  }

  let exists = sqlx::query("SELECT 1 FROM blobs WHERE hash = $1").bind(&hash).fetch_optional(&state.db).await?.is_some();

  if exists {
    return Ok(BlobInfo { hash, size, mime_type: content_type, existed: true });
  }

  state.bucket.put_object(&hash, &data).await.context("S3 Upload failed")?;

  sqlx
    ::query("INSERT INTO blobs (hash, size, mime_type, storage_path, metadata) VALUES ($1, $2, $3, $4, $5)")
    .bind(&hash)
    .bind(size)
    .bind(&content_type)
    .bind(&hash)
    .bind(&metadata)
    .execute(&state.db).await?;

  Ok(BlobInfo { hash, size, mime_type: content_type, existed: false })
}

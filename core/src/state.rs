use sqlx::PgPool;
use s3::Bucket;
use dashmap::DashMap;
use axum::extract::ws::Message;
use tokio::sync::mpsc;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
  pub db: PgPool,
  pub bucket: Bucket,
  pub active_runners: DashMap<Uuid, mpsc::UnboundedSender<Message>>,
}

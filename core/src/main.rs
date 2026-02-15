mod ai;
mod auth;
mod analytics;
mod diff;
mod registry;
mod repo;
mod state;
mod storage;
mod validation;
mod crypto;
mod mirror;
mod pipeline;
mod admin;

use dashmap::DashMap;
use anyhow::{ Context, Result };
use axum::{ extract::{ Multipart, State, DefaultBodyLimit }, routing::{ get, post, put, delete }, Json, Router };
use s3::bucket::Bucket;
use s3::creds::Credentials;
use s3::region::Region;
use serde_json::{ json, Value };
use sqlx::postgres::PgPoolOptions;
use std::{ net::SocketAddr, sync::Arc };
use state::AppState;
use tower_http::cors::{ CorsLayer, Any };

#[tokio::main]
async fn main() -> Result<()> {
  if std::env::var("ENCRYPTION_KEY").is_err() {
    tracing::warn!("⚠️ ENCRYPTION_KEY not set! Mirroring feature will crash.");
  }
  dotenv::dotenv().ok();
  tracing_subscriber::fmt::init();

  let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
  let pool = PgPoolOptions::new()
    .max_connections(50)
    .acquire_timeout(std::time::Duration::from_secs(10))
    .connect(&database_url).await
    .context("Could not connect to database")?;

  tracing::info!("⚙️  Synchronizing Forge Schema...");
  let migrator = sqlx::migrate::Migrator::new(std::path::Path::new("./migrations")).await.context("Failed to load migrations from disk")?;
  migrator.run(&pool).await.context("Failed to apply database migrations")?;

  let bucket_name = "plectr-blobs";
  let s3_endpoint = std::env::var("S3_ENDPOINT").unwrap_or_else(|_| "http://localhost:8333".to_string());

  let region = Region::Custom {
    region: "us-east-1".to_owned(),
    endpoint: s3_endpoint,
  };
  let credentials = Credentials::new(Some("any"), Some("any"), None, None, None)?;

  let bucket = Bucket::new(bucket_name, region.clone(), credentials.clone())?.with_path_style();

  match bucket.list("".to_string(), Some("/".to_string())).await {
    Ok(_) => {
      tracing::info!("✅ Storage connected");
    }
    Err(_) => {
      let _ = Bucket::create_with_path_style(bucket_name, region, credentials, s3::bucket_ops::BucketConfiguration::default()).await;
    }
  }

  let state = Arc::new(AppState {
    db: pool,
    bucket,
    active_runners: DashMap::new(),
  });

  let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any);

  let app = Router::new()
    .route("/", get(root))
    .route("/api/me", get(auth::get_me).patch(auth::update_profile))
    .route("/api/check/repo/:name", get(validation::check_repo_name))
    .route("/api/check/user/:name", get(validation::check_username))

    .route("/upload", post(upload_handler))
    .route("/repos", post(repo::create_repo).get(repo::list_repos))
    .route("/repos/:name", axum::routing::patch(repo::update_repo).delete(repo::delete_repo))
    .route("/repos/:name/head", get(repo::get_head_commit))
    .route("/repos/:name/commits", get(repo::list_repo_commits).post(repo::create_commit))
    .route("/repos/:name/merge", post(repo::merge_commits))
    .route("/repos/:name/mirror", get(mirror::get_mirror_status).post(mirror::save_mirror_config))
    .route("/repos/:name/commits/:commit_id/tree", get(repo::list_commit_files))
    .route("/repos/:name/commits/:commit_id/files/*path", get(repo::get_file_content))
    .route("/repos/:name/commits/:commit_id/metadata/*path", get(repo::get_file_metadata))
    .route("/analytics/repos/:name/commits/:commit_id/files/*path", post(analytics::run_query))
    .route("/repos/:name/compare", post(repo::compare_blobs))
    .route("/repos/:name/images", get(registry::list_repo_images))
    .route("/repos/:name/images/:digest/config", get(registry::inspect_image_config))
    .route("/repos/:name/members", get(repo::list_repo_members).post(repo::add_repo_member))

    // --- DOCKER REGISTRY V2 ---

    .route("/v2/", get(registry::v2_base_check).head(registry::v2_base_check))
    .route("/v2/:name/blobs/:digest", get(registry::head_blob).head(registry::head_blob))
    .route("/v2/:name/blobs/uploads/", post(registry::start_upload))
    .route("/v2/:name/blobs/uploads/:uuid", put(registry::complete_upload).patch(registry::complete_upload))
    .route("/v2/:name/manifests/:reference", put(registry::put_manifest).get(registry::get_manifest).head(registry::head_manifest))
    .route("/v2/:ns/:img/blobs/:digest", get(registry::head_blob_ns).head(registry::head_blob_ns))
    .route("/v2/:ns/:img/blobs/uploads/", post(registry::start_upload_ns))
    .route("/v2/:ns/:img/blobs/uploads/:uuid", put(registry::complete_upload_ns).patch(registry::complete_upload_ns))
    .route(
      "/v2/:ns/:img/manifests/:reference",
      put(registry::put_manifest_ns).get(registry::get_manifest_ns).head(registry::head_manifest_ns)
    )

    .route("/api/runner/ws", get(pipeline::runner_ws_handler))
    .route("/repos/:name/pipelines", get(pipeline::list_pipelines))
    .route("/repos/:name/pipelines/:id", get(pipeline::get_pipeline_details))

    .route("/repos/:name/pipelines/artifacts", post(pipeline::upload_job_artifact))
    .route("/api/runner/jobs/:id/artifacts", post(pipeline::upload_job_artifact))

    .route("/repos/:name/releases", get(pipeline::list_repo_releases))
    .route("/repos/:name/releases/:id/download", get(pipeline::download_artifact))

    .route("/api/admin/runners", get(admin::list_runners).post(admin::create_runner_token))
    .route("/api/admin/runners/:id", delete(admin::delete_runner))

    .layer(DefaultBodyLimit::disable())
    .layer(cors)
    .with_state(state);

  let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
  tracing::info!("🚀 PLECTR Core listening on {}", addr);

  let listener = tokio::net::TcpListener::bind(addr).await?;
  axum::serve(listener, app).await?;

  Ok(())
}

async fn root() -> &'static str {
  "PLECTR Core: Online & Resonating."
}

async fn upload_handler(State(state): State<Arc<AppState>>, mut multipart: Multipart) -> Json<Value> {
  let mut uploaded_blobs = Vec::new();
  while let Ok(Some(field)) = multipart.next_field().await {
    if let Ok(info) = storage::ingest_file(state.clone(), field).await {
      uploaded_blobs.push(json!({ "hash": info.hash, "size": info.size, "mime_type": info.mime_type }));
    }
  }
  Json(json!({ "status": "ok", "blobs": uploaded_blobs }))
}

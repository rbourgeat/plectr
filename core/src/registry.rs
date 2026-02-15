use axum::{ body::Bytes, extract::{ Path, Query, State }, http::{ header, StatusCode, HeaderMap }, response::IntoResponse, Json };
use serde::Deserialize;
use serde_json::{ json, Value };
use std::sync::Arc;
use uuid::Uuid;
use sha2::{ Sha256, Digest };
use crate::state::AppState;
use futures::StreamExt;
use sqlx::Row;
use base64::{ Engine as _, engine::general_purpose };

#[derive(Deserialize)]
pub struct DigestQuery {
  digest: Option<String>,
}

fn docker_headers() -> HeaderMap {
  let mut h = HeaderMap::new();
  h.insert("Docker-Distribution-Api-Version", "registry/2.0".parse().unwrap());
  h
}

async fn check_docker_access(
  state: &Arc<AppState>,
  full_image_name: &str,
  headers: &HeaderMap,
  require_write: bool
) -> Result<(), (StatusCode, HeaderMap, String)> {
  let parts: Vec<&str> = full_image_name.splitn(2, '/').collect();
  let plectr_repo_name = parts[0];

  let user_info = if let Some(auth_val) = headers.get("Authorization") {
    let auth_str = auth_val.to_str().unwrap_or("");
    let token_opt = if auth_str.starts_with("Basic ") {
      let payload = auth_str.strip_prefix("Basic ").unwrap();
      if let Ok(decoded) = general_purpose::STANDARD.decode(payload) {
        let creds = String::from_utf8(decoded).unwrap_or_default();
        creds
          .splitn(2, ':')
          .nth(1)
          .map(|s| s.to_string())
      } else {
        None
      }
    } else if auth_str.starts_with("Bearer ") {
      auth_str.strip_prefix("Bearer ").map(|s| s.to_string())
    } else {
      None
    };

    if let Some(token) = token_opt {
      let parts: Vec<&str> = token.split('.').collect();
      if parts.len() == 3 {
        if let Ok(claims_bytes) = general_purpose::URL_SAFE_NO_PAD.decode(parts[1]) {
          if let Ok(claims) = serde_json::from_slice::<crate::auth::Claims>(&claims_bytes) {
            if let Ok(uid) = Uuid::parse_str(&claims.sub) {
              Some((uid, claims.preferred_username.unwrap_or("docker".to_string()), claims.email.unwrap_or_default()))
            } else {
              tracing::warn!("🐳 Docker Auth: Invalid UUID in token");
              None
            }
          } else {
            tracing::warn!("🐳 Docker Auth: Invalid Claims");
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

  let user_id = user_info.as_ref().map(|u| u.0);

  let row = sqlx
    ::query(
      r#"
    SELECT r.id, r.is_public, rm.role::text 
    FROM repositories r
    LEFT JOIN repository_members rm ON r.id = rm.repo_id AND rm.user_id = $2
    WHERE r.name = $1
    "#
    )
    .bind(plectr_repo_name)
    .bind(user_id)
    .fetch_optional(&state.db).await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, docker_headers(), e.to_string()))?;

  match row {
    Some(r) => {
      let is_public: bool = r.get("is_public");
      let role: Option<String> = r.get("role");

      if require_write {
        if user_id.is_none() {
          let mut h = docker_headers();
          h.insert("Www-Authenticate", "Basic realm=\"Registry Realm\"".parse().unwrap());
          return Err((StatusCode::UNAUTHORIZED, h, "Authentication required".to_string()));
        }

        if role.is_some() && role.as_deref() != Some("viewer") {
          return Ok(());
        }
        return Err((StatusCode::FORBIDDEN, docker_headers(), "Write access denied".to_string()));
      } else {
        if is_public || role.is_some() {
          return Ok(());
        }

        if user_id.is_none() {
          let mut h = docker_headers();
          h.insert("Www-Authenticate", "Basic realm=\"Registry Realm\"".parse().unwrap());
          return Err((StatusCode::UNAUTHORIZED, h, "Authentication required".to_string()));
        }
        return Err((StatusCode::FORBIDDEN, docker_headers(), "Read access denied".to_string()));
      }
    }
    None => {
      if !require_write {
        return Err((StatusCode::NOT_FOUND, docker_headers(), "Repository not found".to_string()));
      }

      if let Some((uid, username, email)) = user_info {
        let _ = sqlx
          ::query("INSERT INTO users (id, username, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING")
          .bind(uid)
          .bind(&username)
          .bind(&email)
          .execute(&state.db).await;

        let repo_uuid = Uuid::new_v4();
        let create_res = sqlx
          ::query("INSERT INTO repositories (id, name, description, is_public) VALUES ($1, $2, 'Auto-created via Docker Push', FALSE)")
          .bind(repo_uuid)
          .bind(plectr_repo_name)
          .execute(&state.db).await;

        if create_res.is_err() {
          return Err((StatusCode::INTERNAL_SERVER_ERROR, docker_headers(), "Failed to auto-create repo".to_string()));
        }

        let _ = sqlx
          ::query("INSERT INTO repository_members (repo_id, user_id, role) VALUES ($1, $2, 'admin')")
          .bind(repo_uuid)
          .bind(uid)
          .execute(&state.db).await;

        tracing::info!("🐳 Auto-created Docker repository: {}", plectr_repo_name);
        return Ok(());
      }

      let mut h = docker_headers();
      h.insert("Www-Authenticate", "Basic realm=\"Registry Realm\"".parse().unwrap());
      return Err((StatusCode::UNAUTHORIZED, h, "Authentication required to create repository".to_string()));
    }
  }
}

pub async fn v2_base_check() -> impl IntoResponse {
  let mut h = docker_headers();
  h.insert("Www-Authenticate", "Basic realm=\"Registry Realm\"".parse().unwrap());
  (StatusCode::OK, h, Json(json!({})))
}

async fn head_blob_logic(state: Arc<AppState>, headers: HeaderMap, name: String, digest: String) -> impl IntoResponse {
  if let Err(e) = check_docker_access(&state, &name, &headers, false).await {
    return e.into_response();
  }
  let hash = digest.strip_prefix("sha256:").unwrap_or(&digest);
  let exists = sqlx::query("SELECT size FROM blobs WHERE sha256 = $1").bind(hash).fetch_optional(&state.db).await.unwrap_or(None);
  match exists {
    Some(row) => {
      let size: i64 = row.get("size");
      let mut h = docker_headers();
      h.insert(header::CONTENT_LENGTH, size.to_string().parse().unwrap());
      h.insert("Docker-Content-Digest", digest.parse().unwrap());
      (StatusCode::OK, h, "").into_response()
    }
    None => (StatusCode::NOT_FOUND, docker_headers(), "").into_response(),
  }
}

async fn start_upload_logic(state: Arc<AppState>, headers: HeaderMap, name: String) -> impl IntoResponse {
  if let Err(e) = check_docker_access(&state, &name, &headers, true).await {
    return e.into_response();
  }
  let uuid = Uuid::new_v4();
  let _ = sqlx::query("INSERT INTO docker_uploads (uuid, repo_name) VALUES ($1, $2)").bind(uuid).bind(&name).execute(&state.db).await;
  let mut h = docker_headers();
  let location = format!("/v2/{}/blobs/uploads/{}", name, uuid);
  h.insert(header::LOCATION, location.parse().unwrap());
  h.insert("Range", "0-0".parse().unwrap());
  (StatusCode::ACCEPTED, h, "").into_response()
}

async fn complete_upload_logic(
  state: Arc<AppState>,
  headers: HeaderMap,
  name: String,
  uuid: String,
  digest_opt: Option<String>,
  body: axum::body::Body
) -> impl IntoResponse {
  if let Err(e) = check_docker_access(&state, &name, &headers, true).await {
    return e.into_response();
  }
  let expected_digest = match digest_opt {
    Some(d) => d,
    None => {
      return (StatusCode::BAD_REQUEST, docker_headers(), "Missing digest").into_response();
    }
  };

  let mut stream = body.into_data_stream();
  let mut data = Vec::new();
  let mut hasher_sha256 = Sha256::new();
  let mut hasher_blake3 = blake3::Hasher::new();

  while let Some(chunk) = stream.next().await {
    match chunk {
      Ok(bytes) => {
        data.extend_from_slice(&bytes);
        hasher_sha256.update(&bytes);
        hasher_blake3.update(&bytes);
      }
      Err(_) => {
        return (StatusCode::INTERNAL_SERVER_ERROR, docker_headers(), "Stream error").into_response();
      }
    }
  }

  let calculated_sha256 = format!("sha256:{:x}", hasher_sha256.finalize());
  let calculated_blake3 = hasher_blake3.finalize().to_hex().to_string();

  if calculated_sha256 != expected_digest {
    return (StatusCode::BAD_REQUEST, docker_headers(), "Digest mismatch").into_response();
  }

  if let Err(e) = state.bucket.put_object(&calculated_blake3, &data).await {
    return (StatusCode::INTERNAL_SERVER_ERROR, docker_headers(), e.to_string()).into_response();
  }

  let sha256_clean = calculated_sha256.strip_prefix("sha256:").unwrap();
  let size = data.len() as i64;

  let _ = sqlx
    ::query(
      "INSERT INTO blobs (hash, sha256, size, mime_type, storage_path) VALUES ($1, $2, $3, 'application/vnd.docker.image.rootfs.diff.tar.gzip', $1) ON CONFLICT (hash) DO UPDATE SET sha256 = $2"
    )
    .bind(&calculated_blake3)
    .bind(sha256_clean)
    .bind(size)
    .execute(&state.db).await;

  let _ = sqlx::query("DELETE FROM docker_uploads WHERE uuid = $1").bind(Uuid::parse_str(&uuid).unwrap_or_default()).execute(&state.db).await;

  let mut h = docker_headers();
  h.insert("Docker-Content-Digest", calculated_sha256.parse().unwrap());
  h.insert(header::LOCATION, format!("/v2/{}/blobs/{}", name, calculated_sha256).parse().unwrap());
  (StatusCode::CREATED, h, "").into_response()
}

async fn put_manifest_logic(state: Arc<AppState>, headers: HeaderMap, name: String, tag: String, body: Bytes) -> impl IntoResponse {
  if let Err(e) = check_docker_access(&state, &name, &headers, true).await {
    return e.into_response();
  }
  let mut hasher = Sha256::new();
  hasher.update(&body);
  let digest = format!("sha256:{:x}", hasher.finalize());
  let manifest: Value = match serde_json::from_slice(&body) {
    Ok(v) => v,
    Err(_) => {
      return (StatusCode::BAD_REQUEST, docker_headers(), "Invalid JSON").into_response();
    }
  };

  let parts: Vec<&str> = name.splitn(2, '/').collect();
  let plectr_repo_name = parts[0];

  let repo_row = sqlx
    ::query("SELECT id FROM repositories WHERE name = $1")
    .bind(plectr_repo_name)
    .fetch_optional(&state.db).await
    .unwrap_or(None);

  let repo_id = match repo_row {
    Some(r) => r.get::<Uuid, _>("id"),
    None => {
      return (StatusCode::INTERNAL_SERVER_ERROR, docker_headers(), "Repo missing after check").into_response();
    }
  };

  let _ = sqlx
    ::query("INSERT INTO docker_repositories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name")
    .bind(&name)
    .execute(&state.db).await;

  let docker_repo_id_row = sqlx::query("SELECT id FROM docker_repositories WHERE name = $1").bind(&name).fetch_one(&state.db).await;
  let docker_repo_id: Uuid = docker_repo_id_row.unwrap().get("id");

  let _ = sqlx
    ::query(
      "INSERT INTO docker_manifests (digest, repo_id, content) VALUES ($1, $2, $3) ON CONFLICT (digest) DO UPDATE SET content = EXCLUDED.content"
    )
    .bind(&digest)
    .bind(docker_repo_id)
    .bind(&manifest)
    .execute(&state.db).await;

  let _ = sqlx
    ::query(
      "INSERT INTO docker_tags (repo_id, tag, manifest_digest) VALUES ($1, $2, $3) ON CONFLICT (repo_id, tag) DO UPDATE SET manifest_digest = $3, updated_at = NOW()"
    )
    .bind(docker_repo_id)
    .bind(&tag)
    .bind(&digest)
    .execute(&state.db).await;

  let mut h = docker_headers();
  h.insert("Docker-Content-Digest", digest.parse().unwrap());
  h.insert(header::LOCATION, format!("/v2/{}/manifests/{}", name, digest).parse().unwrap());
  (StatusCode::CREATED, h, "").into_response()
}

async fn get_manifest_logic(state: Arc<AppState>, headers: HeaderMap, name: String, reference: String, is_head: bool) -> impl IntoResponse {
  if let Err(e) = check_docker_access(&state, &name, &headers, false).await {
    return e.into_response();
  }

  let row = sqlx
    ::query(
      r#"
    SELECT m.digest, m.content 
    FROM docker_manifests m
    JOIN docker_repositories r ON m.repo_id = r.id
    LEFT JOIN docker_tags t ON t.repo_id = r.id AND t.manifest_digest = m.digest
    WHERE r.name = $1 AND (t.tag = $2 OR m.digest = $2)
    LIMIT 1
    "#
    )
    .bind(&name)
    .bind(&reference)
    .fetch_optional(&state.db).await
    .unwrap_or(None);

  match row {
    Some(r) => {
      let digest: String = r.get("digest");
      let content: Value = r.get("content");
      let mut h = docker_headers();
      h.insert("Docker-Content-Digest", digest.parse().unwrap());
      h.insert(header::CONTENT_TYPE, "application/vnd.docker.distribution.manifest.v2+json".parse().unwrap());

      if is_head {
        let size = serde_json::to_vec(&content).unwrap().len();
        h.insert(header::CONTENT_LENGTH, size.to_string().parse().unwrap());
        (StatusCode::OK, h, "").into_response()
      } else {
        (StatusCode::OK, h, Json(content)).into_response()
      }
    }
    None => (StatusCode::NOT_FOUND, docker_headers(), Json(json!({"errors": [{"code": "MANIFEST_UNKNOWN"}]}))).into_response(),
  }
}

pub async fn head_blob(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Path((name, digest)): Path<(String, String)>
) -> impl IntoResponse {
  head_blob_logic(state, headers, name, digest).await
}
pub async fn start_upload(State(state): State<Arc<AppState>>, headers: HeaderMap, Path(name): Path<String>) -> impl IntoResponse {
  start_upload_logic(state, headers, name).await
}
pub async fn complete_upload(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Path((name, uuid)): Path<(String, String)>,
  Query(query): Query<DigestQuery>,
  body: axum::body::Body
) -> impl IntoResponse {
  complete_upload_logic(state, headers, name, uuid, query.digest, body).await
}
pub async fn put_manifest(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Path((name, tag)): Path<(String, String)>,
  body: Bytes
) -> impl IntoResponse {
  put_manifest_logic(state, headers, name, tag, body).await
}
pub async fn get_manifest(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Path((name, reference)): Path<(String, String)>
) -> impl IntoResponse {
  get_manifest_logic(state, headers, name, reference, false).await
}
pub async fn head_manifest(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Path((name, reference)): Path<(String, String)>
) -> impl IntoResponse {
  get_manifest_logic(state, headers, name, reference, true).await
}

pub async fn head_blob_ns(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Path((ns, img, digest)): Path<(String, String, String)>
) -> impl IntoResponse {
  head_blob_logic(state, headers, format!("{}/{}", ns, img), digest).await
}
pub async fn start_upload_ns(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Path((ns, img)): Path<(String, String)>
) -> impl IntoResponse {
  start_upload_logic(state, headers, format!("{}/{}", ns, img)).await
}
pub async fn complete_upload_ns(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Path((ns, img, uuid)): Path<(String, String, String)>,
  Query(query): Query<DigestQuery>,
  body: axum::body::Body
) -> impl IntoResponse {
  complete_upload_logic(state, headers, format!("{}/{}", ns, img), uuid, query.digest, body).await
}
pub async fn put_manifest_ns(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Path((ns, img, tag)): Path<(String, String, String)>,
  body: Bytes
) -> impl IntoResponse {
  put_manifest_logic(state, headers, format!("{}/{}", ns, img), tag, body).await
}
pub async fn get_manifest_ns(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Path((ns, img, reference)): Path<(String, String, String)>
) -> impl IntoResponse {
  get_manifest_logic(state, headers, format!("{}/{}", ns, img), reference, false).await
}
pub async fn head_manifest_ns(
  State(state): State<Arc<AppState>>,
  headers: HeaderMap,
  Path((ns, img, reference)): Path<(String, String, String)>
) -> impl IntoResponse {
  get_manifest_logic(state, headers, format!("{}/{}", ns, img), reference, true).await
}

pub async fn list_repo_images(State(state): State<Arc<AppState>>, Path(repo_name): Path<String>) -> impl IntoResponse {
  let rows = sqlx
    ::query(
      r#"
    SELECT t.tag, m.digest, t.updated_at, m.content, r.name as image_name
    FROM docker_tags t
    JOIN docker_repositories r ON t.repo_id = r.id
    JOIN docker_manifests m ON t.manifest_digest = m.digest
    WHERE r.name = $1 OR r.name LIKE $1 || '/%'
    ORDER BY t.updated_at DESC
    "#
    )
    .bind(&repo_name)
    .fetch_all(&state.db).await
    .unwrap_or_default();

  let images: Vec<Value> = rows
    .iter()
    .map(|r| {
      let content: Value = r.get("content");
      let empty_vec = vec![];
      let layers = content["layers"].as_array().unwrap_or(&empty_vec);
      let size: i64 = layers
        .iter()
        .map(|l| l["size"].as_i64().unwrap_or(0))
        .sum();

      json!({
      "image_name": r.get::<String, _>("image_name"),
      "tag": r.get::<String, _>("tag"),
      "digest": r.get::<String, _>("digest"),
      "updated_at": r.get::<chrono::DateTime<chrono::Utc>, _>("updated_at").to_rfc3339(),
      "size": size,
      "layers_count": layers.len(),
      "content": content
    })
    })
    .collect();

  Json(images)
}

pub async fn inspect_image_config(
  State(state): State<Arc<AppState>>,
  Path((_repo_name, digest)): Path<(String, String)>
) -> impl IntoResponse {
  let row = sqlx
    ::query("SELECT content FROM docker_manifests WHERE digest = $1")
    .bind(&digest)
    .fetch_optional(&state.db).await
    .unwrap_or(None);

  if let Some(r) = row {
    let manifest: Value = r.get("content");
    if let Some(config_digest) = manifest["config"]["digest"].as_str() {
      let clean_sha = config_digest.strip_prefix("sha256:").unwrap_or(config_digest);

      let blob_row = sqlx::query("SELECT hash FROM blobs WHERE sha256 = $1").bind(clean_sha).fetch_optional(&state.db).await.unwrap_or(None);

      if let Some(br) = blob_row {
        let hash: String = br.get("hash");
        if let Ok(response_data) = state.bucket.get_object(&hash).await {
          let bytes = response_data.to_vec();
          let json_config: Value = serde_json::from_slice(&bytes).unwrap_or(json!({}));
          return Json(json_config).into_response();
        }
      }
    }
  }
  (StatusCode::NOT_FOUND, Json(json!({"error": "Config not found"}))).into_response()
}

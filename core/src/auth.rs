use axum::{
  async_trait,
  extract::{ FromRequestParts, Path, State },
  http::{ request::Parts, StatusCode },
  response::{ IntoResponse, Response },
  RequestPartsExt,
  Json,
};
use serde::{ Deserialize, Serialize };
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;
use crate::state::AppState;
use base64::{ Engine as _, engine::general_purpose };

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
  pub sub: String,
  pub preferred_username: Option<String>,
  pub email: Option<String>,
  pub exp: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuthUser {
  pub id: Uuid,
  pub username: String,
  pub email: String,
}

pub trait FromRef<S> {
  fn from_ref(state: &S) -> Self;
}

impl FromRef<Arc<AppState>> for AppState {
  fn from_ref(state: &Arc<AppState>) -> Self {
    state.as_ref().clone()
  }
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser where S: Send + Sync, AppState: FromRef<S> {
  type Rejection = Response;

  async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
    let auth_header = parts.headers
      .get("Authorization")
      .and_then(|h| h.to_str().ok())
      .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Missing Authorization Header").into_response())?;

    if !auth_header.starts_with("Bearer ") {
      return Err((StatusCode::UNAUTHORIZED, "Invalid Token Format").into_response());
    }

    let token = &auth_header[7..];

    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
      return Err((StatusCode::UNAUTHORIZED, "Invalid JWT Structure").into_response());
    }

    let payload_str = parts[1];
    let decoded_bytes = general_purpose::URL_SAFE_NO_PAD
      .decode(payload_str)
      .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid Base64 Token").into_response())?;

    let claims: Claims = serde_json
      ::from_slice(&decoded_bytes)
      .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid Claims JSON").into_response())?;

    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid UID").into_response())?;

    Ok(AuthUser {
      id: user_id,
      username: claims.preferred_username.unwrap_or("unknown".to_string()),
      email: claims.email.unwrap_or("".to_string()),
    })
  }
}

pub async fn get_me(auth: AuthUser) -> Json<AuthUser> {
  Json(auth)
}

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
  pub username: String,
}

pub async fn update_profile(
  State(state): State<Arc<AppState>>,
  auth: AuthUser,
  Json(payload): Json<UpdateProfileRequest>
) -> impl IntoResponse {
  let taken = sqlx
    ::query("SELECT 1 FROM users WHERE username = $1 AND id != $2")
    .bind(&payload.username)
    .bind(auth.id)
    .fetch_optional(&state.db).await
    .unwrap_or(None)
    .is_some();

  if taken {
    return (StatusCode::CONFLICT, Json(json!({ "error": "Username already taken" }))).into_response();
  }

  let res = sqlx::query("UPDATE users SET username = $1 WHERE id = $2").bind(&payload.username).bind(auth.id).execute(&state.db).await;

  match res {
    Ok(_) => (StatusCode::OK, Json(json!({ "status": "updated", "username": payload.username }))).into_response(),
    Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
  }
}

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum RepoPerm {
  None = 0,
  Read = 1,
  Write = 2,
  Admin = 3,
}

pub struct RepoReadGuard {
  pub repo_id: Uuid,
  pub perm: RepoPerm,
}

#[async_trait]
impl<S> FromRequestParts<S> for RepoReadGuard where S: Send + Sync, AppState: FromRef<S> {
  type Rejection = Response;

  async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
    let app_state = AppState::from_ref(state);

    let params: Path<std::collections::HashMap<String, String>> = parts
      .extract().await
      .map_err(|_| (StatusCode::BAD_REQUEST, "Missing repo params").into_response())?;

    let repo_name = params.get("name").ok_or_else(|| (StatusCode::BAD_REQUEST, "Missing repo name").into_response())?;

    let user: Option<AuthUser> = parts.extract_with_state::<Option<AuthUser>, S>(state).await.unwrap_or(None);

    let row = sqlx
      ::query(
        r#"
            SELECT r.id, r.is_public, 
                   rm.role::text as member_role, 
                   om.role::text as org_role
            FROM repositories r
            LEFT JOIN repository_members rm ON r.id = rm.repo_id AND rm.user_id = $2
            LEFT JOIN organization_members om ON r.org_id = om.org_id AND om.user_id = $2
            WHERE r.name = $1
            "#
      )
      .bind(repo_name)
      .bind(user.as_ref().map(|u| u.id))
      .fetch_optional(&app_state.db).await
      .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response())?;

    let row = row.ok_or_else(|| (StatusCode::NOT_FOUND, "Repository not found").into_response())?;

    let id: Uuid = row.try_get("id").unwrap();
    let is_public: bool = row.try_get("is_public").unwrap();
    let member_role: Option<String> = row.try_get("member_role").unwrap_or(None);
    let org_role: Option<String> = row.try_get("org_role").unwrap_or(None);

    if let Some("owner") = org_role.as_deref() {
      return Ok(RepoReadGuard { repo_id: id, perm: RepoPerm::Admin });
    }
    if let Some("admin") = member_role.as_deref() {
      return Ok(RepoReadGuard { repo_id: id, perm: RepoPerm::Admin });
    }
    if let Some("editor") = member_role.as_deref() {
      return Ok(RepoReadGuard { repo_id: id, perm: RepoPerm::Write });
    }
    if let Some(_) = member_role {
      return Ok(RepoReadGuard { repo_id: id, perm: RepoPerm::Read });
    }

    if is_public {
      return Ok(RepoReadGuard { repo_id: id, perm: RepoPerm::Read });
    }

    Err((StatusCode::FORBIDDEN, "Access Denied: Private Repository").into_response())
  }
}

pub struct RepoWriteGuard(pub RepoReadGuard);

#[async_trait]
impl<S> FromRequestParts<S> for RepoWriteGuard where S: Send + Sync, AppState: FromRef<S> {
  type Rejection = Response;
  async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
    let guard = RepoReadGuard::from_request_parts(parts, state).await?;
    if guard.perm >= RepoPerm::Write {
      Ok(RepoWriteGuard(guard))
    } else {
      Err((StatusCode::FORBIDDEN, "Write permission required").into_response())
    }
  }
}

pub struct RepoAdminGuard(pub RepoReadGuard);

#[async_trait]
impl<S> FromRequestParts<S> for RepoAdminGuard where S: Send + Sync, AppState: FromRef<S> {
  type Rejection = Response;
  async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
    let guard = RepoReadGuard::from_request_parts(parts, state).await?;
    if guard.perm >= RepoPerm::Admin {
      Ok(RepoAdminGuard(guard))
    } else {
      Err((StatusCode::FORBIDDEN, "Admin permission required").into_response())
    }
  }
}

pub fn create_system_token() -> anyhow::Result<String> {
  let expiration = chrono::Utc
    ::now()
    .checked_add_signed(chrono::Duration::minutes(15))
    .expect("valid timestamp")
    .timestamp();

  let claims = Claims {
    sub: Uuid::new_v4().to_string(),
    preferred_username: Some("plectr-ci-system".to_string()),
    email: Some("ci@plectr.internal".to_string()),
    exp: expiration as usize,
  };

  let header = jsonwebtoken::Header::default();
  let key = jsonwebtoken::EncodingKey::from_secret("secret".as_ref()); // TODO: Use env var
  Ok(jsonwebtoken::encode(&header, &claims, &key)?)
}

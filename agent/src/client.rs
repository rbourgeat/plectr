use anyhow::Result;
use reqwest::{Client, header};
use std::time::Duration;
use crate::config::GlobalConfig;

pub fn get_authenticated_client() -> Result<Client> {
  let config = GlobalConfig::load()?;
  let mut headers = header::HeaderMap::new();

  if let Some(token) = config.auth_token {
    let auth_val = format!("Bearer {}", token);
    let mut header_val = header::HeaderValue::from_str(&auth_val)?;
    header_val.set_sensitive(true);
    headers.insert(header::AUTHORIZATION, header_val);
  } 

  let client = Client::builder()
    .default_headers(headers)
    .timeout(Duration::from_secs(300))
    .build()?;

  Ok(client)
}
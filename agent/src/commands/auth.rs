use anyhow::Result;
use console::style;
use dialoguer::{Input, theme::ColorfulTheme};
use reqwest::StatusCode;
use crate::{config::GlobalConfig, client::get_authenticated_client};

pub async fn login() -> Result<()> {
  println!("{}", style("🔐 Plectr Authentication Setup").bold().cyan());

  let current_config = GlobalConfig::load()?;

  let url: String = Input::with_theme(&ColorfulTheme::default())
    .with_prompt("Forge URL")
    .default(current_config.server_url)
    .interact_text()?;

  println!("{}", style("ℹ️ To get your token, log in to the Web UI and go to Settings > Tokens").dim());

  let token: String = Input::with_theme(&ColorfulTheme::default())
    .with_prompt("Paste JWT / API Token")
    .interact_text()?;

  let config = GlobalConfig { 
    server_url: url.trim_end_matches('/').to_string(), 
    auth_token: Some(token.trim().to_string()) 
  };
  config.save()?;

  println!("{}", style("✨ Configuration saved.").green());
  whoami().await?; 
  Ok(())
}

pub async fn whoami() -> Result<()> {
  let client = get_authenticated_client()?;
  let config = GlobalConfig::load()?;

  if config.auth_token.is_none() {
    println!("❌ Not logged in.");
    return Ok(());
  }

  let res = client.get(format!("{}/api/me", config.server_url)).send().await;

  match res {
    Ok(r) if r.status().is_success() => {
      let user: serde_json::Value = r.json().await?;
      println!("✅ Connected to {}: {}", style(&config.server_url).cyan(), style("Authenticated").green().bold());
      println!("  User: {} ({})", style(user["username"].as_str().unwrap_or("?")).bold(), user["email"].as_str().unwrap_or("?"));
    },
    Ok(r) if r.status() == StatusCode::UNAUTHORIZED => {
      println!("❌ Authentication failed: Token invalid or expired.");
      println!("  Run {} to refresh credentials.", style("plectr login").bold());
    },
    Err(e) => {
      println!("❌ Connection refused: {}", e);
      println!("  Is the server running at {}?", style(&config.server_url).yellow());
    }
    _ => println!("⚠️ Unknown status from server."),
  }
  Ok(())
}
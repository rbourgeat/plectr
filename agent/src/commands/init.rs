use anyhow::{Result};
use console::style;
use indicatif::ProgressBar;
use reqwest::StatusCode;
use std::{fs, time::Duration};

use crate::{config::{GlobalConfig, LocalRepoConfig}, client::get_authenticated_client};

pub async fn init(name: String, is_public: bool) -> Result<()> {
  let client = get_authenticated_client()?;
  let config = GlobalConfig::load()?;

  let spinner = ProgressBar::new_spinner();
  spinner.set_message("Resonating with Forge...");
  spinner.enable_steady_tick(Duration::from_millis(100));

  let res = client.post(format!("{}/repos", config.server_url))
    .json(&serde_json::json!({
      "name": name,
      "description": "Initialized via CLI",
      "is_public": is_public
    }))
    .send()
    .await?;

  spinner.finish_and_clear();

  if !res.status().is_success() {
    if res.status() == StatusCode::UNAUTHORIZED {
       anyhow::bail!("Unauthorized. Run 'plectr login'.");
    }
    if res.status() == StatusCode::CONFLICT {
       anyhow::bail!("Repository '{}' already exists.", name);
    }
    anyhow::bail!("Failed to init repo: {}", res.text().await?);
  }

  let json: serde_json::Value = res.json().await?;
  let repo_id = json["repo_id"].as_str().unwrap().to_string();

  fs::create_dir_all(".plectr")?;
  let local_config = LocalRepoConfig { repo_name: name.clone(), repo_id, last_commit_id: None };
  fs::write(".plectr/config.json", serde_json::to_string_pretty(&local_config)?)?;

  println!("{} Repo {} initialized successfully.", style("✔").green(), style(name).bold());
  Ok(())
}
use anyhow::{anyhow, Result};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::{fs};

#[derive(Serialize, Deserialize, Default)]
pub struct GlobalConfig {
  pub server_url: String,
  pub auth_token: Option<String>,
}

impl GlobalConfig {
  pub fn load() -> Result<Self> {
    let dirs = ProjectDirs::from("com", "plectr", "plectr")
      .ok_or_else(|| anyhow!("Could not determine config directory"))?;

    let path = dirs.config_dir().join("config.json");

    if !path.exists() {
      return Ok(GlobalConfig { 
        server_url: "https://plectr.com".to_string(), 
        auth_token: None 
      });
    }
    let content = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&content)?)
  }

  pub fn save(&self) -> Result<()> {
    let dirs = ProjectDirs::from("com", "plectr", "plectr")
      .ok_or_else(|| anyhow!("Could not determine config directory"))?;

    fs::create_dir_all(dirs.config_dir())?;
    let content = serde_json::to_string_pretty(self)?;
    fs::write(dirs.config_dir().join("config.json"), content)?;
    Ok(())
  }
}

#[derive(Serialize, Deserialize)]
pub struct LocalRepoConfig {
  pub repo_name: String,
  pub repo_id: String,
  pub last_commit_id: Option<String>,
}

pub fn load_local_config() -> Result<LocalRepoConfig> {
  let content = fs::read_to_string(".plectr/config.json")
    .map_err(|_| anyhow!("Not a Plectr repository. Run 'plectr init' or cd into a repo."))?;
  Ok(serde_json::from_str(&content)?)
}

pub fn save_local_config(config: &LocalRepoConfig) -> Result<()> {
  fs::create_dir_all(".plectr")?;
  fs::write(".plectr/config.json", serde_json::to_string_pretty(config)?)?;
  Ok(())
}
use anyhow::{Context, Result};
use console::style;
use futures::{stream, StreamExt};
use indicatif::{ProgressBar, ProgressStyle};
use reqwest::StatusCode;
use std::{fs, path::Path};
use tokio;

use crate::{config::{GlobalConfig, LocalRepoConfig}, client::get_authenticated_client};

pub async fn clone(name: String) -> Result<()> {
  let client = get_authenticated_client()?;
  let config = GlobalConfig::load()?;

  println!("📡 Accessing Forge: {}...", style(&name).bold());

  let head_res = client.get(format!("{}/repos/{}/head", config.server_url, name)).send().await?;
  let status = head_res.status();

  if status == StatusCode::NOT_FOUND {
    anyhow::bail!("Repository '{}' does not exist or access denied (404).", name);
  }

  if status == StatusCode::FORBIDDEN {
    println!("❌ {}", style("Access Denied (403)").red().bold());
    println!("  The repository '{}' is private or you lack permissions.", style(&name).cyan());
    println!("  👉 Run {} to authenticate.", style("plectr login").yellow().bold());
    anyhow::bail!("Authentication required.");
  }

  if status == StatusCode::UNAUTHORIZED {
    println!("❌ {}", style("Session Expired (401)").red().bold());
    anyhow::bail!("Login required.");
  }

  if !status.is_success() {
    let text = head_res.text().await.unwrap_or_else(|_| "unreadable body".to_string());
    println!("❌ Forge Error [{}]: {}", style(status.as_u16()).red(), text);
    anyhow::bail!("Server rejected resonance request.");
  }

  let head: serde_json::Value = head_res.json().await
    .context("Invalid JSON from Forge. Protocol mismatch.")?;

  let repo_id = head["repo_id"].as_str()
    .context("Invalid protocol: missing repo_id")?
    .to_string();

  let commit_id_opt = head["commit_id"].as_str();

  let root = Path::new(&name);
  if root.exists() {
    anyhow::bail!("Directory '{}' already exists. Cannot clone here.", name);
  }
  fs::create_dir(root)?;

  let pdir = root.join(".plectr");
  fs::create_dir(&pdir)?;

  match commit_id_opt {
    Some(commit_id) => {
      println!("📥 Materializing assets from snapshot {}...", style(&commit_id[..8]).cyan());

      let tree_res = client.get(format!("{}/repos/{}/commits/{}/tree", config.server_url, name, commit_id)).send().await?;
      let files: Vec<serde_json::Value> = tree_res.json().await?;

      let pb = ProgressBar::new(files.len() as u64);
      let pb_style = ProgressStyle::default_bar()
        .template("{spinner:.green} [{bar:40.cyan/blue}] {pos}/{len}")
        .unwrap_or_else(|_| ProgressStyle::default_bar())
        .progress_chars("#>-");
      pb.set_style(pb_style);

      let client_ref = &client;
      let url_ref = &config.server_url;
      let cid_ref = &commit_id;
      let name_ref = &name;
      let root_path = root.to_path_buf();
      let pb_clone = pb.clone();

      stream::iter(files)
        .map(|f| {
          let path_str = f["path"].as_str().unwrap().to_string();
          let c = client_ref.clone();
          let u = url_ref.clone();
          let cid = cid_ref.to_string();
          let rname = name_ref.to_string();
          let r_root = root_path.clone();
          let pb_ref = pb_clone.clone();

          tokio::spawn(async move {
            let target = r_root.join(&path_str);
            if let Some(parent) = target.parent() { fs::create_dir_all(parent).ok(); }

            let file_url = format!("{}/repos/{}/commits/{}/files/{}", u, rname, cid, path_str);
            if let Ok(res) = c.get(file_url).send().await {
              if let Ok(bytes) = res.bytes().await {
                fs::write(target, bytes).ok();
              }
            }
            pb_ref.inc(1);
          })
        })
        .buffer_unordered(10)
        .collect::<Vec<_>>()
        .await;

      pb.finish_and_clear();

      let local_config = LocalRepoConfig { 
        repo_name: name.clone(), 
        repo_id, 
        last_commit_id: Some(commit_id.to_string()) 
      };
      fs::write(pdir.join("config.json"), serde_json::to_string_pretty(&local_config)?)?;

      println!("{} Materialization complete.", style("✔").green());
    },
    None => {
      let local_config = LocalRepoConfig { 
        repo_name: name.clone(), 
        repo_id, 
        last_commit_id: None 
      };
      fs::write(pdir.join("config.json"), serde_json::to_string_pretty(&local_config)?)?;

      println!("{}", style("✨ Void resonance established.").blue());
      println!("  This repository is empty. Add files and run:");
      println!("  $ cd {}", style(&name).bold());
      println!("  $ plectr save -m \"First light\"");
    }
  }

  Ok(())
}
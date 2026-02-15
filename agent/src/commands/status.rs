use anyhow::Result;
use console::style;
use ignore::WalkBuilder;
use std::{ collections::HashMap, fs };
use blake3;

use crate::{ config::{ GlobalConfig, load_local_config }, client::get_authenticated_client };

pub async fn status() -> Result<()> {
  let local_config = load_local_config()?;
  let config = GlobalConfig::load()?;
  let client = get_authenticated_client()?;

  println!("📊 Repository: {}", style(&local_config.repo_name).cyan().bold());
  println!("  Remote ID: {}", style(&local_config.repo_id[..8]).dim());

  let mut remote_files = HashMap::new();
  let mut remote_head_id = None;

  if
    let Ok(res) = client
      .get(format!("{}/repos/{}/head", config.server_url, local_config.repo_name))
      .send().await
  {
    if let Ok(json) = res.json::<serde_json::Value>().await {
      remote_head_id = json["commit_id"].as_str().map(|s| s.to_string());

      println!(
        "  Head:    {}",
        remote_head_id
          .as_ref()
          .map(|s| style(&s[..8]).yellow())
          .unwrap_or(style("VOID").red())
      );

      if let Some(ref id) = remote_head_id {
        if
          let Ok(tree_res) = client
            .get(
              format!("{}/repos/{}/commits/{}/tree", config.server_url, local_config.repo_name, id)
            )
            .send().await
        {
          if let Ok(files) = tree_res.json::<Vec<serde_json::Value>>().await {
            for f in files {
              let path = f["path"].as_str().unwrap().to_string();
              let hash = f["hash"].as_str().unwrap().to_string();
              remote_files.insert(path, hash);
            }
          }
        }
      }
    }
  }
  println!();

  let walker = WalkBuilder::new(".")
    .hidden(false)
    .git_ignore(true)
    .require_git(false)
    .filter_entry(|entry| {
      let name = entry.file_name().to_string_lossy();
      if
        name == ".git" ||
        name == ".plectr" ||
        name == "node_modules" ||
        name == "target" ||
        name == ".next" ||
        name == "dist" ||
        name == "build"
      {
        return false;
      }
      true
    })
    .build();

  let mut modified = Vec::new();
  let mut new_files = Vec::new();
  let mut local_paths = std::collections::HashSet::new();

  for result in walker {
    match result {
      Ok(entry) => {
        let path = entry.path();
        if path.is_dir() {
          continue;
        }
        let path_str = path.to_string_lossy();

        if path_str.contains(".plectr/") || path_str.contains(".git/") {
          continue;
        }

        let rel_path = path.strip_prefix(".").unwrap().to_string_lossy().to_string();
        if
          rel_path.starts_with(".") &&
          !rel_path.starts_with(".env") &&
          !rel_path.starts_with(".gitignore")
        {
          continue;
        }

        local_paths.insert(rel_path.clone());

        let content = fs::read(path)?;
        let local_hash = blake3::hash(&content).to_hex().to_string();

        match remote_files.get(&rel_path) {
          Some(remote_hash) => {
            if *remote_hash != local_hash {
              modified.push(rel_path);
            }
          }
          None => {
            new_files.push(rel_path);
          }
        }
      }
      Err(_) => {
        continue;
      }
    }
  }

  let mut deleted = Vec::new();
  for (remote_path, _) in &remote_files {
    if !local_paths.contains(remote_path) {
      deleted.push(remote_path.clone());
    }
  }

  if modified.is_empty() && new_files.is_empty() && deleted.is_empty() {
    println!("{}", style("✨ Working directory clean. Everything resonates.").green());
    return Ok(());
  }

  if !modified.is_empty() {
    println!("{}", style("Changed files:").bold().yellow());
    for f in modified {
      println!(" {} {}", style("M").yellow().bold(), f);
    }
  }

  if !new_files.is_empty() {
    println!("{}", style("New files (Untracked):").bold().green());
    for f in new_files {
      println!(" {} {}", style("+").green().bold(), f);
    }
  }

  if !deleted.is_empty() {
    println!("{}", style("Deleted files:").bold().red());
    for f in deleted {
      println!(" {} {}", style("-").red().bold(), f);
    }
  }

  println!();
  println!("{}", style("💡 Run 'plectr save' to snapshot these changes.").dim());

  Ok(())
}

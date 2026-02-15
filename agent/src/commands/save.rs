use anyhow::Result;
use console::style;
use futures::{ stream, StreamExt };
use ignore::WalkBuilder;
use indicatif::{ ProgressBar, ProgressStyle };
use std::{ fs, time::Duration, path::Path };
use blake3;

use crate::{
  config::{ GlobalConfig, load_local_config, save_local_config },
  client::get_authenticated_client,
};

pub async fn save(message: Option<String>) -> Result<()> {
  let client = get_authenticated_client()?;
  let config = GlobalConfig::load()?;
  let mut local_config = load_local_config()?;

  let user_res = client.get(format!("{}/api/me", config.server_url)).send().await;
  let (author_name, author_email) = match user_res {
    Ok(r) if r.status().is_success() => {
      let json: serde_json::Value = r.json().await?;
      (
        json["username"].as_str().unwrap_or("Unknown").to_string(),
        json["email"].as_str().unwrap_or("anon@plectr.io").to_string(),
      )
    }
    _ => ("CLI User".to_string(), "cli@plectr.io".to_string()),
  };

  let mut remote_files = std::collections::HashMap::new();
  let mut remote_head_id = None;

  if
    let Ok(res) = client
      .get(format!("{}/repos/{}/head", config.server_url, local_config.repo_name))
      .send().await
  {
    if let Ok(json) = res.json::<serde_json::Value>().await {
      remote_head_id = json["commit_id"].as_str().map(|s| s.to_string());
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

  let spinner = ProgressBar::new_spinner();
  spinner.set_style(ProgressStyle::default_spinner().template("{spinner:.blue} {msg}").unwrap());

  if Path::new(".gitignore").exists() {
    spinner.set_message("Scanning filesystem (using .gitignore)...");
  } else {
    spinner.set_message("Scanning filesystem...");
  }
  spinner.enable_steady_tick(Duration::from_millis(50));

  let mut files_to_upload = Vec::new();
  let mut commit_tree = Vec::new();
  let mut current_paths = std::collections::HashSet::new();

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

        let content = fs::read(path)?;
        let hash = blake3::hash(&content).to_hex().to_string();

        commit_tree.push(serde_json::json!({ "path": rel_path, "hash": hash }));
        current_paths.insert(rel_path.clone());

        if remote_files.get(&rel_path) != Some(&hash) {
          files_to_upload.push((rel_path, content));
        }
      }
      Err(_) => {
        continue;
      }
    }
  }
  spinner.finish_and_clear();

  let files_to_upload_count = files_to_upload.len();

  if files_to_upload_count > 0 {
    println!("🚀 Synchronizing {} files...", files_to_upload_count);
    let pb = ProgressBar::new(files_to_upload_count as u64);
    let pb_style = ProgressStyle::default_bar()
      .template("{spinner:.green} [{bar:40.cyan/blue}] {pos}/{len} ({msg})")
      .unwrap_or_else(|_| ProgressStyle::default_bar())
      .progress_chars("#>-");
    pb.set_style(pb_style);

    let client_ref = &client;
    let url_ref = &config.server_url;

    let upload_results: Vec<Result<()>> = stream
      ::iter(files_to_upload)
      .map(|(path, content)| {
        let c = client_ref.clone();
        let u = url_ref.clone();
        let pb_clone = pb.clone();

        async move {
          let file_name = path.clone();
          pb_clone.set_message(path.clone()); 
          let form = reqwest::multipart::Form
            ::new()
            .part("file", reqwest::multipart::Part::bytes(content).file_name(path.clone()));

          let res = c.post(format!("{}/upload", u)).multipart(form).send().await;

          match res {
            Ok(response) => {
              if response.status().is_success() {
                pb_clone.inc(1);
                Ok(())
              } else {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                pb_clone.set_message(format!("Retrying {}", file_name));
                Err(anyhow::anyhow!("Upload failed for {}: {} - {}", file_name, status, text))
              }
            }
            Err(e) => Err(anyhow::anyhow!("Network error for {}: {}", file_name, e)),
          }
        }
      })
      .buffer_unordered(4)
      .collect().await;

    pb.finish_and_clear();

    let mut errors = Vec::new();
    for result in upload_results {
      if let Err(e) = result {
        errors.push(e.to_string());
      }
    }

    if !errors.is_empty() {
      println!("{}", style("❌ Upload errors detected:").red().bold());
      for e in errors.iter().take(5) {
        println!(" - {}", e);
      }
      if errors.len() > 5 {
        println!(" ... and {} more.", errors.len() - 5);
      }
      anyhow::bail!("Aborting commit due to upload failures.");
    }
  } else {
    println!("{}", style("✨ No changes to upload.").dim());
  }

  let has_changes = files_to_upload_count > 0 || remote_files.len() != current_paths.len();

  if !has_changes && remote_head_id.is_some() {
    println!("{}", style("💤 Nothing to commit.").yellow());
    return Ok(());
  }

  let msg = message.unwrap_or_else(|| {
    let now = chrono::Local::now();
    format!("Resonance snapshot {}", now.format("%Y-%m-%d %H:%M"))
  });

  let commit_res = client
    .post(format!("{}/repos/{}/commits", config.server_url, local_config.repo_name))
    .json(
      &serde_json::json!({
      "message": msg,
      "author_name": author_name,
      "author_email": author_email,
      "parent_commit_id": local_config.last_commit_id,
      "files": commit_tree
    })
    )
    .send().await?;

  if commit_res.status().is_success() {
    let res_data: serde_json::Value = commit_res.json().await?;
    let new_id = res_data["commit_id"].as_str().unwrap().to_string();
    let is_divergent = res_data["is_divergent"].as_bool().unwrap_or(false);

    local_config.last_commit_id = Some(new_id.clone());
    save_local_config(&local_config)?;

    if is_divergent {
      println!(
        "\n{} {}",
        style("⚠ DIVERGENCE DETECTED").red().bold(),
        style("Timeline forked.").red()
      );
      println!(
        "  Resolve conflicts in UI: {}/repo/{}/reconcile/{}",
        config.server_url,
        local_config.repo_name,
        new_id
      );
    } else {
      println!("{} Snapshot secured: {}", style("✔").green(), style(&new_id[..8]).bold());
    }
  } else {
    println!("❌ Commit failed: {}", commit_res.text().await?);
  }

  Ok(())
}

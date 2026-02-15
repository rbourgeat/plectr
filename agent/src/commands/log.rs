use anyhow::Result;
use console::style;
use crate::{config::{GlobalConfig, load_local_config}, client::get_authenticated_client};

pub async fn log() -> Result<()> {
  let client = get_authenticated_client()?;
  let config = GlobalConfig::load()?;
  let local_config = load_local_config()?;

  let res = client.get(format!("{}/repos/{}/commits", config.server_url, local_config.repo_name)).send().await?;
  let commits: Vec<serde_json::Value> = res.json().await?;

  println!("{}", style(format!("Timeline: {}", local_config.repo_name)).bold().underlined());

  for c in commits.iter().take(10) {
    let id = c["id"].as_str().unwrap_or("?");
    let msg = c["message"].as_str().unwrap_or("");
    let author = c["author"].as_str().unwrap_or("Unknown");
    let date = c["date"].as_str().unwrap_or("");
    let is_div = c["is_divergent"].as_bool().unwrap_or(false);

    let symbol = if is_div { style("⑂").red() } else { style("●").blue() };

    println!("{} {} {}", symbol, style(&id[..8]).dim(), style(msg).bold());
    println!(" {} {} • {}", style("└").dim(), style(author).cyan(), style(date).dim());
  }
  Ok(())
}
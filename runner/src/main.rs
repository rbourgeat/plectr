use anyhow::{ Result, Context, anyhow };
use bollard::Docker;
use bollard::container::{
  CreateContainerOptions,
  Config,
  StartContainerOptions,
  LogOutput,
  RemoveContainerOptions,
  UploadToContainerOptions,
};
use bollard::exec::{ CreateExecOptions, StartExecResults };
use futures_util::{ StreamExt, SinkExt };
use serde::{ Deserialize, Serialize };
use serde_json::json;
use tokio_tungstenite::{ connect_async, tungstenite::protocol::Message };
use url::Url;
use std::env;
use std::path::Path;
use tokio::fs;

#[derive(Serialize, Deserialize, Debug)]
struct JobContext {
  repo_name: String,
  commit_id: String,
  api_url: String,
  auth_token: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct JobRequest {
  job_id: String,
  image: String,
  script: Vec<String>,
  env: Option<Vec<String>>,
  context: Option<JobContext>,
  artifacts: Option<Vec<String>>,
}

#[tokio::main]
async fn main() -> Result<()> {
  tracing_subscriber::fmt::init();

  let core_url = env
    ::var("PLECTR_CORE_URL")
    .unwrap_or("ws://localhost:3000/api/runner/ws".to_string());
  let token = env::var("RUNNER_TOKEN").expect("RUNNER_TOKEN is required");
  let runner_name = env
    ::var("RUNNER_NAME")
    .unwrap_or_else(|_| format!("runner-{}", uuid::Uuid::new_v4()));

  tracing::info!("🚀 Starting Plectr Runner: {}", runner_name);

  let docker = Docker::connect_with_local_defaults().context("Failed to connect to Docker Daemon")?;

  let url_string = format!("{}?token={}&name={}", core_url, token, runner_name);
  let url = Url::parse(&url_string)?;

  loop {
    tracing::info!("🔌 Connecting to Core at {}...", core_url);
    match connect_async(url.clone()).await {
      Ok((ws_stream, _)) => {
        tracing::info!("✅ Connected via WebSocket securely.");
        let (mut write, mut read) = ws_stream.split();

        while let Some(msg_res) = read.next().await {
          match msg_res {
            Ok(Message::Text(text)) => {
              if let Err(e) = handle_message(&docker, text, &mut write).await {
                tracing::error!("Error processing job: {}", e);
              }
            }
            Ok(Message::Ping(_)) => {}
            Ok(Message::Close(_)) => {
              break;
            }
            Err(e) => {
              tracing::error!("WebSocket Error: {}", e);
              break;
            }
            _ => {}
          }
        }
        tracing::warn!("⚠️ Connection lost. Retrying in 5s...");
      }
      Err(e) => {
        tracing::error!("❌ Connection failed: {}. Retrying in 5s...", e);
      }
    }
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
  }
}

async fn handle_message<S>(docker: &Docker, text: String, write: &mut S) -> Result<()>
  where S: SinkExt<Message> + Unpin, S::Error: std::error::Error + Send + Sync + 'static
{
  let data: serde_json::Value = serde_json::from_str(&text)?;

  if data["type"] == "job_request" {
    let job: JobRequest = serde_json::from_value(data["payload"].clone())?;
    tracing::info!("⚙️ Received Job: {} (Image: {})", job.job_id, job.image);

    write.send(
      Message::Text(json!({
      "type": "job_started",
      "job_id": job.job_id
    }).to_string())
    ).await?;

    match execute_job(docker, &job, write).await {
      Ok(_) => {
        tracing::info!("✅ Job {} succeeded", job.job_id);
        write.send(
          Message::Text(
            json!({
          "type": "job_completed",
          "job_id": job.job_id,
          "status": "success",
          "exit_code": 0
        }).to_string()
          )
        ).await?;
      }
      Err(e) => {
        tracing::error!("❌ Job {} failed: {}", job.job_id, e);
        write.send(
          Message::Text(
            json!({
          "type": "job_completed",
          "job_id": job.job_id,
          "status": "failed",
          "error": e.to_string(),
          "exit_code": 1
        }).to_string()
          )
        ).await?;
      }
    }
  }
  Ok(())
}

async fn execute_job<S>(docker: &Docker, job: &JobRequest, ws_sender: &mut S) -> Result<()>
  where S: SinkExt<Message> + Unpin, S::Error: std::error::Error + Send + Sync + 'static
{
  let workspace_id = uuid::Uuid::new_v4().to_string();
  let runner_workspace = format!("/tmp/plectr-jobs/{}", workspace_id);
  fs::create_dir_all(&runner_workspace).await?;

  if docker.inspect_image(&job.image).await.is_err() {
    use bollard::image::CreateImageOptions;
    let mut stream = docker.create_image(
      Some(CreateImageOptions { from_image: job.image.clone(), ..Default::default() }),
      None,
      None
    );
    while let Some(_) = stream.next().await {}
  }

  let container_name = format!("plectr-job-{}", job.job_id);

  let config = Config {
    image: Some(job.image.clone()),
    cmd: Some(vec!["sleep".to_string(), "3600".to_string()]),
    working_dir: Some("/workspace".to_string()),
    env: Some(job.env.clone().unwrap_or_default()),
    ..Default::default()
  };

  docker.create_container(
    Some(CreateContainerOptions { name: container_name.clone(), platform: None }),
    config
  ).await?;

  if let Some(ctx) = &job.context {
    let _ = ws_sender.send(
      Message::Text(
        json!({
      "type": "job_log", "job_id": job.job_id,
      "content": format!("⬇️ Materializing assets for {}@{}...\n", ctx.repo_name, &ctx.commit_id[..8])
    }).to_string()
      )
    ).await;

    if let Err(e) = fetch_source_code(ctx, &runner_workspace).await {
      let _ = ws_sender.send(
        Message::Text(
          json!({
        "type": "job_log", "job_id": job.job_id,
        "content": format!("❌ Failed to fetch source: {}\n", e)
      }).to_string()
        )
      ).await;
      let _ = fs::remove_dir_all(&runner_workspace).await;
      return Err(e);
    }

    let tar_data = create_tar_from_dir(&runner_workspace)?;

    let upload_options = UploadToContainerOptions {
      path: "/workspace",
      ..Default::default()
    };

    docker
      .upload_to_container(&container_name, Some(upload_options), tar_data.into()).await
      .context("Failed to upload source code to container")?;

    let _ = ws_sender.send(
      Message::Text(
        json!({
      "type": "job_log", "job_id": job.job_id,
      "content": "📦 Assets uploaded to container workspace.\n"
    }).to_string()
      )
    ).await;
  }

  docker.start_container(&container_name, None::<StartContainerOptions<String>>).await?;

  let full_script = job.script.join(" && ");
  let exec_config = CreateExecOptions {
    cmd: Some(vec!["/bin/sh", "-c", &full_script]),
    attach_stdout: Some(true),
    attach_stderr: Some(true),
    ..Default::default()
  };

  let exec = docker.create_exec(&container_name, exec_config).await?;

  if let StartExecResults::Attached { mut output, .. } = docker.start_exec(&exec.id, None).await? {
    while let Some(log_res) = output.next().await {
      if let Ok(log) = log_res {
        let msg = match log {
          LogOutput::StdOut { message } => String::from_utf8_lossy(&message).to_string(),
          LogOutput::StdErr { message } => String::from_utf8_lossy(&message).to_string(),
          _ => {
            continue;
          }
        };
        let _ = ws_sender.send(
          Message::Text(
            json!({
          "type": "job_log", "job_id": job.job_id, "content": msg
        }).to_string()
          )
        ).await;
      }
    }
  }

  let inspect = docker.inspect_exec(&exec.id).await?;
  let exit_code = inspect.exit_code.unwrap_or(1);

  if exit_code == 0 {
    if let Some(artifacts) = &job.artifacts {
      for raw_path in artifacts {
        let artifact_path = if raw_path.starts_with("/") {
          raw_path.clone()
        } else {
          format!("/workspace/{}", raw_path)
        };

        let _ = ws_sender.send(
          Message::Text(
            json!({
          "type": "job_log", "job_id": job.job_id,
          "content": format!("📦 Processing artifact: {}\n", raw_path)
        }).to_string()
          )
        ).await;

        use futures_util::TryStreamExt;
        let download_stream = docker.download_from_container(
          &container_name,
          Some(bollard::container::DownloadFromContainerOptions { path: artifact_path.clone() })
        );

        let mut tar_bytes = Vec::new();
        let mut stream = download_stream;
        while let Some(chunk) = stream.next().await {
          match chunk {
            Ok(bytes) => tar_bytes.extend_from_slice(&bytes),
            Err(e) => {
              let _ = ws_sender.send(
                Message::Text(
                  json!({
                "type": "job_log", "job_id": job.job_id,
                "content": format!("❌ Error downloading artifact: {}\n", e)
              }).to_string()
                )
              ).await;
            }
          }
        }

        if !tar_bytes.is_empty() {
          let mut archive = tar::Archive::new(&tar_bytes[..]);
          let mut found = false;

          if let Ok(entries) = archive.entries() {
            for file in entries {
              if let Ok(mut file) = file {
                let path = file.path().unwrap().into_owned();
                let filename = path.file_name().unwrap().to_string_lossy().to_string();

                let mut content = Vec::new();
                use std::io::Read;
                if file.read_to_end(&mut content).is_ok() {
                  if let Some(ctx) = &job.context {
                    match upload_artifact(ctx, &job.job_id, &filename, content).await {
                      Ok(_) => {
                        found = true;
                        let _ = ws_sender.send(Message::Text(json!({
                          "type": "job_log", "job_id": job.job_id,
                          "content": format!("🚀 Uploaded release artifact: {}\n", filename)
                        }).to_string())).await;
                      },
                      Err(e) => {
                        let _ = ws_sender.send(Message::Text(json!({
                          "type": "job_log", "job_id": job.job_id,
                          "content": format!("❌ Upload FAILED for {}: {}\n", filename, e)
                        }).to_string())).await;
                      }
                    }
                  }
                }
              }
            }
          }

          if !found {
            let _ = ws_sender.send(
              Message::Text(
                json!({
              "type": "job_log", "job_id": job.job_id,
              "content": format!("⚠️ Warning: Artifact {} found but empty or unreadable.\n", artifact_path)
            }).to_string()
              )
            ).await;
          }
        }
      }
    }
  }

  let _ = docker.remove_container(
    &container_name,
    Some(RemoveContainerOptions { force: true, ..Default::default() })
  ).await;
  let _ = fs::remove_dir_all(&runner_workspace).await;

  if exit_code != 0 {
    return Err(anyhow!("Script exited with code {}", exit_code));
  }

  Ok(())
}

async fn upload_artifact(
  ctx: &JobContext,
  job_id: &str,
  filename: &str,
  content: Vec<u8>
) -> Result<()> {
  let client = reqwest::Client
    ::builder()
    .danger_accept_invalid_certs(true)
    .use_rustls_tls()
    .build()?;

  let url = format!("{}/api/runner/jobs/{}/artifacts", ctx.api_url, job_id);

  let part = reqwest::multipart::Part::bytes(content).file_name(filename.to_string());

  let form = reqwest::multipart::Form::new().part("file", part);

  let res = client
    .post(&url)
    .header("Authorization", format!("Bearer {}", ctx.auth_token))
    .multipart(form)
    .send().await?;

  if !res.status().is_success() {
    anyhow::bail!("Upload failed: {}", res.status());
  }
  Ok(())
}

fn create_tar_from_dir(src_path: &str) -> Result<Vec<u8>> {
  let mut tar_builder = tar::Builder::new(Vec::new());

  tar_builder.append_dir_all(".", src_path).context("Failed to pack source code")?;

  let tar_data = tar_builder.into_inner().context("Failed to finish tar")?;

  Ok(tar_data)
}

async fn fetch_source_code(ctx: &JobContext, target_dir: &str) -> Result<()> {
  let client = reqwest::Client
    ::builder()
    .danger_accept_invalid_certs(true)
    .use_rustls_tls()
    .build()?;

  let tree_url = format!("{}/repos/{}/commits/{}/tree", ctx.api_url, ctx.repo_name, ctx.commit_id);
  let resp = client
    .get(&tree_url)
    .header("Authorization", format!("Bearer {}", ctx.auth_token))
    .send().await?;

  if !resp.status().is_success() {
    anyhow::bail!("Failed to get tree: {}", resp.status());
  }

  let files: Vec<serde_json::Value> = resp.json().await?;

  for f in files {
    let path_str = f["path"].as_str().unwrap_or_default();
    if path_str.is_empty() || path_str.contains("..") {
      continue;
    }

    let file_url = format!(
      "{}/repos/{}/commits/{}/files/{}",
      ctx.api_url,
      ctx.repo_name,
      ctx.commit_id,
      path_str
    );
    let file_resp = client
      .get(&file_url)
      .header("Authorization", format!("Bearer {}", ctx.auth_token))
      .send().await?;

    if file_resp.status().is_success() {
      let content = file_resp.bytes().await?;
      let full_path = Path::new(target_dir).join(path_str);
      if let Some(parent) = full_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
      }
      tokio::fs::write(full_path, content).await?;
    }
  }
  Ok(())
}

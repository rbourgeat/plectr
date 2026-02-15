use anyhow::Result;
use clap::{ Parser, Subcommand };
use console::style;

mod config;
mod client;
mod commands;

use commands::{ auth, init, save, clone, log, status };

#[derive(Parser)]
#[command(name = "plectr")]
#[command(about = "The Unified Engineering Forge CLI v0.2", long_about = None)]
struct Cli {
  #[command(subcommand)]
  command: Commands,
}

#[derive(Subcommand)]
enum Commands {
  Login,
  Whoami,
  Init {
    #[arg(short, long)]
    name: String,
    #[arg(short, long)]
    public: bool,
  },
  Save {
    #[arg(short, long)]
    message: Option<String>,
  },
  Clone {
    name: String,
  },
  Log,
  Status,
}

#[tokio::main]
async fn main() -> Result<()> {
  let cli = Cli::parse();

  if !matches!(cli.command, Commands::Save { .. }) {
    print_banner();
  }

  match cli.command {
    Commands::Login => auth::login().await?,
    Commands::Whoami => auth::whoami().await?,
    Commands::Init { name, public } => init::init(name, public).await?,
    Commands::Save { message } => save::save(message).await?,
    Commands::Clone { name } => clone::clone(name).await?,
    Commands::Log => log::log().await?,
    Commands::Status => status::status().await?,
  }

  Ok(())
}

fn print_banner() {
  println!("{}", style("   ___  __    ___________ ______  ").magenta().bold());
  println!("{}", style("  / _ \\/ /   / __/ ___/_  __/ _ \\ ").magenta().bold());
  println!("{}", style(" / ___/ /___/ _// /__  / / / , _/ ").magenta().bold());
  println!("{} v0.2.0\n", style("/_/  /_____/___/\\___/ /_/ /_/|_|  ").magenta().bold());
}

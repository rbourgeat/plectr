-- Statuts possibles d'un job
CREATE TYPE job_status_enum AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled');

-- 1. Les Runners (Worker Nodes)
CREATE TABLE runners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,   -- Token d'authentification (à mettre dans le ENV du runner)
  name TEXT NOT NULL,       -- ex: "prod-runner-01"
  platform TEXT,          -- "linux/amd64", "darwin/arm64"
  last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Les Pipelines (Groupe de jobs liés à un commit)
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  commit_id UUID REFERENCES commits(id) ON DELETE CASCADE,
  status job_status_enum DEFAULT 'pending',
  ref TEXT, -- branche ou tag (ex: "refs/heads/main")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- 3. Les Jobs (Unités d'exécution)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,       -- ex: "build-rust"
  stage TEXT NOT NULL,       -- ex: "build"
  image TEXT NOT NULL,       -- ex: "rust:1.75-alpine"
  script JSONB NOT NULL,      -- Liste des commandes (Array de strings)
  status job_status_enum DEFAULT 'pending',
  runner_id UUID REFERENCES runners(id), -- Quel runner l'a pris ?
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  exit_code INT,
  log_file_path TEXT        -- Chemin dans le stockage d'objets (S3) pour les logs
);

-- Index pour les requêtes fréquentes du Scheduler
CREATE INDEX idx_jobs_status ON jobs(status) WHERE status = 'pending';
CREATE INDEX idx_pipelines_repo ON pipelines(repo_id);
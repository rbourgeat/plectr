-- Table pour les artefacts de jobs (fichiers produits par la CI)
CREATE TABLE job_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,     -- ex: "plectr-linux-x86_64"
  blob_hash TEXT REFERENCES blobs(hash), -- Lien vers le stockage CAS
  size BIGINT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour retrouver rapidement les artefacts d'un repo
CREATE INDEX idx_job_artifacts_job ON job_artifacts(job_id);
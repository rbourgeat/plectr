-- Ajouter la colonne sha256 aux blobs existants (pour compatibilité Docker)
ALTER TABLE blobs ADD COLUMN IF NOT EXISTS sha256 TEXT;
CREATE INDEX IF NOT EXISTS idx_blobs_sha256 ON blobs(sha256);

-- Tables pour le Registry Docker
CREATE TABLE IF NOT EXISTS docker_repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- ex: "plectr/alpine"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS docker_uploads (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS docker_manifests (
    digest TEXT PRIMARY KEY, -- sha256:...
    repo_id UUID REFERENCES docker_repositories(id),
    content JSONB NOT NULL, -- Le JSON du manifest Docker
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS docker_tags (
    repo_id UUID REFERENCES docker_repositories(id),
    tag TEXT NOT NULL, -- ex: "latest"
    manifest_digest TEXT REFERENCES docker_manifests(digest),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (repo_id, tag)
);
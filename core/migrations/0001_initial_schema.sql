-- core/migrations/0001_init.sql

-- 1. Extensions (Préparation Phase 3)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Organizations & Repositories
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, name)
);

-- 3. Content Addressable Storage (Blobs)
CREATE TABLE IF NOT EXISTS blobs (
    hash TEXT PRIMARY KEY,
    size BIGINT NOT NULL,
    mime_type TEXT,
    storage_path TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Commits & Versioning
CREATE TABLE IF NOT EXISTS commits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id UUID REFERENCES repositories(id),
    parent_id UUID REFERENCES commits(id),
    message TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_email TEXT NOT NULL,
    tree_hash TEXT NOT NULL,
    is_divergent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Mapping Commit <-> Files
CREATE TABLE IF NOT EXISTS commit_files (
    commit_id UUID REFERENCES commits(id),
    file_path TEXT NOT NULL,
    blob_hash TEXT REFERENCES blobs(hash),
    PRIMARY KEY (commit_id, file_path)
);

-- 6. Index de performance (GitLab style)
CREATE INDEX IF NOT EXISTS idx_commits_repo_id ON commits(repo_id);
CREATE INDEX IF NOT EXISTS idx_commit_files_commit_id ON commit_files(commit_id);
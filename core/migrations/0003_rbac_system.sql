-- Enumérations pour typer les rôles (Postgres native enums)
CREATE TYPE org_role_enum AS ENUM ('owner', 'member');
CREATE TYPE repo_role_enum AS ENUM ('admin', 'editor', 'viewer');

-- Table Users (Miroir local de Keycloak pour les FK et l'affichage)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY, -- Keycloak 'sub'
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Members
CREATE TABLE IF NOT EXISTS organization_members (
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role org_role_enum NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (org_id, user_id)
);

-- Repository Members (Granularité fine)
CREATE TABLE IF NOT EXISTS repository_members (
    repo_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role repo_role_enum NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (repo_id, user_id)
);

-- Index pour la performance des lookups de permissions
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_repo_members_user ON repository_members(user_id);

-- Trigger pour mettre à jour last_seen
CREATE OR REPLACE FUNCTION update_last_seen() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_seen_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
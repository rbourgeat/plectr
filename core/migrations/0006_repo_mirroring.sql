CREATE TABLE IF NOT EXISTS repo_mirrors (
  repo_id UUID PRIMARY KEY REFERENCES repositories(id) ON DELETE CASCADE,
  remote_url TEXT NOT NULL,     -- ex: https://github.com/user/repo.git
  encrypted_token TEXT NOT NULL,   -- Base64 encoded encrypted token
  iv TEXT NOT NULL,         -- Initialization Vector (pour AES)
  is_enabled BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  last_status TEXT DEFAULT 'pending', -- 'success', 'failed', 'pending'
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
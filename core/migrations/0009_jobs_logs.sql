-- Ajouter le support des logs textes
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS logs TEXT DEFAULT '';
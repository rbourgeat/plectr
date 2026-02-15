-- Ajout du flag Admin global
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN DEFAULT FALSE;

-- On s'assure que le premier user (toi) est admin (hack pour le dev)
UPDATE users SET is_system_admin = TRUE WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);

-- Amélioration de la table runners pour les stats
ALTER TABLE runners 
ADD COLUMN IF NOT EXISTS version TEXT, -- ex: "v0.2.1"
ADD COLUMN IF NOT EXISTS hostname TEXT, -- ex: "aws-ec2-large"
ADD COLUMN IF NOT EXISTS tags TEXT[]; -- ex: ["linux", "gpu", "production"]
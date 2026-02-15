-- D'abord, on nettoie les doublons éventuels (on garde le plus récent)
DELETE FROM repositories a USING repositories b
WHERE a.id < b.id AND a.name = b.name;

-- Ensuite, on ajoute la contrainte UNIQUE stricte sur le nom
ALTER TABLE repositories ADD CONSTRAINT unique_repo_name UNIQUE (name);
-- D'abord, on s'occupe de la liaison Repo -> Commits
-- On supprime l'ancienne contrainte rigide
ALTER TABLE commits 
DROP CONSTRAINT IF EXISTS commits_repo_id_fkey;

-- On la recrée avec l'autorisation de tout supprimer en cascade
ALTER TABLE commits 
ADD CONSTRAINT commits_repo_id_fkey 
FOREIGN KEY (repo_id) 
REFERENCES repositories(id) 
ON DELETE CASCADE;

-- Ensuite, on doit aussi s'assurer que si un commit saute, ses fichiers sautent aussi
-- Liaison Commit -> Files
ALTER TABLE commit_files 
DROP CONSTRAINT IF EXISTS commit_files_commit_id_fkey;

ALTER TABLE commit_files 
ADD CONSTRAINT commit_files_commit_id_fkey 
FOREIGN KEY (commit_id) 
REFERENCES commits(id) 
ON DELETE CASCADE;

-- Enfin, la récursion parent/enfant des commits (optionnel mais propre)
ALTER TABLE commits
DROP CONSTRAINT IF EXISTS commits_parent_id_fkey;

ALTER TABLE commits
ADD CONSTRAINT commits_parent_id_fkey
FOREIGN KEY (parent_id)
REFERENCES commits(id)
ON DELETE SET NULL; 
-- Si le parent disparait, l'enfant devient orphelin (plutôt que supprimé, sauf si le repo entier saute)

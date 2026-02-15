export type FileType = 'code' | 'data' | 'ai' | 'markdown';

export interface FileEntry {
 path: string;
 size: number;
 type: FileType;
 hash: string;
}

export interface Commit {
  id: string;
  message: string;
  author: string;
  date: string;
  parent_id?: string;
  is_divergent?: boolean;
  stats?: { files: number };
  email?: string;
 }

export interface RepositoryHead {
  status: 'active' | 'empty';
  repo_id: string;
  commit_id: string | null;
  message: string;
  access_level: 'admin' | 'editor' | 'viewer' | 'none' | 'owner';
}

export interface Repository {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  last_updated: string;
  language: string;
}
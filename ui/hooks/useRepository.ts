import { useState, useEffect } from 'react';
import axios from 'axios';
import { FileEntry, Commit } from '@/types/repo';
import { useSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

export function useRepository(repoName: string, targetCommitId?: string | null) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [currentCommit, setCurrentCommit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    const fetchData = async () => {
      setLoading(true);
      
      const headers = session?.accessToken 
        ? { Authorization: `Bearer ${session.accessToken}` } 
        : {};

      try {
        const headRes = await axios.get(
            `${API_URL}/repos/${repoName}/head`, 
            { headers }
        );
        
        if (headRes.data.status === 'empty' || !headRes.data.commit_id) {
            setFiles([]);
            setCommits([]);
            setCurrentCommit(headRes.data);
            setLoading(false);
            return;
        }

        const activeCommitId = targetCommitId || headRes.data.commit_id; 
        setCurrentCommit(headRes.data); 

        const [treeRes, histRes] = await Promise.all([
        axios.get(`${API_URL}/repos/${repoName}/commits/${activeCommitId}/tree`, { headers }),
        axios.get(`${API_URL}/repos/${repoName}/commits`, { headers })
        ]);

        setFiles(Array.isArray(treeRes.data) ? treeRes.data : []);
        setCommits(Array.isArray(histRes.data) ? histRes.data : []);
      } catch (e: any) {
        if (e.response?.status === 404) {
           setFiles([]);
           setCommits([]);
        } else if (e.response?.status === 403) {
           console.error("🔒 Access Denied. Private repository.");
        } else {
           console.error("Forge Sync Error:", e);
        }
      } finally {
        setLoading(false);
      }
    };

    if (repoName) fetchData();
  }, [repoName, session, status]);

  return { files, commits, currentCommit, loading };
}

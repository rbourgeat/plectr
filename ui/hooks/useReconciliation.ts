import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

export function useReconciliation(repoName: string, divergentId: string) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMergeData = async () => {
            setLoading(true);
            try {
                const headRes = await axios.get(`${API_URL}/repos/${repoName}/head`);
                const headId = headRes.data.commit_id;

                const [treeRemote, treeLocal] = await Promise.all([
                    axios.get(`${API_URL}/repos/${repoName}/commits/${headId}/tree`),
                    axios.get(`${API_URL}/repos/${repoName}/commits/${divergentId}/tree`)
                ]);

                setData({
                    remote: { id: headId, files: treeRemote.data },
                    local: { id: divergentId, files: treeLocal.data }
                });
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchMergeData();
    }, [repoName, divergentId]);

    return { data, loading };
}
'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { GitCommit, Calendar, ArrowRight, PlayCircle } from 'lucide-react';
import { PipelineBadge } from '@/components/pipelines/PipelineBadge';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

export default function PipelinesPage() {
  const { name: repoName } = useParams();
  const { data: session } = useSession();
  const [pipelines, setPipelines] = useState<any[]>([]);

  useEffect(() => {
    if (!session?.accessToken) return;
    const fetchPipelines = async () => {
      const res = await axios.get(`${API_URL}/repos/${repoName}/pipelines`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      setPipelines(res.data);
    };
    fetchPipelines();
    const interval = setInterval(fetchPipelines, 3000);
    return () => clearInterval(interval);
  }, [repoName, session]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <PlayCircle className="text-blue-500" /> Resonance Pipelines
      </h1>

      <div className="space-y-3">
        {pipelines.map((p) => (
          <Link key={p.id} href={`/repo/${repoName}/pipelines/${p.id}`}>
            <div className="glass-panel p-4 rounded-xl border border-zinc-800 hover:border-blue-500/30 transition-all group flex items-center justify-between">
              <div className="flex items-center gap-6">
                <PipelineBadge status={p.status} />

                <div>
                  <div className="text-sm text-white font-mono font-bold mb-1 group-hover:text-blue-400 transition-colors">
                    {p.commit_message}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <GitCommit size={12} /> {p.commit_id.substring(0, 8)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} /> {new Date(p.created_at).toLocaleString()}
                    </span>
                    <span>by {p.author}</span>
                  </div>
                </div>
              </div>
              <ArrowRight
                size={16}
                className="text-zinc-600 group-hover:text-white transition-colors"
              />
            </div>
          </Link>
        ))}

        {pipelines.length === 0 && (
          <div className="text-center py-20 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
            No pipelines found. Push a <code>plectr.yaml</code> file to start building.
          </div>
        )}
      </div>
    </div>
  );
}

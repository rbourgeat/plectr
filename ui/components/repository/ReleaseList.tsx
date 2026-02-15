'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { Download, Package, GitCommit, Calendar, HardDrive } from 'lucide-react';
import { formatBytes } from '@/utils/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

export const ReleaseList = ({ repoName }: { repoName: string }) => {
  const { data: session } = useSession();
  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.accessToken) return;
    axios
      .get(`${API_URL}/repos/${repoName}/releases`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      })
      .then((res) => setReleases(res.data))
      .finally(() => setLoading(false));
  }, [repoName, session]);

  if (loading)
    return (
      <div className="text-center py-10 text-zinc-500 animate-pulse">Loading distributions...</div>
    );

  if (releases.length === 0)
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
        <Package size={48} className="mb-4 opacity-20" />
        <p>No build artifacts released yet.</p>
        <p className="text-xs mt-2 opacity-60">
          Add <code>artifacts: ['path/to/bin']</code> to your plectr.yaml
        </p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Package className="text-purple-500" /> Binary Distributions
        </h2>
      </div>

      {releases.map((rel) => (
        <div
          key={rel.id}
          className="glass-panel p-5 rounded-xl border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-zinc-700 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-purple-400 transition-colors shrink-0">
              <Package size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">{rel.name}</h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 mt-1">
                <span className="flex items-center gap-1">
                  <HardDrive size={12} /> {formatBytes(rel.size)}
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <GitCommit size={12} /> {rel.commit_id.substring(0, 8)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> {new Date(rel.date).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-zinc-600 mt-1.5 line-clamp-1 italic">
                Build from: "{rel.commit_msg}"
              </p>
            </div>
          </div>

          <a
            href={`${API_URL}/repos/${repoName}/releases/${rel.id}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-black rounded-lg font-bold text-sm hover:bg-purple-50 transition-all shadow-lg shadow-white/5 active:scale-95 shrink-0"
          >
            <Download size={16} /> Download
          </a>
        </div>
      ))}
    </div>
  );
};

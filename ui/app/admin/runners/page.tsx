'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Server, Activity, Plus, Trash2, Copy, CheckCircle, RefreshCw, Cpu } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/context/ToastContext';

export default function RunnersPage() {
  const { data: session } = useSession();
  const { success } = useToast();
  const [runners, setRunners] = useState<any[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);

  const fetchRunners = async () => {
    if (!session?.accessToken) return;
    const res = await axios.get('/api/admin/runners', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    setRunners(res.data);
  };

  useEffect(() => {
    fetchRunners();
    const interval = setInterval(fetchRunners, 5000);
    return () => clearInterval(interval);
  }, [session]);

  const createRunner = async () => {
    const name = prompt('Runner Name (e.g., prod-worker-01):');
    if (!name) return;

    const res = await axios.post(
      '/api/admin/runners',
      { name },
      {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      }
    );
    setNewToken(res.data.token);
    fetchRunners();
  };

  return (
    <div className="max-w-6xl mx-auto p-8 animate-in fade-in">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Server className="text-blue-500" /> Fleet Commander
          </h1>
          <p className="text-zinc-500 text-sm">Monitor and manage your resonance workers.</p>
        </div>
        <button
          onClick={createRunner}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20"
        >
          <Plus size={16} /> Register New Runner
        </button>
      </header>

      {/* Token Modal Display */}
      {newToken && (
        <div className="mb-8 p-6 bg-green-900/10 border border-green-500/20 rounded-xl animate-in slide-in-from-top-4">
          <h3 className="text-green-400 font-bold mb-2 flex items-center gap-2">
            <CheckCircle size={18} /> Runner Registered!
          </h3>
          <p className="text-zinc-400 text-sm mb-4">
            This token will only be shown once. Save it immediately.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black border border-green-500/30 p-3 rounded-lg text-green-300 font-mono text-sm break-all">
              {newToken}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newToken);
                success('Token copied!');
              }}
              className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white transition"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Runners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {runners.map((runner) => (
          <div
            key={runner.id}
            className={`glass-panel p-5 rounded-xl border transition-all ${
              runner.online
                ? 'border-green-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                : 'border-zinc-800 opacity-70'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    runner.online ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}
                />
                <div>
                  <h3 className="font-bold text-white text-sm">{runner.name}</h3>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {runner.hostname || 'Unknown Host'}
                  </p>
                </div>
              </div>
              {runner.active_jobs > 0 && (
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-full border border-blue-500/20 flex items-center gap-1">
                  <Activity size={10} /> {runner.active_jobs} Jobs
                </span>
              )}
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Platform</span>
                <span className="text-zinc-300 font-mono">{runner.platform}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Last Seen</span>
                <span className="text-zinc-300">
                  {runner.online ? 'Now' : new Date(runner.last_seen).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-800">
              <button className="text-zinc-600 hover:text-red-400 transition-colors text-xs flex items-center gap-1">
                <Trash2 size={12} /> Terminate
              </button>
            </div>
          </div>
        ))}

        {runners.length === 0 && (
          <div className="col-span-full py-20 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
            <Cpu size={32} className="mx-auto mb-4 opacity-50" />
            <p>No runners active. Register one to start processing pipelines.</p>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import RepoCard from '@/components/repository/RepoCard';
import { Plus, Search, SlidersHorizontal, X, Terminal, Box } from 'lucide-react';
import { Repository } from '@/types/repo';
import { useSession } from 'next-auth/react';
import { CreateRepoModal } from '@/components/CreateRepoModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

export default function Dashboard() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!session?.accessToken) return;

    const headers = { Authorization: `Bearer ${session.accessToken}` };
    axios
      .get(`${API_URL}/repos`, { headers })
      .then((res) => setRepos(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session]);

  const filteredRepos = repos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-10 animate-in fade-in duration-500">
      <CreateRepoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            Your Forge
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] border border-blue-500/20 font-mono uppercase tracking-wider">
              {repos.length} Repositories
            </span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Manage and monitor your engineering resonance.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative group w-full sm:w-auto">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-500 transition-colors"
              size={14}
            />
            <input
              type="text"
              placeholder="Find a repository..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-900/40 border border-zinc-800 rounded-lg pl-9 pr-8 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-zinc-900 transition-all w-full md:w-64 placeholder:text-zinc-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button className="bg-zinc-900 border border-zinc-800 p-2 rounded-lg text-zinc-400 flex-1 sm:flex-none justify-center flex hover:bg-zinc-800 hover:text-white transition-colors">
              <SlidersHorizontal size={16} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 flex-1 sm:flex-none justify-center transition-all shadow-lg shadow-blue-900/20 active:scale-95"
            >
              <Plus size={16} /> New
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-48 bg-zinc-900/50 rounded-xl animate-pulse border border-zinc-800"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRepos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} />
            ))}
          </div>

          {filteredRepos.length === 0 && repos.length > 0 && (
            <div className="text-center py-20 text-zinc-500">
              <p>
                No repositories found matching "
                <span className="text-white font-bold">{searchQuery}</span>"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-blue-500 text-sm mt-2 hover:underline"
              >
                Clear search
              </button>
            </div>
          )}

          {repos.length === 0 && (
            <div className="glass-panel p-12 rounded-3xl border border-dashed border-zinc-800 flex flex-col items-center justify-center text-center max-w-2xl mx-auto mt-10">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-3xl flex items-center justify-center mb-6 border border-white/5">
                <Box size={40} className="text-zinc-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Initialize your first Resonance</h3>
              <p className="text-zinc-500 mb-8 max-w-md">
                Your forge is empty. Create a repository to start versioning your code, data, and AI
                models in one unified place.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-white text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.15)]"
              >
                <Plus size={18} /> Create Repository
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

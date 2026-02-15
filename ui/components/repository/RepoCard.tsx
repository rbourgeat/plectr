"use client";
import { FolderGit2, Calendar, Lock, Globe } from 'lucide-react';
import Link from 'next/link';
import { Repository } from '@/types/repo';

const LANG_COLORS: Record<string, string> = {
    "Rust": "bg-orange-500",
    "Python": "bg-blue-500",
    "TypeScript": "bg-blue-600",
    "JavaScript": "bg-yellow-400",
    "Data": "bg-green-500",
    "AI Model": "bg-purple-500",
    "Empty": "bg-zinc-700"
};

function formatTimeAgo(dateString: string | null | undefined) {
    if (!dateString) return "No activity";
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return "Date unknown";
    }
  
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 0) return "Just now";
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function RepoCard({ repo }: { repo: Repository }) {
  const langColor = LANG_COLORS[repo.language] || "bg-zinc-500";

  return (
    <Link href={`/repo/${repo.name}`} className="group">
      <div className="glass-panel p-5 rounded-xl flex flex-col h-full relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
          <FolderGit2 size={80} />
        </div>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400 group-hover:text-blue-400 transition-colors">
            <FolderGit2 size={20} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 flex items-center gap-1">
            {repo.is_public ? <Globe size={10}/> : <Lock size={10}/>}
            {repo.is_public ? "Public" : "Private"}
          </span>
        </div>

        <h3 className="text-lg font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors mb-2">
          {repo.name}
        </h3>
        
        <p className="text-sm text-zinc-500 line-clamp-2 mb-6 flex-grow">
          {repo.description || "No description provided for this repository."}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${langColor} shadow-[0_0_8px_rgba(0,0,0,0.3)]`}></div>
            <span className="text-xs font-medium text-zinc-400">{repo.language}</span>
          </div>
          
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-bold uppercase tracking-tight">
            <Calendar size={12} />
            {formatTimeAgo(repo.last_updated)}
          </div>
        </div>
      </div>
    </Link>
  );
}
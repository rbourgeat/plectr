import {
  Clock,
  User,
  GitCommit,
  FileText,
  CornerDownRight,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import { Commit } from '@/types/repo';
import { useState } from 'react';

interface Props {
  commits: Commit[];
  onTimeTravel: (id: string) => void;
  activeCommitId?: string;
}

export const CommitTimeline = ({ commits, onTimeTravel, activeCommitId }: Props) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="py-8 px-6 space-y-6">
      {commits.map((c, idx) => {
        const isActive = c.id === activeCommitId;
        const isLast = idx === commits.length - 1;

        return (
          <div key={c.id} className="relative pl-10 group">
            {!isLast && (
              <div className="absolute left-[19px] top-10 -bottom-8 w-[2px] bg-zinc-800/50 group-hover:bg-zinc-700 transition-colors" />
            )}

            <div
              className={`absolute left-1 top-2 w-9 h-9 rounded-full border-4 border-[#050505] flex items-center justify-center z-10 transition-all duration-300
       ${
         isActive
           ? 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.6)] scale-110 text-white'
           : 'bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-300'
       }`}
            >
              {isActive ? (
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
              ) : (
                <GitCommit size={16} />
              )}
            </div>

            <div
              className={`
       relative p-5 rounded-2xl border transition-all duration-300 group/card
       ${
         isActive
           ? 'bg-blue-900/10 border-blue-500/30 shadow-lg shadow-blue-900/10'
           : 'bg-zinc-900/30 border-zinc-800 hover:bg-zinc-900/60 hover:border-zinc-700'
       }
     `}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0 text-sm font-bold text-zinc-400 shadow-inner">
                    {c.author.substring(0, 2).toUpperCase()}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-bold text-sm truncate ${
                          isActive ? 'text-white' : 'text-zinc-200 group-hover/card:text-blue-400'
                        } transition-colors`}
                      >
                        {c.message}
                      </span>

                      {c.is_divergent && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase tracking-wide">
                          Divergent
                        </span>
                      )}

                      <span
                        className="hidden group-hover/card:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-500/10 text-green-500/80 border border-green-500/10"
                        title="Signed with SSH Key"
                      >
                        <ShieldCheck size={10} /> Verified
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                      <span
                        className="flex items-center gap-1.5 hover:text-zinc-300 transition-colors cursor-help"
                        title={c.email || 'No email'}
                      >
                        <User size={12} />
                        <span className="font-medium">{c.author}</span>
                      </span>

                      <span className="w-1 h-1 rounded-full bg-zinc-800" />

                      <span className="flex items-center gap-1.5 font-mono">
                        <Clock size={12} /> {formatDate(c.date)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 w-full sm:w-auto justify-between sm:justify-start">
                  <button
                    onClick={() => handleCopy(c.id)}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg bg-black/40 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800 transition-all group/hash"
                    title="Copy full hash"
                  >
                    <span className="text-[10px] font-mono text-zinc-500 group-hover/hash:text-zinc-300">
                      {c.id.substring(0, 7)}
                    </span>
                    {copiedId === c.id ? (
                      <Check size={10} className="text-green-500" />
                    ) : (
                      <Copy size={10} className="text-zinc-600 group-hover/hash:text-zinc-400" />
                    )}
                  </button>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1.5 bg-zinc-800/50 px-2 py-1 rounded-md border border-transparent">
                      <FileText size={12} />
                      <span className="font-mono">{(c.stats as any)?.files || '?'}</span>
                      files
                    </span>

                    {!isActive && (
                      <button
                        onClick={() => onTimeTravel(c.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-[10px] font-bold hover:bg-blue-50 transition-colors shadow-lg shadow-white/5 active:scale-95"
                      >
                        <CornerDownRight size={12} /> Browse
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

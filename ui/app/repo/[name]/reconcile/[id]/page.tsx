"use client";
import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useReconciliation } from "@/hooks/useReconciliation";
import { ConflictEditor } from "@/components/merge/ConflictEditor";
import {
  ShieldAlert,
  CheckCircle,
  ArrowLeft,
  Zap,
  FilePlus2,
  ChevronRight,
  Layers,
} from "lucide-react";
import axios from "axios";
import { formatBytes } from "@/utils/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

export default function ReconcilePage() {
  const params = useParams();
  const router = useRouter();
  const repoName = params.name as string;
  const divergentId = params.id as string;

  const { data, loading } = useReconciliation(repoName, divergentId);

  const [resolvedFiles, setResolvedFiles] = useState<Record<string, string>>({});
  const [selectedConflict, setSelectedConflict] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  const { conflicts, newFiles } = useMemo(() => {
    if (!data) return { conflicts: [], newFiles: [] };

    const remoteMap = new Map<string, { path: string; hash: string; size: number }>(
      data.remote.files.map((f: any) => [f.path, f])
    );

    const conflicts = data.local.files
    .filter((f: any) => {
      const remoteFile = remoteMap.get(f.path);
      return remoteFile && remoteFile.hash !== f.hash;
    })
    .map((f: any) => {
      const remoteFile = remoteMap.get(f.path);
      return {
        path: f.path,
        size: f.size,
        localHash: f.hash,
        remoteHash: remoteFile!.hash,
      };
    });

    const newFiles = data.local.files.filter(
      (f: any) => !remoteMap.has(f.path)
    );

    return { conflicts, newFiles };
  }, [data]);

  if (loading || !data) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center gap-6">
        <ShieldAlert size={32} className="animate-pulse text-purple-500" />
        <span className="font-mono text-xs text-zinc-500">
          ANALYZING TIMELINES…
        </span>
      </div>
    );
  }

  const handleResolve = (path: string, hash: string) => {
    setResolvedFiles((p) => ({ ...p, [path]: hash }));
    setTimeout(() => {
      const idx = conflicts.findIndex((c: any) => c.path === path);
      const next = conflicts.find(
        (c: any, i: number) => i > idx && !resolvedFiles[c.path]
      );
      setSelectedConflict(next ? next.path : null);
    }, 300);
  };

  const handleMerge = async () => {
    setIsMerging(true);
    try {
      await axios.post(`${API_URL}/repos/${repoName}/merge`, {
        divergent_commit_id: data.local.id,
        remote_commit_id: data.remote.id,
        decisions: resolvedFiles,
      });
      router.push(`/repo/${repoName}`);
    } catch {
      alert("Merge failed.");
      setIsMerging(false);
    }
  };

  const current = conflicts.find(
    (c: any) => c.path === selectedConflict
  );
  const ready = Object.keys(resolvedFiles).length === conflicts.length;

  return (
    <main className="h-screen flex flex-col bg-black text-white overflow-hidden">
      <header className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              selectedConflict
                ? setSelectedConflict(null)
                : router.back()
            }
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-sm font-bold">
              <span className="bg-gradient-to-br from-purple-500 to-blue-500 bg-clip-text text-transparent">
                Resonance
              </span>{" "}
              Reconciliation
            </h1>
            <span className="text-[10px] font-mono text-zinc-500">
              REMOTE {data.remote.id.slice(0, 6)} / LOCAL{" "}
              {data.local.id.slice(0, 6)}
            </span>
          </div>
        </div>

        <button
          onClick={handleMerge}
          disabled={!ready || isMerging}
          className={`h-9 px-5 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 border transition
            ${
              ready
                ? "bg-white text-black border-white hover:scale-105"
                : "bg-transparent text-zinc-600 border-zinc-800 cursor-not-allowed"
            }`}
        >
          {isMerging ? (
            <Zap size={14} className="animate-spin" />
          ) : (
            <CheckCircle size={14} />
          )}
          Merge
        </button>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        <aside
          className={`absolute inset-0 z-10 bg-black border-r border-white/5 transition-transform duration-300
          md:relative md:w-80 md:translate-x-0
          ${selectedConflict ? "-translate-x-full" : "translate-x-0"}`}
        >
          <div className="p-4 border-b border-white/5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Conflicts ({conflicts.length - Object.keys(resolvedFiles).length} left)
          </div>

          <div className="p-3 space-y-1 overflow-y-auto">
            {conflicts.map((file: any) => {
              const done = resolvedFiles[file.path];
              const active = selectedConflict === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedConflict(file.path)}
                  className={`w-full px-3 py-3 rounded-lg text-xs font-mono flex items-center justify-between border transition
                    ${
                      active
                        ? "bg-zinc-800 border-zinc-700"
                        : "border-transparent text-zinc-400 hover:bg-zinc-900"
                    }
                    ${done ? "opacity-50" : ""}`}
                >
                  <div className="flex gap-3 truncate">
                    <span
                      className={`w-2 h-2 rounded-full mt-1 ${
                        done ? "bg-green-500" : "bg-amber-500"
                      }`}
                    />
                    <div className="truncate text-left">
                      <div className="truncate">{file.path}</div>
                      <div className="text-[10px] text-zinc-600">
                        {formatBytes(file.size)}
                      </div>
                    </div>
                  </div>
                  {done ? (
                    <CheckCircle size={14} className="text-green-500" />
                  ) : (
                    <ChevronRight size={14} className="text-zinc-600" />
                  )}
                </button>
              );
            })}

            {newFiles.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <Layers size={12} /> Auto-Added
                </h2>
                {newFiles.map((f: any) => (
                  <div
                    key={f.path}
                    className="px-3 py-2 text-xs font-mono flex items-center gap-2 text-emerald-500/60"
                  >
                    <FilePlus2 size={14} />
                    <span className="truncate">{f.path}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section
          className={`absolute inset-0 z-20 bg-black transition-transform duration-300
          md:relative md:flex-1 md:translate-x-0
          ${selectedConflict ? "translate-x-0" : "translate-x-full"}`}
        >
          {current ? (
            <div className="h-full p-2 md:p-4">
              <ConflictEditor
                key={current.path}
                file={current}
                repoName={repoName}
                onResolve={handleResolve}
              />
            </div>
          ) : (
            <div className="hidden md:flex h-full flex-col items-center justify-center text-zinc-600">
              <ShieldAlert size={48} />
              <p className="mt-4 text-sm">
                Select a conflict to begin resolution
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

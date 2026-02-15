'use client';
import React, { useState, useEffect } from 'react';
import { useRepository } from '@/hooks/useRepository';
import { FileExplorer } from '@/components/repository/FileExplorer';
import { FilePreview } from '@/components/repository/FilePreview';
import { CommitTimeline } from '@/components/repository/CommitTimeline';
import { ContainerRegistry } from '@/components/repository/ContainerRegistry';
import { ForgeConsole } from '@/components/repository/ForgeConsole';
import { SlidingTabs } from '@/components/ui/SlidingTabs';
import { PipelineBadge } from '@/components/pipelines/PipelineBadge';
import {
  Terminal,
  ShieldAlert,
  Layers,
  History,
  GitGraph,
  Box,
  Settings,
  ArrowLeft,
  Clock,
  Copy,
  Check,
  Github,
  GitBranch,
  Gitlab,
  PlayCircle,
  Rocket,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { ReleaseList } from '@/components/repository/ReleaseList';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

const getProviderIcon = (url: string) => {
  if (url.includes('github.com')) return <Github size={18} />;
  if (url.includes('gitlab.com')) return <Gitlab size={18} />;
  return <GitBranch size={18} />;
};

export default function RepoPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: repoName } = React.use(params);
  const router = useRouter();
  const { data: session } = useSession();

  const [view, setView] = useState<'files' | 'history' | 'packages' | 'releases'>('files');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showConsole, setShowConsole] = useState(false);
  const [copiedClone, setCopiedClone] = useState(false);
  const [timeTravelId, setTimeTravelId] = useState<string | null>(null);
  const [mirrorUrl, setMirrorUrl] = useState<string | null>(null);
  const [latestPipeline, setLatestPipeline] = useState<any>(null);

  const { files, commits, currentCommit, loading } = useRepository(repoName, timeTravelId);

  useEffect(() => {
    if (session?.accessToken) {
      axios
        .get(`${API_URL}/repos/${repoName}/mirror`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        })
        .then((res) => {
          if (res.data.configured && res.data.enabled) {
            setMirrorUrl(res.data.remote_url);
          }
        })
        .catch(() => {});
    }
  }, [repoName, session]);

  useEffect(() => {
    if (session?.accessToken) {
      const fetchPipeline = async () => {
        try {
          const res = await axios.get(`${API_URL}/repos/${repoName}/pipelines`, {
            headers: { Authorization: `Bearer ${session.accessToken}` },
          });
          if (res.data && res.data.length > 0) {
            setLatestPipeline(res.data[0]);
          }
        } catch (e) {}
      };
      fetchPipeline();
      const interval = setInterval(fetchPipeline, 2000);
      return () => clearInterval(interval);
    }
  }, [repoName, session]);

  useEffect(() => {
    if (!loading && files.length > 0 && !selectedFile) {
      const readme = files.find((f) => f.path.toLowerCase() === 'readme.md');
      if (readme) setSelectedFile(readme.path);
      else {
        const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
        setSelectedFile(sortedFiles[0]?.path);
      }
    }
  }, [loading, files, selectedFile]);

  const handleTimeTravel = (commitId: string) => {
    setTimeTravelId(commitId);
    setView('files');
    setSelectedFile(null);
  };

  const resetTimeTravel = () => {
    setTimeTravelId(null);
    setView('files');
  };

  if (loading)
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-[#050505]">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_20px_rgba(37,99,235,0.4)]" />
        <p className="text-zinc-500 font-mono text-sm animate-pulse tracking-widest uppercase">
          Resonating...
        </p>
      </div>
    );

  const isVoid = commits.length === 0;
  const isAdmin =
    currentCommit?.access_level === 'admin' || currentCommit?.access_level === 'owner';

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-[#050505] overflow-hidden">
      {showConsole && <ForgeConsole repoName={repoName} onClose={() => setShowConsole(false)} />}

      <div className="shrink-0 border-b border-zinc-800/50 px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black/40 backdrop-blur-sm z-20">
        <div className="flex items-center gap-4 lg:gap-6 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg bg-zinc-900/50 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all group shrink-0"
            title="Go Back"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div className="text-sm font-medium truncate flex items-center gap-2 shrink-0">
            <span className="p-1.5 bg-blue-600/10 rounded-md text-blue-500">
              <GitGraph size={14} />
            </span>
            <span className="text-zinc-500 hidden sm:inline">repo</span>
            <span className="text-zinc-700 text-xs hidden sm:inline">/</span>
            <span className="text-white font-bold tracking-tight">{repoName}</span>
          </div>

          <div className="h-6 w-px bg-zinc-800 hidden sm:block shrink-0" />

          <SlidingTabs
            activeTab={view}
            onChange={setView}
            tabs={[
              { id: 'files', label: 'Assets', icon: Layers },
              { id: 'history', label: 'History', icon: History },
              { id: 'packages', label: 'Packages', icon: Box },
              { id: 'releases', label: 'Distributions', icon: Rocket },
            ]}
          />

          {latestPipeline && (
            <Link
              href={`/repo/${repoName}/pipelines/${latestPipeline.id}`}
              className="ml-2 flex items-center gap-2 group shrink-0"
            >
              <div className="h-6 w-px bg-zinc-800 hidden sm:block" />
              <div className="flex items-center gap-2 hover:bg-zinc-900/60 p-1.5 rounded-lg transition-colors border border-transparent hover:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider hidden xl:inline group-hover:text-zinc-300">
                  Pipeline
                </span>
                <PipelineBadge status={latestPipeline.status} />
                <PlayCircle
                  size={14}
                  className="text-zinc-600 group-hover:text-blue-400 transition-colors"
                />
              </div>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {commits.some((c) => c.is_divergent) && (
            <div className="px-4 py-2 bg-purple-600/10 border border-purple-500/30 rounded-lg flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
              <ShieldAlert size={16} className="text-purple-400" />
              <span className="text-xs text-purple-200 font-medium hidden sm:inline">
                Divergence
              </span>
              <Link
                href={`/repo/${repoName}/reconcile/${commits.find((c) => c.is_divergent)?.id}`}
                className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-md transition-all shadow-lg active:scale-95 uppercase tracking-wide"
              >
                Resolve
              </Link>
            </div>
          )}

          {timeTravelId && (
            <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-3 animate-in fade-in">
              <span className="text-xs text-blue-200 font-bold flex items-center gap-2">
                <Clock size={14} /> <span className="hidden sm:inline">Past:</span>{' '}
                <span className="font-mono">{timeTravelId.substring(0, 8)}</span>
              </span>
              <button
                onClick={resetTimeTravel}
                className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded font-bold transition-colors"
              >
                Return
              </button>
            </div>
          )}

          {!timeTravelId && (
            <div className="flex flex-col items-end hidden lg:flex">
              <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                Resonance
              </span>
              <span
                className={`text-[10px] font-mono ${
                  isVoid ? 'text-zinc-700 italic' : 'text-blue-500'
                }`}
              >
                {isVoid ? 'VOID' : currentCommit?.commit_id?.substring(0, 8)}
              </span>
            </div>
          )}

          {isAdmin && (
            <Link
              href={`/repo/${repoName}/settings`}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Repository Settings"
            >
              <Settings size={18} />
            </Link>
          )}

          <button
            onClick={() => setShowConsole(true)}
            className="bg-white hover:bg-zinc-200 text-black text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Terminal size={14} /> <span className="hidden sm:inline">CLI</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col relative">
        {view === 'releases' ? (
          <div className="flex-1 lg:overflow-y-auto custom-scrollbar w-full max-w-5xl mx-auto h-full p-6">
            <ReleaseList repoName={repoName} />
          </div>
        ) : view === 'packages' ? (
          <div className="flex-1 lg:overflow-y-auto custom-scrollbar w-full max-w-6xl mx-auto h-full p-4">
            <ContainerRegistry repoName={repoName} />
          </div>
        ) : isVoid ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-zinc-900/50 rounded-3xl border border-zinc-800 flex items-center justify-center mb-6 text-zinc-700 shadow-xl shadow-black">
              <Terminal size={40} />
            </div>
            <h1 className="text-3xl font-bold mb-2 tracking-tight text-white">
              Repository is Void
            </h1>
            <p className="text-zinc-500 max-w-md mb-8 leading-relaxed">
              This repository has been initialized on the Forge but contains no matter yet.
              <br />
              Resonate your local files to see them here.
            </p>

            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div
                className="relative bg-black border border-zinc-800 p-1 pl-4 pr-2 rounded-xl flex items-center gap-4 cursor-pointer hover:border-zinc-600 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(`plectr clone ${repoName}`);
                  setCopiedClone(true);
                  setTimeout(() => setCopiedClone(false), 2000);
                }}
              >
                <code className="font-mono text-sm text-blue-400">
                  $ plectr clone <span className="text-white font-bold">{repoName}</span>
                </code>
                <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors">
                  {copiedClone ? (
                    <Check size={16} className="text-green-500" />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
              </div>
            </div>

            <p className="mt-4 text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
              Or push an existing project
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 p-4 gap-4 flex flex-col lg:flex-row">
            {view === 'files' ? (
              <>
                <div className="w-full lg:w-80 shrink-0 flex flex-col h-[300px] lg:h-full">
                  <FileExplorer
                    files={files}
                    selectedPath={selectedFile}
                    onSelect={setSelectedFile}
                  />
                </div>
                <div className="flex-1 min-w-0 h-full">
                  <FilePreview
                    repoName={repoName}
                    commitId={timeTravelId || currentCommit?.commit_id}
                    path={selectedFile}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 lg:overflow-y-auto custom-scrollbar w-full max-w-5xl mx-auto h-full">
                <CommitTimeline
                  commits={commits}
                  onTimeTravel={handleTimeTravel}
                  activeCommitId={timeTravelId || currentCommit?.commit_id}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

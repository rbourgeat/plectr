'use client';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2,
  Terminal,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  PlayCircle,
  AlertTriangle,
  LayoutDashboard,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

export default function PipelineDetailPage() {
  const { name: repoName, id: pipelineId } = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const userHasScrolledRef = useRef(false);

  useEffect(() => {
    const el = logContainerRef.current;
    if (el && !userHasScrolledRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [jobs, selectedJobId]);

  const handleScroll = () => {
    const el = logContainerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50;
    userHasScrolledRef.current = !isAtBottom;
  };

  useEffect(() => {
    if (!session?.accessToken) return;

    const fetchJobs = async () => {
      try {
        const res = await axios.get(`${API_URL}/repos/${repoName}/pipelines/${pipelineId}`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        const newJobs = res.data.jobs;
        setJobs(newJobs);

        setSelectedJobId((prev) => {
          if (prev) return prev;
          if (newJobs.length > 0) {
            const running = newJobs.find((j: any) => j.status === 'running') || newJobs[0];
            return running.id;
          }
          return null;
        });
      } catch (e) {
        console.error(e);
      }
    };

    fetchJobs();
    const interval = setInterval(fetchJobs, 1000);
    return () => clearInterval(interval);
  }, [repoName, pipelineId, session]);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || jobs[0];

  const stages = jobs.reduce((acc: any, job) => {
    if (!acc[job.stage]) acc[job.stage] = [];
    acc[job.stage].push(job);
    return acc;
  }, {});

  const getStatusColor = (status: string, isSelected: boolean) => {
    if (isSelected)
      return 'ring-2 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] bg-zinc-900 border-transparent';

    switch (status) {
      case 'success':
        return 'text-green-500 bg-green-500/5 border-green-500/20 hover:border-green-500/50';
      case 'failed':
        return 'text-red-500 bg-red-500/5 border-red-500/20 hover:border-red-500/50';
      case 'running':
        return 'text-blue-500 bg-blue-500/5 border-blue-500/20 animate-pulse';
      default:
        return 'text-zinc-500 bg-zinc-900 border-zinc-800 hover:border-zinc-700';
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-[#050505] overflow-hidden animate-in fade-in">
      <div className="shrink-0 h-14 border-b border-zinc-800 flex items-center px-4 gap-4 bg-zinc-950/50 backdrop-blur-md z-20">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-transparent hover:border-zinc-700"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="h-6 w-px bg-zinc-800" />
        <div className="flex items-center gap-2 text-sm font-bold text-zinc-200">
          <PlayCircle size={16} className="text-blue-500" />
          Pipeline{' '}
          <span className="font-mono text-zinc-500">#{String(pipelineId).substring(0, 8)}</span>
        </div>
      </div>

      <div className="shrink-0 h-32 border-b border-zinc-800 bg-[#080808] flex items-center px-8 gap-8 overflow-x-auto custom-scrollbar relative">
        {Object.keys(stages).map((stage, idx) => (
          <div key={stage} className="flex items-center gap-6 shrink-0">
            <div className="flex flex-col gap-3">
              <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest pl-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700"></span>
                {stage}
              </span>
              <div className="flex gap-3">
                {stages[stage].map((job: any) => (
                  <div key={job.id} className="relative group/tooltip">
                    <button
                      onClick={() => {
                        setSelectedJobId(job.id);
                        userHasScrolledRef.current = false;
                      }}
                      className={`
                      w-11 h-11 rounded-xl border flex items-center justify-center transition-all duration-300
                      ${getStatusColor(job.status, selectedJobId === job.id)}
                    `}
                    >
                      {job.status === 'running' && <Loader2 size={18} className="animate-spin" />}
                      {job.status === 'success' && <CheckCircle size={18} />}
                      {job.status === 'failed' && <XCircle size={18} />}
                      {job.status === 'pending' && <Clock size={18} />}
                    </button>

                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl">
                      {job.name}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-800 border-b border-r border-zinc-700 rotate-45"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {idx < Object.keys(stages).length - 1 && (
              <div className="h-px w-8 bg-zinc-800/50 mt-5" />
            )}
          </div>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {selectedJob ? (
          <div className="flex-1 flex flex-col bg-[#0c0c0c] w-full">
            <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/30 shrink-0">
              <div className="flex items-center gap-3">
                <Terminal size={16} className="text-zinc-500" />
                <span className="font-bold text-sm text-zinc-200">{selectedJob.name}</span>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wider 
                ${
                  selectedJob.status === 'failed'
                    ? 'text-red-400 border-red-500/30 bg-red-500/10'
                    : selectedJob.status === 'success'
                    ? 'text-green-400 border-green-500/30 bg-green-500/10'
                    : 'text-zinc-500 border-zinc-700'
                }`}
                >
                  {selectedJob.status}
                </span>
              </div>
              <div className="text-xs font-mono text-zinc-500 flex items-center gap-2">
                <Clock size={12} /> {selectedJob.duration}
              </div>
            </div>

            <div
              ref={logContainerRef}
              onScroll={handleScroll}
              className="flex-1 p-6 overflow-auto custom-scrollbar font-mono text-xs leading-relaxed text-zinc-300 selection:bg-blue-500/30"
            >
              {selectedJob.logs ? (
                <pre className="whitespace-pre-wrap break-all">{selectedJob.logs}</pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2">
                  <Loader2 size={24} className="animate-spin opacity-20" />
                  <p>Waiting for runner output...</p>
                </div>
              )}

              {selectedJob.status === 'running' && (
                <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse align-middle ml-1" />
              )}

              {selectedJob.status === 'failed' && (
                <div className="mt-6 p-4 rounded-xl bg-red-950/20 border border-red-500/20 text-red-400 flex items-start gap-3">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold mb-1">Resonance Failed</p>
                    <p className="opacity-80">
                      Process exited with code {selectedJob.exit_code}. Check the logs above for
                      stack traces.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 bg-[#050505]">
            <LayoutDashboard size={48} className="mb-4 opacity-20" />
            <p>Select a resonance job to inspect</p>
          </div>
        )}
      </div>
    </div>
  );
}

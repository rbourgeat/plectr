import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Eye, FileCode2, Ban, Download, Copy, Check } from 'lucide-react';
import { SafeTensorDashboard } from './safetensors/SafeTensorDashboard';
import { normalizeSafeTensorMetadata } from './safetensors/normalize';
import { CsvViewer } from './preview/CsvViewer';
import { MarkdownViewer } from './preview/MarkdownViewer';
import { ImageViewer } from './preview/ImageViewer';
import { CodeViewer } from './preview/CodeViewer';
import { getFileIcon } from '@/utils/icons';
import { formatBytes } from '@/utils/format';
import { SlidingTabs } from '@/components/ui/SlidingTabs';
import { useSession } from 'next-auth/react';
import { useToast } from '@/context/ToastContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];

type ViewMode = 'preview' | 'raw';

export const FilePreview = ({
  repoName,
  commitId,
  path,
}: {
  repoName: string;
  commitId: string;
  path: string | null;
}) => {
  const { data: session } = useSession();
  const { success, error: toastError } = useToast();

  const [content, setContent] = useState<any>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');

  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setViewMode('preview');
  }, [path]);

  useEffect(() => {
    if (!path || !commitId) return;

    const loadContent = async () => {
      setLoading(true);
      setError(null);
      setContent(null);

      try {
        const ext = path.split('.').pop()?.toLowerCase() || '';
        const isImage = IMAGE_EXTENSIONS.includes(ext);
        const isSafeTensor = path.endsWith('.safetensors');
        const isCsv = path.endsWith('.csv') || path.endsWith('.parquet');

        const metaRes = await axios.get(
          `${API_URL}/repos/${repoName}/commits/${commitId}/metadata/${path}`
        );
        const meta = metaRes.data;
        setFileSize(meta.size);

        if (isImage) {
          setContent({ type: 'image' });
        } else if (isSafeTensor) {
          if (meta.metadata) setContent({ ...meta.metadata, type: 'safetensors' });
          else setError('No metadata available');
        } else if (isCsv) {
          if (path.endsWith('.csv') && meta.size < 500 * 1024) {
            const contentRes = await axios.get(
              `${API_URL}/repos/${repoName}/commits/${commitId}/files/${path}`
            );
            setContent(contentRes.data);
          } else {
            setContent({ type: 'dataset_lazy_load', path: path });
          }
        } else {
          if (meta.size > 2 * 1024 * 1024) {
            setContent(`File too large (${formatBytes(meta.size)}). Use CLI.`);
          } else {
            const contentRes = await axios.get(
              `${API_URL}/repos/${repoName}/commits/${commitId}/files/${path}`
            );
            setContent(contentRes.data);
          }
        }
      } catch (e) {
        console.error(e);
        setError('Impossible to resonate with this asset.');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [path, commitId, repoName]);

  const handleCopy = () => {
    if (typeof content === 'string') {
      navigator.clipboard.writeText(content);
      setIsCopied(true);
      success('Content copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    } else if (typeof content === 'object') {
      navigator.clipboard.writeText(JSON.stringify(content, null, 2));
      setIsCopied(true);
      success('Metadata copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    if (!path) return;
    setIsDownloading(true);
    try {
      const response = await axios.get(
        `${API_URL}/repos/${repoName}/commits/${commitId}/files/${path}`,
        {
          responseType: 'blob',
          headers: { Authorization: `Bearer ${session?.accessToken}` },
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', path.split('/').pop() || 'file');
      document.body.appendChild(link);
      link.click();
      link.remove();
      success('Download started');
    } catch (e) {
      toastError('Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!path) {
    return (
      <div className="h-full flex flex-col items-center justify-center glass-panel rounded-3xl border border-zinc-800 shadow-2xl bg-[#050505]">
        <div className="p-4 bg-zinc-900/50 rounded-full mb-4">
          <Eye size={24} className="text-zinc-600" />
        </div>
        <div className="text-zinc-500 font-mono text-sm italic">Select a file to materialize</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-[600px] lg:h-full glass-panel rounded-3xl border border-zinc-800 shadow-2xl flex flex-col items-center justify-center text-blue-500 bg-[#050505]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="font-mono text-xs animate-pulse tracking-widest">DECODING ASSET...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[600px] lg:h-full glass-panel rounded-3xl border border-red-900/30 flex items-center justify-center bg-[#050505]">
        <p className="text-red-400 font-mono text-xs">{error}</p>
      </div>
    );
  }

  const isSafeTensor = path.endsWith('.safetensors');
  const isDataset = path.toLowerCase().endsWith('.csv') || path.toLowerCase().endsWith('.parquet');
  const isTooLarge = fileSize > 2 * 1024 * 1024;
  const isImage = path
    ? IMAGE_EXTENSIONS.includes(path.split('.').pop()?.toLowerCase() || '')
    : false;

  const rawDisabled =
    isSafeTensor || (isDataset && typeof content !== 'string') || isTooLarge || isImage;
  const canCopy = !isImage && !isTooLarge && !isDataset;

  const renderContent = () => {
    if (viewMode === 'raw') {
      const rawText = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      return (
        <div className="absolute inset-0 overflow-auto custom-scrollbar bg-[#0a0a0a] p-4">
          <pre className="font-mono text-xs text-zinc-400 whitespace-pre font-medium">
            {rawText}
          </pre>
        </div>
      );
    }

    const ext = path?.split('.').pop()?.toLowerCase() || '';
    if (IMAGE_EXTENSIONS.includes(ext)) {
      return <ImageViewer repoName={repoName} commitId={commitId} path={path!} />;
    }

    if (isSafeTensor && content && content.type !== 'image') {
      const normalized = normalizeSafeTensorMetadata(content);
      return (
        <div className="h-full overflow-hidden">
          <SafeTensorDashboard data={normalized} />
        </div>
      );
    }

    if (path?.toLowerCase().endsWith('.csv') || path?.toLowerCase().endsWith('.parquet')) {
      return (
        <CsvViewer
          repoName={repoName}
          commitId={commitId}
          path={path!}
          content={typeof content === 'string' ? content : undefined}
        />
      );
    }

    if (path?.toLowerCase().endsWith('.md')) {
      return <MarkdownViewer content={typeof content === 'string' ? content : ''} />;
    }

    return (
      <CodeViewer
        content={typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
        path={path || ''}
      />
    );
  };

  return (
    <div className="glass-panel rounded-3xl overflow-hidden h-[600px] lg:h-full border border-zinc-800 shadow-2xl flex flex-col bg-[#050505]">
      <div className="h-12 border-b border-zinc-800/50 bg-zinc-950/80 flex items-center justify-between px-4 shrink-0 backdrop-blur-md z-10">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="shrink-0 opacity-80">{getFileIcon(path || '')}</div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-zinc-300 truncate">
              {path || 'No file selected'}
            </span>
            <span className="text-[10px] font-mono text-zinc-600">{formatBytes(fileSize)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {canCopy && (
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Copy Content"
              >
                {isCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors ${
                isDownloading ? 'animate-pulse' : ''
              }`}
              title="Download File"
            >
              <Download size={16} />
            </button>
          </div>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          <SlidingTabs
            activeTab={viewMode}
            onChange={setViewMode}
            tabs={[
              { id: 'preview', label: 'Preview', icon: Eye },
              {
                id: 'raw',
                label: 'Raw',
                icon: rawDisabled ? Ban : FileCode2,
                disabled: rawDisabled,
              },
            ]}
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative w-full">{renderContent()}</div>
    </div>
  );
};

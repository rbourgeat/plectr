import {
  FileCode,
  FileJson,
  FileSpreadsheet,
  FileText,
  Box,
  Image as ImageIcon,
  File,
  Database,
  Terminal,
} from 'lucide-react';
import { PlectrLogo } from '@/components/icons/PlectrLogo';

export const getFileIcon = (path: string, size: number = 18) => {
  if (path.toLowerCase().endsWith('plectr.yaml') || path.toLowerCase().endsWith('plectr.yml')) {
    return (
      <div className="shrink-0 flex items-center justify-center filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <PlectrLogo size={size} />
      </div>
    );
  }

  const ext = path.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'rs':
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'go':
    case 'c':
    case 'cpp':
      return <FileCode size={size} className="text-blue-400" />;

    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'xml':
      return <FileJson size={size} className="text-yellow-400" />;

    case 'csv':
    case 'parquet':
    case 'xls':
    case 'xlsx':
      return <FileSpreadsheet size={size} className="text-green-400" />;

    case 'md':
    case 'txt':
      return <FileText size={size} className="text-zinc-400" />;

    case 'safetensors':
    case 'pt':
    case 'ckpt':
    case 'gguf':
      return <Box size={size} className="text-purple-400" />;

    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'webp':
      return <ImageIcon size={size} className="text-pink-400" />;

    case 'sql':
    case 'db':
    case 'sqlite':
      return <Database size={size} className="text-cyan-400" />;

    case 'sh':
    case 'bash':
      return <Terminal size={size} className="text-zinc-300" />;

    default:
      return <File size={size} className="text-zinc-500" />;
  }
};

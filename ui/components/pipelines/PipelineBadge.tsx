import { CheckCircle, XCircle, Loader2, Clock, CircleSlash } from 'lucide-react';

export const PipelineBadge = ({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) => {
  const styles: any = {
    success: {
      icon: CheckCircle,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
    },
    failed: {
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
    },
    running: {
      icon: Loader2,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      animate: true,
    },
    pending: { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700' },
    cancelled: {
      icon: CircleSlash,
      color: 'text-zinc-500',
      bg: 'bg-zinc-900',
      border: 'border-zinc-800',
    },
  };

  const s = styles[status?.toLowerCase()] || styles.pending;
  const Icon = s.icon;
  const textSize = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2.5 py-1';
  const iconSize = size === 'sm' ? 10 : 12;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wider border ${s.bg} ${s.color} ${s.border} ${textSize}`}
    >
      <Icon size={iconSize} className={s.animate ? 'animate-spin' : ''} />
      {status || 'Unknown'}
    </span>
  );
};

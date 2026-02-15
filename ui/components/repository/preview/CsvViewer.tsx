import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Loader2, Database } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'idea' | 'neutral' | 'caution';

interface BadgeRule {
  variant: BadgeVariant;
  keywords: string[];
}

const BADGE_RULES: BadgeRule[] = [
  {
    variant: 'success',
    keywords: ['done', 'completed', 'success', 'fixed', 'resolved', 'validated', 'ok', 'pass'],
  },
  {
    variant: 'danger',
    keywords: ['p0', 'critical', 'blocker', 'severe', 'very high', 'fail', 'error', 'bug'],
  },
  {
    variant: 'caution',
    keywords: ['p1', 'high', 'major', 'hard', 'urgent'],
  },
  {
    variant: 'warning',
    keywords: ['p2', 'medium', 'moderate', 'warn', 'wip'],
  },
  {
    variant: 'info',
    keywords: ['pending', 'in progress', 'open', 'review', 'analysis', 'running'],
  },
  {
    variant: 'idea',
    keywords: ['idea', 'draft', 'concept', 'proposal', 'future'],
  },
  {
    variant: 'neutral',
    keywords: ['p3', 'low', 'minor', 'easy', 'tbd', 'unknown', 'none', 'n/a'],
  },
];

const BADGE_STYLES: Record<BadgeVariant, string> = {
  success:
    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
  caution: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  idea: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  neutral: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

interface Props {
  repoName: string;
  commitId: string;
  path: string;
  content?: string;
}

export const CsvViewer = ({ repoName, commitId, path, content }: Props) => {
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const parseCSVLine = (text: string) => {
    const result = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cell.trim());
        cell = '';
      } else {
        cell += char;
      }
    }
    result.push(cell.trim());
    return result.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
  };

  const renderCell = (value: any) => {
    const strVal = String(value).trim();
    if (!strVal) return <span className="text-zinc-700">-</span>;

    const lowerVal = strVal.toLowerCase();

    const rule = BADGE_RULES.find((r) => r.keywords.includes(lowerVal));

    if (rule) {
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
            BADGE_STYLES[rule.variant]
          }`}
        >
          {strVal}
        </span>
      );
    }

    return <span className="text-zinc-300">{strVal}</span>;
  };

  useEffect(() => {
    if (content) {
      setLoading(false);
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        const headerRow = parseCSVLine(lines[0]);
        setHeaders(headerRow);
        const rows = lines.slice(1).map((line) => {
          const values = parseCSVLine(line);
          const rowObj: any = {};
          headerRow.forEach((h, i) => {
            rowObj[h] = values[i] || '';
          });
          return rowObj;
        });
        setData(rows);
      }
      return;
    }

    const fetchPreview = async () => {
      setLoading(true);
      try {
        const query = "SELECT * FROM read_csv_auto('input_file') LIMIT 100";
        const res = await axios.post(
          `${API_URL}/analytics/repos/${repoName}/commits/${commitId}/files/${encodeURIComponent(
            path
          )}`,
          { query }
        );
        if (res.data.data && res.data.data.length > 0) {
          setData(res.data.data);
          setHeaders(Object.keys(res.data.data[0]));
        }
      } catch (e) {
        console.error('DuckDB Preview Error', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [repoName, commitId, path, content]);

  if (loading)
    return (
      <div className="flex h-full items-center justify-center text-zinc-500 gap-2">
        <Loader2 className="animate-spin" size={20} />
        <span className="font-mono text-xs">Parsing Dataset...</span>
      </div>
    );

  if (data.length === 0)
    return <div className="p-10 text-center text-zinc-500">Empty or Invalid Dataset</div>;

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/40">
        <Database size={14} className="text-blue-400" />
        <span className="text-xs font-bold text-zinc-300">
          Dataset Preview{' '}
          <span className="text-zinc-500 font-normal">
            {content ? '(Full)' : '(First 100 rows)'}
          </span>
        </span>
      </div>

      <div className="overflow-auto custom-scrollbar flex-1">
        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead className="bg-zinc-900/90 sticky top-0 z-10 backdrop-blur-sm shadow-sm">
            <tr>
              <th className="p-3 border-b border-zinc-800 text-zinc-500 w-12 text-center bg-zinc-900/90">
                #
              </th>
              {headers.map((h) => (
                <th
                  key={h}
                  className="p-3 border-b border-zinc-800 border-r border-zinc-800/50 text-zinc-300 font-semibold whitespace-nowrap bg-zinc-900/90"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/30">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-blue-500/5 transition-colors group">
                <td className="p-2 text-center text-zinc-600 bg-zinc-950/50 border-r border-zinc-800 group-hover:bg-blue-500/10 transition-colors">
                  {i + 1}
                </td>
                {headers.map((h) => (
                  <td
                    key={`${i}-${h}`}
                    className="p-2 border-r border-zinc-800/30 whitespace-nowrap max-w-[300px] truncate"
                  >
                    {renderCell(row[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { FileEntry } from '@/types/repo';
import { getFileIcon } from '@/utils/icons';

interface Props {
  files: FileEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

type TreeNode = {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  children: Record<string, TreeNode>;
  fileData?: FileEntry;
};

export const FileExplorer = ({ files, selectedPath, onSelect }: Props) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));
  const [searchTerm, setSearchTerm] = useState('');

  const tree = useMemo(() => {
    const root: TreeNode = { name: 'root', path: '', type: 'tree', children: {} };

    files.forEach(file => {
      const parts = file.path.split('/');
      let current = root;

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');

        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            type: isFile ? 'blob' : 'tree',
            children: {},
            fileData: isFile ? file : undefined,
          };
        }
        current = current.children[part];
      });
    });

    if (selectedPath) {
      const parts = selectedPath.split('/');
      const pathsToOpen = new Set(expandedFolders);
      let pathBuilder = '';
      parts.slice(0, -1).forEach(part => {
        pathBuilder += (pathBuilder ? '/' : '') + part;
        pathsToOpen.add(pathBuilder);
      });
      if (pathsToOpen.size > expandedFolders.size) {
        setExpandedFolders(pathsToOpen);
      }
    }

    return root;
  }, [files, selectedPath]);

  const toggleFolder = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedFolders);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpandedFolders(next);
  };

  const TreeItem = ({ node, level }: { node: TreeNode; level: number }) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedPath === node.path;

    const sortedChildren = Object.values(node.children).sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'tree' ? -1 : 1;
    });

    return (
      <div className="select-none">
        <div
          className={`
            flex items-center gap-1.5 py-1 px-2 cursor-pointer transition-colors rounded-md text-xs font-mono
            ${isSelected ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}
          `}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={(e) => {
            if (node.type === 'tree') toggleFolder(node.path, e);
            else onSelect(node.path);
          }}
        >
          <span className="shrink-0 w-4 h-4 flex items-center justify-center text-zinc-600">
            {node.type === 'tree' && (isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
          </span>

          <span className="shrink-0">
            {node.type === 'tree' ? (
              isExpanded ? <FolderOpen size={14} className="text-blue-400" /> : <Folder size={14} className="text-zinc-500" />
            ) : (
              getFileIcon(node.name, 14)
            )}
          </span>

          <span className={`truncate ${isSelected ? 'font-bold' : ''}`}>{node.name}</span>
        </div>

        {node.type === 'tree' && isExpanded && (
          <div>
            {sortedChildren.map((child) => (
              <TreeItem key={child.path} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const filteredFiles = files.filter(f => f.path.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-[#050505] rounded-xl border border-white/5 overflow-hidden">
      <div className="p-3 border-b border-white/5">
        <div className="relative group">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-400 transition-colors"
            size={12}
          />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50 focus:bg-zinc-900 transition-all placeholder:text-zinc-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
        {searchTerm ? (
          <div className="px-2">
            {filteredFiles.map(f => (
              <div
                key={f.path}
                onClick={() => onSelect(f.path)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5 text-zinc-400 text-xs font-mono mb-0.5"
              >
                {getFileIcon(f.path, 14)}
                {f.path}
              </div>
            ))}
            {filteredFiles.length === 0 && (
              <div className="text-center py-8 text-zinc-600 text-xs italic">No matching files</div>
            )}
          </div>
        ) : (
          Object.values(tree.children)
            .sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === 'tree' ? -1 : 1;
            })
            .map(node => <TreeItem key={node.path} node={node} level={0} />)
        )}
      </div>
    </div>
  );
};

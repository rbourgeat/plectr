'use client';
import Editor, { loader } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';
loader.config({ paths: { vs: '/monaco/vs' } });

interface Props {
  content: string;
  path: string;
}

const getLanguage = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'rs':
      return 'rust';
    case 'py':
      return 'python';
    case 'js':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'typescript';
    case 'jsx':
      return 'javascript';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'sql':
      return 'sql';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'toml':
      return 'ini';
    case 'sh':
      return 'shell';
    case 'md':
      return 'markdown';
    case 'dockerfile':
      return 'dockerfile';
    default:
      return 'plaintext';
  }
};

export const CodeViewer = ({ content, path }: Props) => {
  const language = getLanguage(path);

  const handleEditorWillMount = (monaco: any) => {
    monaco.editor.defineTheme('plectr-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc', fontStyle: 'bold' },
        { token: 'string', foreground: '86efac' },
        { token: 'number', foreground: 'fca5a5' },
        { token: 'type', foreground: '60a5fa' },
        { token: 'identifier', foreground: 'e4e4e7' },
        { token: 'delimiter', foreground: 'a1a1aa' },
      ],
      colors: {
        'editor.background': '#050505',
        'editor.foreground': '#e4e4e7',
        'editor.lineHighlightBackground': '#18181b',
        'editorLineNumber.foreground': '#52525b',
        'editorLineNumber.activeForeground': '#e4e4e7',
        'editor.selectionBackground': '#2563eb30',
        'editor.inactiveSelectionBackground': '#2563eb10',
        'scrollbarSlider.background': '#27272a80',
        'scrollbarSlider.hoverBackground': '#3f3f46',
        'editorIndentGuide.background': '#27272a',
        'editorIndentGuide.activeBackground': '#3f3f46',
      },
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      <div className="bg-[#050505] border-b border-zinc-800 p-2 px-4 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          {path}
        </span>
        <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider font-bold">
          {language}
        </span>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <Editor
          height="100%"
          language={language}
          value={content}
          theme="plectr-dark"
          beforeMount={handleEditorWillMount}
          loading={
            <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono">
              <Loader2 className="animate-spin" size={14} /> Loading Editor...
            </div>
          }
          options={{
            readOnly: true,
            domReadOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineHeight: 22,
            fontFamily: 'var(--font-geist-mono)',
            fontLigatures: true,
            cursorStyle: 'line',
            renderLineHighlight: 'all',
            contextmenu: false,
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            padding: { top: 16, bottom: 16 },
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  );
};

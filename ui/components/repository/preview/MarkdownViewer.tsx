import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export const MarkdownViewer = ({ content }: { content: string }) => {
  return (
    <div className="p-8 overflow-auto custom-scrollbar h-full bg-[#050505]">
      <article className="prose prose-invert prose-zinc max-w-none text-zinc-300">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code(props) {
              const { children, className, node, ...rest } = props;
              const match = /language-(\w+)/.exec(className || '');

              if (match) {
                return (
                  <div className="not-prose rounded-xl overflow-hidden border border-zinc-800 my-4 shadow-lg">
                    <div className="bg-zinc-900/50 px-4 py-1.5 border-b border-zinc-800 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">
                        {match[1]}
                      </span>
                    </div>
                    <SyntaxHighlighter
                      {...rest}
                      PreTag="div"
                      children={String(children).replace(/\n$/, '')}
                      language={match[1]}
                      style={vscDarkPlus}
                      customStyle={{
                        margin: 0,
                        padding: '1.5rem',
                        background: '#0a0a0a',
                        fontSize: '13px',
                        fontFamily: 'var(--font-geist-mono)',
                      }}
                    />
                  </div>
                );
              }

              return (
                <code {...rest} className={className}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
};

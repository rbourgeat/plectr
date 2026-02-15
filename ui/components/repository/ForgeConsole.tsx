'use client';
import { Copy, X, Check, Download, UploadCloud, Terminal } from 'lucide-react';
import { useState } from 'react';
import { SlidingTabs } from '../ui/SlidingTabs';

type Tab = 'clone' | 'push';

export const ForgeConsole = ({ repoName, onClose }: { repoName: string; onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState<Tab>('clone');
  const [copied, setCopied] = useState(false);

  const commands = {
    clone: `plectr clone ${repoName}`,
    push: `cd my-project\nplectr init --name ${repoName}\nplectr save -m "Initial resonance"`,
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(commands[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#09090b] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/10">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/50 bg-zinc-900/20">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Terminal size={18} className="text-blue-500" />
              Connect to Forge
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Synchronize your local environment with Plectr.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-900 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <SlidingTabs
              activeTab={activeTab}
              onChange={setActiveTab}
              layout="full"
              className="w-full"
              tabs={[
                { id: 'clone', label: 'Clone Repository', icon: Download },
                { id: 'push', label: 'Push Existing', icon: UploadCloud },
              ]}
            />
          </div>

          <p className="text-sm text-zinc-400 mb-4 px-1">
            {activeTab === 'clone'
              ? 'Use this command to download the repository and its history to your machine.'
              : 'Navigate to your project folder and run these commands to initialize resonance.'}
          </p>

          <div className="relative group">
            <div
              onClick={handleCopy}
              className="bg-black border border-zinc-800 rounded-xl p-5 cursor-pointer hover:border-zinc-600 transition-all group-hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]"
            >
              <pre
                className={`font-mono text-sm text-zinc-300 whitespace-pre-wrap ${
                  activeTab === 'push' ? 'leading-6' : ''
                }`}
              >
                {commands[activeTab]}
              </pre>

              <div className="absolute top-4 right-4">
                <button
                  className={`p-2 rounded-lg transition-colors ${
                    copied
                      ? 'text-green-500 bg-green-500/10'
                      : 'text-zinc-500 bg-zinc-900 hover:text-white'
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 p-3 rounded-lg bg-blue-900/10 border border-blue-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs text-blue-200/80">
              Requires <strong>plectr-agent v0.2+</strong> installed on your machine.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { Copy, Check, Shield, Key, Terminal, AlertTriangle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function TokensPage() {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  const token = session?.accessToken || "";

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="text-center">
            <Shield size={48} className="mx-auto text-zinc-700 mb-4"/>
            <h1 className="text-xl font-bold text-white">Access Restricted</h1>
            <p className="text-zinc-500 mb-4">Please log in to manage your access tokens.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
                <Link href="/" className="hover:text-white transition-colors">Home</Link>
                <span>/</span>
                <span>Settings</span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Access Tokens</h1>
            <p className="text-zinc-400">Manage credentials for accessing Plectr via the Command Line Interface.</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/50 to-zinc-950/50">
            <div className="flex items-start justify-between mb-6">
                <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <Key className="text-blue-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">CLI Session Token</h2>
                        <p className="text-sm text-zinc-500">
                            Use this token to authenticate the <code className="text-blue-400">plectr-agent</code> on your machine.
                        </p>
                    </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider">
                    Active
                </div>
            </div>

            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Shield size={16} className="text-zinc-600" />
                </div>
                
                <input 
                    type={visible ? "text" : "password"}
                    readOnly
                    value={token}
                    className="w-full bg-black border border-zinc-800 rounded-xl py-4 pl-12 pr-24 text-zinc-300 font-mono text-sm focus:outline-none focus:border-blue-500/50 transition-all selection:bg-blue-500/30"
                />

                <div className="absolute inset-y-0 right-2 flex items-center gap-2">
                    <button 
                        onClick={() => setVisible(!visible)}
                        className="p-2 text-zinc-500 hover:text-white transition-colors"
                        title={visible ? "Hide" : "Reveal"}
                    >
                        {visible ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                    <button 
                        onClick={handleCopy}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-zinc-700"
                    >
                        {copied ? <Check size={14} className="text-green-400"/> : <Copy size={14} />}
                        {copied ? "Copied" : "Copy"}
                    </button>
                </div>
            </div>

            <div className="mt-4 flex gap-3 p-4 rounded-lg bg-orange-500/5 border border-orange-500/10">
                <AlertTriangle size={16} className="text-orange-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-xs font-bold text-orange-300">Security Notice</p>
                    <p className="text-xs text-orange-200/60 leading-relaxed">
                        This token grants full access to your repositories. Treat it like your password. 
                        It is tied to your current session and may expire, requiring a fresh login via CLI.
                    </p>
                </div>
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">CLI Quick Start</h3>
            
            <div className="glass-panel p-0 rounded-xl overflow-hidden border border-zinc-800">
                <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Terminal size={14} className="text-zinc-500" />
                        <span className="text-xs font-mono text-zinc-400">Terminal</span>
                    </div>
                </div>
                <div className="p-6 bg-black font-mono text-sm space-y-4">
                    <div className="flex gap-4">
                        <span className="text-zinc-600 select-none">$</span>
                        <span className="text-zinc-300">plectr login</span>
                    </div>
                    
                    <div className="text-zinc-500 italic select-none">
                        # Paste the token when prompted
                    </div>

                    <div className="flex gap-4">
                        <span className="text-zinc-600 select-none">$</span>
                        <span className="text-zinc-300">plectr whoami</span>
                    </div>
                    <div className="text-green-500/50">
                         ✅ Connected to https://plectr.com: Authenticated
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
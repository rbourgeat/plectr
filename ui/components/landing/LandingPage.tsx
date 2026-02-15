'use client';
import Link from 'next/link';
import {
  ArrowRight,
  Terminal,
  Cpu,
  Database,
  Layers,
  ShieldCheck,
  Zap,
  Download,
  Command,
} from 'lucide-react';
import { useState } from 'react';
import { PlectrLogo } from '@/components/icons/PlectrLogo';

export default function LandingPage() {
  const [downloadOS, setDownloadOS] = useState<'mac' | 'linux' | 'win'>('mac');

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">
      {/* --- HERO SECTION --- */}
      <section className="relative pt-20 pb-32 px-4 md:px-6 max-w-7xl mx-auto w-full flex flex-col items-center text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          v0.2.0 Public Beta
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-white mb-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
          Resonate with <br />
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-white bg-clip-text text-transparent">
            your data.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
          The Unified Engineering Forge. Replace GitHub, Hugging Face, and Docker Hub with a single,
          high-performance Local-First platform written in Rust.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
          <Link
            href="/login"
            className="px-8 py-4 bg-white text-black rounded-full font-bold text-sm flex items-center gap-2 hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            Start Resonating <ArrowRight size={16} />
          </Link>
          <button
            onClick={() =>
              document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' })
            }
            className="px-8 py-4 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-zinc-800 hover:text-white transition-all"
          >
            <Terminal size={16} /> Install Agent
          </button>
        </div>

        {/* Visual Terminal Demo */}
        <div className="mt-20 w-full max-w-4xl relative animate-in fade-in zoom-in-95 duration-1000 delay-300">
          <div className="absolute -inset-1 bg-gradient-to-b from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-50" />
          <div className="glass-panel bg-[#0a0a0a] rounded-xl border border-zinc-800 shadow-2xl overflow-hidden text-left relative">
            <div className="flex items-center px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
              <div className="ml-2 text-xs text-zinc-500 font-mono">
                user@plectr-station: ~/projects/neural-net
              </div>
            </div>
            <div className="p-6 font-mono text-sm text-zinc-300 space-y-2">
              <div className="flex gap-3">
                <span className="text-blue-400 font-bold">$</span>
                <span>plectr init --name neural-net</span>
              </div>
              <div className="text-zinc-500">✔ Repo neural-net initialized successfully.</div>

              <div className="flex gap-3 pt-2">
                <span className="text-blue-400 font-bold">$</span>
                <span>plectr save -m "Initial resonance"</span>
              </div>
              <div className="text-zinc-500">Scanning filesystem (ignoring node_modules)...</div>
              <div className="text-zinc-400">🚀 Synchronizing 1,240 files...</div>
              <div className="w-64 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
                <div className="w-3/4 h-full bg-gradient-to-r from-blue-500 to-purple-500" />
              </div>
              <div className="text-green-400 pt-1">✔ Snapshot secured: 8f3a1c9b</div>
            </div>
          </div>
        </div>
      </section>

      {/* --- FEATURES GRID --- */}
      <section className="py-24 px-4 border-t border-white/5 bg-black/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Unified Engineering</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Stop switching tools. Plectr handles your source code, large datasets, and container
              images in a single Content Addressable Storage.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={Database}
              title="Universal Repo"
              desc="Store code (.rs, .ts), datasets (.parquet), and models (.safetensors) in one repo. Native deduplication saves massive space."
            />
            <FeatureCard
              icon={Cpu}
              title="Data Intelligence"
              desc="Visualize CSV/Parquet files with SQL via DuckDB Wasm. Inspect neural network layers without downloading GBs of weights."
            />
            <FeatureCard
              icon={Zap}
              title="Rust Performance"
              desc="Written in Rust with Axum & SeaweedFS. Optimized for speed, handling 50GB+ files with resilient resumable uploads."
            />
            <FeatureCard
              icon={Layers}
              title="Docker Registry V2"
              desc="Push and pull container images directly. Fully OCI compliant registry integrated into every repository."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="White Label Auth"
              desc="Enterprise-grade security with Keycloak integration. RBAC, Branch Protection, and Audit Logs built-in."
            />
            <FeatureCard
              icon={Terminal}
              title="Smart Agent"
              desc="A single binary CLI that understands your project structure. Smart ignore patterns and blazing fast hashing."
            />
          </div>
        </div>
      </section>

      {/* --- DOWNLOAD SECTION --- */}
      <section id="download" className="py-24 px-4 max-w-5xl mx-auto w-full">
        <div className="glass-panel p-10 rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/50 to-black text-center">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
            <Download className="text-blue-400" size={32} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Install the Agent</h2>
          <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
            The Plectr CLI is a single static binary. No dependencies, no runtime. Just raw
            performance.
          </p>

          <div className="flex justify-center gap-2 mb-8">
            <button
              onClick={() => setDownloadOS('mac')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                downloadOS === 'mac' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'
              }`}
            >
              macOS
            </button>
            <button
              onClick={() => setDownloadOS('linux')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                downloadOS === 'linux' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'
              }`}
            >
              Linux
            </button>
            <button
              onClick={() => setDownloadOS('win')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                downloadOS === 'win' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'
              }`}
            >
              Windows
            </button>
          </div>

          <div className="bg-black border border-zinc-800 rounded-xl p-4 max-w-md mx-auto flex items-center justify-between group cursor-pointer hover:border-zinc-600 transition-colors">
            <code className="text-sm font-mono text-zinc-300">
              {downloadOS === 'mac' && 'curl -fsSL https://plectr.com/install.sh | sh'}
              {downloadOS === 'linux' && 'curl -fsSL https://plectr.com/install.sh | sh'}
              {downloadOS === 'win' && 'iwr https://plectr.com/install.ps1 | iex'}
            </code>
            <Command size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
          </div>

          <p className="mt-4 text-xs text-zinc-600">MD5: 8f3a...1c9b • v0.2.0 • 12MB</p>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity">
            <PlectrLogo size={24} />
            <span className="font-bold text-white tracking-tight">PLECTR</span>
          </div>
          <p className="text-xs text-zinc-600">
            © 2026 Raphaël Bourgeat. Open Source (Apache 2.0).
          </p>
          <div className="flex gap-6 text-xs font-bold text-zinc-500">
            <Link href="#" className="hover:text-white">
              Documentation
            </Link>
            <Link href="#" className="hover:text-white">
              GitHub
            </Link>
            <Link href="#" className="hover:text-white">
              Legal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const FeatureCard = ({ icon: Icon, title, desc }: any) => (
  <div className="glass-panel p-6 rounded-2xl border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40 transition-all group">
    <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-colors">
      <Icon size={20} className="text-zinc-400 group-hover:text-blue-400" />
    </div>
    <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
    <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
  </div>
);

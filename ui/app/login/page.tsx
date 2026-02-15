"use client";
import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PlectrLogo } from '@/components/icons/PlectrLogo';
import { Loader2, ArrowRight, Lock, User, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid resonance frequency (Wrong credentials)");
        setLoading(false);
      } else {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError("Connection to Forge failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#050505] relative overflow-hidden">
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md p-4 z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="glass-panel border border-white/10 rounded-3xl p-8 shadow-2xl bg-black/40 backdrop-blur-xl">
          
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 p-4 rounded-2xl bg-gradient-to-tr from-blue-500/10 to-purple-500/10 border border-white/5 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                <PlectrLogo size={48} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
            <p className="text-sm text-zinc-500 mt-1">Authenticate to access the Engineering Forge</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-xs font-bold animate-in slide-in-from-top-2">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Username</label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-blue-500 transition-colors">
                        <User size={16} />
                    </div>
                    <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-zinc-900 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-zinc-700"
                        placeholder="engineer_01"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Password</label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-purple-500 transition-colors">
                        <Lock size={16} />
                    </div>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:bg-zinc-900 focus:ring-1 focus:ring-purple-500/20 transition-all placeholder:text-zinc-700"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-white hover:bg-zinc-200 text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-white/5 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                ) : (
                    <>
                        Initiate Resonance <ArrowRight size={18} />
                    </>
                )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-zinc-600">
                Forgot credentials? Contact your <span className="text-zinc-400">Forge Administrator</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

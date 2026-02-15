'use client';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { User, Save, Loader2, CheckCircle, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const { success, error } = useToast();

  const [username, setUsername] = useState('');
  const [initialUsername, setInitialUsername] = useState('');

  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (session?.user?.name) {
      setUsername(session.user.name);
      setInitialUsername(session.user.name);
    }
  }, [session]);

  useEffect(() => {
    if (!username || username === initialUsername) {
      setIsAvailable(null);
      return;
    }

    setIsChecking(true);
    setIsAvailable(null);

    const timer = setTimeout(async () => {
      try {
        await axios.get(`${API_URL}/api/check/user/${username}`);
        setIsAvailable(true);
      } catch (err) {
        setIsAvailable(false);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, initialUsername]);

  const handleUpdate = async () => {
    if (isAvailable === false) return;
    setIsSaving(true);

    try {
      await axios.patch(
        `${API_URL}/api/me`,
        { username },
        { headers: { Authorization: `Bearer ${session?.accessToken}` } }
      );

      await update({ name: username });
      setInitialUsername(username);
      setIsAvailable(null);

      success('Identity shifted successfully');
    } catch (e) {
      error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-3xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-zinc-500 mb-1">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span>/</span>
          <span>Settings</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Public Profile</h1>
        <p className="text-zinc-400">Manage how you resonate across the Forge.</p>
      </div>

      <div className="glass-panel p-8 rounded-2xl border border-zinc-800 bg-zinc-900/20">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-xl ring-4 ring-black shrink-0">
            {username.substring(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 space-y-6">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                Display Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full bg-black border rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors
                                ${
                                  isAvailable === false
                                    ? 'border-red-500/50 focus:border-red-500'
                                    : isAvailable === true
                                    ? 'border-green-500/50 focus:border-green-500'
                                    : 'border-zinc-800 focus:border-blue-500'
                                }`}
                />

                <div className="absolute right-4 top-3.5">
                  {isChecking ? (
                    <Loader2 size={18} className="animate-spin text-zinc-500" />
                  ) : isAvailable === true ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : isAvailable === false ? (
                    <X size={18} className="text-red-500" />
                  ) : (
                    <User size={18} className="text-zinc-600" />
                  )}
                </div>
              </div>

              {isAvailable === false && (
                <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                  <AlertCircle size={12} /> Username is already taken.
                </p>
              )}

              <p className="text-zinc-600 text-xs mt-2">
                This is your public identity on Plectr. It must be unique.
              </p>
            </div>

            <div className="pt-4 border-t border-zinc-800 flex justify-end">
              <button
                onClick={handleUpdate}
                disabled={
                  isSaving || isAvailable === false || username === initialUsername || !username
                }
                className="flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-xl text-sm font-bold hover:bg-zinc-200 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

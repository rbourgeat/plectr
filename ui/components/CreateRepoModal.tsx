'use client';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Lock, Globe, Loader2, BookPlus, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

export const CreateRepoModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const router = useRouter();
  const { data: session } = useSession();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setIsAvailable(null);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!name) {
      setIsAvailable(null);
      return;
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    setIsChecking(true);
    setIsAvailable(null);

    const timer = setTimeout(async () => {
      try {
        await axios.get(`${API_URL}/api/check/repo/${slug}`);
        setIsAvailable(true);
      } catch (err) {
        setIsAvailable(false);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [name]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAvailable) return;

    setLoading(true);
    setError('');
    const slug = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    try {
      await axios.post(
        `${API_URL}/repos`,
        { name: slug, description, is_public: isPublic },
        { headers: { Authorization: `Bearer ${session?.accessToken}` } }
      );
      onClose();
      router.push(`/repo/${slug}`);
    } catch (err: any) {
      setError('Failed to create repository.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md glass-panel bg-[#0a0a0a] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/30">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookPlus size={20} className="text-blue-500" /> Create Repository
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Name</label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="my-awesome-project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full bg-zinc-950 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none transition-colors placeholder:text-zinc-700
          ${
            isAvailable === false
              ? 'border-red-500/50 focus:border-red-500'
              : isAvailable === true
              ? 'border-green-500/50 focus:border-green-500'
              : 'border-zinc-800 focus:border-blue-500'
          }`}
              />

              <div className="absolute right-3 top-2.5">
                {isChecking ? (
                  <Loader2 size={16} className="animate-spin text-zinc-500" />
                ) : isAvailable === true ? (
                  <CheckCircle size={16} className="text-green-500" />
                ) : isAvailable === false ? (
                  <X size={16} className="text-red-500" />
                ) : null}
              </div>
            </div>

            <div className="mt-1.5 flex justify-between text-[10px]">
              <span className="text-zinc-600">Lowercase, numbers and dashes only.</span>
              {isAvailable === false && (
                <span className="text-red-400 font-bold">Name already taken</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">
              Description
            </label>
            <textarea
              placeholder="What resonates within this forge?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors h-20 resize-none placeholder:text-zinc-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
              Visibility
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isPublic
                    ? 'bg-blue-600/10 border-blue-500/50'
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div
                  className={`flex items-center gap-2 text-sm font-bold mb-1 ${
                    isPublic ? 'text-blue-400' : 'text-zinc-300'
                  }`}
                >
                  <Globe size={16} /> Public
                </div>
                <p className="text-[10px] text-zinc-500">Anyone can see this repository.</p>
              </button>

              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  !isPublic
                    ? 'bg-blue-600/10 border-blue-500/50'
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div
                  className={`flex items-center gap-2 text-sm font-bold mb-1 ${
                    !isPublic ? 'text-blue-400' : 'text-zinc-300'
                  }`}
                >
                  <Lock size={16} /> Private
                </div>
                <p className="text-[10px] text-zinc-500">Only you and contributors.</p>
              </button>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name || isAvailable === false || isChecking}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Create Forge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

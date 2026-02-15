'use client';
import { signIn, signOut, useSession } from 'next-auth/react';
import { LogIn, LogOut, ChevronDown, User, Key } from 'lucide-react';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

export const AuthButton = () => {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuRef]);

  if (session) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-3 hover:bg-zinc-800/50 p-1.5 pr-3 rounded-full transition-all border border-transparent hover:border-zinc-700 ${
            isOpen ? 'bg-zinc-800 border-zinc-700' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-blue-900/20 ring-1 ring-white/10">
            {session.user?.name?.substring(0, 2).toUpperCase() || <User size={14} />}
          </div>

          <div className="flex flex-col items-start hidden sm:flex">
            <span className="text-xs font-bold text-white leading-none mb-0.5">
              {session.user?.name}
            </span>
            <span className="text-[9px] text-zinc-400 font-medium leading-none">Pro Plan</span>
          </div>
          <ChevronDown
            size={12}
            className={`text-zinc-500 transition-transform duration-300 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 z-50 origin-top-right animate-in fade-in zoom-in-95 duration-150">
            <div className="flex flex-col bg-[#0a0a0a] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden ring-1 ring-black">
              <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/30">
                <p className="text-sm font-bold text-white tracking-tight">{session.user?.name}</p>
                <p className="text-[10px] text-zinc-500 truncate font-medium font-mono mt-0.5">
                  {session.user?.email}
                </p>
              </div>

              <div className="p-1.5 flex flex-col gap-0.5">
                <Link
                  href="/settings/profile"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-lg transition-all group"
                >
                  <User
                    size={16}
                    className="text-zinc-500 group-hover:text-blue-400 transition-colors"
                  />
                  Public Profile
                </Link>

                <Link
                  href="/settings/tokens"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-lg transition-all group"
                >
                  <Key
                    size={16}
                    className="text-zinc-500 group-hover:text-yellow-400 transition-colors"
                  />
                  Access Tokens
                </Link>

                <div className="h-px bg-zinc-800 mx-2 my-1" />

                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-all group"
                >
                  <LogOut
                    size={16}
                    className="text-zinc-500 group-hover:text-red-400 transition-colors"
                  />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="flex items-center gap-2 px-5 py-2 bg-white text-black rounded-full text-xs font-bold hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:scale-105 active:scale-95"
    >
      <LogIn size={14} />
      Sign In
    </Link>
  );
};

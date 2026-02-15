/*
 * Copyright 2026 Raphaël Bourgeat
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { AuthButton } from '@/components/AuthButton';
import { PlectrLogo } from '@/components/icons/PlectrLogo';
import { Providers } from '@/components/Providers';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PLECTR',
  description: 'Unified Engineering Forge',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#050505] text-white selection:bg-blue-500/30 relative overflow-x-hidden`}
      >
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="aurora-blob aurora-1" />
          <div className="aurora-blob aurora-2" />
          <div className="aurora-blob aurora-3" />
          {/* <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02] mix-blend-overlay"></div> */}
        </div>

        <Providers>
          <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl backdrop-saturate-150">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="transition-transform group-hover:scale-110 duration-300">
                  <PlectrLogo size={32} />
                </div>
                <span className="font-bold tracking-tighter text-xl bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent group-hover:to-white transition-all">
                  PLECTR
                </span>
              </Link>

              <div className="flex items-center gap-3 sm:gap-6">
                <div className="hidden sm:flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-zinc-500">
                  <Link href="/" className="hover:text-white transition-colors">
                    Repositories
                  </Link>
                  <Link href="#" className="hover:text-white transition-colors">
                    Nodes
                  </Link>
                </div>

                <div className="h-6 w-px bg-zinc-800" />
                <AuthButton />
              </div>
            </div>
          </nav>

          {children}
        </Providers>
      </body>
    </html>
  );
}

'use client';

import { useSession } from 'next-auth/react';
import LandingPage from '@/components/landing/LandingPage';
import Dashboard from '@/components/dashboard/Dashboard';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#050505]">
        <Loader2 className="animate-spin text-zinc-600 mb-4" size={32} />
      </div>
    );
  }

  if (session) {
    return <Dashboard />;
  }

  return <LandingPage />;
}

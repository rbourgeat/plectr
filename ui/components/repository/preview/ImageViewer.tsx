'use client';
import React, { useState, useEffect } from 'react';
import { Loader2, ImageOff, Maximize2, Minimize2 } from 'lucide-react';
import axios from 'axios';
import { useSession } from 'next-auth/react';

interface Props {
  repoName: string;
  commitId: string;
  path: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

export const ImageViewer = ({ repoName, commitId, path }: Props) => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchImage = async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await axios.get(
          `${API_URL}/repos/${repoName}/commits/${commitId}/files/${encodeURIComponent(path)}`,
          {
            responseType: 'blob',
            headers: { Authorization: `Bearer ${session?.accessToken}` },
          }
        );

        if (active) {
          const url = URL.createObjectURL(response.data);
          setObjectUrl(url);
        }
      } catch (err) {
        console.error(err);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchImage();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [repoName, commitId, path, session]);

  return (
    <div className="relative h-full w-full flex flex-col items-center justify-center bg-[#0a0a0a] overflow-hidden p-8 group">
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50 backdrop-blur-sm">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      )}

      {error ? (
        <div className="flex flex-col items-center gap-3 text-zinc-600 z-10">
          <ImageOff size={48} />
          <p className="text-xs font-mono">Image corrupted or access denied</p>
          <p className="text-[10px] opacity-50 font-mono bg-zinc-900 px-2 py-1 rounded">{path}</p>
        </div>
      ) : (
        objectUrl && (
          <div
            className={`relative transition-all duration-300 ease-out ${
              zoom ? 'w-full h-full p-0' : 'max-w-[90%] max-h-[90%]'
            }`}
          >
            <img
              src={objectUrl}
              alt={path}
              className={`mx-auto shadow-2xl object-contain transition-transform ${
                zoom
                  ? 'h-full w-full object-contain bg-black'
                  : 'max-h-full rounded-lg border border-zinc-800'
              }`}
            />
          </div>
        )
      )}

      {!error && !loading && (
        <button
          onClick={() => setZoom(!zoom)}
          className="absolute bottom-6 right-6 p-2.5 bg-zinc-900/80 backdrop-blur-md border border-zinc-700 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all z-20 shadow-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 duration-200"
        >
          {zoom ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      )}
    </div>
  );
};

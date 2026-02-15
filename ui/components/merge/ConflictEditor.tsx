"use client";
import React, { useRef, useState, useEffect } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { Loader2, Check, Monitor, Smartphone } from "lucide-react";
import axios from "axios";

interface Props {
  file: { path: string; localHash: string; remoteHash: string };
  onResolve: (path: string, finalHash: string) => void;
  repoName: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

export const ConflictEditor = ({ file, onResolve, repoName }: Props) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<{ local: string; remote: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const diffEditorRef = useRef<any>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.post(
          `${API_URL}/repos/${repoName}/compare`,
          {
            local_hash: file.localHash,
            remote_hash: file.remoteHash,
          }
        );
        setData({
          local: res.data.local_content,
          remote: res.data.remote_content,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [file, repoName]);

  const acceptRemote = () => {
    if (!diffEditorRef.current || !data) return;
    diffEditorRef.current
      .getModifiedEditor()
      .getModel()
      .setValue(data.remote);
  };

  const acceptLocal = () => {
    if (!diffEditorRef.current || !data) return;
    diffEditorRef.current
      .getModifiedEditor()
      .getModel()
      .setValue(data.local);
  };

  const handleSave = async () => {
    if (!diffEditorRef.current) return;
    setSaving(true);
    try {
      const model = diffEditorRef.current
        .getModifiedEditor()
        .getModel();
      const content = model.getValue();

      const formData = new FormData();
      const blob = new Blob([content], { type: "text/plain" });
      formData.append("file", blob, file.path);

      const res = await axios.post(`${API_URL}/upload`, formData);
      const newHash = res.data.blobs[0].hash;
      onResolve(file.path, newHash);
    } catch {
      alert("Fusion failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-xl">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-[10px] font-mono tracking-widest text-blue-400">
          DIFFING…
        </span>
      </div>
    );
  }

  const getLanguage = (path: string) => {
    const ext = path.split(".").pop();
    if (ext === "ts" || ext === "tsx") return "typescript";
    if (ext === "js" || ext === "jsx") return "javascript";
    if (ext === "py") return "python";
    if (ext === "rs") return "rust";
    if (ext === "json") return "json";
    return "plaintext";
  };

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-white/5 bg-black/50 backdrop-blur-xl shadow-2xl">
      <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-b border-white/5 bg-black/40">
        <div className="flex w-full sm:w-auto gap-2 p-1 rounded-lg bg-white/5 border border-white/5">
          <button
            onClick={acceptRemote}
            className="flex-1 flex items-center justify-center gap-2 text-[10px] px-3 py-1.5 rounded-md text-zinc-400 hover:bg-red-500/20 hover:text-red-300 transition"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Accept Remote
          </button>
          <div className="w-px bg-white/10" />
          <button
            onClick={acceptLocal}
            className="flex-1 flex items-center justify-center gap-2 text-[10px] px-3 py-1.5 rounded-md text-zinc-400 hover:bg-green-500/20 hover:text-green-300 transition"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Reset Local
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-blue-400/20 transition disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} strokeWidth={3} />
          )}
          {saving ? "Fusing…" : "Resolve"}
        </button>
      </div>

      <div className="relative flex-1 min-h-0 bg-[#1e1e1e]">
        <div className="absolute bottom-2 right-3 z-10 flex items-center gap-1 text-[10px] text-white/40 font-mono pointer-events-none">
          {isMobile ? <Smartphone size={10} /> : <Monitor size={10} />}
          {isMobile ? "INLINE" : "SPLIT"}
        </div>

        <DiffEditor
          height="100%"
          theme="vs-dark"
          original={data?.remote}
          modified={data?.local}
          language={getLanguage(file.path)}
          onMount={(editor) => {
            diffEditorRef.current = editor;
            editor.getOriginalEditor().updateOptions({ readOnly: true });
          }}
          options={{
            renderSideBySide: !isMobile,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            fontFamily: "var(--font-geist-mono)",
            automaticLayout: true,
            padding: { top: 16 },
            diffWordWrap: "on",
          }}
        />
      </div>
    </div>
  );
};

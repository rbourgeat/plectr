'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Box,
  Copy,
  Layers,
  Clock,
  HardDrive,
  Terminal,
  X,
  Trash2,
  Check,
  ShieldAlert,
  Download,
  AlertTriangle,
  Cpu,
  Loader2,
  List,
  Hash,
} from 'lucide-react';
import { formatBytes } from '@/utils/format';
import { useSession } from 'next-auth/react';
import { useToast } from '@/context/ToastContext';

interface DockerImage {
  image_name: string;
  tag: string;
  digest: string;
  updated_at: string;
  size: number;
  layers_count: number;
  content: any;
}

interface ImageGroup {
  name: string;
  tags: DockerImage[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

const cleanLayerCommand = (cmd: string) => {
  return cmd.replace('/bin/sh -c #(nop) ', '').replace('/bin/sh -c ', '').trim();
};

export const ContainerRegistry = ({ repoName }: { repoName: string }) => {
  const { data: session } = useSession();
  const { success, error } = useToast();

  const [groups, setGroups] = useState<ImageGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedImage, setSelectedImage] = useState<DockerImage | null>(null);
  const [imageToDelete, setImageToDelete] = useState<DockerImage | null>(null);

  const [imageConfig, setImageConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [copiedDigest, setCopiedDigest] = useState<string | null>(null);

  useEffect(() => {
    fetchImages();
  }, [repoName]);

  const fetchImages = () => {
    setLoading(true);
    axios
      .get(`${API_URL}/repos/${repoName}/images`)
      .then((res) => {
        const rawList = res.data;
        setGroups([{ name: repoName, tags: rawList }]);
      })
      .catch((err) => console.error('Failed to load images', err))
      .finally(() => setLoading(false));
  };

  const handleInspect = async (img: DockerImage) => {
    setSelectedImage(img);
    setLoadingConfig(true);
    setImageConfig(null);
    try {
      const res = await axios.get(`${API_URL}/repos/${repoName}/images/${img.digest}/config`);
      setImageConfig(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleDelete = async () => {
    if (!imageToDelete) return;
    try {
      await axios.delete(`${API_URL}/v2/${repoName}/manifests/${imageToDelete.digest}`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      success('Image manifest deleted');
      setImageToDelete(null);
      fetchImages();
    } catch (e: any) {
      console.error(e);
      error('Failed to delete (API might be missing)');
      setImageToDelete(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDigest(id);
    setTimeout(() => setCopiedDigest(null), 2000);
  };

  if (loading)
    return (
      <div className="h-64 flex flex-col items-center justify-center text-zinc-500">
        <Loader2 size={32} className="animate-spin mb-4 text-blue-500" />
        <p className="text-xs font-mono tracking-widest">SCANNING REGISTRY...</p>
      </div>
    );

  return (
    <div className="flex flex-col gap-6 relative h-full">
      <div className="glass-panel p-6 rounded-2xl bg-gradient-to-br from-zinc-900/50 to-black border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Box className="text-blue-500" /> Container Registry
            </h2>
            <p className="text-zinc-400 text-sm max-w-lg">
              OCI-compliant storage for your Docker images. Use the CLI or standard Docker commands
              to interact.
            </p>
          </div>

          <div className="bg-black border border-zinc-800 pl-4 pr-2 py-2 rounded-xl flex items-center gap-4 shadow-lg">
            <div className="flex flex-col">
              <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">
                Push Command
              </span>
              <code className="text-xs font-mono text-blue-400">
                docker push plectr.com/{repoName}/[image]:[tag]
              </code>
            </div>
            <button
              onClick={() =>
                copyToClipboard(`docker push plectr.com/${repoName}/app:latest`, 'cmd')
              }
              className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors"
            >
              {copiedDigest === 'cmd' ? (
                <Check size={16} className="text-green-500" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.name} className="space-y-3">
            {group.tags.length === 0 ? (
              <div className="text-center py-20 text-zinc-600 italic border border-dashed border-zinc-800 rounded-xl">
                No images found in this repository.
              </div>
            ) : (
              group.tags.map((img) => (
                <ImageRow
                  key={img.digest}
                  img={img}
                  repoName={repoName}
                  onInspect={handleInspect}
                  onDelete={() => setImageToDelete(img)}
                  onCopy={copyToClipboard}
                  copiedId={copiedDigest}
                />
              ))
            )}
          </div>
        ))}
      </div>

      {imageToDelete && (
        <DeleteModal
          isOpen={!!imageToDelete}
          imageName={`${imageToDelete.tag}`}
          onClose={() => setImageToDelete(null)}
          onConfirm={handleDelete}
        />
      )}

      {selectedImage && (
        <InspectDrawer
          image={selectedImage}
          config={imageConfig}
          loading={loadingConfig}
          onClose={() => setSelectedImage(null)}
          onCopy={copyToClipboard}
          copiedId={copiedDigest}
        />
      )}
    </div>
  );
};

const ImageRow = ({ img, repoName, onInspect, onDelete, onCopy, copiedId }: any) => {
  const shortName = img.image_name === repoName ? '' : img.image_name.replace(`${repoName}/`, '');
  const pullCommand = `docker pull plectr.com/${img.image_name}:${img.tag}`;

  return (
    <div className="glass-panel p-4 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 group hover:border-zinc-700 transition-all bg-[#0a0a0a]">
      <div className="flex items-start gap-4 flex-1">
        <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 group-hover:bg-blue-900/10 group-hover:text-blue-400 transition-colors text-zinc-500">
          <Layers size={24} />
        </div>

        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-3">
            <span className="font-bold text-base text-white tracking-tight font-mono">
              {shortName && <span className="text-zinc-400">{shortName}:</span>}
              <span className={shortName ? 'text-blue-400' : 'text-white'}>{img.tag}</span>
            </span>

            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-500 border border-zinc-700 uppercase tracking-wide flex items-center gap-1">
                <ShieldAlert size={10} /> Not Scanned
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500 font-mono">
            <span className="text-zinc-600" title="Full Image Name">
              {img.image_name}
            </span>
            <span className="w-1 h-1 rounded-full bg-zinc-800" />
            <span className="flex items-center gap-1.5" title="Uncompressed Size">
              <HardDrive size={12} /> {formatBytes(img.size)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={12} /> {new Date(img.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end lg:self-center">
        <button
          onClick={() => onCopy(pullCommand, `pull-${img.digest}`)}
          className="h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 text-xs font-bold transition-all flex items-center gap-2"
          title="Copy Pull Command"
        >
          {copiedId === `pull-${img.digest}` ? (
            <Check size={14} className="text-green-500" />
          ) : (
            <Download size={14} />
          )}
          <span className="hidden sm:inline">Pull</span>
        </button>

        <button
          onClick={() => onInspect(img)}
          className="h-9 px-4 rounded-lg bg-white text-black hover:bg-blue-50 text-xs font-bold transition-all shadow-lg shadow-white/5 flex items-center gap-2"
        >
          <Terminal size={14} /> Inspect
        </button>

        <div className="w-px h-6 bg-zinc-800 mx-1" />

        <button
          onClick={onDelete}
          className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete Image"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

const DeleteModal = ({ isOpen, imageName, onClose, onConfirm }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-red-900/50 rounded-2xl shadow-2xl shadow-red-900/20 overflow-hidden ring-1 ring-red-900/20">
        <div className="px-6 py-4 border-b border-zinc-800 bg-red-950/10 flex justify-between items-center">
          <h3 className="text-lg font-bold text-red-500 flex items-center gap-2">
            <AlertTriangle size={20} /> Delete Image
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-zinc-300 text-sm leading-relaxed">
            Are you sure you want to delete{' '}
            <span className="font-mono text-white bg-zinc-900 px-1.5 py-0.5 rounded">
              {imageName}
            </span>
            ?
            <br />
            This action cannot be undone and will remove the manifest from the registry.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-red-900/20"
            >
              <Trash2 size={14} /> Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const InspectDrawer = ({ image, config, loading, onClose, onCopy, copiedId }: any) => {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-[#0c0c0c] border-l border-zinc-800 shadow-2xl z-[70] transform transition-transform duration-300 flex flex-col animate-in slide-in-from-right">
        <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30 backdrop-blur-md">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
              <Box className="text-blue-500" size={20} /> {image.tag}
            </h3>
            <p className="text-[10px] font-mono text-zinc-500 mt-1 flex items-center gap-2">
              {image.digest}
              <button
                onClick={() => onCopy(image.digest, 'drawer-digest')}
                className="hover:text-white"
              >
                {copiedId === 'drawer-digest' ? (
                  <Check size={10} className="text-green-500" />
                ) : (
                  <Copy size={10} />
                )}
              </button>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-500">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <span className="text-xs font-mono tracking-widest animate-pulse">
                DECODING MANIFEST...
              </span>
            </div>
          ) : config ? (
            <div className="p-6 space-y-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetaBox
                  label="Architecture"
                  value={`${config.architecture}/${config.os}`}
                  icon={Cpu}
                />
                <MetaBox label="Size" value={formatBytes(image.size)} icon={HardDrive} />
                <MetaBox label="Layers" value={config.history?.length || 0} icon={Layers} />
                <MetaBox
                  label="Created"
                  value={new Date(image.updated_at).toLocaleDateString()}
                  icon={Clock}
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Terminal size={14} className="text-purple-400" /> Startup Command
                </h4>
                <div className="bg-black border border-zinc-800 rounded-xl p-4 font-mono text-xs overflow-x-auto">
                  {config.config?.Entrypoint ? (
                    <div className="flex gap-2 mb-2">
                      <span className="text-purple-400">ENTRYPOINT</span>
                      <span className="text-zinc-300">
                        [{config.config.Entrypoint.map((s: string) => `"${s}"`).join(', ')}]
                      </span>
                    </div>
                  ) : null}
                  {config.config?.Cmd ? (
                    <div className="flex gap-2">
                      <span className="text-blue-400">CMD</span>
                      <span className="text-zinc-300">
                        [{config.config.Cmd.map((s: string) => `"${s}"`).join(', ')}]
                      </span>
                    </div>
                  ) : (
                    <span className="text-zinc-600 italic">No CMD defined</span>
                  )}
                </div>
              </div>

              {config.config?.Env && config.config.Env.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <List size={14} className="text-green-400" /> Environment Variables
                  </h4>
                  <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden">
                    {config.config.Env.map((env: string, i: number) => {
                      const [key, ...val] = env.split('=');
                      return (
                        <div
                          key={i}
                          className="flex border-b border-zinc-800/50 last:border-0 px-4 py-2 text-xs font-mono"
                        >
                          <span className="text-green-400 w-1/3 truncate font-bold">{key}</span>
                          <span className="text-zinc-400 flex-1 truncate select-all">
                            {val.join('=')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {config.config?.ExposedPorts && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Exposed Ports
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(config.config.ExposedPorts).map((port) => (
                      <span
                        key={port}
                        className="px-3 py-1 bg-blue-900/20 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-mono font-bold"
                      >
                        {port}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers size={14} className="text-orange-400" /> Build History
                </h4>
                <div className="space-y-1">
                  {[...(config.history || [])].reverse().map((layer: any, i: number) => {
                    const cmd = cleanLayerCommand(layer.created_by || '');
                    const isRun = cmd.startsWith('RUN');
                    const isCopy = cmd.startsWith('COPY');
                    const isEmpty = layer.empty_layer;

                    return (
                      <div
                        key={i}
                        className="flex gap-4 p-3 rounded-lg hover:bg-zinc-900/50 transition-colors group border border-transparent hover:border-zinc-800"
                      >
                        <div className="mt-0.5">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold font-mono
                            ${
                              isRun
                                ? 'bg-blue-900/20 text-blue-400 border border-blue-500/20'
                                : isCopy
                                ? 'bg-green-900/20 text-green-400 border border-green-500/20'
                                : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                            }
                          `}
                          >
                            {config.history.length - i}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <code className="text-xs font-mono text-zinc-300 break-all whitespace-pre-wrap block leading-relaxed">
                            {cmd || <span className="opacity-30">NO COMMAND</span>}
                          </code>
                          <div className="flex items-center gap-3 mt-1.5">
                            {isEmpty ? (
                              <span className="text-[9px] text-zinc-600 uppercase font-bold">
                                Empty Layer
                              </span>
                            ) : (
                              <span className="text-[9px] text-zinc-400 font-mono">LAYER DATA</span>
                            )}
                            {layer.created && (
                              <span className="text-[9px] text-zinc-600 border-l border-zinc-800 pl-3">
                                {new Date(layer.created).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs font-mono">
              Config blob not found or unreadable.
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const MetaBox = ({ label, value, icon: Icon }: any) => (
  <div className="bg-zinc-900/30 border border-zinc-800 p-3 rounded-xl flex flex-col gap-1">
    <span className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1.5">
      <Icon size={10} /> {label}
    </span>
    <span className="text-sm font-mono text-white font-medium truncate" title={String(value)}>
      {value}
    </span>
  </div>
);

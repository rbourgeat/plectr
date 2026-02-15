'use client';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  UserPlus,
  Shield,
  Users,
  Lock,
  Globe,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  Save,
  FileText,
  GitMerge,
  Github,
  RefreshCw,
  Key,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useToast } from '@/context/ToastContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://plectr.com';

export default function SettingsPage() {
  const { success, error } = useToast();
  const { name: repoName } = useParams();
  const router = useRouter();
  const { data: session } = useSession();

  // General States
  const [members, setMembers] = useState<any[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [description, setDescription] = useState('');

  // Loading States
  const [loading, setLoading] = useState(true);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [savingDesc, setSavingDesc] = useState(false);

  // Invite States
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('viewer');

  // Mirroring States
  const [mirrorConfig, setMirrorConfig] = useState({ remote_url: '', token: '', enabled: false });
  const [mirrorStatus, setMirrorStatus] = useState<any>(null);
  const [savingMirror, setSavingMirror] = useState(false);
  const [showTokenHelp, setShowTokenHelp] = useState(false);

  // Delete States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!session?.accessToken) return;

    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${session.accessToken}` };

        const memRes = await axios.get(`${API_URL}/repos/${repoName}/members`, { headers });
        setMembers(memRes.data);

        const listRes = await axios.get(`${API_URL}/repos`, { headers });
        const currentRepo = listRes.data.find((r: any) => r.name === repoName);
        if (currentRepo) {
          setIsPublic(currentRepo.is_public);
          setDescription(currentRepo.description || '');
        }

        try {
          const mirRes = await axios.get(`${API_URL}/repos/${repoName}/mirror`, { headers });
          if (mirRes.data.configured) {
            setMirrorConfig({
              remote_url: mirRes.data.remote_url,
              token: '',
              enabled: mirRes.data.enabled,
            });
            setMirrorStatus(mirRes.data);
          }
        } catch (e) {
          /* No mirror configured yet */
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [repoName, session]);

  const saveDescription = async () => {
    setSavingDesc(true);
    try {
      await axios.patch(
        `${API_URL}/repos/${repoName}`,
        { description: description },
        { headers: { Authorization: `Bearer ${session?.accessToken}` } }
      );
      success('Description updated successfully');
    } catch (e) {
      error('Failed to update description');
    } finally {
      setSavingDesc(false);
    }
  };

  const saveMirror = async () => {
    setSavingMirror(true);
    try {
      await axios.post(
        `${API_URL}/repos/${repoName}/mirror`,
        {
          remote_url: mirrorConfig.remote_url,
          token: mirrorConfig.token,
          enabled: mirrorConfig.enabled,
        },
        { headers: { Authorization: `Bearer ${session?.accessToken}` } }
      );

      success('Mirror configuration saved & encrypted');
      const mirRes = await axios.get(`${API_URL}/repos/${repoName}/mirror`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      setMirrorStatus(mirRes.data);
      setMirrorConfig((prev) => ({ ...prev, token: '' }));
    } catch (e) {
      error('Failed to save mirror config');
    } finally {
      setSavingMirror(false);
    }
  };

  const updateVisibility = async (publicState: boolean) => {
    if (publicState === isPublic) return;
    setSavingVisibility(true);
    try {
      await axios.patch(
        `${API_URL}/repos/${repoName}`,
        { is_public: publicState },
        { headers: { Authorization: `Bearer ${session?.accessToken}` } }
      );
      setIsPublic(publicState);
      success(`Repository is now ${publicState ? 'Public' : 'Private'}`);
    } catch (e) {
      error('Failed to update visibility. Only Admins allowed.');
    } finally {
      setSavingVisibility(false);
    }
  };

  const inviteMember = async () => {
    try {
      await axios.post(
        `${API_URL}/repos/${repoName}/members`,
        {
          email: newEmail,
          role: newRole,
        },
        { headers: { Authorization: `Bearer ${session?.accessToken}` } }
      );
      setNewEmail('');
      const res = await axios.get(`${API_URL}/repos/${repoName}/members`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      setMembers(res.data);
      success('Member invited successfully');
    } catch (err) {
      error('User not found or already member');
    }
  };

  const handleDeleteRepo = async () => {
    if (deleteConfirmation !== repoName) return;
    setIsDeleting(true);
    try {
      await axios.delete(`${API_URL}/repos/${repoName}`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      });
      router.push('/');
      setTimeout(() => success('Repository deleted permanently'), 500);
    } catch (e) {
      error('Deletion failed');
      setIsDeleting(false);
    }
  };

  if (loading)
    return <div className="p-10 text-center animate-pulse text-zinc-500">Loading Settings...</div>;

  const displayRepoName = Array.isArray(repoName) ? repoName[0] : repoName;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Repository Settings</h1>
        <p className="text-zinc-500 text-sm">Manage access, visibility and resonance parameters.</p>
      </div>

      <div className="glass-panel p-6 rounded-xl border border-zinc-800 bg-zinc-900/20">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <FileText size={20} className="text-blue-400" /> General Settings
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
              Repository Name
            </label>
            <input
              type="text"
              disabled
              value={displayRepoName}
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-500 cursor-not-allowed"
            />
            <p className="text-[10px] text-zinc-600 mt-1">
              Repository names cannot be changed in this version.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the resonance of this forge..."
              className="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-zinc-900 transition-all placeholder:text-zinc-700 resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveDescription}
              disabled={savingDesc}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-xs font-bold hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5 disabled:opacity-50"
            >
              {savingDesc ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-xl border border-zinc-800 bg-zinc-900/20">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <GitMerge size={20} className="text-orange-500" /> Integrations & Mirroring
        </h2>

        <div className="bg-zinc-900/50 p-5 rounded-xl border border-zinc-800 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Github size={16} /> Sync with External Git
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-lg">
                Automatically push every Plectr commit to a remote repository (GitHub, GitLab,
                BitBucket). Credentials are encrypted with AES-256-GCM.
              </p>
            </div>

            {mirrorStatus?.status === 'success' && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[10px] font-bold uppercase tracking-wide border border-green-500/20">
                <RefreshCw size={12} /> Synced{' '}
                {mirrorStatus.last_sync
                  ? new Date(mirrorStatus.last_sync).toLocaleTimeString()
                  : ''}
              </div>
            )}
            {mirrorStatus?.status === 'failed' && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-[10px] font-bold uppercase tracking-wide border border-red-500/20">
                <AlertTriangle size={12} /> Sync Failed
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase">
                Remote Git URL
              </label>
              <input
                type="text"
                placeholder="https://github.com/username/repo.git"
                value={mirrorConfig.remote_url}
                onChange={(e) => setMirrorConfig({ ...mirrorConfig, remote_url: e.target.value })}
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                  Personal Access Token <Key size={10} />
                </label>
                <button
                  onClick={() => setShowTokenHelp(!showTokenHelp)}
                  className="text-[10px] text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
                >
                  <HelpCircle size={10} /> Where to find?{' '}
                  {showTokenHelp ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>
              </div>

              <input
                type="password"
                placeholder={mirrorStatus?.configured ? '•••••••••••• (Encrypted)' : 'ghp_...'}
                value={mirrorConfig.token}
                onChange={(e) => setMirrorConfig({ ...mirrorConfig, token: e.target.value })}
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-orange-500 placeholder:text-zinc-700"
              />
            </div>
          </div>

          {showTokenHelp && (
            <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-4 animate-in slide-in-from-top-2 fade-in">
              <h4 className="text-xs font-bold text-blue-300 mb-2 flex items-center gap-2">
                How to retrieve your Personal Access Token (PAT)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-zinc-400 leading-relaxed">
                <div>
                  <p className="font-bold text-white mb-1">GitHub</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>
                      Go to <strong>Settings</strong> {'>'} <strong>Developer settings</strong>
                    </li>
                    <li>
                      Select <strong>Personal access tokens (Classic)</strong>
                    </li>
                    <li>
                      Click <strong>Generate new token</strong>
                    </li>
                    <li>
                      Select scopes:{' '}
                      <code className="bg-black/30 px-1 rounded text-blue-300">repo</code> (for
                      private) and{' '}
                      <code className="bg-black/30 px-1 rounded text-blue-300">workflow</code>
                    </li>
                  </ol>
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    className="flex items-center gap-1 text-blue-500 mt-2 hover:underline"
                  >
                    Go to GitHub Tokens <ExternalLink size={10} />
                  </a>
                </div>
                <div>
                  <p className="font-bold text-white mb-1">GitLab</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>
                      Go to <strong>Preferences</strong> {'>'} <strong>Access Tokens</strong>
                    </li>
                    <li>Name your token and set expiration</li>
                    <li>
                      Select scopes:{' '}
                      <code className="bg-black/30 px-1 rounded text-orange-300">
                        write_repository
                      </code>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50 mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={mirrorConfig.enabled}
                onChange={(e) => setMirrorConfig({ ...mirrorConfig, enabled: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-700 bg-black text-orange-500 focus:ring-orange-500/20"
              />
              <span className="text-xs font-bold text-zinc-400">Enable Auto-Sync</span>
            </label>

            <button
              onClick={saveMirror}
              disabled={savingMirror}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-orange-900/20 disabled:opacity-50"
            >
              {savingMirror ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Configuration
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-xl border border-zinc-800 bg-zinc-900/20">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Globe size={20} className="text-blue-400" /> Visibility
          {savingVisibility && <Loader2 size={14} className="animate-spin text-zinc-500" />}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => updateVisibility(true)}
            className={`p-4 rounded-xl border text-left transition-all relative group overflow-hidden ${
              isPublic
                ? 'bg-blue-600/10 border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.1)]'
                : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
            }`}
          >
            {isPublic && (
              <div className="absolute top-3 right-3 text-blue-500">
                <CheckCircle size={16} />
              </div>
            )}
            <div
              className={`flex items-center gap-3 text-sm font-bold mb-2 ${
                isPublic ? 'text-blue-400' : 'text-zinc-300'
              }`}
            >
              <Globe size={18} /> Public
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Anyone on the internet can see this repository. You choose who can commit.
            </p>
          </button>

          <button
            onClick={() => updateVisibility(false)}
            className={`p-4 rounded-xl border text-left transition-all relative group overflow-hidden ${
              !isPublic
                ? 'bg-blue-600/10 border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.1)]'
                : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
            }`}
          >
            {!isPublic && (
              <div className="absolute top-3 right-3 text-blue-500">
                <CheckCircle size={16} />
              </div>
            )}
            <div
              className={`flex items-center gap-3 text-sm font-bold mb-2 ${
                !isPublic ? 'text-blue-400' : 'text-zinc-300'
              }`}
            >
              <Lock size={18} /> Private
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Only you and the members you explicitly invite can view this resonance.
            </p>
          </button>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-xl border border-zinc-800 bg-zinc-900/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-purple-400" /> Team Access
          </h2>
          <span className="px-2 py-1 bg-purple-500/10 text-purple-400 rounded text-xs font-mono">
            {members.length} Members
          </span>
        </div>

        <div className="flex gap-2 mb-6 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <input
            type="email"
            placeholder="colleague@plectr.io"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="bg-zinc-900 text-zinc-300 text-xs border border-zinc-700 rounded px-2 focus:outline-none"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={inviteMember}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
          >
            <UserPlus size={14} /> Invite
          </button>
        </div>

        <div className="space-y-2">
          {members.map((m, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 hover:bg-white/5 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
                  {m.username.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-200">{m.username}</p>
                  <p className="text-[10px] text-zinc-500">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${
                    m.role === 'admin'
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : m.role === 'editor'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {m.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6 rounded-xl border border-red-900/30 bg-red-950/10">
        <h2 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
          <Shield size={20} /> Danger Zone
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-sm text-zinc-200">Delete Repository</p>
            <p className="text-xs text-zinc-500">
              Once deleted, it will be gone forever. Please be certain.
            </p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600/10 hover:bg-red-600 hover:text-white text-red-500 text-xs font-bold rounded-lg transition-all border border-red-600/20"
          >
            Delete Repository
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0a0a0a] border border-red-900/50 rounded-2xl shadow-2xl shadow-red-900/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 bg-red-950/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-red-500 flex items-center gap-2">
                <AlertTriangle size={20} /> Delete Repository
              </h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-zinc-300 text-sm">
                This action cannot be undone. This will permanently delete the
                <span className="font-bold text-white mx-1">{displayRepoName}</span>
                repository, all commits, files, and container images.
              </p>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">
                  Type <span className="text-zinc-300">{displayRepoName}</span> to confirm
                </label>
                <input
                  type="text"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteRepo}
                  disabled={deleteConfirmation !== displayRepoName || isDeleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all"
                >
                  {isDeleting && <Loader2 size={14} className="animate-spin" />} I understand,
                  delete this repository
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

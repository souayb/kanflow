import React, { useEffect, useState } from 'react';
import { Github, X } from 'lucide-react';
import { api, type GithubIntegrationStatus } from '../lib/api';

interface GithubIntegrationModalProps {
  open: boolean;
  status: GithubIntegrationStatus;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export default function GithubIntegrationModal({
  open,
  status,
  onClose,
  onChanged,
}: GithubIntegrationModalProps) {
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [ownerIsOrg, setOwnerIsOrg] = useState(false);
  const [mode, setMode] = useState<'app' | 'pat'>('app');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setToken('');
    setOwner(status.owner ?? '');
    setRepo(status.repo ?? '');
    setMode('app');
    setError('');
  }, [open, status.owner, status.repo, status.appAvailable]);

  if (!open) return null;

  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const repository = {
        owner,
        repo,
        projectNumber: projectNumber.trim() ? Number(projectNumber) : undefined,
        ownerIsOrg,
      };
      if (mode === 'app') {
        const { authorizeUrl } = await api.startGithubAuth(repository);
        window.location.assign(authorizeUrl);
        return;
      }
      await api.configureGithub({ token, ...repository });
      await onChanged();
      onClose();
    } catch {
      setError(
        mode === 'app'
          ? 'Could not start GitHub authorization. Check the server GitHub App configuration.'
          : 'Connection failed. Check the token permissions and repository name.',
      );
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    setSaving(true);
    setError('');
    try {
      await api.disconnectGithub();
      await onChanged();
      onClose();
    } catch {
      setError('Could not disconnect GitHub.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-kf-overlay/80 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="github-integration-title"
        className="w-full max-w-lg bg-kf-white rounded-[24px] border border-kf-divider-gray shadow-2xl p-6"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 id="github-integration-title" className="text-lg font-medium text-kf-charcoal flex items-center gap-2">
              <Github size={20} /> GitHub integration
            </h2>
            <p className="text-sm text-kf-slate mt-1">
              Connect a repository for issues, task branches, pull requests, and reviews.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-kf-warm-gray" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={connect} className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-kf-warm-gray p-1">
            <button type="button" onClick={() => setMode('app')} className={`px-3 py-2 text-sm rounded-lg ${mode === 'app' ? 'bg-kf-white text-kf-charcoal shadow-sm' : 'text-kf-slate'}`}>
              Continue with GitHub
            </button>
            <button type="button" onClick={() => setMode('pat')} className={`px-3 py-2 text-sm rounded-lg ${mode === 'pat' ? 'bg-kf-white text-kf-charcoal shadow-sm' : 'text-kf-slate'}`}>
              Personal token
            </button>
          </div>

          {mode === 'app' ? (
            <p className="text-sm text-kf-slate rounded-xl bg-kf-baby-blue/40 p-3">
              {status.appAvailable
                ? 'You will approve Kanflow on GitHub. You can later revoke access here or from GitHub Settings → Applications.'
                : 'GitHub authorization requires GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET on the server. You can still use a personal token.'}
            </p>
          ) : <div>
            <label htmlFor="github-token" className="block text-xs font-medium text-kf-secondary-text mb-1.5">
              Personal access token
            </label>
            <input
              id="github-token"
              type="password"
              autoComplete="off"
              className="kf-input w-full text-sm rounded-xl"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={status.configured ? 'Enter a new token to reconnect' : 'github_pat_…'}
              required={mode === 'pat'}
            />
            <p className="text-[11px] text-kf-secondary-text mt-1">
              Fine-grained token permissions: repository Contents, Issues, and Pull requests read/write.
            </p>
          </div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="github-owner" className="block text-xs font-medium text-kf-secondary-text mb-1.5">Owner</label>
              <input id="github-owner" className="kf-input w-full text-sm rounded-xl" value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="user-or-org" required />
            </div>
            <div>
              <label htmlFor="github-repo" className="block text-xs font-medium text-kf-secondary-text mb-1.5">Repository</label>
              <input id="github-repo" className="kf-input w-full text-sm rounded-xl" value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="repository" required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label htmlFor="github-project" className="block text-xs font-medium text-kf-secondary-text mb-1.5">Projects v2 number (optional)</label>
              <input id="github-project" type="number" min="1" className="kf-input w-full text-sm rounded-xl" value={projectNumber} onChange={(event) => setProjectNumber(event.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-kf-slate min-h-10">
              <input type="checkbox" checked={ownerIsOrg} onChange={(event) => setOwnerIsOrg(event.target.checked)} />
              Owner is an organization
            </label>
          </div>

          {error && <p role="alert" className="text-sm text-kf-error">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-2">
            {status.configured ? (
              <button type="button" disabled={saving} onClick={() => void disconnect()} className="px-4 py-2.5 text-sm text-kf-error hover:bg-kf-warm-gray rounded-xl disabled:opacity-50">
                {status.authMethod === 'github_app' ? 'Revoke access' : 'Disconnect'}
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-kf-slate hover:bg-kf-warm-gray rounded-xl">Cancel</button>
              <button type="submit" disabled={saving || (mode === 'app' && !status.appAvailable)} className="kf-btn-primary px-5 py-2.5 text-sm rounded-xl disabled:opacity-50">
                {saving
                  ? mode === 'app' ? 'Redirecting…' : 'Checking…'
                  : mode === 'app' ? 'Continue with GitHub'
                  : status.configured ? 'Reconnect' : 'Connect'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

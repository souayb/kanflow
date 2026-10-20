/**
 * Coding agent: T3 Code is the real harness. The Warp-inspired in-app shell
 * stays available as an optional fallback. Kanflow does not vendor T3 or Warp.
 */
import React, { useMemo, useState } from 'react';
import { ExternalLink, TerminalSquare } from 'lucide-react';
import { useApp } from '../AppContext';
import { cn } from '../lib/utils';
import {
  DEFAULT_T3_URL,
  normalizeT3Url,
  openT3,
  readAgentSurface,
  readT3Url,
  writeAgentSurface,
  writeT3Url,
  type AgentSurface,
} from '../lib/t3';
import WarpTerminal from './WarpTerminal';

export default function CodingAgentView() {
  const { activeProjectId, projects } = useApp();
  const project = projects.find((p) => p.id === activeProjectId);
  const [surface, setSurface] = useState<AgentSurface>(() => readAgentSurface());
  const [t3Url, setT3Url] = useState(() => readT3Url());
  const [draftUrl, setDraftUrl] = useState(() => readT3Url());
  const [urlError, setUrlError] = useState('');

  const normalizedDraft = useMemo(() => normalizeT3Url(draftUrl), [draftUrl]);

  const selectSurface = (next: AgentSurface) => {
    setSurface(next);
    writeAgentSurface(next);
  };

  const saveUrl = (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalizedDraft) {
      setUrlError('Enter an http(s) T3 URL or pairing link.');
      return;
    }
    const saved = writeT3Url(normalizedDraft);
    setT3Url(saved);
    setDraftUrl(saved);
    setUrlError('');
  };

  const resetUrl = () => {
    const saved = writeT3Url(DEFAULT_T3_URL);
    setT3Url(saved);
    setDraftUrl(saved);
    setUrlError('');
  };

  const launchT3 = () => {
    if (draftUrl.trim() && !normalizedDraft) {
      setUrlError('Enter an http(s) T3 URL or pairing link.');
      return;
    }
    const url = normalizedDraft ?? t3Url;
    if (!url) {
      setUrlError('Enter an http(s) T3 URL or pairing link.');
      return;
    }
    if (normalizedDraft && normalizedDraft !== t3Url) {
      const saved = writeT3Url(normalizedDraft);
      setT3Url(saved);
      setDraftUrl(saved);
    }
    setUrlError('');
    const opened = openT3(url);
    if (!opened) {
      setUrlError('Pop-up blocked. Allow pop-ups for Kanflow, or copy the URL into a new tab.');
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium tracking-[-0.012em] text-kf-paper flex items-center gap-2">
            <TerminalSquare size={22} /> Coding agent
          </h2>
          <p className="text-sm text-kf-slate mt-1">
            Drive Claude, Cursor, Codex, and other host agents from T3 for {project?.name ?? 'this project'}.
            The in-app terminal is an optional local shell, not a Warp import.
          </p>
        </div>
        <div className="flex bg-kf-warm-gray p-1 rounded-full border border-kf-divider-gray self-start">
          <button
            type="button"
            aria-pressed={surface === 't3'}
            onClick={() => selectSurface('t3')}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-medium transition-all min-h-[40px]',
              surface === 't3' ? 'bg-kf-meta-blue text-kf-white shadow-sm' : 'text-kf-slate hover:text-kf-charcoal',
            )}
          >
            T3 Code
          </button>
          <button
            type="button"
            aria-pressed={surface === 'warp'}
            onClick={() => selectSurface('warp')}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-medium transition-all min-h-[40px]',
              surface === 'warp' ? 'bg-kf-meta-blue text-kf-white shadow-sm' : 'text-kf-slate hover:text-kf-charcoal',
            )}
          >
            In-app terminal
          </button>
        </div>
      </div>

      {surface === 't3' ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="max-w-2xl rounded-xl border border-kf-divider-gray bg-kf-carbon p-6 space-y-5">
            <div>
              <h3 className="text-base font-medium text-kf-charcoal">Open T3 Code</h3>
              <p className="text-sm text-kf-slate mt-1">
                T3 runs on the machine that owns the repo and your provider CLIs.
                Kanflow opens it; it does not embed or vendor T3.
              </p>
            </div>

            <button
              type="button"
              onClick={launchT3}
              className="kf-btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2"
            >
              Open T3 Code <ExternalLink size={16} />
            </button>

            <form onSubmit={saveUrl} className="space-y-2">
              <label htmlFor="t3-url" className="text-xs font-medium text-kf-secondary-text">
                T3 URL or pairing link
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="t3-url"
                  className="kf-input flex-1 text-sm rounded-xl"
                  value={draftUrl}
                  onChange={(event) => {
                    setDraftUrl(event.target.value);
                    setUrlError('');
                  }}
                  placeholder={DEFAULT_T3_URL}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  disabled={!normalizedDraft || normalizedDraft === t3Url}
                  className="kf-btn-primary px-4 py-2.5 text-sm rounded-xl disabled:opacity-50"
                >
                  Save
                </button>
                <button type="button" onClick={resetUrl} className="kf-btn-secondary px-4 py-2.5 text-sm rounded-xl">
                  Default
                </button>
              </div>
              {urlError && <p className="text-sm text-kf-error">{urlError}</p>}
            </form>

            <ol className="text-sm text-kf-slate list-decimal pl-5 space-y-2">
              <li>
                Install T3:{' '}
                <code className="text-xs bg-kf-soft-gray px-1.5 py-0.5 rounded">curl -fsSL https://t3.codes/install.sh | sh</code>
              </li>
              <li>
                Start it with <code className="text-xs bg-kf-soft-gray px-1.5 py-0.5 rounded">t3</code> or{' '}
                <code className="text-xs bg-kf-soft-gray px-1.5 py-0.5 rounded">t3 service install</code>, then sign in a provider (Claude, Cursor, Codex, …).
              </li>
              <li>
                Paste a <code className="text-xs bg-kf-soft-gray px-1.5 py-0.5 rounded">t3 pair</code> URL here if you are not using the hosted app.
              </li>
            </ol>

            <div className="flex flex-wrap gap-3 text-sm">
              <a
                href="https://github.com/pingdotgg/t3code"
                target="_blank"
                rel="noreferrer"
                className="text-kf-meta-blue hover:underline inline-flex items-center gap-1"
              >
                T3 on GitHub <ExternalLink size={14} />
              </a>
              <a
                href="https://github.com/pingdotgg/t3code/blob/main/docs/user/install.md"
                target="_blank"
                rel="noreferrer"
                className="text-kf-meta-blue hover:underline inline-flex items-center gap-1"
              >
                Install docs <ExternalLink size={14} />
              </a>
              <a
                href="https://github.com/pingdotgg/t3code/blob/main/docs/user/remote-access.md"
                target="_blank"
                rel="noreferrer"
                className="text-kf-meta-blue hover:underline inline-flex items-center gap-1"
              >
                Remote access <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      ) : (
        <WarpTerminal />
      )}
    </div>
  );
}

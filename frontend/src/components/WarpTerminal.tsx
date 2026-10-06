/**
 * Optional in-app shell: Warp-inspired command blocks over Kanflow's WebSocket.
 * This is a Kanflow-owned UI, not a Warp source import.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot } from 'lucide-react';
import keycloak from '../lib/keycloak';
import { applyTerminalEvent, terminalWsUrl, type TerminalBlock, type TerminalEvent } from '../lib/terminal';
import { cn } from '../lib/utils';

export default function WarpTerminal() {
  const [blocks, setBlocks] = useState<TerminalBlock[]>([]);
  const [prompt, setPrompt] = useState('kanflow % ');
  const [cwd, setCwd] = useState('.');
  const [command, setCommand] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const attach = (next: WebSocket) => {
      socket = next;
      socketRef.current = next;
      next.onopen = () => {
        attempts = 0;
        setConnected(true);
        setError('');
      };
      next.onclose = () => {
        setConnected(false);
        socketRef.current = null;
        if (cancelled) return;
        if (attempts < 4) {
          attempts += 1;
          retryTimer = setTimeout(connect, 800 * attempts);
        } else {
          setError('Could not reach the coding-agent terminal.');
        }
      };
      next.onerror = () => setError('Could not reach the coding-agent terminal.');
      next.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as TerminalEvent;
          if (payload.type === 'ready') {
            setCwd(payload.cwd);
            setPrompt(payload.prompt);
            return;
          }
          setBlocks((current) => applyTerminalEvent(current, payload));
        } catch {
          /* ignore malformed frames */
        }
      };
    };

    const connect = () => {
      if (cancelled) return;
      const start = () => {
        if (cancelled) return;
        try {
          attach(new WebSocket(terminalWsUrl()));
        } catch {
          setError('Could not reach the coding-agent terminal.');
        }
      };
      const refresh = keycloak.updateToken;
      if (typeof refresh === 'function') {
        void refresh.call(keycloak, 30).then(start, start);
      } else {
        start();
      }
    };

    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
      socketRef.current = null;
    };
  }, [generation]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top: scroller.scrollHeight });
    } else {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [blocks]);

  const running = useMemo(() => blocks.some((block) => block.running), [blocks]);

  const retry = useCallback(() => {
    setError('');
    setGeneration((current) => current + 1);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = command.trim();
    if (running || !value || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    socketRef.current.send(
      JSON.stringify({
        type: 'input',
        blockId: crypto.randomUUID(),
        data: value,
      }),
    );
    setCommand('');
  };

  const interrupt = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: 'interrupt' }));
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-xs text-kf-secondary-text">
        <p>
          Optional local shell for {cwd}. Real agents (Claude, Cursor, Codex) still run in T3 on your machine.
        </p>
        <span className="flex items-center gap-1.5 shrink-0">
          <Bot size={14} />
          {connected ? `Ready · ${cwd}` : 'Connecting…'}
        </span>
      </div>

      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-auto rounded-xl bg-kf-void text-kf-mist p-4 space-y-3 font-mono text-sm">
        {blocks.length === 0 && (
          <p className="text-kf-fog">Run a command to start a block. Example: `git status` or `ls`.</p>
        )}
        {blocks.map((block) => (
          <article key={block.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-[#8fd0ff]">{prompt}{block.command}</div>
            {block.output && <pre className="mt-2 whitespace-pre-wrap text-[#d7e0ea]">{block.output}</pre>}
            <div className={cn('mt-2 text-[11px] uppercase tracking-wide', block.running ? 'text-[#f0c674]' : block.exitCode === 0 ? 'text-[#98c379]' : 'text-[#e06c75]')}>
              {block.running ? 'Running' : `Exit ${block.exitCode ?? '?'}`}
            </div>
          </article>
        ))}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <label htmlFor="agent-command" className="sr-only">Command</label>
        <span className="text-sm font-mono text-kf-slate shrink-0">{prompt}</span>
        <input
          id="agent-command"
          className="kf-input flex-1 font-mono text-sm rounded-xl"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder={running ? 'Command is running…' : 'Type a command'}
          disabled={!connected || running}
        />
        {running ? (
          <button type="button" onClick={interrupt} className="kf-btn-primary px-4 py-2.5 text-sm rounded-xl">
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!connected || !command.trim()} className="kf-btn-primary px-4 py-2.5 text-sm rounded-xl disabled:opacity-50">
            Run
          </button>
        )}
      </form>
      {error && (
        <p className="text-sm text-kf-error flex items-center gap-3">
          <span>{error}</span>
          <button type="button" onClick={retry} className="kf-btn-secondary !py-1 !px-3 text-xs">
            Retry
          </button>
        </p>
      )}
    </div>
  );
}

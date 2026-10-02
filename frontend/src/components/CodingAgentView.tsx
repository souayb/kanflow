/**
 * Warp-inspired coding-agent terminal: command blocks, streamed output, and
 * room for CLI agents. This is a Kanflow-owned UI, not a Warp source import.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, TerminalSquare } from 'lucide-react';
import { applyTerminalEvent, terminalWsUrl, type TerminalBlock, type TerminalEvent } from '../lib/terminal';
import { useApp } from '../AppContext';
import { cn } from '../lib/utils';

export default function CodingAgentView() {
  const { activeProjectId, projects } = useApp();
  const project = projects.find((p) => p.id === activeProjectId);
  const [blocks, setBlocks] = useState<TerminalBlock[]>([]);
  const [prompt, setPrompt] = useState('kanflow % ');
  const [cwd, setCwd] = useState('.');
  const [command, setCommand] = useState('');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const socketRef = useRef<WebSocket | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = new WebSocket(terminalWsUrl());
    socketRef.current = socket;
    socket.onopen = () => {
      setConnected(true);
      setError('');
    };
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setError('Could not reach the coding-agent terminal.');
    socket.onmessage = (event) => {
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
    return () => socket.close();
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [blocks]);

  const running = useMemo(() => blocks.some((block) => block.running), [blocks]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = command.trim();
    if (!value || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: 'input',
        blockId: crypto.randomUUID(),
        data: value,
      }),
    );
    setCommand('');
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-kf-charcoal flex items-center gap-2">
            <TerminalSquare size={22} /> Coding agent
          </h2>
          <p className="text-sm text-kf-slate mt-1">
            Warp-like command blocks for {project?.name ?? 'this project'}. Approve CLI agents here later without importing Warp source.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-kf-secondary-text">
          <Bot size={14} />
          <span>{connected ? `Ready · ${cwd}` : 'Connecting…'}</span>
        </div>
      </div>

      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-auto rounded-2xl bg-[#11161c] text-[#d7e0ea] p-4 space-y-3 font-mono text-sm">
        {blocks.length === 0 && (
          <p className="text-[#7f8b98]">Run a command to start a block. Example: `git status` or `ls`.</p>
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
          disabled={!connected}
          autoFocus
        />
        <button type="submit" disabled={!connected || !command.trim()} className="kf-btn-primary px-4 py-2.5 text-sm rounded-xl disabled:opacity-50">
          Run
        </button>
      </form>
      {error && <p className="text-sm text-kf-error">{error}</p>}
    </div>
  );
}

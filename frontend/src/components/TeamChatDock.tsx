import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Send, X, MessageSquare, Bot, Hash, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../AppContext';
import { cn } from '../lib/utils';
import Avatar from './Avatar';
import { chatWithAI } from '../lib/ai';

type DockTab = 'team' | 'ai';

interface ChatLine {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  at: number;
  kind: 'user' | 'ai';
}

const STORE_KEY = 'kanflow_team_chat_v1';

function threadKeyChannel(projectId: string) {
  return `c:${projectId}:general`;
}

function threadKeyDm(a: string, b: string) {
  return a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`;
}

function loadStore(): Record<string, ChatLine[]> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    return p && typeof p === 'object' ? (p as Record<string, ChatLine[]>) : {};
  } catch {
    return {};
  }
}

function saveStore(data: Record<string, ChatLine[]>) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export default function TeamChatDock() {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<DockTab>('team');
  const [teamKind, setTeamKind] = useState<'channel' | 'dm'>('channel');
  const [dmPeerId, setDmPeerId] = useState<string | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState('');
  const [aiTyping, setAiTyping] = useState(false);
  const skipPersist = useRef(false);
  const { activeProjectId, projects, users, currentUser } = useApp();

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const threadKey = useMemo(() => {
    if (!activeProjectId || !currentUser) return null;
    if (tab === 'ai') return `ai:${activeProjectId}`;
    if (teamKind === 'channel') return threadKeyChannel(activeProjectId);
    if (!dmPeerId) return null;
    return threadKeyDm(currentUser.id, dmPeerId);
  }, [activeProjectId, currentUser, teamKind, dmPeerId, tab]);

  useEffect(() => {
    if (!threadKey) {
      setLines([]);
      return;
    }
    skipPersist.current = true;
    const all = loadStore();
    setLines(Array.isArray(all[threadKey]) ? all[threadKey] : []);
  }, [threadKey]);

  useEffect(() => {
    if (!threadKey) return;
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    const all = loadStore();
    all[threadKey] = lines;
    saveStore(all);
  }, [lines, threadKey]);

  const teamScrollRef = useRef<HTMLDivElement>(null);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tab === 'ai' ? aiScrollRef.current : teamScrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [lines, aiTyping, tab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !currentUser) return;

    if (tab === 'ai') {
      if (!activeProjectId) return;
      setInput('');
      const userMsg: ChatLine = {
        id: crypto.randomUUID(),
        senderId: currentUser.id,
        senderName: currentUser.name,
        content: text,
        at: Date.now(),
        kind: 'user',
      };
      setLines((prev) => [...prev, userMsg]);
      setAiTyping(true);
      try {
        const ctx = activeProject ? `Project "${activeProject.name}"` : undefined;
        const reply = await chatWithAI(text, ctx);
        setLines((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            senderId: 'kanflow-ai',
            senderName: 'Kanflow AI',
            content: reply,
            at: Date.now(),
            kind: 'ai',
          },
        ]);
      } catch (err) {
        const hint = err instanceof Error ? err.message : 'AI unavailable';
        setLines((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            senderId: 'kanflow-ai',
            senderName: 'Kanflow AI',
            content: `Could not reach the model (${hint}).`,
            at: Date.now(),
            kind: 'ai',
          },
        ]);
      } finally {
        setAiTyping(false);
      }
      return;
    }

    if (!threadKey) return;
    setInput('');
    const msg: ChatLine = {
      id: crypto.randomUUID(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: text,
      at: Date.now(),
      kind: 'user',
    };
    setLines((prev) => [...prev, msg]);
  };

  const dmTargets = useMemo(
    () => users.filter((u) => u.id !== currentUser?.id),
    [users, currentUser?.id],
  );

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="mb-4 w-[min(100vw-1.5rem,28rem)] h-[min(100dvh-6rem,640px)] bg-kf-white border border-kf-divider-gray rounded-[24px] shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 bg-kf-charcoal text-kf-white flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare size={18} className="shrink-0" strokeWidth={1.75} />
                <span className="text-sm font-medium truncate">Team chat</span>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-[10px] shrink-0" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="flex border-b border-kf-divider-gray shrink-0">
              <button
                type="button"
                onClick={() => setTab('team')}
                className={cn(
                  'flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide',
                  tab === 'team' ? 'text-kf-meta-blue border-b-2 border-kf-meta-blue bg-kf-baby-blue/30' : 'text-kf-slate hover:bg-kf-soft-gray',
                )}
              >
                Channels · DM
              </button>
              <button
                type="button"
                onClick={() => setTab('ai')}
                className={cn(
                  'flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide flex items-center justify-center gap-1',
                  tab === 'ai' ? 'text-kf-meta-blue border-b-2 border-kf-meta-blue bg-kf-baby-blue/30' : 'text-kf-slate hover:bg-kf-soft-gray',
                )}
              >
                <Bot size={14} />
                AI
              </button>
            </div>

            {tab === 'team' && (
              <div className="flex flex-1 min-h-0 border-b border-kf-divider-gray">
                <div className="w-[42%] max-w-[11rem] border-r border-kf-divider-gray bg-kf-soft-gray/50 flex flex-col text-xs shrink-0">
                  <div className="p-2 font-semibold text-kf-secondary-text uppercase tracking-wide">Channels</div>
                  <button
                    type="button"
                    onClick={() => {
                      setTeamKind('channel');
                      setDmPeerId(null);
                    }}
                    className={cn(
                      'mx-1 mb-1 px-2 py-2 rounded-lg text-left font-medium flex items-center gap-1.5',
                      teamKind === 'channel' ? 'bg-kf-white text-kf-meta-blue shadow-sm' : 'text-kf-charcoal hover:bg-kf-warm-gray',
                    )}
                  >
                    <Hash size={12} className="shrink-0" />
                    general
                  </button>
                  <div className="p-2 pt-3 font-semibold text-kf-secondary-text uppercase tracking-wide flex items-center gap-1">
                    <Users size={12} />
                    Direct
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar px-1 pb-2 space-y-0.5">
                    {dmTargets.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setTeamKind('dm');
                          setDmPeerId(u.id);
                        }}
                        className={cn(
                          'w-full px-2 py-2 rounded-lg text-left font-medium flex items-center gap-2 min-w-0',
                          teamKind === 'dm' && dmPeerId === u.id ? 'bg-kf-white text-kf-meta-blue shadow-sm' : 'text-kf-charcoal hover:bg-kf-warm-gray',
                        )}
                      >
                        <Avatar name={u.name} className="w-6 h-6 text-[8px] shrink-0" />
                        <span className="truncate">{u.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-w-0 bg-kf-white">
                  <div className="px-3 py-2 border-b border-kf-divider-gray text-[11px] text-kf-slate truncate">
                    {teamKind === 'channel' ? `# general · ${activeProject?.name ?? 'Project'}` : dmTargets.find((u) => u.id === dmPeerId)?.name ?? 'Direct'}
                  </div>
                  <div ref={teamScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                    {lines.length === 0 && (
                      <p className="text-xs text-kf-slate text-center py-8 px-2">Say hi to your team. Messages stay in this browser (localStorage).</p>
                    )}
                    {lines.map((m) => (
                      <div key={m.id} className={cn('flex gap-2', m.senderId === currentUser?.id ? 'flex-row-reverse' : '')}>
                        <Avatar name={m.senderName} className="w-7 h-7 text-[9px] shrink-0 border border-kf-divider-gray" />
                        <div className={cn('min-w-0 max-w-[85%]', m.senderId === currentUser?.id ? 'text-right' : '')}>
                          <div className="text-[10px] text-kf-secondary-text mb-0.5">{m.senderName}</div>
                          <div
                            className={cn(
                              'text-sm px-3 py-2 rounded-2xl inline-block text-left',
                              m.senderId === currentUser?.id ? 'bg-kf-meta-blue text-kf-white rounded-tr-sm' : 'bg-kf-warm-gray text-kf-charcoal rounded-tl-sm',
                            )}
                          >
                            {m.content}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'ai' && (
              <div className="flex-1 flex flex-col min-h-0 bg-kf-soft-gray/40">
                <div ref={aiScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {lines.length === 0 && !aiTyping && (
                    <p className="text-xs text-kf-slate text-center py-8">Ask Kanflow AI about this project.</p>
                  )}
                  {lines.map((m) => (
                    <div key={m.id} className={cn('flex gap-2', m.senderId === currentUser?.id ? 'flex-row-reverse' : '')}>
                      <div
                        className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center shrink-0 border text-[9px]',
                          m.kind === 'ai' ? 'bg-kf-baby-blue border-kf-meta-blue/30 text-kf-meta-blue' : 'border-kf-divider-gray',
                        )}
                      >
                        {m.kind === 'ai' ? <Bot size={14} /> : <Avatar name={m.senderName} className="w-full h-full text-[8px]" />}
                      </div>
                      <div className={cn('min-w-0 max-w-[85%]', m.senderId === currentUser?.id ? 'text-right' : '')}>
                        <div className="text-[10px] text-kf-secondary-text mb-0.5">{m.senderName}</div>
                        <div
                          className={cn(
                            'text-sm px-3 py-2 rounded-2xl inline-block text-left whitespace-pre-wrap',
                            m.senderId === currentUser?.id ? 'bg-kf-meta-blue text-kf-white' : 'bg-kf-white border border-kf-divider-gray text-kf-charcoal',
                          )}
                        >
                          {m.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  {aiTyping && (
                    <div className="flex gap-2">
                      <div className="w-7 h-7 rounded-full bg-kf-baby-blue border border-kf-meta-blue/30 flex items-center justify-center">
                        <Bot size={14} className="text-kf-meta-blue" />
                      </div>
                      <div className="text-xs text-kf-slate py-2">Thinking…</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-3 border-t border-kf-divider-gray bg-kf-white shrink-0">
              {!currentUser ? (
                <p className="text-xs text-kf-slate text-center py-2">Sign in to send messages.</p>
              ) : tab === 'team' && teamKind === 'dm' && !dmPeerId ? (
                <p className="text-xs text-kf-slate text-center py-2">Pick someone under Direct.</p>
              ) : (
                <div className="relative">
                  <input
                    className="kf-input w-full pr-11 py-2.5 text-sm rounded-[12px]"
                    placeholder={tab === 'ai' ? 'Ask Kanflow AI…' : 'Message…'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || (tab === 'team' && !threadKey)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-kf-meta-blue text-kf-white rounded-[10px] hover:bg-kf-meta-blue-hover disabled:opacity-40"
                  >
                    <Send size={14} />
                  </button>
                </div>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-14 h-14 min-w-[56px] min-h-[56px] rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 relative',
          isOpen ? 'bg-kf-charcoal text-kf-white' : 'bg-kf-meta-blue text-kf-white',
        )}
        aria-label={isOpen ? 'Close team chat' : 'Open team chat'}
      >
        {isOpen ? <X size={22} /> : <MessageSquare size={22} strokeWidth={1.75} />}
      </button>
    </div>
  );
}

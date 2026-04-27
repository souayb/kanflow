import React, { useState, useRef, useEffect } from 'react';
import { Send, X, MessageSquare, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../AppContext';
import { cn } from '../lib/utils';
import Avatar from './Avatar';
import { chatWithAI } from '../lib/ai';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: number;
  type: 'user' | 'ai';
}

function chatStorageKey(projectId: string): string {
  return `kanflow_chat_${projectId}`;
}

function loadMessages(projectId: string): Message[] {
  try {
    const raw = localStorage.getItem(chatStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is Message =>
        m &&
        typeof m === 'object' &&
        typeof (m as Message).id === 'string' &&
        typeof (m as Message).content === 'string',
    );
  } catch {
    return [];
  }
}

function saveMessages(projectId: string, messages: Message[]): void {
  try {
    localStorage.setItem(chatStorageKey(projectId), JSON.stringify(messages));
  } catch {
    /* quota or private mode */
  }
}

export default function ChatComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /** Avoid saving stale messages under a new project id right after switching (race). */
  const skipNextPersist = useRef(false);
  const { activeProjectId, projects, currentUser } = useApp();

  const activeProject = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    if (!activeProjectId) {
      setMessages([]);
      return;
    }
    skipNextPersist.current = true;
    setMessages(loadMessages(activeProjectId));
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    saveMessages(activeProjectId, messages);
  }, [messages, activeProjectId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeProjectId || !currentUser) return;

    const messageContent = input.trim();
    setInput('');

    const userMsg: Message = {
      id: crypto.randomUUID(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      content: messageContent,
      timestamp: Date.now(),
      type: 'user',
    };
    setMessages((prev) => [...prev, userMsg]);

    setIsTyping(true);
    try {
      const projectContext = activeProject
        ? `Project "${activeProject.name}", ${activeProject.description || 'no description'}`
        : undefined;
      const aiReply = await chatWithAI(messageContent, projectContext);
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        senderId: 'kanflow-ai',
        senderName: 'Kanflow AI',
        content: aiReply,
        timestamp: Date.now(),
        type: 'ai',
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('Ollama AI reply failed:', err);
      const hint = err instanceof Error ? err.message : 'Could not reach Ollama.';
      const errMsg: Message = {
        id: crypto.randomUUID(),
        senderId: 'kanflow-ai',
        senderName: 'Kanflow AI',
        content: `Sorry — I could not generate a reply (${hint}). Start Ollama (\`ollama serve\`) or set VITE_OLLAMA_URL. With Docker Compose, the app proxies requests to \`/ollama\`.`,
        timestamp: Date.now(),
        type: 'ai',
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-4 w-[min(100vw-2rem,24rem)] h-[min(100dvh-8rem,600px)] bg-kf-white border border-kf-divider-gray rounded-[24px] shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 bg-kf-meta-blue text-kf-white flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-white/15 rounded-[12px] flex items-center justify-center shrink-0">
                  <MessageSquare size={20} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-sm truncate">Project chat</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-kf-success rounded-full animate-pulse shrink-0" />
                    <span className="text-[11px] font-normal text-white/90 truncate">{activeProject?.name ?? 'Project'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-[10px] transition-colors shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-kf-soft-gray/40">
              {messages.length === 0 && !isTyping && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <div className="w-12 h-12 rounded-full bg-kf-white flex items-center justify-center mb-4 border border-kf-divider-gray">
                    <Bot size={24} className="text-kf-slate" />
                  </div>
                  <p className="text-xs text-kf-slate leading-relaxed px-2">
                    Messages are stored in this browser (localStorage). The Kanflow API can back chat with MongoDB when wired up.
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={cn('flex gap-3', m.senderId === currentUser?.id ? 'flex-row-reverse' : '')}>
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center border shrink-0 overflow-hidden',
                      m.type === 'ai' ? 'bg-kf-baby-blue border-kf-meta-blue/25 text-kf-meta-blue' : 'border-kf-divider-gray',
                    )}
                  >
                    {m.type === 'ai' ? (
                      <Bot size={16} />
                    ) : (
                      <Avatar name={m.senderName || 'User'} className="w-full h-full text-[10px]" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1 max-w-[75%]">
                    <div
                      className={cn(
                        'text-[10px] font-medium text-kf-secondary-text px-1',
                        m.senderId === currentUser?.id ? 'text-right' : '',
                      )}
                    >
                      {m.senderName}
                    </div>
                    <div
                      className={cn(
                        'p-3 rounded-[16px] text-sm leading-relaxed',
                        m.senderId === currentUser?.id
                          ? 'bg-kf-meta-blue text-kf-white rounded-tr-none shadow-md'
                          : m.type === 'ai'
                            ? 'bg-kf-white text-kf-charcoal rounded-tl-none border border-kf-meta-blue/25 font-medium'
                            : 'bg-kf-white text-kf-charcoal rounded-tl-none border border-kf-divider-gray',
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-kf-baby-blue border border-kf-meta-blue/25 text-kf-meta-blue flex items-center justify-center shrink-0">
                    <Bot size={16} />
                  </div>
                  <div className="bg-kf-white p-3 rounded-[16px] rounded-tl-none border border-kf-divider-gray flex gap-1 items-center">
                    <span className="w-1 h-1 bg-kf-meta-blue rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-1 bg-kf-meta-blue rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-1 bg-kf-meta-blue rounded-full animate-bounce" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-kf-divider-gray bg-kf-white">
              {!currentUser ? (
                <div className="text-center py-4">
                  <p className="text-xs text-kf-slate mb-3">Select a profile to send messages.</p>
                </div>
              ) : (
                <form onSubmit={handleSend} className="relative">
                  <input
                    autoFocus
                    placeholder={`Message ${activeProject?.name ?? 'project'}…`}
                    className="kf-input pr-12 py-3 text-sm rounded-[12px]"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-kf-meta-blue text-kf-white rounded-[10px] hover:bg-kf-meta-blue-hover disabled:opacity-50 disabled:hover:bg-kf-meta-blue transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-14 h-14 min-w-[56px] min-h-[56px] rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 group relative',
          isOpen ? 'bg-kf-charcoal text-kf-white rotate-90' : 'bg-kf-meta-blue text-kf-white',
        )}
      >
        <div className="absolute inset-0 rounded-full bg-kf-meta-blue animate-ping opacity-20 pointer-events-none" />
        {isOpen ? <X size={24} /> : <MessageSquare size={24} strokeWidth={1.75} />}
        {!isOpen && messages.length > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-kf-error rounded-full border-2 border-kf-white flex items-center justify-center">
            <span className="text-[10px] font-black">{Math.min(messages.length, 99)}</span>
          </div>
        )}
      </button>
    </div>
  );
}

import React, { useMemo, useRef, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { useApp } from '../AppContext';
import { cn } from '../lib/utils';

interface LayoutSearchResultsProps {
  query: string;
  open: boolean;
  onClose: () => void;
  onPickTask: (taskId: string) => void;
}

export default function LayoutSearchResults({ query, open, onClose, onPickTask }: LayoutSearchResultsProps) {
  const { tasks, projects } = useApp();
  const wrapRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tasks
      .filter((t) => {
        const hay = `${t.title}\n${t.description}\n${t.tags.join(' ')}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 12);
  }, [tasks, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose]);

  if (!open || !query.trim()) return null;

  return (
    <div
      id="kanflow-global-search-results"
      ref={wrapRef}
      className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,22rem)] overflow-y-auto custom-scrollbar kf-card-elevated rounded-2xl border border-kf-divider-gray shadow-2xl z-50 py-2"
      role="listbox"
      aria-label="Search results"
    >
      {hits.length === 0 ? (
        <div className="px-4 py-6 text-sm text-kf-slate text-center">No tasks match.</div>
      ) : (
        hits.map((t) => {
          const proj = projects.find((p) => p.id === t.projectId);
          return (
            <button
              key={t.id}
              type="button"
              role="option"
              onClick={() => {
                onPickTask(t.id);
                onClose();
              }}
              className="w-full text-left px-4 py-3 hover:bg-kf-soft-gray border-b border-kf-divider-gray/60 last:border-0 flex flex-col gap-1"
            >
              <span className="text-sm font-medium text-kf-charcoal line-clamp-2">{t.title}</span>
              <span className="text-[11px] text-kf-slate flex items-center gap-1.5">
                <FolderOpen size={12} className="shrink-0 text-kf-meta-blue" />
                <span className={cn('truncate', !proj && 'italic')}>{proj?.name ?? 'Unknown project'}</span>
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

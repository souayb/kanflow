import React from 'react';
import { X, GripVertical, Eye, EyeOff, Layout, Plus } from 'lucide-react';
import { useApp } from '../AppContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DashboardCustomizer({ isOpen, onClose }: DashboardCustomizerProps) {
  const { dashboardWidgets, updateDashboardWidgets } = useApp();

  const toggleWidget = (id: string) => {
    const newWidgets = dashboardWidgets.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w));
    updateDashboardWidgets(newWidgets);
  };

  const moveWidget = (id: string, direction: 'up' | 'down') => {
    const index = dashboardWidgets.findIndex((w) => w.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= dashboardWidgets.length) return;

    const newWidgets = [...dashboardWidgets];
    [newWidgets[index], newWidgets[newIndex]] = [newWidgets[newIndex], newWidgets[index]];

    const orderedWidgets = newWidgets.map((w, i) => ({ ...w, order: i }));
    updateDashboardWidgets(orderedWidgets);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-kf-overlay backdrop-blur-sm z-[60]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 48 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-kf-white border-l border-kf-divider-gray shadow-2xl z-[70] flex flex-col"
          >
            <div className="p-6 border-b border-kf-divider-gray flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Layout size={20} className="text-kf-meta-blue" strokeWidth={1.75} />
                <h2 className="text-lg font-medium tracking-tight text-kf-charcoal">Dashboard layout</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-kf-warm-gray rounded-[12px] text-kf-icon-secondary hover:text-kf-charcoal transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="mb-8">
                <h3 className="text-xs font-medium text-kf-secondary-text uppercase tracking-wide mb-4">Widget order</h3>
                <div className="space-y-2">
                  {dashboardWidgets.map((widget, idx) => (
                    <div
                      key={widget.id}
                      className={cn(
                        'p-4 rounded-[16px] border flex items-center gap-4 transition-colors',
                        widget.enabled
                          ? 'bg-kf-white border-kf-divider-gray hover:border-kf-meta-blue/25'
                          : 'bg-kf-soft-gray/80 border-kf-divider-gray/60 opacity-60',
                      )}
                    >
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveWidget(widget.id, 'up')}
                          disabled={idx === 0}
                          className="text-kf-icon-secondary hover:text-kf-meta-blue disabled:opacity-0 text-[10px] py-0.5"
                        >
                          ▲
                        </button>
                        <GripVertical size={16} className="text-kf-divider" />
                        <button
                          type="button"
                          onClick={() => moveWidget(widget.id, 'down')}
                          disabled={idx === dashboardWidgets.length - 1}
                          className="text-kf-icon-secondary hover:text-kf-meta-blue disabled:opacity-0 text-[10px] py-0.5"
                        >
                          ▼
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-kf-charcoal truncate">{widget.title}</div>
                        <div className="text-xs text-kf-slate mt-0.5 capitalize">{widget.type.replace('_', ' ')}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleWidget(widget.id)}
                        className={cn(
                          'p-2 rounded-[10px] transition-colors',
                          widget.enabled
                            ? 'bg-kf-baby-blue text-kf-meta-blue hover:bg-kf-meta-blue/10'
                            : 'bg-kf-warm-gray text-kf-slate hover:bg-kf-divider-gray/50',
                        )}
                      >
                        {widget.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-[16px] bg-kf-baby-blue/60 border border-kf-meta-blue/15">
                <div className="flex items-center gap-2 mb-2">
                  <Plus size={14} className="text-kf-meta-blue" />
                  <h4 className="text-xs font-semibold text-kf-meta-blue tracking-wide">More widgets</h4>
                </div>
                <p className="text-xs text-kf-slate leading-relaxed">
                  Additional dashboard modules will ship in a future release.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-kf-divider-gray bg-kf-soft-gray/50">
              <button type="button" onClick={onClose} className="kf-btn-primary w-full !py-3.5">
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

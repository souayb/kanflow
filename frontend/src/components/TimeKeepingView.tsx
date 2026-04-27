import React, { useEffect, useMemo, useState } from 'react';
import { Play, Square, History, TrendingUp, Timer, Activity, ArrowRight } from 'lucide-react';
import { useApp } from '../AppContext';
import { cn, formatDate } from '../lib/utils';
export default function TimeKeepingView() {
  const { tasks, timeEntries, startTimeLog, stopTimeLog, activeTimer, activeProjectId, projects } = useApp();
  const [elapsedTime, setElapsedTime] = useState(0);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const doneColumnId = useMemo(() => {
    if (!activeProject?.columns.length) return null;
    const sorted = [...activeProject.columns].sort((a, b) => a.order - b.order);
    return sorted[sorted.length - 1]?.id ?? null;
  }, [activeProject]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeTimer) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - activeTimer.startTime);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const activeTask = tasks.find((t) => t.id === activeTimer?.taskId);
  const projectTasks = tasks.filter(
    (t) => t.projectId === activeProjectId && (doneColumnId == null || t.status !== doneColumnId),
  );

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const totalTimeThisWeek = timeEntries
    .filter((e) => e.createdAt > Date.now() - 7 * 24 * 60 * 60 * 1000)
    .reduce((acc, curr) => acc + curr.duration, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 custom-scrollbar">
      <div>
        <h2 className="text-2xl md:text-4xl font-medium tracking-tight text-kf-charcoal">Time keeping</h2>
        <p className="text-kf-slate text-sm mt-2">Start a timer on a task and review recent entries.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          <div className="kf-card-elevated p-8 md:p-10 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
                <div className="flex items-center gap-2 text-kf-meta-blue font-medium text-sm">
                  <Timer size={20} className={cn(activeTimer && 'animate-pulse')} strokeWidth={1.75} />
                  {activeTimer ? 'Timer running' : 'Ready'}
                </div>
                {activeTimer && (
                  <span className="text-[11px] font-medium px-3 py-1 rounded-full bg-[rgba(36,228,0,0.12)] text-kf-success border border-kf-success/25">
                    Recording
                  </span>
                )}
              </div>

              <div className="flex flex-col items-center justify-center py-8">
                <div className="text-5xl md:text-7xl font-medium text-kf-charcoal tracking-tight mb-4 tabular-nums">
                  {formatDuration(elapsedTime || 0)}
                </div>
                {activeTask ? (
                  <div className="flex flex-col items-center text-center max-w-lg">
                    <span className="text-xs text-kf-slate mb-1">Focused task</span>
                    <h3 className="text-lg font-medium text-kf-meta-blue">{activeTask.title}</h3>
                  </div>
                ) : (
                  <p className="text-kf-slate text-sm">No timer active. Choose a task on the right.</p>
                )}
              </div>

              <div className="flex justify-center mt-6">
                {activeTimer ? (
                  <button
                    type="button"
                    onClick={() => stopTimeLog(activeTimer.taskId)}
                    className="kf-btn-primary !bg-kf-error hover:!bg-[#C80A28] gap-2"
                  >
                    <Square size={18} fill="currentColor" />
                    Stop timer
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="kf-card-elevated p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-medium text-sm text-kf-charcoal flex items-center gap-2">
                <History size={16} className="text-kf-meta-blue" strokeWidth={1.75} />
                Recent entries
              </h3>
            </div>

            <div className="space-y-2">
              {timeEntries.slice(0, 10).map((entry) => {
                const task = tasks.find((t) => t.id === entry.taskId);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 bg-kf-warm-gray border border-kf-divider-gray rounded-[16px] hover:border-kf-meta-blue/20 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-[12px] bg-kf-white flex items-center justify-center text-kf-icon-secondary border border-kf-divider-gray shrink-0">
                        <Activity size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium text-kf-charcoal truncate">{task?.title ?? 'Unknown task'}</h4>
                        <p className="text-xs text-kf-slate mt-0.5">{formatDate(entry.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <div className="text-sm font-medium text-kf-charcoal tabular-nums">{formatDuration(entry.duration)}</div>
                      <div className="text-[10px] text-kf-success font-medium mt-0.5">Logged</div>
                    </div>
                  </div>
                );
              })}
              {timeEntries.length === 0 && (
                <div className="text-center py-16 text-sm text-kf-slate">No time entries yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-kf-meta-blue p-8 rounded-[24px] shadow-lg text-kf-white relative overflow-hidden">
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-y-10 translate-x-10" />
            <div className="relative z-10">
              <h3 className="text-xs font-medium text-white/80 mb-2 uppercase tracking-wide">This week (sample)</h3>
              <div className="text-3xl md:text-4xl font-medium tracking-tight mb-3 tabular-nums">{formatDuration(totalTimeThisWeek)}</div>
              <div className="flex items-center gap-2 text-white/85 text-xs font-medium">
                <TrendingUp size={14} />
                Rolling 7-day window
              </div>
            </div>
          </div>

          <div className="kf-card-elevated p-6 md:p-8">
            <h3 className="font-medium text-sm text-kf-charcoal mb-4">Tasks to track</h3>
            <div className="space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
              {projectTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => startTimeLog(task.id, 'Session log')}
                  className={cn(
                    'w-full p-4 rounded-[16px] flex items-center justify-between gap-3 transition-all text-left border',
                    activeTimer?.taskId === task.id
                      ? 'bg-kf-baby-blue border-kf-meta-blue/30 ring-1 ring-kf-meta-blue/15'
                      : 'bg-kf-white border-kf-divider-gray hover:border-kf-meta-blue/25',
                  )}
                >
                  <div className="min-w-0">
                    <h4
                      className={cn(
                        'text-sm font-medium truncate',
                        activeTimer?.taskId === task.id ? 'text-kf-meta-blue' : 'text-kf-charcoal',
                      )}
                    >
                      {task.title}
                    </h4>
                    <span className="text-[11px] text-kf-slate capitalize mt-1 inline-block">{task.priority} priority</span>
                  </div>
                  <div
                    className={cn(
                      'w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-colors',
                      activeTimer?.taskId === task.id ? 'bg-kf-meta-blue text-kf-white' : 'bg-kf-warm-gray text-kf-icon-secondary',
                    )}
                  >
                    {activeTimer?.taskId === task.id ? <ArrowRight size={16} /> : <Play size={14} className="ml-0.5" fill="currentColor" />}
                  </div>
                </button>
              ))}
              {projectTasks.length === 0 && (
                <div className="text-center py-10 text-sm text-kf-slate">No open tasks in this project.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

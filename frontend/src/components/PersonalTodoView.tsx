import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ExternalLink,
  Target,
  Grid,
  List as ListIcon,
  AlertCircle,
  Clock,
  UserCheck,
  Zap,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { MOCK_USER_ALEX } from '../constants';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function PersonalTodoView() {
  const {
    personalTodos,
    addPersonalTodo,
    togglePersonalTodo,
    updatePersonalTodo,
    deletePersonalTodo,
    tasks,
    projects,
    activeProjectId,
    currentUser,
  } = useApp();
  const [newTodo, setNewTodo] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('matrix');

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const doneColumnId = useMemo(() => {
    if (!activeProject?.columns.length) return null;
    const sorted = [...activeProject.columns].sort((a, b) => a.order - b.order);
    return sorted[sorted.length - 1]?.id ?? null;
  }, [activeProject]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodo.trim()) {
      addPersonalTodo(newTodo.trim());
      setNewTodo('');
    }
  };

  const uncategorizedTodos = personalTodos.filter((t) => !t.quadrant);
  const quadrant1 = personalTodos.filter((t) => t.quadrant === 1);
  const quadrant2 = personalTodos.filter((t) => t.quadrant === 2);
  const quadrant3 = personalTodos.filter((t) => t.quadrant === 3);
  const quadrant4 = personalTodos.filter((t) => t.quadrant === 4);

  const selfId = currentUser?.id ?? MOCK_USER_ALEX;
  const suggestedTasks = tasks.filter(
    (t) =>
      (!activeProjectId || t.projectId === activeProjectId) &&
      t.assigneeId === selfId &&
      (doneColumnId == null || t.status !== doneColumnId),
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 custom-scrollbar">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-4xl font-medium tracking-tight text-kf-charcoal">Personal todos</h2>
          <p className="text-kf-slate text-sm mt-2">Private list and Eisenhower matrix (MISSION §5.7).</p>
        </div>
        <div className="flex bg-kf-warm-gray p-1 rounded-full border border-kf-divider-gray">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-2 min-h-[40px]',
              viewMode === 'list' ? 'bg-kf-meta-blue text-kf-white shadow-sm' : 'text-kf-slate hover:text-kf-charcoal',
            )}
          >
            <ListIcon size={14} />
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-2 min-h-[40px]',
              viewMode === 'matrix' ? 'bg-kf-meta-blue text-kf-white shadow-sm' : 'text-kf-slate hover:text-kf-charcoal',
            )}
          >
            <Grid size={14} />
            Matrix
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
        <div className="lg:col-span-3 space-y-6">
          {viewMode === 'matrix' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MatrixQuadrant
                title="Do first"
                subtitle="Urgent & important"
                variant="urgent"
                icon={<Zap size={16} strokeWidth={1.75} />}
                todos={quadrant1}
                onToggle={togglePersonalTodo}
                onUpdateQuadrant={(id, q) => updatePersonalTodo(id, { quadrant: q })}
              />
              <MatrixQuadrant
                title="Schedule"
                subtitle="Important, not urgent"
                variant="plan"
                icon={<Clock size={16} strokeWidth={1.75} />}
                todos={quadrant2}
                onToggle={togglePersonalTodo}
                onUpdateQuadrant={(id, q) => updatePersonalTodo(id, { quadrant: q })}
              />
              <MatrixQuadrant
                title="Delegate"
                subtitle="Urgent, not important"
                variant="delegate"
                icon={<UserCheck size={16} strokeWidth={1.75} />}
                todos={quadrant3}
                onToggle={togglePersonalTodo}
                onUpdateQuadrant={(id, q) => updatePersonalTodo(id, { quadrant: q })}
              />
              <MatrixQuadrant
                title="Eliminate"
                subtitle="Neither urgent nor important"
                variant="later"
                icon={<AlertCircle size={16} strokeWidth={1.75} />}
                todos={quadrant4}
                onToggle={togglePersonalTodo}
                onUpdateQuadrant={(id, q) => updatePersonalTodo(id, { quadrant: q })}
              />
            </div>
          ) : (
            <div className="kf-card-elevated p-6 md:p-8 min-h-[400px]">
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {personalTodos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onToggle={togglePersonalTodo}
                      onDelete={deletePersonalTodo}
                      onUpdateQuadrant={(id, q) =>
                        updatePersonalTodo(id, { quadrant: q === todo.quadrant ? undefined : (q as 1 | 2 | 3 | 4) })
                      }
                      tasks={tasks}
                    />
                  ))}
                </AnimatePresence>
                {personalTodos.length === 0 && <EmptyState />}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="kf-card-elevated p-6">
            <h3 className="font-medium text-sm text-kf-charcoal mb-4">Add todo</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="What needs doing?"
                className="kf-input text-sm"
              />
              <button type="submit" className="kf-btn-primary w-full !py-3 gap-2">
                <Plus size={16} />
                Add
              </button>
            </form>
          </div>

          <div className="kf-card-elevated p-6">
            <h3 className="font-medium text-sm text-kf-charcoal mb-4">From your tasks</h3>
            <div className="space-y-2">
              {suggestedTasks.slice(0, 4).map((task) => (
                <div
                  key={task.id}
                  className="p-3 bg-kf-warm-gray border border-kf-divider-gray rounded-[12px] flex items-center justify-between gap-2 hover:border-kf-meta-blue/25 transition-colors"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[10px] font-medium text-kf-meta-blue uppercase tracking-wide">Task</span>
                    <span className="text-xs font-medium text-kf-charcoal truncate">{task.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => addPersonalTodo(task.title, task.id)}
                    className="p-2 bg-kf-baby-blue text-kf-meta-blue rounded-[10px] hover:bg-kf-meta-blue hover:text-kf-white transition-colors shrink-0"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {uncategorizedTodos.length > 0 && viewMode === 'matrix' && (
            <div className="kf-card-elevated p-6">
              <h3 className="font-medium text-sm text-kf-charcoal mb-3">Uncategorized</h3>
              <div className="space-y-2">
                {uncategorizedTodos.map((todo) => (
                  <div key={todo.id} className="p-3 bg-kf-warm-gray border border-kf-divider-gray rounded-[12px] flex flex-col gap-2">
                    <span className="text-xs font-medium text-kf-charcoal truncate">{todo.content}</span>
                    <div className="flex gap-1 flex-wrap">
                        {([1, 2, 3, 4] as const).map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => updatePersonalTodo(todo.id, { quadrant: q as 1 | 2 | 3 | 4 })}
                            className="w-8 h-8 flex items-center justify-center rounded-[8px] bg-kf-white border border-kf-divider-gray text-[11px] font-medium text-kf-slate hover:border-kf-meta-blue hover:text-kf-meta-blue transition-colors"
                          >
                            Q{q}
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type QuadrantVariant = 'urgent' | 'plan' | 'delegate' | 'later';

function MatrixQuadrant({
  title,
  subtitle,
  variant,
  todos,
  onToggle,
  onUpdateQuadrant,
  icon,
}: {
  title: string;
  subtitle: string;
  variant: QuadrantVariant;
  todos: { id: string; content: string; completed: boolean }[];
  onToggle: (id: string) => void;
  onUpdateQuadrant: (id: string, q?: 1 | 2 | 3 | 4) => void;
  icon: React.ReactNode;
}) {
  const shell: Record<QuadrantVariant, string> = {
    urgent: 'border-kf-error/25 bg-[rgba(255,123,145,0.06)]',
    plan: 'border-kf-meta-blue/25 bg-kf-baby-blue/40',
    delegate: 'border-kf-warning/35 bg-[rgba(255,226,0,0.08)]',
    later: 'border-kf-divider-gray bg-kf-warm-gray/80',
  };

  const header: Record<QuadrantVariant, string> = {
    urgent: 'text-kf-error',
    plan: 'text-kf-meta-blue',
    delegate: 'text-[#9a7200]',
    later: 'text-kf-slate',
  };

  return (
    <div className={cn('p-5 md:p-6 rounded-[24px] border flex flex-col min-h-[280px] transition-colors', shell[variant])}>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className={cn('p-1.5 rounded-[10px] bg-kf-white/80 border border-kf-divider-gray', header[variant])}>
            {icon}
          </div>
          <h3 className="font-medium text-sm text-kf-charcoal">{title}</h3>
        </div>
        <p className="text-[11px] text-kf-slate font-normal leading-snug">{subtitle}</p>
      </div>

      <div className="flex-1 space-y-2">
        <AnimatePresence initial={false}>
          {todos.map((todo) => (
            <motion.div key={todo.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="group relative">
              <div
                className={cn(
                  'p-3 rounded-[12px] border flex items-start gap-2 transition-all bg-kf-white/90',
                  todo.completed ? 'border-kf-divider-gray opacity-60' : 'border-kf-divider-gray hover:border-kf-meta-blue/20',
                )}
              >
                <button type="button" onClick={() => onToggle(todo.id)} className="mt-0.5 shrink-0">
                  {todo.completed ? (
                    <CheckCircle2 size={16} className="text-kf-success" strokeWidth={1.75} />
                  ) : (
                    <Circle size={16} className="text-kf-icon-secondary" strokeWidth={1.75} />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'text-xs font-medium tracking-tight truncate',
                      todo.completed ? 'line-through text-kf-slate' : 'text-kf-charcoal',
                    )}
                  >
                    {todo.content}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateQuadrant(todo.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-kf-icon-secondary hover:text-kf-error shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {todos.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-50 py-10">
            <Target size={22} className="text-kf-divider mb-2" />
            <span className="text-xs text-kf-slate text-center">Nothing here yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TodoItem({
  todo,
  onToggle,
  onDelete,
  onUpdateQuadrant,
  tasks,
}: {
  todo: { id: string; content: string; completed: boolean; quadrant?: 1 | 2 | 3 | 4; linkedTaskId?: string };
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateQuadrant: (id: string, q?: 1 | 2 | 3 | 4) => void;
  tasks: { id: string; title: string }[];
}) {
  const linkedTask = tasks.find((t) => t.id === todo.linkedTaskId);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={cn(
        'flex items-center justify-between p-4 rounded-[16px] border transition-colors group gap-3',
        todo.completed ? 'bg-kf-soft-gray border-kf-divider-gray' : 'bg-kf-white border-kf-divider-gray hover:border-kf-meta-blue/20',
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button type="button" onClick={() => onToggle(todo.id)} className={cn('shrink-0', todo.completed ? 'text-kf-success/70' : 'text-kf-icon-secondary hover:text-kf-meta-blue')}>
          {todo.completed ? <CheckCircle2 size={22} strokeWidth={1.75} /> : <Circle size={22} strokeWidth={1.75} />}
        </button>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-sm font-medium', todo.completed ? 'text-kf-slate line-through' : 'text-kf-charcoal')}>{todo.content}</span>
            {todo.quadrant && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-kf-baby-blue text-kf-meta-blue border border-kf-meta-blue/15">
                Q{todo.quadrant}
              </span>
            )}
          </div>
          {linkedTask && (
            <div className="flex items-center gap-1.5 mt-1 min-w-0">
              <ExternalLink size={10} className="text-kf-slate shrink-0" />
              <span className="text-[11px] text-kf-slate truncate">Linked: {linkedTask.title}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <div className="flex bg-kf-warm-gray rounded-[10px] p-0.5 border border-kf-divider-gray">
          {([1, 2, 3, 4] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onUpdateQuadrant(todo.id, q as 1 | 2 | 3 | 4)}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-[8px] text-[11px] font-medium transition-colors',
                todo.quadrant === q ? 'bg-kf-meta-blue text-kf-white' : 'text-kf-slate hover:text-kf-charcoal',
              )}
            >
              {q}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => onDelete(todo.id)} className="p-2 text-kf-icon-secondary hover:text-kf-error transition-colors rounded-[8px]">
          <Trash2 size={18} />
        </button>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 rounded-full bg-kf-warm-gray border border-kf-divider-gray flex items-center justify-center mx-auto mb-4">
        <Target size={28} className="text-kf-slate" strokeWidth={1.5} />
      </div>
      <p className="text-sm text-kf-slate max-w-xs mx-auto leading-relaxed">Add a todo using the form on the right.</p>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import {
  Plus,
  MoreHorizontal,
  Calendar,
  MessageSquare,
  Tag as TagIcon,
  Sparkles,
  Link as LinkIcon,
  Filter,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { cn, formatDate, getPriorityColor } from '../lib/utils';
import Avatar from './Avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { type Task } from '../types';
import TaskModal from './TaskModal';

export default function KanbanView() {
  const { tasks, projects, activeProjectId, addTask, deleteTask } = useApp();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isAddingTask, setIsAddingTask] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const doneColumnId = useMemo(() => {
    if (!activeProject?.columns.length) return null;
    const sorted = [...activeProject.columns].sort((a, b) => a.order - b.order);
    return sorted[sorted.length - 1]?.id ?? null;
  }, [activeProject]);

  if (!activeProject) {
    return (
      <div className="p-20 text-center text-kf-slate text-lg font-medium animate-pulse">Select or create a project to open the board.</div>
    );
  }

  const projectTasks = tasks.filter((t) => t.projectId === activeProjectId);

  const handleAddTask = (columnId: string) => {
    if (!newTaskTitle.trim()) return;
    addTask({
      title: newTaskTitle,
      description: '',
      status: columnId,
      priority: 'medium',
      projectId: activeProjectId!,
      tags: [],
      dependencies: [],
    });
    setNewTaskTitle('');
    setIsAddingTask(null);
  };

  return (
    <div className="h-full flex flex-col gap-6 md:gap-8 overflow-hidden">
      <div className="kf-section-dark rounded-[24px] px-6 py-8 md:px-10 md:py-10 shadow-inner">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <p className="text-sm text-kf-slate font-normal mb-2">Active project</p>
            <h2 className="text-2xl md:text-4xl font-medium tracking-tight text-kf-white">{activeProject.name}</h2>
            <p className="text-kf-slate mt-2 max-w-xl text-sm md:text-base leading-relaxed">{activeProject.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" className="kf-btn-secondary !text-kf-white/90 !border-white/20 hover:!bg-white/10">
              <Filter size={16} />
              Filter
            </button>
            <button type="button" className="kf-btn-primary !bg-kf-meta-blue-light !text-kf-near-black hover:!bg-kf-white">
              View options
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {['Alex Rivera', 'Sam Chen', 'Jordan Taylor', 'Morgan Lee'].map((name) => (
              <Avatar
                key={name}
                name={name}
                className="w-9 h-9 text-xs border-2 border-kf-white shadow-sm"
              />
            ))}
            <div className="w-9 h-9 rounded-full bg-kf-warm-gray flex items-center justify-center text-xs font-medium text-kf-slate border-2 border-kf-white">
              +4
            </div>
          </div>
          <button type="button" className="text-sm font-medium text-kf-meta-blue hover:text-kf-meta-blue-hover px-2">
            Invite teammates
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 md:gap-6 overflow-x-auto pb-4 items-start custom-scrollbar">
        {activeProject.columns.map((column) => (
          <div key={column.id} className="w-[min(100%,20rem)] flex-shrink-0 flex flex-col max-h-full">
            <div className="flex items-center justify-between mb-4 group px-1">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-medium text-sm text-kf-charcoal truncate">{column.title}</h3>
                <span className="bg-kf-warm-gray text-kf-slate text-xs font-medium px-2.5 py-0.5 rounded-full border border-kf-divider-gray shrink-0">
                  {projectTasks.filter((t) => t.status === column.id).length}
                </span>
              </div>
              <button
                type="button"
                className="text-kf-icon-secondary opacity-0 group-hover:opacity-100 hover:text-kf-charcoal transition-all p-1 rounded-[8px]"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar min-h-[50px]">
              {projectTasks
                .filter((t) => t.status === column.id)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    doneColumnId={doneColumnId}
                    onClick={() => setSelectedTaskId(task.id)}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}

              {isAddingTask === column.id ? (
                <div className="kf-card-elevated p-4 border-kf-meta-blue/25">
                  <input
                    autoFocus
                    className="kf-input mb-4 text-sm"
                    placeholder="Task title…"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask(column.id)}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingTask(null)}
                      className="kf-btn-secondary text-sm !py-2 !px-4"
                    >
                      Cancel
                    </button>
                    <button type="button" onClick={() => handleAddTask(column.id)} className="kf-btn-primary text-sm !py-2 !px-4">
                      Add task
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingTask(column.id)}
                  className="w-full py-3 min-h-[44px] flex items-center justify-center gap-2 text-sm font-medium text-kf-slate hover:bg-kf-white hover:text-kf-charcoal rounded-[20px] border border-dashed border-kf-divider-gray transition-all group/addbtn bg-kf-white/60"
                >
                  <Plus size={18} className="group-hover/addbtn:scale-110 transition-transform" />
                  Add task
                </button>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          className="w-[min(100%,20rem)] flex-shrink-0 min-h-[100px] flex items-center justify-center gap-2 text-sm font-medium text-kf-slate hover:bg-kf-white hover:border-kf-divider rounded-[20px] border border-dashed border-kf-divider-gray transition-all bg-kf-white/40"
        >
          <Plus size={18} />
          Add column
        </button>
      </div>

      <AnimatePresence>
        {selectedTaskId && <TaskModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
      </AnimatePresence>
    </div>
  );
}

function TaskCard({
  task,
  doneColumnId,
  onClick,
  onDelete,
}: {
  task: Task;
  doneColumnId: string | null;
  onClick: () => void;
  onDelete: () => void;
}) {
  const { users, tasks } = useApp();
  const assignee = users.find((u) => u.id === task.assigneeId);

  const blockedBy = tasks.filter(
    (t) => task.dependencies?.includes(t.id) && doneColumnId != null && t.status !== doneColumnId,
  );
  const isBlocked = blockedBy.length > 0;
  const isDone = doneColumnId != null && task.status === doneColumnId;

  return (
    <motion.div
      layoutId={task.id}
      onClick={onClick}
      className={cn(
        'kf-card-elevated p-4 cursor-grab active:cursor-grabbing group relative overflow-hidden border-kf-divider-gray',
        isBlocked ? 'border-kf-error/40 opacity-90' : 'hover:border-kf-meta-blue/20',
      )}
    >
      {isBlocked && (
        <div className="absolute inset-0 bg-kf-white/70 flex items-center justify-center pointer-events-none group-hover:bg-kf-white/50 transition-all">
          <div className="bg-[rgba(255,123,145,0.15)] border border-kf-error/30 px-3 py-1.5 rounded-full flex items-center gap-2">
            <LinkIcon size={12} className="text-kf-error" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-kf-error">Blocked</span>
          </div>
        </div>
      )}

      {task.aiSuggested && (
        <div className="absolute top-0 right-0 p-1.5 bg-kf-baby-blue rounded-bl-[16px] border-l border-b border-kf-divider-gray">
          <Sparkles size={14} className="text-kf-meta-blue" />
        </div>
      )}

      <div className="flex items-start justify-between mb-2 gap-2">
        <span
          className={cn(
            'text-[10px] uppercase font-semibold tracking-wide px-2 py-1 rounded-full',
            getPriorityColor(task.priority),
          )}
        >
          {task.priority}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-kf-icon-secondary opacity-0 group-hover:opacity-100 hover:text-kf-error transition-all p-1 rounded-[8px]"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <h4 className="text-[15px] font-medium mb-3 group-hover:text-kf-meta-blue transition-colors text-kf-charcoal leading-snug">
        {task.title}
      </h4>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 text-[10px] bg-kf-baby-blue text-kf-meta-blue px-2 py-1 rounded-full font-medium border border-kf-meta-blue/10"
            >
              <TagIcon size={10} />
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-kf-slate gap-2">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {task.dueDate && (
            <div
              className={cn(
                'flex items-center gap-1 text-[11px] font-medium',
                task.dueDate < Date.now() && !isDone ? 'text-kf-error' : '',
              )}
            >
              <Calendar size={12} />
              {formatDate(task.dueDate)}
            </div>
          )}
          {task.comments.length > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-medium">
              <MessageSquare size={12} />
              {task.comments.length}
            </div>
          )}
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-kf-warning">
              <LinkIcon size={12} />
              {task.dependencies.length} linked
            </div>
          )}
        </div>

        {assignee && (
          <Avatar
            name={assignee.name}
            className="w-7 h-7 text-[10px] border border-kf-divider-gray shadow-sm"
          />
        )}
      </div>
    </motion.div>
  );
}

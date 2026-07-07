import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  MessageSquare, 
  Calendar, 
  Tag as TagIcon,
  Trash2,
  Sparkles,
  ChevronRight,
  Send,
  Loader2,
  Link as LinkIcon,
  Plus
} from 'lucide-react';
import { useApp } from '../AppContext';
import { cn, formatDate, getPriorityColor } from '../lib/utils';
import Avatar from './Avatar';
import { enhanceTask, type TaskEnhancementResult } from '../lib/ai';
import ReactMarkdown from 'react-markdown';

interface TaskModalProps {
  taskId: string;
  onClose: () => void;
}

function buildAppliedDescriptionFromAi(r: TaskEnhancementResult): string {
  const blocks: string[] = [r.enhancedDescription.trim()];
  if (r.subtasks.length) {
    blocks.push('', '### Subtasks', ...r.subtasks.map((s) => `- ${s}`));
  }
  if (r.potentialRisks.length) {
    blocks.push('', '### Risks', ...r.potentialRisks.map((x) => `- ${x}`));
  }
  if (r.definitionOfDone.trim()) {
    blocks.push('', '### Definition of done', r.definitionOfDone.trim());
  }
  return blocks.join('\n');
}

export default function TaskModal({ taskId, onClose }: TaskModalProps) {
  const { tasks, users, projects, updateTask, deleteTask, addComment, addDependency, addNotification, currentUser } =
    useApp();
  const task = tasks.find((t) => t.id === taskId);
  const [commentText, setCommentText] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [aiResult, setAiResult] = useState<TaskEnhancementResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'ai' | 'dependencies'>('details');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    setNewTag('');
  }, [taskId]);

  if (!task) return null;

  const taskProject = projects.find((p) => p.id === task.projectId);
  const columnsSorted = useMemo(
    () => [...(taskProject?.columns ?? [])].sort((a, b) => a.order - b.order),
    [taskProject],
  );
  const doneColumnId = columnsSorted.length ? columnsSorted[columnsSorted.length - 1].id : null;

  const assignee = users.find((u) => u.id === task.assigneeId);
  const availableTasks = tasks.filter(
    (t) => t.id !== taskId && t.projectId === task.projectId && !task.dependencies?.includes(t.id),
  );

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser) return;
    addComment(taskId, currentUser.id, commentText);
    setCommentText('');
  };

  const handleEnhance = async () => {
    setIsRefining(true);
    setAiError(null);
    setActiveTab('ai');
    try {
      const result = await enhanceTask(task.title, task.description, task.tags);
      setAiResult(result);
    } catch (error) {
      console.error(error);
      setAiResult(null);
      setAiError(error instanceof Error ? error.message : 'AI refine failed.');
    } finally {
      setIsRefining(false);
    }
  };

  const formatAiBlockForDescription = (r: TaskEnhancementResult): string => {
    const lines: string[] = [
      '## Kanflow AI — refined output',
      '',
      `**Suggested title:** ${r.enhancedTitle}`,
      '',
      r.enhancedDescription,
      '',
    ];
    if (r.subtasks.length) {
      lines.push('**Subtasks**', ...r.subtasks.map((s) => `- ${s}`), '');
    }
    if (r.potentialRisks.length) {
      lines.push('**Risks**', ...r.potentialRisks.map((x) => `- ${x}`), '');
    }
    lines.push('**Definition of done**', r.definitionOfDone, '', '**Rationale**', r.aiThinking);
    return lines.join('\n');
  };

  const appendAiToDetails = () => {
    if (!aiResult) return;
    const block = formatAiBlockForDescription(aiResult);
    const next = task.description.trim() ? `${task.description.trim()}\n\n---\n\n${block}` : block;
    updateTask(taskId, { description: next });
    setActiveTab('details');
  };

  const applyAIChange = () => {
    if (!aiResult || !currentUser) return;
    const description = buildAppliedDescriptionFromAi(aiResult);
    const thinking = aiResult.aiThinking.trim();
    updateTask(taskId, {
      title: aiResult.enhancedTitle,
      description,
      priority: aiResult.suggestedPriority,
      aiSuggested: true,
      aiThinking: thinking || undefined,
    });
    const shortTitle =
      aiResult.enhancedTitle.length > 56 ? `${aiResult.enhancedTitle.slice(0, 56)}…` : aiResult.enhancedTitle;
    addNotification({
      userId: currentUser.id,
      title: 'AI suggestions applied',
      message: `Updated title, full description (including subtasks, risks, and definition of done), priority, and AI notes on "${shortTitle}".`,
      type: 'ai_insight',
      relatedId: taskId,
    });
    if (task.assigneeId && task.assigneeId !== currentUser.id) {
      addNotification({
        userId: task.assigneeId,
        title: 'Task refined with AI',
        message: `${currentUser.name} applied AI suggestions to "${task.title}".`,
        type: 'task_update',
        relatedId: taskId,
      });
    }
    setAiResult(null);
    setAiError(null);
    setActiveTab('details');
  };

  const commitNewTag = () => {
    const raw = newTag.trim().replace(/\s+/g, ' ');
    if (!raw) return;
    if (task.tags.some((t) => t.toLowerCase() === raw.toLowerCase())) {
      setNewTag('');
      return;
    }
    updateTask(taskId, { tags: [...task.tags, raw] });
    setNewTag('');
  };

  const toggleDependency = (depId: string) => {
    const currentDeps = task.dependencies || [];
    if (currentDeps.includes(depId)) {
      updateTask(taskId, { dependencies: currentDeps.filter(id => id !== depId) });
    } else {
      addDependency(taskId, depId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-kf-overlay backdrop-blur-md"
      />

      <motion.div
        layoutId={taskId}
        className="relative w-full max-w-2xl bg-kf-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-kf-divider-gray"
      >
        <div className="px-6 py-4 border-b border-kf-divider-gray flex items-center justify-between bg-kf-soft-gray/60">
          <div className="flex items-center gap-2 text-xs font-medium text-kf-slate">
            <span className="text-kf-meta-blue">Task</span>
            <ChevronRight size={14} className="text-kf-divider" />
            <span className="text-kf-charcoal truncate max-w-[12rem]">{task.id.slice(0, 8)}…</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnhance}
              disabled={isRefining}
              className="kf-btn-primary !py-2 !px-4 text-xs gap-2 disabled:hover:scale-100"
            >
              {isRefining ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              AI refine
            </button>
            <button type="button" onClick={onClose} className="p-2 hover:bg-kf-warm-gray rounded-[12px] text-kf-icon-secondary">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-8">
            <input
              readOnly={isRefining}
              className="w-full text-2xl font-medium mb-6 focus:ring-0 outline-none bg-transparent text-kf-charcoal placeholder-kf-secondary-text"
              placeholder="Task title"
              value={task.title}
              onChange={(e) => updateTask(taskId, { title: e.target.value })}
            />

            <div className="flex flex-wrap gap-6 md:gap-8 mb-8 text-xs font-medium">
              <div className="space-y-2">
                <span className="text-kf-slate block">Assignee</span>
                <select
                  className="kf-input text-sm font-medium py-2 max-w-[200px]"
                  value={task.assigneeId ?? ''}
                  onChange={(e) =>
                    updateTask(taskId, { assigneeId: e.target.value ? e.target.value : undefined })
                  }
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <span className="text-kf-slate block">Due date</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar size={14} className="text-kf-meta-blue shrink-0" strokeWidth={1.75} />
                    <input
                      type="date"
                      className="kf-input text-sm font-medium py-2 min-w-[11rem]"
                      value={
                        task.dueDate
                          ? new Date(task.dueDate).toISOString().slice(0, 10)
                          : ''
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) {
                          updateTask(taskId, { dueDate: undefined });
                          return;
                        }
                        const ms = Date.parse(`${v}T12:00:00.000Z`);
                        if (!Number.isNaN(ms)) updateTask(taskId, { dueDate: ms });
                      }}
                    />
                  </div>
                  {task.dueDate != null && (
                    <button
                      type="button"
                      className="text-[10px] font-semibold uppercase tracking-wide text-kf-slate hover:text-kf-meta-blue"
                      onClick={() => updateTask(taskId, { dueDate: undefined })}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-kf-slate block">Priority</span>
                <select
                  className={cn(
                    'kf-input text-sm font-semibold capitalize py-2 min-w-[8rem]',
                    getPriorityColor(task.priority),
                  )}
                  value={task.priority}
                  onChange={(e) =>
                    updateTask(taskId, {
                      priority: e.target.value as 'low' | 'medium' | 'high',
                    })
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="space-y-2">
                <span className="text-kf-slate block">Column</span>
                <select
                  className="kf-input text-sm font-medium py-2 min-w-[140px]"
                  value={task.status}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    const blockedBy = tasks.filter(
                      (t) => task.dependencies?.includes(t.id) && doneColumnId != null && t.status !== doneColumnId,
                    );
                    if (doneColumnId && newStatus === doneColumnId && blockedBy.length > 0) {
                      alert(`Finish dependencies first:\n${blockedBy.map((t) => t.title).join(', ')}`);
                      return;
                    }
                    updateTask(taskId, { status: newStatus });
                  }}
                >
                  {columnsSorted.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-kf-divider-gray mb-8 overflow-x-auto no-scrollbar">
              {[
                { id: 'details', label: 'Details' },
                { id: 'comments', label: `Comments (${task.comments.length})` },
                { id: 'dependencies', label: `Dependencies (${task.dependencies?.length || 0})` },
                { id: 'ai', label: 'Kanflow AI' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as 'details' | 'comments' | 'ai' | 'dependencies')}
                  className={cn(
                    'px-5 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap',
                    activeTab === tab.id ? 'border-kf-meta-blue text-kf-meta-blue' : 'border-transparent text-kf-slate hover:text-kf-charcoal',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'details' && (
              <div className="space-y-8">
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-kf-meta-blue">Description</h4>
                  <textarea 
                    className="w-full bg-kf-warm-gray p-6 rounded-2xl text-sm min-h-[150px] focus:outline-none focus:ring-1 focus:ring-kf-meta-blue/25 resize-none border border-kf-divider-gray text-kf-charcoal placeholder-kf-secondary-text custom-scrollbar"
                    placeholder="Log technical details..."
                    value={task.description}
                    onChange={(e) => updateTask(taskId, { description: e.target.value })}
                  />
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-kf-meta-blue">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {task.tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-2 px-3 py-1.5 bg-kf-warm-gray border border-kf-divider-gray text-[10px] font-black uppercase tracking-widest text-kf-slate rounded-lg group/tag"
                      >
                        <TagIcon size={12} className="text-kf-meta-blue shrink-0" />
                        <span className="truncate max-w-[12rem]">{tag}</span>
                        <button
                          type="button"
                          aria-label={`Remove tag ${tag}`}
                          className="text-kf-secondary-text hover:text-rose-500 transition-colors p-0.5 rounded"
                          onClick={() => updateTask(taskId, { tags: task.tags.filter((t) => t !== tag) })}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 items-stretch sm:items-center">
                    <input
                      type="text"
                      className="kf-input text-sm py-2 min-w-0 flex-1 sm:max-w-xs"
                      placeholder="Type a tag and press Enter…"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitNewTag();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={commitNewTag}
                      className="px-4 py-2 bg-kf-warm-gray border border-dashed border-kf-divider-gray text-kf-secondary-text hover:border-kf-meta-blue/40 hover:text-kf-meta-blue text-[10px] font-black uppercase tracking-widest rounded-xl transition-all inline-flex items-center justify-center gap-2 shrink-0"
                    >
                      <Plus size={12} />
                      Add tag
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="space-y-8">
                <div className="space-y-6 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                  {task.comments.map(comment => (
                    <div key={comment.id} className="flex gap-4">
                      <Avatar name={comment.userName} className="w-8 h-8 text-xs border border-kf-divider-gray" />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-kf-slate uppercase tracking-widest">{comment.userName}</span>
                          <span className="text-[10px] font-black text-kf-secondary-text uppercase">{formatDate(comment.createdAt)}</span>
                        </div>
                        <div className="text-sm text-kf-charcoal bg-kf-warm-gray border border-kf-divider-gray px-4 py-3 rounded-2xl rounded-tl-none shadow-inner">
                          {comment.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  {task.comments.length === 0 && (
                    <div className="text-center py-12 text-kf-secondary-text italic text-sm font-black uppercase tracking-widest animate-pulse">
                      Waiting for signal input...
                    </div>
                  )}
                </div>
                
                <form onSubmit={handleAddComment} className="relative">
                  <input 
                    className="w-full bg-kf-warm-gray border border-kf-divider-gray pl-6 pr-14 py-4 rounded-2xl text-sm focus:ring-1 focus:ring-kf-meta-blue/25 outline-none transition-all font-bold text-kf-charcoal placeholder-kf-secondary-text shadow-inner"
                    placeholder="Broadcast signal..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <button 
                    type="submit"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-kf-meta-blue text-kf-white rounded-xl hover:bg-kf-meta-blue-hover transition-all shadow-md"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'dependencies' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-kf-meta-blue flex items-center gap-2">
                    Current Logical Blocks
                  </h4>
                  <div className="space-y-2">
                    {task.dependencies?.map(depId => {
                      const depTask = tasks.find(t => t.id === depId);
                      return (
                        <div key={depId} className="flex items-center justify-between p-3 bg-kf-warm-gray border border-kf-divider-gray rounded-xl group transition-all hover:border-kf-meta-blue/35 shadow-sm">
                          <div className="flex items-center gap-3">
                            <LinkIcon size={14} className="text-kf-meta-blue" />
                            <span className="text-xs font-bold text-kf-charcoal">{depTask?.title || 'Unknown Block'}</span>
                          </div>
                          <button 
                            onClick={() => toggleDependency(depId)}
                            className="p-1 text-kf-secondary-text hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                    {(!task.dependencies || task.dependencies.length === 0) && (
                      <div className="p-10 border border-dashed border-kf-divider-gray rounded-xl text-center text-kf-secondary-text text-[10px] font-black uppercase tracking-widest">
                        No dependencies yet
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-kf-meta-blue">Available Linkages</h4>
                  <div className="max-h-[200px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                    {availableTasks.map(t => (
                      <button
                        key={t.id}
                        onClick={() => toggleDependency(t.id)}
                        className="w-full flex items-center justify-between p-3 bg-kf-soft-gray border border-kf-divider-gray rounded-xl hover:bg-kf-baby-blue/50 hover:border-kf-meta-blue/25 transition-all text-left"
                      >
                        <span className="text-xs font-bold text-kf-slate">{t.title}</span>
                        <LinkIcon size={14} className="text-kf-icon-secondary" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-6">
                {aiError && (
                  <div className="rounded-2xl border border-kf-error/30 bg-kf-error/10 px-4 py-3 text-sm text-kf-charcoal">
                    {aiError}
                  </div>
                )}
                {isRefining ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-6">
                    <div className="relative">
                      <Loader2 size={48} className="animate-spin text-kf-meta-blue opacity-20" />
                      <Sparkles size={24} className="absolute inset-0 m-auto text-kf-meta-blue animate-pulse" />
                    </div>
                    <p className="text-xs font-medium tracking-wide text-kf-slate animate-pulse">Refining with Kanflow AI…</p>
                  </div>
                ) : aiResult ? (
                  <div className="space-y-6">
                     <div className="bg-kf-warm-gray p-8 rounded-3xl border border-kf-meta-blue/20 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-kf-meta-blue opacity-[0.06] rounded-full blur-3xl -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-1000" />
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
                          <div className="flex items-center gap-3 text-kf-meta-blue font-black text-xs uppercase tracking-widest">
                            <Sparkles size={20} className="animate-pulse" />
                            AI suggestions
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button 
                              type="button"
                              onClick={() => {
                                updateTask(taskId, { description: aiResult.enhancedDescription });
                                setActiveTab('details');
                              }}
                              className="px-4 py-2 border border-kf-divider-gray hover:border-kf-meta-blue/40 text-kf-slate hover:text-kf-meta-blue text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                            >
                              Replace description
                            </button>
                            <button 
                              type="button"
                              onClick={appendAiToDetails}
                              className="px-4 py-2 border border-kf-meta-blue/30 bg-kf-baby-blue/40 hover:bg-kf-baby-blue/70 text-kf-meta-blue text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                            >
                              Append to Details
                            </button>
                            <button 
                              type="button"
                              onClick={applyAIChange}
                              className="px-4 py-2 kf-btn-primary !rounded-xl text-[10px] font-semibold uppercase tracking-wide !shadow-md"
                            >
                              Apply all to task
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-8">
                          <div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-kf-slate mb-2">Enhanced title</h4>
                            <div className="text-lg font-semibold text-kf-charcoal mb-2">{aiResult.enhancedTitle}</div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-kf-slate mb-2 mt-4">Enhanced description</h4>
                            <p className="text-sm text-kf-charcoal leading-relaxed whitespace-pre-wrap">{aiResult.enhancedDescription}</p>
                            <p className="text-[10px] text-kf-secondary-text mt-2">Suggested priority: <span className="font-semibold capitalize text-kf-charcoal">{aiResult.suggestedPriority}</span></p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-kf-slate mb-3">Subtasks</h4>
                              <div className="space-y-2">
                                {aiResult.subtasks.length ? (
                                  aiResult.subtasks.map((s, i) => (
                                  <div key={i} className="text-xs text-kf-charcoal flex items-center gap-2">
                                    <div className="w-1 h-1 bg-kf-meta-blue rounded-full shrink-0" />
                                    {s}
                                  </div>
                                ))
                                ) : (
                                  <span className="text-xs text-kf-secondary-text">None suggested</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600/80 mb-3">Risks</h4>
                              <div className="space-y-2">
                                {aiResult.potentialRisks.length ? (
                                  aiResult.potentialRisks.map((r, i) => (
                                  <div key={i} className="text-xs text-kf-charcoal flex items-center gap-2">
                                    <div className="w-1 h-1 bg-rose-500 rounded-full shrink-0" />
                                    {r}
                                  </div>
                                ))
                                ) : (
                                  <span className="text-xs text-kf-secondary-text">None suggested</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div>
                             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-kf-slate mb-3">Definition of done</h4>
                             <div className="p-4 bg-kf-soft-gray border border-kf-divider-gray rounded-2xl text-sm text-kf-charcoal leading-relaxed">
                                {aiResult.definitionOfDone}
                             </div>
                          </div>

                          <div className="pt-6 border-t border-kf-divider-gray">
                             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-kf-slate mb-2">Rationale</h4>
                             <p className="text-sm text-kf-charcoal leading-relaxed whitespace-pre-wrap">
                               {aiResult.aiThinking}
                             </p>
                          </div>
                        </div>
                     </div>
                  </div>
                ) : task.aiThinking ? (
                  <div className="bg-kf-warm-gray p-8 rounded-3xl border border-kf-meta-blue/20 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-kf-meta-blue opacity-[0.06] rounded-full blur-3xl -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-1000" />
                    <div className="flex items-center gap-3 text-kf-meta-blue mb-6 font-black text-xs uppercase tracking-widest">
                      <Sparkles size={20} className="animate-pulse" />
                      Saved AI notes
                    </div>
                    <div className="prose prose-sm max-w-none prose-p:text-kf-slate prose-headings:text-kf-charcoal prose-headings:font-medium prose-headings:text-sm">
                      <ReactMarkdown>{task.aiThinking}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 bg-kf-warm-gray/40 rounded-3xl border border-dashed border-kf-divider-gray">
                    <Sparkles size={48} className="mx-auto mb-6 text-kf-divider" />
                    <p className="text-kf-slate mb-8 max-w-xs mx-auto text-sm leading-relaxed">Run Kanflow AI to refine title, description, and priority.</p>
                    <button 
                      onClick={handleEnhance}
                      className="px-8 py-3 kf-btn-primary !rounded-2xl text-xs font-semibold uppercase tracking-wide hover:scale-105 active:scale-95 transition-transform"
                    >
                      Process Node
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-kf-warm-gray border-t border-kf-divider-gray flex items-center justify-between">
          <button 
            onClick={() => {
              if (window.confirm('Execute node deletion? This action is irreversible.')) {
                deleteTask(taskId);
                onClose();
              }
            }}
            className="flex items-center gap-2 text-rose-500 hover:text-rose-400 text-[10px] font-black uppercase tracking-widest transition-colors"
          >
            <Trash2 size={16} />
            Delete task
          </button>
          
          <div className="text-[10px] text-kf-secondary-text font-black uppercase tracking-widest">
            Last Sync: {formatDate(task.updatedAt)}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

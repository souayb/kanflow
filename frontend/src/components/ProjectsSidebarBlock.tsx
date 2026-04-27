import React, { useState } from 'react';
import { FolderPlus, Users, X, UserPlus } from 'lucide-react';
import { useApp } from '../AppContext';
import { cn } from '../lib/utils';
import Avatar from './Avatar';
interface ProjectsSidebarBlockProps {
  onSelectProject: () => void;
}

export default function ProjectsSidebarBlock({ onSelectProject }: ProjectsSidebarBlockProps) {
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    addProject,
    deleteProject,
    addProjectTeamMember,
    removeProjectTeamMember,
    users,
  } = useApp();

  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const active = projects.find((p) => p.id === activeProjectId);
  const teamIds = active
    ? Array.from(new Set([active.ownerId, ...(active.memberIds ?? [])].filter(Boolean)))
    : [];
  const addableUsers = users.filter((u) => !teamIds.includes(u.id));

  const submitNewProject = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    void addProject(name, newDescription.trim());
    setNewName('');
    setNewDescription('');
    setShowNewProject(false);
    onSelectProject();
  };

  return (
    <div className="px-6 md:px-8 py-6 border-t border-kf-divider-gray space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-kf-secondary-text font-medium tracking-tight">Projects</div>
        <button
          type="button"
          onClick={() => setShowNewProject(true)}
          className="p-1.5 rounded-[10px] text-kf-meta-blue hover:bg-kf-baby-blue/60 transition-colors"
          aria-label="Add project"
        >
          <FolderPlus size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="space-y-1">
        {projects.map((project) => (
          <div key={project.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveProjectId(project.id);
                onSelectProject();
              }}
              className={cn(
                'flex-1 min-w-0 text-left px-3 py-2.5 rounded-[12px] transition-colors flex items-center justify-between text-sm font-medium',
                activeProjectId === project.id
                  ? 'bg-kf-baby-blue text-kf-meta-blue border border-kf-meta-blue/15'
                  : 'text-kf-slate hover:bg-kf-warm-gray border border-transparent',
              )}
            >
              <span className="truncate">{project.name}</span>
              {activeProjectId === project.id && (
                <span className="w-2 h-2 rounded-full bg-kf-meta-blue shrink-0" aria-hidden />
              )}
            </button>
            {activeProjectId === project.id && (
              <button
                type="button"
                className="shrink-0 p-2 text-kf-secondary-text hover:text-kf-error rounded-[10px] hover:bg-kf-warm-gray text-xs font-medium"
                aria-label="Delete project"
                onClick={() => {
                  if (window.confirm(`Delete project “${project.name}”? Tasks in this project will be removed.`)) {
                    deleteProject(project.id);
                  }
                }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            )}
          </div>
        ))}
      </div>

      {active && (
        <div className="pt-2 border-t border-kf-divider-gray/80">
          <div className="flex items-center gap-2 mb-3 text-xs text-kf-secondary-text font-medium tracking-tight">
            <Users size={14} strokeWidth={1.75} />
            Project team
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {teamIds.map((uid) => {
              const u = users.find((x) => x.id === uid);
              if (!u) return null;
              const isOwner = uid === active.ownerId;
              return (
                <div
                  key={uid}
                  className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-kf-warm-gray border border-kf-divider-gray text-xs font-medium text-kf-charcoal"
                >
                  <Avatar name={u.name} className="w-6 h-6 text-[9px]" />
                  <span className="max-w-[7rem] truncate">{u.name}</span>
                  {isOwner && (
                    <span className="text-[9px] uppercase tracking-wide text-kf-secondary-text shrink-0">Owner</span>
                  )}
                  {!isOwner && (
                    <button
                      type="button"
                      className="ml-0.5 p-0.5 rounded-full hover:bg-kf-divider-gray/80 text-kf-slate"
                      aria-label={`Remove ${u.name}`}
                      onClick={() => removeProjectTeamMember(active.id, uid)}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {addableUsers.length > 0 ? (
            <div className="flex items-center gap-2">
              <UserPlus size={14} className="text-kf-icon-secondary shrink-0" />
              <select
                className="kf-input text-xs py-2 rounded-[12px] flex-1 min-w-0"
                aria-label="Add teammate"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) {
                    addProjectTeamMember(active.id, v);
                    e.target.value = '';
                  }
                }}
              >
                <option value="">Add teammate…</option>
                {addableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-[11px] text-kf-slate">Everyone is already on this project.</p>
          )}
        </div>
      )}

      {showNewProject && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-kf-overlay/80 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            className="w-full max-w-md bg-kf-white rounded-[24px] border border-kf-divider-gray shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 id="new-project-title" className="text-lg font-medium text-kf-charcoal">
                New project
              </h2>
              <button
                type="button"
                className="p-2 rounded-[12px] hover:bg-kf-warm-gray text-kf-slate"
                onClick={() => setShowNewProject(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submitNewProject} className="space-y-4">
              <div>
                <label htmlFor="np-name" className="block text-xs font-medium text-kf-secondary-text mb-1.5">
                  Name
                </label>
                <input
                  id="np-name"
                  className="kf-input w-full text-sm rounded-[12px]"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Q2 roadmap"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="np-desc" className="block text-xs font-medium text-kf-secondary-text mb-1.5">
                  Description
                </label>
                <textarea
                  id="np-desc"
                  className="kf-input w-full text-sm rounded-[12px] min-h-[88px] resize-y"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Optional context for your team"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2.5 text-sm font-medium text-kf-slate hover:bg-kf-warm-gray rounded-[12px]"
                  onClick={() => setShowNewProject(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="kf-btn-primary px-5 py-2.5 text-sm rounded-[12px]">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

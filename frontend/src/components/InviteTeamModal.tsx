import React, { useMemo } from 'react';
import { X, UserPlus } from 'lucide-react';
import { useApp } from '../AppContext';

interface InviteTeamModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export default function InviteTeamModal({ open, onClose, projectId }: InviteTeamModalProps) {
  const { projects, users, addProjectTeamMember } = useApp();
  const project = projects.find((p) => p.id === projectId);

  const teamIds = useMemo(
    () => (project ? Array.from(new Set([project.ownerId, ...(project.memberIds ?? [])].filter(Boolean))) : []),
    [project],
  );
  const addableUsers = useMemo(() => users.filter((u) => !teamIds.includes(u.id)), [users, teamIds]);

  if (!open || !project) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-kf-overlay/80 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-team-title"
        className="w-full max-w-md bg-kf-white rounded-[24px] border border-kf-divider-gray shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="invite-team-title" className="text-lg font-medium text-kf-charcoal flex items-center gap-2">
            <UserPlus size={20} className="text-kf-meta-blue" strokeWidth={1.75} />
            Invite teammates
          </h2>
          <button type="button" className="p-2 rounded-[12px] hover:bg-kf-warm-gray text-kf-slate" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-kf-slate">
          Add people to <span className="font-medium text-kf-charcoal">{project.name}</span>. They can collaborate on tasks and see the board.
        </p>
        {addableUsers.length === 0 ? (
          <p className="text-sm text-kf-secondary-text">Everyone in the directory is already on this project.</p>
        ) : (
          <div className="space-y-2">
            <label htmlFor="invite-select" className="block text-xs font-medium text-kf-secondary-text">
              Add teammate
            </label>
            <select
              id="invite-select"
              key={teamIds.join(',')}
              className="kf-input w-full text-sm rounded-[12px]"
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) {
                  addProjectTeamMember(projectId, v);
                  e.target.value = '';
                }
              }}
            >
              <option value="" disabled>
                Choose a user…
              </option>
              {addableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.email}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex justify-end pt-2">
          <button type="button" className="kf-btn-primary px-5 py-2.5 text-sm rounded-[12px]" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

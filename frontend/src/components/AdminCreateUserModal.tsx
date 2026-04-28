import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '../AppContext';

export default function AdminCreateUserModal({ onClose }: { onClose: () => void }) {
  const { createUserAdmin, addNotification, currentUser } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = name.trim();
    const em = email.trim().toLowerCase();
    if (!n || !em) {
      setError('Name and email are required.');
      return;
    }
    setBusy(true);
    try {
      await createUserAdmin({ name: n, email: em, role: role.trim() || 'member' });
      addNotification({
        userId: currentUser?.id ?? '',
        title: 'User created in database',
        message: `Created ${em}. Add the same email in Keycloak (Admin Console → Users → Create) with a password so they can sign in.`,
        type: 'task_update',
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-kf-overlay/80 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md bg-kf-white rounded-[20px] border border-kf-divider-gray shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-kf-charcoal font-medium">
            <UserPlus size={20} className="text-kf-meta-blue" />
            Create user (database)
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-[10px] hover:bg-kf-soft-gray text-kf-icon-secondary">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-kf-slate mb-4 leading-relaxed">
          Creates a row in Postgres. The person must also exist in Keycloak with the <strong>same email</strong> to log in (see MISSION §8).
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-kf-secondary-text uppercase tracking-wide">Name</label>
            <input className="kf-input w-full mt-1 text-sm" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-kf-secondary-text uppercase tracking-wide">Email</label>
            <input
              className="kf-input w-full mt-1 text-sm"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-kf-secondary-text uppercase tracking-wide">Role (label)</label>
            <input
              className="kf-input w-full mt-1 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="member"
            />
          </div>
          {error && <p className="text-xs text-kf-error">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="kf-btn-secondary !py-2 !px-4 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="kf-btn-primary !py-2 !px-4 text-sm disabled:opacity-50">
              {busy ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import {
  User as UserIcon,
  Settings,
  Shield,
  Key,
  LogOut,
  Smartphone,
  ChevronDown,
  ExternalLink,
  Save,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { useAuth } from './AuthProvider';
import { cn } from '../lib/utils';
import Avatar from './Avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_PRIVACY_SETTINGS, type PrivacySettings } from '../types';

export default function ProfileDropdown() {
  const { currentUser, updateUser } = useApp();
  const { logout, manageAccount, updatePassword } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [panel, setPanel] = useState<'menu' | 'security' | 'profile' | 'privacy'>('menu');
  const [name, setName] = useState(currentUser?.name ?? '');
  const [avatar, setAvatar] = useState(currentUser?.avatar ?? '');
  const [privacy, setPrivacy] = useState<PrivacySettings>(
    currentUser?.privacy ?? DEFAULT_PRIVACY_SETTINGS,
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setName(currentUser.name);
    setAvatar(currentUser.avatar ?? '');
    setPrivacy(currentUser.privacy ?? DEFAULT_PRIVACY_SETTINGS);
  }, [currentUser]);

  if (!currentUser) return null;

  const saveProfile = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await updateUser({ name: name.trim(), avatar: avatar.trim() || undefined });
      setFeedback('Profile saved.');
    } catch {
      setFeedback('Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const savePrivacy = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await updateUser({ privacy });
      setFeedback('Privacy preferences saved.');
    } catch {
      setFeedback('Could not save privacy preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pl-2 pr-2 min-h-[44px] bg-kf-warm-gray hover:bg-kf-divider-gray/50 border border-kf-divider-gray rounded-full transition-colors"
      >
        <div className="text-right hidden sm:block pr-1">
          <div className="text-xs font-medium text-kf-charcoal leading-tight">{currentUser.name}</div>
          <div className="text-[10px] text-kf-slate">{currentUser.role}</div>
        </div>
        <div className="relative shrink-0">
          <Avatar
            name={currentUser.name}
            src={currentUser.avatar}
            className="w-8 h-8 text-xs border border-kf-divider-gray"
          />
          {(currentUser.privacy?.showOnlineStatus ?? true) && (
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-kf-success border-2 border-kf-white rounded-full" />
          )}
        </div>
        <ChevronDown
          size={14}
          className={cn('text-kf-icon-secondary transition-transform shrink-0', isOpen && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => {
                setIsOpen(false);
                setPanel('menu');
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              className="absolute right-0 top-12 w-72 kf-card-elevated z-50 overflow-hidden rounded-xl"
            >
              {panel === 'menu' ? (
                <div className="p-2">
                  <div className="p-4 border-b border-kf-divider-gray mb-1">
                    <div className="text-xs text-kf-secondary-text mb-1">Signed in as</div>
                    <div className="text-sm font-medium text-kf-charcoal mb-2">{currentUser.email}</div>
                    <span className="inline-block px-2 py-0.5 bg-kf-baby-blue text-kf-meta-blue text-[10px] font-medium rounded-full border border-kf-meta-blue/15">
                      {currentUser.role}
                    </span>
                  </div>

                  <MenuButton icon={<Settings size={14} />} label="Security" onClick={() => setPanel('security')} />
                  <MenuButton icon={<UserIcon size={14} />} label="Profile" onClick={() => setPanel('profile')} />
                  <MenuButton icon={<Shield size={14} />} label="Privacy" onClick={() => setPanel('privacy')} />

                  <div className="mt-1 border-t border-kf-divider-gray pt-1">
                    <MenuButton
                      icon={<LogOut size={14} />}
                      label="Sign out"
                      onClick={() => { setIsOpen(false); logout(); }}
                      className="text-kf-error hover:bg-[rgba(255,123,145,0.12)]"
                    />
                  </div>
                </div>
              ) : panel === 'security' ? (
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => setPanel('menu')}
                    className="flex items-center gap-2 p-3 text-xs font-medium text-kf-meta-blue hover:bg-kf-soft-gray rounded-[12px] w-full text-left transition-colors"
                  >
                    <ChevronDown size={14} className="rotate-90" />
                    Back
                  </button>

                  <div className="px-3 pb-3 mt-1">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Smartphone size={14} className="text-kf-icon-secondary" />
                        <span className="text-xs font-medium text-kf-charcoal">Two-factor authentication</span>
                      </div>
                      <p className="text-[11px] text-kf-slate leading-relaxed">
                        MFA is managed securely by Keycloak, not stored in Kanflow.
                      </p>
                      <button type="button" onClick={manageAccount} className="kf-btn-secondary text-xs mt-3 w-full gap-2">
                        <ExternalLink size={13} />
                        Manage MFA in Keycloak
                      </button>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-kf-divider-gray">
                      <button
                        type="button"
                        onClick={updatePassword}
                        className="w-full flex items-center justify-between p-3 bg-kf-warm-gray hover:bg-kf-soft-gray border border-kf-divider-gray rounded-[12px] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Key size={14} className="text-kf-meta-blue" />
                          <span className="text-xs font-medium text-kf-charcoal">Update password</span>
                        </div>
                        <ChevronDown size={12} className="-rotate-90 text-kf-icon-secondary" />
                      </button>

                      <p className="text-center text-[10px] text-kf-slate pt-1">
                        Credentials are handled by your identity provider.
                      </p>
                    </div>
                  </div>
                </div>
              ) : panel === 'profile' ? (
                <EditorPanel title="Profile" onBack={() => setPanel('menu')}>
                  <label className="block text-xs text-kf-slate mb-3">
                    Display name
                    <input
                      className="kf-input w-full mt-1"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <label className="block text-xs text-kf-slate mb-4">
                    Avatar URL
                    <input
                      type="url"
                      className="kf-input w-full mt-1"
                      value={avatar}
                      onChange={(event) => setAvatar(event.target.value)}
                      placeholder="https://…"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={saving || !name.trim()}
                    className="kf-btn-primary w-full gap-2 disabled:opacity-50"
                  >
                    <Save size={13} />
                    Save profile
                  </button>
                  {feedback && <p className="text-[11px] text-kf-slate mt-2">{feedback}</p>}
                </EditorPanel>
              ) : (
                <EditorPanel title="Privacy" onBack={() => setPanel('menu')}>
                  <PrivacyToggle
                    label="Show online status"
                    checked={privacy.showOnlineStatus}
                    onChange={(checked) => setPrivacy({ ...privacy, showOnlineStatus: checked })}
                  />
                  <PrivacyToggle
                    label="Share anonymous analytics"
                    checked={privacy.allowAnalytics}
                    onChange={(checked) => setPrivacy({ ...privacy, allowAnalytics: checked })}
                  />
                  <label className="block text-xs text-kf-slate mb-4">
                    Activity visibility
                    <select
                      className="kf-input w-full mt-1"
                      value={privacy.activityVisibility}
                      onChange={(event) =>
                        setPrivacy({
                          ...privacy,
                          activityVisibility: event.target.value as PrivacySettings['activityVisibility'],
                        })
                      }
                    >
                      <option value="project">Project members</option>
                      <option value="private">Only me</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void savePrivacy()}
                    disabled={saving}
                    className="kf-btn-primary w-full gap-2 disabled:opacity-50"
                  >
                    <Save size={13} />
                    Save privacy
                  </button>
                  {feedback && <p className="text-[11px] text-kf-slate mt-2">{feedback}</p>}
                </EditorPanel>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-[12px] text-kf-charcoal hover:bg-kf-soft-gray transition-colors text-sm font-medium text-left',
        className,
      )}
    >
      <span className="text-kf-icon-secondary">{icon}</span>
      {label}
    </button>
  );
}

function EditorPanel({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="p-2">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 p-3 text-xs font-medium text-kf-meta-blue hover:bg-kf-soft-gray rounded-[12px] w-full text-left"
      >
        <ChevronDown size={14} className="rotate-90" />
        Back
      </button>
      <div className="px-3 pb-3">
        <h3 className="text-sm font-medium text-kf-charcoal mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function PrivacyToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-kf-charcoal mb-4">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

import React, { useState } from 'react';
import {
  User as UserIcon,
  Settings,
  Shield,
  Key,
  LogOut,
  Smartphone,
  ChevronDown,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { useAuth } from './AuthProvider';
import { cn } from '../lib/utils';
import Avatar from './Avatar';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfileDropdown() {
  const { currentUser, updateUser } = useApp();
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (!currentUser) return null;

  const handleToggle2FA = () => {
    updateUser({ twoFactorEnabled: !currentUser.twoFactorEnabled });
  };

  const handleResetPassword = () => {
    updateUser({ passwordLastChanged: Date.now() });
    alert('If email were configured, a reset link would be sent to your inbox.');
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
          <Avatar name={currentUser.name} className="w-8 h-8 text-xs border border-kf-divider-gray" />
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-kf-success border-2 border-kf-white rounded-full" />
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
                setShowSettings(false);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              className="absolute right-0 top-12 w-72 kf-card-elevated z-50 overflow-hidden rounded-[20px]"
            >
              {!showSettings ? (
                <div className="p-2">
                  <div className="p-4 border-b border-kf-divider-gray mb-1">
                    <div className="text-xs text-kf-secondary-text mb-1">Signed in as</div>
                    <div className="text-sm font-medium text-kf-charcoal mb-2">{currentUser.email}</div>
                    <span className="inline-block px-2 py-0.5 bg-kf-baby-blue text-kf-meta-blue text-[10px] font-medium rounded-full border border-kf-meta-blue/15">
                      {currentUser.role}
                    </span>
                  </div>

                  <MenuButton icon={<Settings size={14} />} label="Security" onClick={() => setShowSettings(true)} />
                  <MenuButton icon={<UserIcon size={14} />} label="Profile" onClick={() => setIsOpen(false)} />
                  <MenuButton icon={<Shield size={14} />} label="Privacy" onClick={() => setIsOpen(false)} />

                  <div className="mt-1 border-t border-kf-divider-gray pt-1">
                    <MenuButton
                      icon={<LogOut size={14} />}
                      label="Sign out"
                      onClick={() => { setIsOpen(false); logout(); }}
                      className="text-kf-error hover:bg-[rgba(255,123,145,0.12)]"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="flex items-center gap-2 p-3 text-xs font-medium text-kf-meta-blue hover:bg-kf-soft-gray rounded-[12px] w-full text-left transition-colors"
                  >
                    <ChevronDown size={14} className="rotate-90" />
                    Back
                  </button>

                  <div className="px-3 pb-3 mt-1">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Smartphone size={14} className="text-kf-icon-secondary" />
                          <span className="text-xs font-medium text-kf-charcoal">Two-factor authentication</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleToggle2FA}
                          className={cn(
                            'w-9 h-5 rounded-full transition-colors relative shrink-0',
                            currentUser.twoFactorEnabled ? 'bg-kf-success' : 'bg-kf-divider-gray',
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-0.5 w-4 h-4 bg-kf-white rounded-full shadow transition-all',
                              currentUser.twoFactorEnabled ? 'left-4' : 'left-0.5',
                            )}
                          />
                        </button>
                      </div>
                      <p className="text-[11px] text-kf-slate leading-relaxed">
                        Add an extra step at sign-in for sensitive workspaces.
                      </p>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-kf-divider-gray">
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        className="w-full flex items-center justify-between p-3 bg-kf-warm-gray hover:bg-kf-soft-gray border border-kf-divider-gray rounded-[12px] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Key size={14} className="text-kf-meta-blue" />
                          <span className="text-xs font-medium text-kf-charcoal">Update password</span>
                        </div>
                        <ChevronDown size={12} className="-rotate-90 text-kf-icon-secondary" />
                      </button>

                      <p className="text-center text-[10px] text-kf-slate pt-1">
                        Last updated:{' '}
                        {currentUser.passwordLastChanged
                          ? new Date(currentUser.passwordLastChanged).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>
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

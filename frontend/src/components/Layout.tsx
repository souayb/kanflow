import React from 'react';
import {
  LayoutDashboard,
  Kanban,
  BarChart3,
  Bell,
  Search,
  LogOut,
  Menu,
  Github,
  Calendar,
  MessageSquare,
  Target,
  Clock,
  UserPlus,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import TeamChatDock from './TeamChatDock';
import ProfileDropdown from './ProfileDropdown';
import ProjectsSidebarBlock from './ProjectsSidebarBlock';
import LayoutSearchResults from './LayoutSearchResults';
import AdminCreateUserModal from './AdminCreateUserModal';

interface LayoutProps {
  children: React.ReactNode;
  currentView: 'dashboard' | 'kanban' | 'reporting' | 'todos' | 'time';
  onViewChange: (view: 'dashboard' | 'kanban' | 'reporting' | 'todos' | 'time') => void;
}

export default function Layout({ children, currentView, onViewChange }: LayoutProps) {
  const {
    projects,
    activeProjectId,
    notifications,
    markNotificationAsRead,
    globalSearchQuery,
    setGlobalSearchQuery,
    openTaskOnBoard,
    integrationSettings,
    setIntegrationSettings,
    currentUser,
    apiOnline,
  } = useApp();
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [adminUserModalOpen, setAdminUserModalOpen] = React.useState(false);
  const searchWrapRef = React.useRef<HTMLDivElement>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const myNotifications = React.useMemo(
    () =>
      !currentUser?.id ? notifications : notifications.filter((n) => n.userId === currentUser.id),
    [notifications, currentUser?.id],
  );
  const unreadCount = myNotifications.filter((n) => !n.read).length;

  return (
    <div className="flex h-screen bg-kf-soft-gray text-kf-charcoal font-sans overflow-hidden">
      <aside
        className={cn(
          'border-r border-kf-divider-gray bg-kf-white transition-all duration-300 overflow-hidden flex flex-col shrink-0 z-40 fixed md:relative h-full shadow-[var(--shadow-kf-subtle)]',
          isSidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 md:w-0 border-none',
        )}
      >
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-[12px] bg-kf-meta-blue flex items-center justify-center text-kf-white shadow-md">
              <Kanban className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <span className="block text-lg font-medium tracking-tight text-kf-charcoal">Kanflow</span>
              <span className="text-xs text-kf-slate font-normal">Task management</span>
            </div>
          </div>

          <nav className="space-y-1" aria-label="Primary">
            <SidebarItem
              icon={<LayoutDashboard size={20} strokeWidth={1.75} />}
              label="Dashboard"
              active={currentView === 'dashboard'}
              onClick={() => onViewChange('dashboard')}
            />
            <SidebarItem
              icon={<Kanban size={20} strokeWidth={1.75} />}
              label="Board"
              active={currentView === 'kanban'}
              onClick={() => onViewChange('kanban')}
            />
            <SidebarItem
              icon={<BarChart3 size={20} strokeWidth={1.75} />}
              label="Reporting"
              active={currentView === 'reporting'}
              onClick={() => onViewChange('reporting')}
            />
            <SidebarItem
              icon={<Target size={20} strokeWidth={1.75} />}
              label="Personal todos"
              active={currentView === 'todos'}
              onClick={() => onViewChange('todos')}
            />
            <SidebarItem
              icon={<Clock size={20} strokeWidth={1.75} />}
              label="Time"
              active={currentView === 'time'}
              onClick={() => onViewChange('time')}
            />
          </nav>
        </div>

        <div className="mt-auto overflow-y-auto no-scrollbar">
          <ProjectsSidebarBlock onSelectProject={() => onViewChange('kanban')} />

          <div className="px-6 md:px-8 py-6 border-t border-kf-divider-gray">
            <div className="text-xs text-kf-secondary-text font-medium mb-3 tracking-tight">Integrations</div>
            <div className="space-y-4">
              <div className="rounded-xl border border-kf-divider-gray bg-kf-soft-gray/50 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-2 rounded-[10px] bg-kf-warm-gray border border-kf-divider-gray text-kf-icon-secondary shrink-0">
                      <Github size={14} />
                    </div>
                    <span className="text-xs font-medium text-kf-slate truncate">GitHub</span>
                  </div>
                  <label className="flex items-center gap-1.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-kf-slate cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-kf-divider-gray text-kf-meta-blue focus:ring-kf-meta-blue/30"
                      checked={integrationSettings.github.enabled}
                      onChange={(e) =>
                        setIntegrationSettings({
                          github: { ...integrationSettings.github, enabled: e.target.checked },
                        })
                      }
                    />
                    On
                  </label>
                </div>
                <input
                  type="url"
                  className="kf-input text-xs py-1.5 w-full"
                  placeholder="https://github.com/org/repo"
                  value={integrationSettings.github.repoUrl}
                  disabled={!integrationSettings.github.enabled}
                  onChange={(e) =>
                    setIntegrationSettings({
                      github: { ...integrationSettings.github, repoUrl: e.target.value },
                    })
                  }
                />
                <input
                  type="text"
                  className="kf-input text-xs py-1.5 w-full"
                  placeholder="Default branch (e.g. main)"
                  value={integrationSettings.github.defaultBranch}
                  disabled={!integrationSettings.github.enabled}
                  onChange={(e) =>
                    setIntegrationSettings({
                      github: { ...integrationSettings.github, defaultBranch: e.target.value },
                    })
                  }
                />
              </div>
              <ConnectorItem icon={<Calendar size={14} />} label="Calendar" status="Active" />
              <ConnectorItem icon={<MessageSquare size={14} />} label="Team chat" status="Dock" />
            </div>
          </div>
        </div>

        <div className="p-6 md:px-8 border-t border-kf-divider-gray flex items-center gap-3">
          <button
            type="button"
            className="kf-nav-link text-xs text-kf-secondary-text hover:text-kf-error inline-flex items-center gap-2"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative min-w-0">
        {isSidebarOpen && (
          <div
            className="md:hidden absolute inset-0 bg-kf-overlay backdrop-blur-sm z-30"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden
          />
        )}

        <header className="h-14 md:h-[56px] kf-glass-header px-4 md:px-10 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[12px] hover:bg-kf-warm-gray transition-colors text-kf-charcoal md:hidden"
              aria-label="Toggle menu"
            >
              <Menu size={22} strokeWidth={1.75} />
            </button>
            <h1 className="text-base md:text-lg font-medium tracking-tight text-kf-charcoal truncate hidden sm:block">
              {activeProject?.name ?? 'Select a project'}
            </h1>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div ref={searchWrapRef} className="relative group min-w-0 flex-1 max-w-md hidden sm:block">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-kf-icon-secondary pointer-events-none"
                size={18}
                strokeWidth={1.75}
              />
              <input
                type="search"
                placeholder="Search tasks across projects…"
                className="kf-input pl-10 pr-4 py-2 text-sm w-full sm:w-56 md:w-64 lg:w-72 xl:w-80 rounded-full border-kf-divider-gray"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                aria-autocomplete="list"
                aria-controls="kanflow-global-search-results"
              />
              <LayoutSearchResults
                query={globalSearchQuery}
                open={globalSearchQuery.trim().length > 0}
                onClose={() => setGlobalSearchQuery('')}
                onPickTask={(id) => {
                  openTaskOnBoard(id);
                  setGlobalSearchQuery('');
                }}
              />
            </div>

            <ProfileDropdown />

            {currentUser?.role === 'Admin' && (
              <button
                type="button"
                title={apiOnline ? 'Create database user' : 'API offline — connect server to create users'}
                disabled={!apiOnline}
                onClick={() => apiOnline && setAdminUserModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-kf-meta-blue hover:bg-kf-baby-blue/40 rounded-full border border-kf-meta-blue/25 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UserPlus size={16} strokeWidth={1.75} />
                User
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                className="relative p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-kf-icon-secondary hover:bg-kf-warm-gray rounded-[12px] transition-colors"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                aria-expanded={isNotificationsOpen}
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              >
                <Bell size={20} strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-kf-error rounded-full border-2 border-kf-white" />
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsNotificationsOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-12 w-[min(100vw-2rem,22rem)] kf-card-elevated z-30 flex flex-col max-h-[400px] overflow-hidden rounded-[20px]"
                    >
                      <div className="p-4 border-b border-kf-divider-gray flex items-center justify-between">
                        <span className="text-sm font-medium text-kf-charcoal">Notifications</span>
                        <button
                          type="button"
                          className="text-xs text-kf-link font-medium hover:underline"
                          onClick={() => myNotifications.forEach((n) => !n.read && markNotificationAsRead(n.id))}
                        >
                          Mark all read
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {myNotifications.length === 0 ? (
                          <div className="p-8 text-center text-kf-slate text-sm">No notifications yet.</div>
                        ) : (
                          myNotifications.map((n) => (
                            <div
                              key={n.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => markNotificationAsRead(n.id)}
                              onKeyDown={(e) => e.key === 'Enter' && markNotificationAsRead(n.id)}
                              className={cn(
                                'p-4 border-b border-kf-divider-gray cursor-pointer hover:bg-kf-soft-gray transition-colors text-left',
                                !n.read && 'bg-kf-baby-blue/50',
                              )}
                            >
                              <div className="text-sm font-medium text-kf-charcoal">{n.title}</div>
                              <div className="text-xs text-kf-slate mt-1 leading-relaxed">{n.message}</div>
                              <div className="text-xs text-kf-secondary-text mt-2">
                                {new Date(n.createdAt).toLocaleTimeString()}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-4 py-6 md:px-10 md:py-10 max-w-[1440px] w-full mx-auto custom-scrollbar">
          {children}
        </div>

        <TeamChatDock />
        {adminUserModalOpen && <AdminCreateUserModal onClose={() => setAdminUserModalOpen(false)} />}
      </main>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-3 rounded-full transition-all text-sm font-medium min-h-[44px]',
        active
          ? 'bg-kf-meta-blue text-kf-white shadow-md hover:bg-kf-meta-blue-hover'
          : 'text-kf-charcoal hover:bg-kf-warm-gray',
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ConnectorItem({ icon, label, status }: { icon: React.ReactNode; label: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-2 rounded-[10px] bg-kf-warm-gray border border-kf-divider-gray text-kf-icon-secondary shrink-0">
          {icon}
        </div>
        <span className="text-xs font-medium text-kf-slate truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 bg-kf-success rounded-full" />
        <span className="text-[10px] font-medium text-kf-success uppercase tracking-wide">{status}</span>
      </div>
    </div>
  );
}

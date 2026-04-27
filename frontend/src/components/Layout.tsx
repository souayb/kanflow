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
} from 'lucide-react';
import { useApp } from '../AppContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ChatComponent from './ChatComponent';
import ProfileDropdown from './ProfileDropdown';

interface LayoutProps {
  children: React.ReactNode;
  currentView: 'dashboard' | 'kanban' | 'reporting' | 'todos' | 'time';
  onViewChange: (view: 'dashboard' | 'kanban' | 'reporting' | 'todos' | 'time') => void;
}

export default function Layout({ children, currentView, onViewChange }: LayoutProps) {
  const { projects, activeProjectId, setActiveProjectId, notifications, markNotificationAsRead } = useApp();
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const unreadCount = notifications.filter((n) => !n.read).length;

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
          <div className="px-6 md:px-8 py-6 border-t border-kf-divider-gray">
            <div className="text-xs text-kf-secondary-text font-medium mb-3 tracking-tight">Projects</div>
            <div className="space-y-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    setActiveProjectId(project.id);
                    onViewChange('kanban');
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-[12px] transition-colors flex items-center justify-between text-sm font-medium',
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
              ))}
            </div>
          </div>

          <div className="px-6 md:px-8 py-6 border-t border-kf-divider-gray">
            <div className="text-xs text-kf-secondary-text font-medium mb-3 tracking-tight">Integrations</div>
            <div className="space-y-3">
              <ConnectorItem icon={<Github size={14} />} label="GitHub" status="Synced" />
              <ConnectorItem icon={<Calendar size={14} />} label="Calendar" status="Active" />
              <ConnectorItem icon={<MessageSquare size={14} />} label="Chat" status="Online" />
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
            <div className="relative group hidden lg:block">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-kf-icon-secondary pointer-events-none"
                size={18}
                strokeWidth={1.75}
              />
              <input
                type="search"
                placeholder="Search…"
                className="kf-input pl-10 pr-4 py-2 text-sm w-56 xl:w-72 rounded-full border-kf-divider-gray"
              />
            </div>

            <ProfileDropdown />

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
                          onClick={() => notifications.forEach((n) => !n.read && markNotificationAsRead(n.id))}
                        >
                          Mark all read
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-kf-slate text-sm">No notifications yet.</div>
                        ) : (
                          notifications.map((n) => (
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

        <ChatComponent />
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

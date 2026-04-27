import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Settings,
  Sparkles,
  Zap,
  Target,
} from 'lucide-react';
import { cn } from '../lib/utils';
import Avatar from './Avatar';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardCustomizer from './DashboardCustomizer';

const CHART_PALETTE = ['#5D6C7B', '#F7B928', '#0064E0', '#31A24C', '#A121CE'];

export default function DashboardView() {
  const { tasks, projects, activeProjectId, dashboardWidgets } = useApp();
  const [isCustomizing, setIsCustomizing] = useState(false);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const projectTasks = tasks.filter((t) => t.projectId === activeProjectId);

  const columnsSorted = useMemo(
    () => [...(activeProject?.columns ?? [])].sort((a, b) => a.order - b.order),
    [activeProject],
  );
  const doneColumnId = columnsSorted.length ? columnsSorted[columnsSorted.length - 1].id : null;
  const inProgressId = columnsSorted[1]?.id;

  const stats = useMemo(() => {
    const overdue =
      doneColumnId == null
        ? 0
        : projectTasks.filter((t) => t.dueDate && t.dueDate < Date.now() && t.status !== doneColumnId).length;
    const done =
      doneColumnId == null ? 0 : projectTasks.filter((t) => t.status === doneColumnId).length;
    const processing =
      inProgressId == null ? 0 : projectTasks.filter((t) => t.status === inProgressId).length;

    return [
      {
        label: 'Total tasks',
        value: projectTasks.length,
        icon: <Activity className="text-kf-meta-blue" strokeWidth={1.75} />,
        change: '+12%',
        trend: 'up' as const,
      },
      {
        label: 'Completed',
        value: done,
        icon: <CheckCircle2 className="text-kf-success" strokeWidth={1.75} />,
        change: '+5%',
        trend: 'up' as const,
      },
      {
        label: 'In progress',
        value: processing,
        icon: <Clock className="text-kf-warning" strokeWidth={1.75} />,
        change: '-2%',
        trend: 'down' as const,
      },
      {
        label: 'Overdue',
        value: overdue,
        icon: <AlertCircle className="text-kf-error" strokeWidth={1.75} />,
        change: '0%',
        trend: 'neutral' as const,
      },
    ];
  }, [projectTasks, doneColumnId, inProgressId]);

  const activityData = [
    { name: 'Mon', completed: 4, added: 2 },
    { name: 'Tue', completed: 3, added: 5 },
    { name: 'Wed', completed: 6, added: 3 },
    { name: 'Thu', completed: 8, added: 4 },
    { name: 'Fri', completed: 5, added: 7 },
    { name: 'Sat', completed: 2, added: 1 },
    { name: 'Sun', completed: 1, added: 0 },
  ];

  const statusDistribution = columnsSorted.map((c, i) => ({
    name: c.title,
    value: projectTasks.filter((t) => t.status === c.id).length,
    color: CHART_PALETTE[i % CHART_PALETTE.length],
  }));

  const activeWidgets = [...dashboardWidgets].filter((w) => w.enabled).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-8 md:space-y-10 pb-12 custom-scrollbar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-4xl font-medium tracking-tight text-kf-charcoal">Dashboard</h2>
          <p className="text-kf-slate text-sm mt-2">Overview for {activeProject?.name ?? 'your workspace'}.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setIsCustomizing(true)}
            className="kf-btn-secondary text-sm !py-2.5 !px-4"
          >
            <Settings size={16} strokeWidth={1.75} />
            Customize widgets
          </button>
          <div className="inline-flex items-center gap-2 text-sm text-kf-slate kf-card px-4 py-2.5">
            <Calendar size={16} className="text-kf-meta-blue" strokeWidth={1.75} />
            Last 7 days
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            className="kf-card-elevated p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-kf-warm-gray rounded-[12px] border border-kf-divider-gray">{stat.icon}</div>
              <div
                className={cn(
                  'flex items-center gap-0.5 text-xs font-medium',
                  stat.trend === 'up'
                    ? 'text-kf-success'
                    : stat.trend === 'down'
                      ? 'text-kf-error'
                      : 'text-kf-slate',
                )}
              >
                {stat.trend === 'up' && <ArrowUpRight size={14} />}
                {stat.trend === 'down' && <ArrowDownRight size={14} />}
                {stat.change}
              </div>
            </div>
            <div>
              <div className="text-3xl font-medium text-kf-charcoal tracking-tight">{stat.value}</div>
              <div className="text-xs text-kf-slate mt-1">{stat.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <AnimatePresence mode="popLayout">
          {activeWidgets.map((widget) => (
            <React.Fragment key={widget.id}>
              {widget.type === 'performance' && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="lg:col-span-2 kf-card-elevated p-6 md:p-8"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-medium text-sm text-kf-charcoal flex items-center gap-2">
                      <TrendingUp size={18} className="text-kf-meta-blue" strokeWidth={1.75} />
                      Throughput
                    </h3>
                    <div className="hidden sm:flex gap-6 text-xs text-kf-slate">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-kf-success" />
                        Completed
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-kf-meta-blue" />
                        Added
                      </span>
                    </div>
                  </div>
                  <div className="h-[280px] md:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activityData}>
                        <defs>
                          <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#31A24C" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#31A24C" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorAdded" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0064E0" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#0064E0" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DEE3E9" />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: '#5D6C7B', fontWeight: 500 }}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#5D6C7B', fontWeight: 500 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '12px',
                            border: '1px solid #DEE3E9',
                            boxShadow: 'var(--shadow-kf-card)',
                          }}
                          labelStyle={{ color: '#1C2B33', fontWeight: 600 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="completed"
                          stroke="#31A24C"
                          fillOpacity={1}
                          fill="url(#colorCompleted)"
                          strokeWidth={2}
                        />
                        <Area type="monotone" dataKey="added" stroke="#0064E0" fillOpacity={1} fill="url(#colorAdded)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}

              {widget.type === 'overview' && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="kf-card-elevated p-6 md:p-8"
                >
                  <h3 className="font-medium text-sm text-kf-charcoal mb-6">Tasks by column</h3>
                  <div className="h-[220px] md:h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={82}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-90 transition-opacity cursor-pointer" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '12px',
                            border: '1px solid #DEE3E9',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 mt-4">
                    {statusDistribution.map((status) => (
                      <div key={status.name} className="flex items-center justify-between text-xs font-medium">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                          <span className="text-kf-slate truncate">{status.name}</span>
                        </div>
                        <span className="text-kf-charcoal shrink-0">{status.value}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {widget.type === 'ai_insights' && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="lg:col-span-1 bg-kf-meta-blue p-8 rounded-[24px] shadow-lg relative overflow-hidden group text-kf-white"
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-kf-meta-blue-light/30 rounded-full blur-3xl -translate-y-10 translate-x-10 group-hover:scale-110 transition-transform duration-700" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="p-2 bg-white/15 rounded-[12px] backdrop-blur-sm">
                        <Sparkles size={20} className="text-kf-white" />
                      </div>
                      <h3 className="font-medium text-sm tracking-tight">Kanflow AI insight</h3>
                    </div>
                    <p className="text-sm text-white/90 leading-relaxed mb-6">
                      Throughput is strong mid-week. Consider grooming high-priority items in your first column to keep
                      flow steady.
                    </p>
                    <button
                      type="button"
                      className="w-full py-3 kf-btn-primary !bg-kf-white !text-kf-meta-blue hover:!bg-kf-baby-blue"
                    >
                      <Zap size={14} />
                      Review suggestions
                    </button>
                  </div>
                </motion.div>
              )}

              {widget.type === 'activity' && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="lg:col-span-1 kf-card-elevated p-6 md:p-8"
                >
                  <h3 className="font-medium text-sm text-kf-charcoal mb-5 flex items-center gap-2">
                    <Activity size={18} className="text-kf-meta-blue" strokeWidth={1.75} />
                    Recent activity
                  </h3>
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3">
                        <div className="relative shrink-0">
                          <Avatar
                            name={['Alex Rivera', 'Sam Chen', 'Jordan Taylor'][i - 1] ?? `User ${i}`}
                            className="w-9 h-9 text-xs border border-kf-divider-gray"
                          />
                          {i === 1 && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-kf-success rounded-full border-2 border-kf-white" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-kf-charcoal">Teammate updated a task</div>
                          <div className="text-xs text-kf-slate mt-0.5">{i * 15} min ago</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {widget.type === 'upcoming' && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="lg:col-span-1 kf-card-elevated p-6 md:p-8"
                >
                  <h3 className="font-medium text-sm text-kf-charcoal mb-5 flex items-center gap-2">
                    <Target size={18} className="text-kf-error" strokeWidth={1.75} />
                    High priority
                  </h3>
                  <div className="space-y-3">
                    {projectTasks
                      .filter((t) => t.priority === 'high')
                      .slice(0, 4)
                      .map((task) => {
                        const col = columnsSorted.find((c) => c.id === task.status);
                        return (
                          <div key={task.id} className="p-3 bg-kf-warm-gray border border-kf-divider-gray rounded-[12px]">
                            <div className="text-sm font-medium text-kf-charcoal truncate">{task.title}</div>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-kf-error bg-[rgba(255,123,145,0.15)] px-2 py-0.5 rounded-full">
                                High
                              </span>
                              <span className="text-xs text-kf-slate">Column: {col?.title ?? task.status}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </motion.div>
              )}
            </React.Fragment>
          ))}
        </AnimatePresence>
      </div>

      <DashboardCustomizer isOpen={isCustomizing} onClose={() => setIsCustomizing(false)} />
    </div>
  );
}

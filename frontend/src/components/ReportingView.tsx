import React, { useMemo } from 'react';
import { useApp } from '../AppContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { Users, Target, Flame, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import Avatar from './Avatar';
import { motion } from 'framer-motion';

export default function ReportingView() {
  const { tasks, users, activeProjectId, projects } = useApp();

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const columnsSorted = useMemo(
    () => [...(activeProject?.columns ?? [])].sort((a, b) => a.order - b.order),
    [activeProject],
  );
  const doneColumnId = columnsSorted.length ? columnsSorted[columnsSorted.length - 1].id : null;

  const projectTasks = tasks.filter((t) => t.projectId === activeProjectId);
  const completedTasks = doneColumnId ? projectTasks.filter((t) => t.status === doneColumnId) : [];

  const teamPerformance = users.map((user) => {
    const userTasks = projectTasks.filter((t) => t.assigneeId === user.id);
    const completed = doneColumnId ? userTasks.filter((t) => t.status === doneColumnId).length : 0;
    return {
      name: user.name.split(' ')[0],
      total: userTasks.length,
      completed,
      efficiency: userTasks.length > 0 ? Math.round((completed / userTasks.length) * 100) : 0,
    };
  });

  const bottleneckData = [
    { phase: 'Discovery', avgDays: 1.2 },
    { phase: 'Design', avgDays: 4.5 },
    { phase: 'Development', avgDays: 8.2 },
    { phase: 'Testing', avgDays: 2.1 },
    { phase: 'Launch', avgDays: 0.8 },
  ];

  return (
    <div className="space-y-8 pb-12 custom-scrollbar">
      <div>
        <h2 className="text-2xl md:text-4xl font-medium tracking-tight text-kf-charcoal">Reporting</h2>
        <p className="text-kf-slate text-sm mt-2">
          Team throughput and illustrative stage timing ({completedTasks.length} completed in view).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="kf-card-elevated p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-medium text-sm text-kf-charcoal flex items-center gap-2">
              <Users size={18} className="text-kf-meta-blue" strokeWidth={1.75} />
              Completion rate by assignee
            </h3>
            <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-kf-baby-blue text-kf-meta-blue border border-kf-meta-blue/15">
              Snapshot
            </span>
          </div>
          <div className="h-[280px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamPerformance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DEE3E9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#5D6C7B', fontWeight: 500 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#5D6C7B', fontWeight: 500 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,100,224,0.04)' }}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #DEE3E9',
                    boxShadow: 'var(--shadow-kf-card)',
                  }}
                />
                <Bar dataKey="efficiency" radius={[8, 8, 0, 0]} barSize={36}>
                  {teamPerformance.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.efficiency > 70 ? '#31A24C' : entry.efficiency > 40 ? '#0064E0' : '#F7B928'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-5 p-4 rounded-[16px] bg-kf-soft-gray flex gap-3 items-start border border-kf-divider-gray">
            <Info size={18} className="text-kf-meta-blue mt-0.5 shrink-0" strokeWidth={1.75} />
            <p className="text-xs text-kf-slate leading-relaxed">
              <strong className="text-kf-charcoal">Efficiency</strong> is completed tasks divided by assigned tasks for
              each teammate in the active project.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="kf-card-elevated p-6 md:p-8"
        >
          <h3 className="font-medium text-sm text-kf-charcoal mb-6 flex items-center gap-2">
            <Flame size={18} className="text-kf-error" strokeWidth={1.75} />
            Example stage duration (days)
          </h3>
          <div className="h-[280px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bottleneckData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DEE3E9" />
                <XAxis dataKey="phase" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#5D6C7B', fontWeight: 500 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#5D6C7B', fontWeight: 500 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #DEE3E9',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avgDays"
                  stroke="#E41E3F"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#E41E3F', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7, stroke: '#0064E0', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-5 p-4 rounded-[16px] border border-kf-error/20 bg-[rgba(255,123,145,0.08)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-kf-error/10 flex items-center justify-center text-kf-error shrink-0">
                <Target size={20} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-kf-charcoal">Longest sample phase</div>
                <div className="text-[11px] text-kf-slate mt-0.5">Development — illustrative data for charts</div>
              </div>
            </div>
            <ArrowUp size={20} className="text-kf-error shrink-0" />
          </div>
        </motion.div>
      </div>

      <div className="kf-card-elevated overflow-hidden mb-12">
        <div className="px-6 py-4 border-b border-kf-divider-gray flex items-center justify-between bg-kf-warm-gray/50">
          <h3 className="font-medium text-sm text-kf-charcoal">Team summary</h3>
          <button type="button" className="text-xs font-medium text-kf-link hover:underline">
            Export (soon)
          </button>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-kf-soft-gray text-[11px] font-medium text-kf-slate uppercase tracking-wide">
                <th className="px-6 py-3">Member</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Done</th>
                <th className="px-4 py-3">Load</th>
                <th className="px-6 py-3 text-right">Efficiency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kf-divider-gray">
              {teamPerformance.map((member) => (
                <tr key={member.name} className="hover:bg-kf-soft-gray/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} className="w-8 h-8 text-xs border border-kf-divider-gray" />
                      <span className="font-medium text-sm text-kf-charcoal">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-kf-slate">{member.total}</td>
                  <td className="px-4 py-4 text-sm text-kf-success font-medium">{member.completed}</td>
                  <td className="px-4 py-4">
                    <div className="w-28 h-1.5 bg-kf-divider-gray rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-kf-meta-blue"
                        style={{ width: `${Math.min((member.total / 10) * 100, 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div
                      className={cn(
                        'inline-flex items-center gap-1 text-xs font-semibold',
                        member.efficiency > 50 ? 'text-kf-success' : 'text-kf-warning',
                      )}
                    >
                      {member.efficiency > 50 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                      {member.efficiency}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

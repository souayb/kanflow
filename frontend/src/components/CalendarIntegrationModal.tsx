import { Calendar, Download, X } from 'lucide-react';
import { useApp } from '../AppContext';
import { buildTaskCalendar, downloadCalendar } from '../lib/calendar';

export default function CalendarIntegrationModal({ onClose }: { onClose: () => void }) {
  const {
    tasks,
    projects,
    currentUser,
    integrationSettings,
    setIntegrationSettings,
  } = useApp();
  const settings = integrationSettings.calendar;
  const dueCount = tasks.filter((task) => {
    if (!task.dueDate) return false;
    return !settings.assignedOnly || task.assigneeId === currentUser?.id;
  }).length;

  const exportCalendar = () => {
    downloadCalendar(buildTaskCalendar(tasks, projects, currentUser, settings));
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
      <div className="kf-card-elevated rounded-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex gap-3">
            <div className="p-2.5 rounded-xl bg-kf-baby-blue text-kf-meta-blue">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="font-medium text-kf-charcoal">Calendar integration</h2>
              <p className="text-xs text-kf-slate mt-1">
                Export due dates to Apple Calendar, Google Calendar, or Outlook.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-kf-slate" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between gap-4 text-sm text-kf-charcoal">
            Only tasks assigned to me
            <input
              type="checkbox"
              checked={settings.assignedOnly}
              onChange={(event) =>
                setIntegrationSettings({
                  calendar: { ...settings, assignedOnly: event.target.checked },
                })
              }
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm text-kf-charcoal">
            Include completed tasks
            <input
              type="checkbox"
              checked={settings.includeCompleted}
              onChange={(event) =>
                setIntegrationSettings({
                  calendar: { ...settings, includeCompleted: event.target.checked },
                })
              }
            />
          </label>
          <div className="rounded-xl bg-kf-soft-gray p-3 text-xs text-kf-slate">
            {dueCount} task{dueCount === 1 ? '' : 's'} with due dates will be considered.
            Import the downloaded <code>.ics</code> file in your calendar provider.
          </div>
          <button type="button" onClick={exportCalendar} className="kf-btn-primary w-full gap-2">
            <Download size={15} />
            Download calendar
          </button>
        </div>
      </div>
    </div>
  );
}

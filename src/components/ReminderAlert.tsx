import { useStore } from '../store';
import { BellRing, Clock, X } from 'lucide-react';

const SNOOZE_OPTIONS = [
  { minutes: 5, label: '۵ دقیقه' },
  { minutes: 10, label: '۱۰ دقیقه' },
  { minutes: 30, label: '۳۰ دقیقه' },
];

export function ReminderAlert() {
  const reminderAlerts = useStore(s => s.reminderAlerts);
  const popReminderAlert = useStore(s => s.popReminderAlert);
  const refreshCurrentView = useStore(s => s.refreshCurrentView);
  const showToast = useStore(s => s.showToast);

  const alert = reminderAlerts[0];
  if (!alert) return null;

  const snooze = async (minutes: number) => {
    popReminderAlert();
    try {
      await window.electronAPI.snoozeReminder(alert.taskId, minutes);
      await refreshCurrentView();
      const opt = SNOOZE_OPTIONS.find(o => o.minutes === minutes);
      showToast(`⏳ ${opt?.label || `${minutes} دقیقه`} بعد دوباره یادآوری می‌شود`, 'info');
    } catch {
      // ignore
    }
  };

  const dismiss = async () => {
    popReminderAlert();
    try {
      await window.electronAPI.cancelReminder(alert.taskId);
      await refreshCurrentView();
      showToast('یادآوری رد شد', 'info');
    } catch {
      // ignore
    }
  };

  const openTask = async () => {
    try {
      const task = await window.electronAPI.getTaskById(alert.taskId);
      if (task) {
        useStore.getState().setSelectedTask(task);
        useStore.getState().setShowTaskDetail(true);
      }
    } catch {
      // ignore
    }
    popReminderAlert();
    await refreshCurrentView();
  };

  return (
    <div className="fixed bottom-6 left-4 z-[110] w-80 animate-slide-up" role="alert">
      <div className="rounded-xl border border-amber-500/40 bg-card/95 shadow-2xl backdrop-blur-sm overflow-hidden">
        <div className="flex items-start gap-2.5 px-3.5 pt-3 pb-2.5">
          <span className="mt-0.5 p-1.5 rounded-lg bg-amber-500/15 shrink-0">
            <BellRing className="w-4 h-4 text-amber-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-amber-500 font-medium mb-0.5">زمان یادآوری رسید</p>
            <p className="text-sm font-medium truncate">{alert.title}</p>
          </div>
          <button onClick={dismiss} aria-label="بستن" className="p-1 rounded hover:bg-muted transition-colors shrink-0">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
        <div className="flex gap-1.5 px-3.5 pb-2">
          {SNOOZE_OPTIONS.map(opt => (
            <button
              key={opt.minutes}
              onClick={() => snooze(opt.minutes)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
            >
              <Clock className="w-3 h-3" />
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={openTask}
          className="w-full py-2 border-t border-border/40 text-[11px] text-primary hover:bg-muted/60 transition-colors"
        >
          دیدن تسک
        </button>
      </div>
    </div>
  );
}

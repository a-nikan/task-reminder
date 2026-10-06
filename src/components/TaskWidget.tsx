import { useEffect, useState } from 'react';
import { useStore } from '../store';
import {
  cn,
  formatReminderLocalized,
  formatTaskDateLocalized,
  fallbackAccent,
  pickOnColor,
  cardGradient,
  getTransparency,
  WIDGET_TRANSPARENCY_KEY,
} from '../utils';
import type { Task, TaskStatus, Subtask } from '../types';
import { Check, Clock, X, Pin, PinOff } from 'lucide-react';

function readWidgetOnTop(settings: Record<string, string> | undefined, taskId: string): boolean {
  try {
    const raw = settings?.widgetGeometries;
    if (!raw) return false;
    const geoms = JSON.parse(raw);
    return !!geoms?.[taskId]?.onTop;
  } catch {
    return false;
  }
}

export function TaskWidget({ taskId }: { taskId: string }) {
  const { settings, showToast, refreshCurrentView } = useStore();
  const [task, setTask] = useState<Task | null>(null);
  const [reminder, setReminder] = useState<any>(null);
  const [onTop, setOnTop] = useState(false);

  const load = async () => {
    try {
      await useStore.getState().loadSettings().catch(() => {});
      const t = await window.electronAPI.getTaskById(taskId);
      if (!t || (t as any).archived) {
        await window.electronAPI.widgetClose(taskId);
        return;
      }
      setTask(t);
      const r = await window.electronAPI.getReminder(taskId).catch(() => null);
      setReminder(r);
      setOnTop(readWidgetOnTop(useStore.getState().settings, taskId));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    window.electronAPI.onTasksChanged(() => load());
    const timer = setInterval(load, 15000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  if (!task) return null;

  const accent = (task as any).color || fallbackAccent(task.id);
  const onColor = pickOnColor(accent);
  const transparency = getTransparency(settings, WIDGET_TRANSPARENCY_KEY, 0);
  const effectiveReminder = reminder ? reminder.snoozed_until || reminder.remind_at : (task as any).reminder;
  const reminderOverdue =
    !!effectiveReminder &&
    task.status !== 'done' &&
    new Date(effectiveReminder).getTime() <= Date.now();
  const subtaskDone = (task.subtasks || []).filter(s => s.completed).length;

  const cycleStatus = async () => {
    const next: Record<TaskStatus, TaskStatus> = { todo: 'in_progress', in_progress: 'done', done: 'todo' };
    await window.electronAPI.changeTaskStatus(task.id, next[task.status]);
    await window.electronAPI.notifyWidgetChanged(task.id);
    await load();
    refreshCurrentView();
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    await window.electronAPI.toggleSubtask(task.id, subtaskId);
    await window.electronAPI.notifyWidgetChanged(task.id);
    await load();
    refreshCurrentView();
  };

  const handleSnooze = async (minutes: number) => {
    await window.electronAPI.snoozeReminder(task.id, minutes);
    const labels: Record<number, string> = { 5: '۵', 10: '۱۰', 30: '۳۰' };
    showToast(`⏳ ${labels[minutes] || minutes} دقیقه بعد دوباره یادآوری می‌شود`, 'info');
    await window.electronAPI.notifyWidgetChanged(task.id);
    await load();
    refreshCurrentView();
  };

  const handleToggleOnTop = async () => {
    const next = !onTop;
    await window.electronAPI.widgetSetOnTop(task.id, next);
    setOnTop(next);
    showToast(next ? 'ویجت همیشه روی بقیه می‌ماند' : 'ویجت به سطح دسکتاپ برگشت', 'info');
  };

  const handleOpenDetails = async () => {
    await window.electronAPI.showTaskInMain(task.id);
  };

  const handleClose = async () => {
    try {
      await window.electronAPI.updateTask(task.id, { pinned: 0 });
    } catch {
      // task may already be gone
    }
    refreshCurrentView();
    await window.electronAPI.notifyWidgetChanged(task.id);
    await window.electronAPI.widgetClose(task.id);
  };

  return (
    <div className="h-screen w-screen bg-transparent p-1.5 overflow-hidden">
      <div
        className="h-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: cardGradient(accent, transparency),
          color: onColor,
        }}
      >
        <div className="drag-region flex items-center gap-2 px-2.5 pt-2 pb-1.5 select-none cursor-move shrink-0">
          <button
            onClick={cycleStatus}
            title="تغییر وضعیت"
            className={cn(
              'no-drag mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
              task.status === 'done' ? 'bg-status-done border-status-done text-white' :
              task.status === 'in_progress' ? 'border-status-progress text-status-progress' :
              'border-muted-foreground/30 hover:border-status-todo'
            )}
            style={task.status === 'todo' ? { borderColor: `${onColor}66` } : undefined}
          >
            {task.status === 'done' && <Check className="w-3 h-3" />}
            {task.status === 'in_progress' && <div className="w-2 h-2 rounded-full bg-status-progress" />}
          </button>
          <span className={cn('text-sm font-medium leading-snug line-clamp-2 break-words flex-1', task.status === 'done' && 'line-through opacity-60')}>
            {task.title}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 pb-1.5 min-h-0">
          {(task.date || task.time || effectiveReminder) && (
            <div className="flex items-center gap-2 flex-wrap text-[11px] opacity-90 mb-1.5">
              {task.date && <span>{formatTaskDateLocalized(task.date, settings.calendarType)}</span>}
              {task.time && (
                <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{task.time}</span>
              )}
              {effectiveReminder && (
                <span className="font-medium">{formatReminderLocalized(effectiveReminder, settings.calendarType)}</span>
              )}
            </div>
          )}

          {(task.subtasks || []).length > 0 && (
            <div className="space-y-1 mb-1.5">
              <div className="text-[10px] opacity-70">سابتسک‌ها ({subtaskDone}/{(task.subtasks || []).length})</div>
              {(task.subtasks || []).map((st: Subtask) => (
                <div key={st.id} className="flex items-center gap-2 py-0.5">
                  <button onClick={() => handleToggleSubtask(st.id)} className="shrink-0 no-drag">
                    <div
                      className="w-4 h-4 rounded border flex items-center justify-center transition-all"
                      style={{
                        borderColor: st.completed ? undefined : `${onColor}55`,
                        backgroundColor: st.completed ? onColor : 'transparent',
                        color: st.completed ? accent : undefined,
                      }}
                    >
                      {st.completed && <Check className="w-2.5 h-2.5" />}
                    </div>
                  </button>
                  <span className={cn('text-xs flex-1 break-words', st.completed && 'line-through opacity-60')}>
                    {st.title}
                  </span>
                </div>
              ))}
            </div>
          )}

          {reminderOverdue && (
            <div className="flex gap-1.5 mb-1.5 no-drag">
              {[5, 10, 30].map(m => (
                <button
                  key={m}
                  onClick={() => handleSnooze(m)}
                  className="flex-1 py-1 rounded-lg text-[11px] font-medium transition-opacity hover:opacity-80"
                  style={{ backgroundColor: `${onColor}26`, color: onColor, border: `1px solid ${onColor}40` }}
                >
                  {m === 5 ? '۵' : m === 10 ? '۱۰' : '۳۰'} دقیقه بعد
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="no-drag flex items-center gap-1.5 px-2.5 py-2 border-t shrink-0" style={{ borderColor: `${onColor}30` }}>
          <button
            onClick={handleToggleOnTop}
            title={onTop ? 'برگرداندن به سطح دسکتاپ' : 'همیشه روی بقیه پنجره‌ها'}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-opacity hover:opacity-80"
            style={
              onTop
                ? { backgroundColor: onColor, color: accent }
                : { backgroundColor: `${onColor}1f`, color: onColor, border: `1px solid ${onColor}40` }
            }
          >
            {onTop ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
            {onTop ? 'همیشه رو ✓' : 'همیشه رو'}
          </button>
          <button
            onClick={handleOpenDetails}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: `${onColor}1f`, color: onColor, border: `1px solid ${onColor}40` }}
          >
            جزئیات
          </button>
          <button
            onClick={handleClose}
            title="بستن ویجت"
            className="p-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ backgroundColor: `${onColor}1f`, color: onColor, border: `1px solid ${onColor}40` }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

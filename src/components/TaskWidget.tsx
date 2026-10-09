import { useEffect, useRef, useState } from 'react';
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
  CARD_TEXT,
  CARD_TEXT_SHADOW,
} from '../utils';
import type { Task, TaskStatus, Subtask } from '../types';
import { SubtaskRow } from './SubtaskRow';
import { useCardSwap } from '../hooks/useCardSwap';
import { Check, Clock, X, Pin, PinOff, AlignLeft, AlignRight, Plus, Edit2 } from 'lucide-react';

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
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);
  const widgetScale = Math.min(200, Math.max(50, parseInt(settings.widgetScale || '100', 10) || 100));

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

  // Grow/shrink the window itself when widget scale changes so content never clips.
  // Geometry is stored canonical (at 100%); main re-applies it at current scale.
  const prevScaleRef = useRef(widgetScale);
  useEffect(() => {
    const prev = prevScaleRef.current;
    prevScaleRef.current = widgetScale;
    if (prev !== widgetScale && prev > 0) {
      void window.electronAPI.widgetResize(taskId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetScale]);

  // Subtask swap (hook must sit above the early return below)
  const { gridRef: wsubGridRef, indicatorRef: wsubIndicatorRef, dropTargetRef: wsubDropTargetRef, animateSwap: animateWsubSwap, updateDropTarget: updateWsubDropTarget, clearDropIndicator: clearWsubDropIndicator } = useCardSwap();

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

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    await window.electronAPI.addSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
    await window.electronAPI.notifyWidgetChanged(task.id);
    await load();
    refreshCurrentView();
  };

  const handleRemoveSubtask = async (subtaskId: string) => {
    await window.electronAPI.removeSubtask(task.id, subtaskId);
    await window.electronAPI.notifyWidgetChanged(task.id);
    await load();
    refreshCurrentView();
  };

  const handleRenameSubtask = async (subtaskId: string, title: string) => {
    const next = (task.subtasks || []).map(st => st.id === subtaskId ? { ...st, title } : st);
    await window.electronAPI.updateTask(task.id, { subtasks: next });
    await window.electronAPI.notifyWidgetChanged(task.id);
    await load();
    refreshCurrentView();
  };

  // Subtask insertion drag & drop within this widget
  const handleWsubSwap = (draggedId: string) => animateWsubSwap(async () => {
    const t = wsubDropTargetRef.current;
    if (!t) return;
    const arr = [...(task.subtasks || [])];
    const from = arr.findIndex(s => s.id === draggedId);
    let to = arr.findIndex(s => s.id === t.targetId);
    if (from < 0 || to < 0) return;
    const [moved] = arr.splice(from, 1);
    to = arr.findIndex(s => s.id === t.targetId);
    if (!t.before) to += 1;
    arr.splice(to, 0, moved);
    await window.electronAPI.updateTask(task.id, { subtasks: arr });
    await window.electronAPI.notifyWidgetChanged(task.id);
    await load();
    refreshCurrentView();
    clearWsubDropIndicator();
  });

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

  const handleEdit = async () => {
    await window.electronAPI.editTaskInMain(task.id);
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

  const isLtrWidget = (task as any).text_dir === 'ltr';

  const handleToggleDir = async () => {
    await window.electronAPI.updateTask(task.id, { text_dir: isLtrWidget ? null : 'ltr' });
    await window.electronAPI.notifyWidgetChanged(task.id);
    await load();
    refreshCurrentView();
  };

  return (
    <div className="h-full w-full bg-transparent p-1.5 overflow-hidden" dir={isLtrWidget ? 'ltr' : undefined} style={{ zoom: widgetScale / 100 }}>
      <div
        className="h-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: cardGradient(accent, transparency),
          color: CARD_TEXT,
          textShadow: CARD_TEXT_SHADOW,
        }}
      >
        <div className="drag-region flex items-start gap-2 px-2.5 pt-2 pb-1.5 select-none cursor-move shrink-0">
          <button
            onClick={cycleStatus}
            title="تغییر وضعیت"
            className={cn(
              'no-drag mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
              task.status === 'done' ? 'bg-status-done border-status-done text-white' :
              task.status === 'in_progress' ? 'border-status-progress text-status-progress' :
              'border-muted-foreground/60 hover:border-status-todo'
            )}
            style={task.status === 'todo' ? { borderColor: `${onColor}99`, backgroundColor: `${onColor}14` } : undefined}
          >
            {task.status === 'done' && <Check className="w-3 h-3" />}
            {task.status === 'in_progress' && <div className="w-2 h-2 rounded-full bg-status-progress" />}
          </button>
          <span className={cn('font-medium leading-snug line-clamp-2 break-words flex-1', task.status === 'done' && 'line-through opacity-60')} style={{ fontSize: 'var(--font-size-title)', lineHeight: 'var(--text-leading)', WebkitTextStroke: 'var(--stroke-title)' }}>
            {task.title}
          </span>
          <button
            onClick={handleToggleDir}
            title={isLtrWidget ? 'راست‌چین' : 'چپ‌چین'}
            className="no-drag p-1 rounded-md shrink-0 transition-colors hover:bg-black/10"
            style={{ color: onColor }}
          >
            {isLtrWidget ? <AlignLeft className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5 opacity-70" />}
          </button>
          <button
            onClick={handleEdit}
            title="ویرایش در برنامه اصلی"
            className="no-drag p-1 rounded-md shrink-0 transition-colors hover:bg-black/10"
            style={{ color: onColor }}
          >
            <Edit2 className="w-3.5 h-3.5 opacity-70" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 pb-1.5 min-h-0">
          {task.description ? (
            <p
              onClick={() => setDescExpanded(!descExpanded)}
              title={descExpanded ? 'بستن' : 'برای خواندن کامل کلیک کن'}
              className={cn('opacity-75 break-words mb-1 cursor-pointer', descExpanded ? 'max-h-40 overflow-y-auto' : 'line-clamp-2')}
              style={{ fontSize: 'var(--font-size-description)', fontFamily: 'var(--hand-font)', lineHeight: 'var(--text-leading)', WebkitTextStroke: 'var(--stroke-description)' }}
            >
              {task.description}
            </p>
          ) : null}
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
              <div ref={wsubGridRef} data-swap-group={`wsub-${task.id}`} className="relative space-y-1">
                <div
                  ref={wsubIndicatorRef}
                  className="absolute left-0 top-0 h-[2px] rounded-full bg-primary z-40 pointer-events-none"
                  style={{ display: 'none' }}
                />
                {[...(task.subtasks || [])].sort((a, b) => Number(!!a.completed) - Number(!!b.completed)).map((st: Subtask) => (
                  <SubtaskRow
                    key={st.id}
                    subtask={st}
                    groupId={`wsub-${task.id}`}
                    hoverClassName="hover:bg-black/10"
                    accent={accent}
                    onColor={onColor}
                    onToggle={handleToggleSubtask}
                    onRemove={handleRemoveSubtask}
                    onRename={handleRenameSubtask}
                    onDrop={handleWsubSwap}
                    onDragMove={(x, y, id) => updateWsubDropTarget(x, y, id)}
                    onDragEnd={clearWsubDropIndicator}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-1 no-drag">
                <input
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(); }}
                  placeholder="سابتسک جدید..."
                  className="flex-1 min-w-0 text-[11px] px-2 py-1 rounded-lg border focus:outline-none"
                  style={{ backgroundColor: `${onColor}14`, borderColor: `${onColor}30`, color: onColor }}
                />
                <button onClick={handleAddSubtask} title="افزودن سابتسک"
                  className="p-1 rounded-lg transition-opacity hover:opacity-80"
                  style={{ backgroundColor: `${onColor}1f`, color: onColor, border: `1px solid ${onColor}40` }}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
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

import { useState, useRef } from 'react';
import { useStore } from '../store';
import { cn, getToday, getTomorrow, formatTaskDateLocalized, formatReminderLocalized, fallbackAccent, pickOnColor, cardGradient, getTransparency, CARD_TRANSPARENCY_KEY } from '../utils';
import type { Task, TaskStatus, Subtask } from '../types';
import { Check, Clock, Star, ChevronDown, ChevronUp, Edit2, Copy, CheckSquare, Plus, Trash2, X, Calendar, Bell, BellOff, Pin, PinOff, GripVertical } from 'lucide-react';
import { DateInput } from './DateInput';
import { ColorSwatches } from './ColorSwatches';
import { followReminderAfterMove, armReminderIfFuture } from './TaskForm';

interface TaskCardProps {
  task: Task;
  onStatusChange?: (id: string, status: TaskStatus) => void;
  onToggleFavorite?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  showDate?: boolean;
  dateLabel?: string;
  dateLabelColor?: string;
  borderColor?: string;
  hoverBg?: string;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (task: Task) => void;
  reminderAt?: string | null;
  onReminderChanged?: () => void;
  swapGroupId?: string | null;
  onSwapCards?: (aId: string, bId: string) => Promise<void>;
}

export function formatReminderFa(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' });
    const timePart = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  } catch {
    return '';
  }
}

function toLocalInput(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function TaskCard({
  task,
  onStatusChange,
  onToggleFavorite,
  onDelete,
  showDate = false,
  dateLabel,
  dateLabelColor = '',
  borderColor = 'border-border/50',
  hoverBg = 'hover:bg-accent/5',
  selectionMode = false,
  selected = false,
  onToggleSelect,
  reminderAt,
  onReminderChanged,
  swapGroupId,
  onSwapCards,
}: TaskCardProps) {
  const { refreshCurrentView, showToast, setSelectedTask, setShowTaskDetail, settings, setEditingTask, setShowEditTaskForm } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyDate, setCopyDate] = useState('');
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const cycleStatus = () => {
    if (onStatusChange) {
      const next: Record<TaskStatus, TaskStatus> = { todo: 'in_progress', in_progress: 'done', done: 'todo' };
      onStatusChange(task.id, next[task.status]);
    }
  };

  const handleCardClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(task);
      return;
    }
    setExpanded(!expanded);
  };

  const openFullEdit = () => {
    setEditingTask(task);
    setShowEditTaskForm(true);
  };

  const openReminderModal = () => {
    const fromExisting = toLocalInput(reminderAt || (task as any).reminder || null);
    if (fromExisting.date) {
      setReminderDate(fromExisting.date);
      setReminderTime(fromExisting.time);
    } else {
      setReminderDate(task.date || getToday());
      setReminderTime(task.time || '09:00');
    }
    setShowReminderModal(true);
  };

  const handleSaveReminder = async () => {
    if (!reminderDate || !reminderTime) {
      showToast('تاریخ و ساعت هشدار را کامل وارد کنید', 'error');
      return;
    }
    const remindAt = new Date(`${reminderDate}T${reminderTime}:00`).toISOString();
    if (new Date(remindAt).getTime() <= Date.now()) {
      showToast('زمان هشدار باید در آینده باشد', 'error');
      return;
    }
    const res = await window.electronAPI.setReminder(task.id, remindAt);
    setShowReminderModal(false);
    if (res?.success === false) return;
    showToast('یادآوری با موفقیت ثبت شد');
    refreshCurrentView();
    onReminderChanged?.();
  };

  const handleCancelReminder = async () => {
    await window.electronAPI.cancelReminder(task.id);
    setShowReminderModal(false);
    showToast('هشدار لغو شد', 'info');
    refreshCurrentView();
    onReminderChanged?.();
  };

  const handleSnoozeReminder = async (minutes: number) => {
    await window.electronAPI.snoozeReminder(task.id, minutes);
    const labels: Record<number, string> = { 5: '۵', 10: '۱۰', 30: '۳۰' };
    showToast(`⏳ ${labels[minutes] || minutes} دقیقه بعد دوباره یادآوری می‌شود`, 'info');
    refreshCurrentView();
    onReminderChanged?.();
  };

  const handleTogglePin = async () => {
    const pinned = (task as any).pinned ? 0 : 1;
    await window.electronAPI.updateTask(task.id, { pinned });
    if (pinned) await window.electronAPI.widgetOpen(task.id);
    else await window.electronAPI.widgetClose(task.id);
    showToast(pinned ? 'ویجت دسکتاپ باز شد' : 'ویجت دسکتاپ بسته شد', 'info');
    refreshCurrentView();
    onReminderChanged?.();
  };

  // Swap drag & drop (exchange places with another card in the same group)
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragInfo = useRef<{ startX: number; startY: number; active: boolean } | null>(null);

  const clearSwapTarget = () => {
    document.querySelectorAll('.swap-target').forEach(el => el.classList.remove('swap-target'));
  };

  const handleSwapPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (selectionMode || !onSwapCards || !swapGroupId) return;
    e.stopPropagation();
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    dragInfo.current = { startX: e.clientX, startY: e.clientY, active: false };
  };

  const handleSwapPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const info = dragInfo.current;
    if (!info) return;
    const dx = e.clientX - info.startX;
    const dy = e.clientY - info.startY;
    if (!info.active) {
      if (Math.hypot(dx, dy) < 7) return;
      info.active = true;
      setDragging(true);
    }
    setDragOffset({ x: dx, y: dy });
    clearSwapTarget();
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const cardEl = under?.closest?.('[data-swap-id]') as HTMLElement | null;
    const groupEl = under?.closest?.('[data-swap-group]') as HTMLElement | null;
    if (cardEl && groupEl && groupEl.getAttribute('data-swap-group') === swapGroupId) {
      const targetId = cardEl.getAttribute('data-swap-id');
      if (targetId && targetId !== task.id) cardEl.classList.add('swap-target');
    }
  };

  const handleSwapEnd = (allowDrop: boolean) => {
    const info = dragInfo.current;
    dragInfo.current = null;
    if (!info) return;
    const target = document.querySelector('.swap-target') as HTMLElement | null;
    const targetId = target?.getAttribute('data-swap-id');
    clearSwapTarget();
    setDragging(false);
    setDragOffset({ x: 0, y: 0 });
    if (allowDrop && info.active && targetId && targetId !== task.id && onSwapCards) {
      void onSwapCards(task.id, targetId);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (task.linked_id) {
      await window.electronAPI.toggleSubtask(task.id, subtaskId);
      refreshCurrentView();
    } else {
      const updated = (task.subtasks || []).map((st: Subtask) =>
        st.id === subtaskId ? { ...st, completed: !st.completed } : st
      );
      await window.electronAPI.updateTask(task.id, { subtasks: updated });
      refreshCurrentView();
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    await window.electronAPI.addSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
    setShowAddSubtask(false);
    refreshCurrentView();
  };

  const handleRemoveSubtask = async (subtaskId: string) => {
    await window.electronAPI.removeSubtask(task.id, subtaskId);
    refreshCurrentView();
  };

  const handlePickColor = async (color: string) => {
    await window.electronAPI.updateTask(task.id, { color: color || null });
    setShowColorPicker(false);
    refreshCurrentView();
    showToast('رنگ کارت تنظیم شد');
  };

  const handleMoveToDate = async (date: string | null) => {
    await window.electronAPI.moveTaskToDate(task.id, date);
    await followReminderAfterMove(task, date);
    setShowDatePicker(false);
    refreshCurrentView();
    showToast(date ? 'تاریخ تعیین شد' : 'تاریخ حذف شد');
  };

  const handleCopyLinked = async () => {
    if (!copyDate) {
      showToast('تاریخ مقصد را انتخاب کنید', 'error');
      return;
    }
    const created: any = await window.electronAPI.copyLinkedTask(task.id, copyDate);
    if (created?.id) {
      await armReminderIfFuture(created.id, created.date, created.time, created.reminder_offset || 0);
    }
    setShowCopyModal(false);
    setCopyDate('');
    refreshCurrentView();
    showToast('تسک لینک‌شده کپی شد');
  };

  const subtaskProgress = task.subtasks && task.subtasks.length > 0
    ? Math.round((task.subtasks.filter((s: Subtask) => s.completed).length / task.subtasks.length) * 100)
    : 0;

  const effectiveReminder = reminderAt ?? (task as any).reminder ?? null;
  const reminderLabel = formatReminderLocalized(effectiveReminder, settings.calendarType);
  const reminderOverdue = !!effectiveReminder &&
    task.status !== 'done' &&
    new Date(effectiveReminder).getTime() <= Date.now();
  const isNative = typeof (window as any).Capacitor !== 'undefined' && !!(window as any).Capacitor.isNativePlatform?.();
  const isPinned = !!(task as any).pinned;
  const hasStrip = !!task.subtasks && task.subtasks.length > 0;
  const accent = task.color || fallbackAccent(task.id);
  const onColor = pickOnColor(accent);
  const cardT = getTransparency(settings, CARD_TRANSPARENCY_KEY, 0);
  const displayDateLabel = dateLabel && /^\d{4}-\d{2}-\d{2}$/.test(dateLabel)
    ? formatTaskDateLocalized(dateLabel, settings.calendarType)
    : dateLabel;

  return (
    <div
      ref={cardRef}
      data-swap-id={swapGroupId ? task.id : undefined}
      style={dragging ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` } : undefined}
      className={cn('flex flex-col transition-all duration-200',
      !expanded && !selectionMode && 'hover:-translate-y-0.5 hover:rotate-[-0.4deg]',
      dragging && 'relative z-50 scale-[1.04] rotate-[1.5deg] pointer-events-none transition-none')} >
    <div
      className={cn(
        'relative rounded-t-2xl bg-card transition-all duration-200 group flex flex-col min-h-[150px]',
        hasStrip ? 'rounded-b-none' : 'rounded-b-2xl',
        'shadow-[0_2px_10px_-5px_rgba(0,0,0,0.18)]',
        borderColor,
        task.status === 'done' && 'opacity-60',
        expanded && !selectionMode && 'ring-1 ring-primary/30',
        selected && 'ring-2 ring-primary',
        !expanded && !selectionMode &&
          'hover:shadow-[0_10px_24px_-8px_rgba(0,0,0,0.28)]'
      )}
      style={{
        background: cardGradient(accent, cardT),
        color: onColor,
      }}
    >
      {effectiveReminder && (
        <span className="pointer-events-none absolute -top-2 -left-2 z-20 animate-badge-pop">
          <span className="flex w-7 h-7 items-center justify-center rounded-full border-2 border-background bg-amber-500 text-white shadow-[0_4px_12px_rgba(245,158,11,0.5)]">
            <Clock className="w-3.5 h-3.5" />
          </span>
        </span>
      )}
      {isPinned && (
        <span className="pointer-events-none absolute -top-2 -right-2 z-20 animate-badge-pop" title="ویجت دسکتاپ فعال است">
          <span className="flex w-7 h-7 items-center justify-center rounded-full border-2 border-background shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
            style={{ backgroundColor: onColor, color: accent }}>
            <Pin className="w-3.5 h-3.5" />
          </span>
        </span>
      )}
      <div
        className={cn('flex items-stretch gap-2.5 p-3 cursor-pointer', hoverBg)}
        onClick={handleCardClick}
      >
        {selectionMode ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(task); }}
            className={cn(
              'mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
              selected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 hover:border-primary'
            )}
          >
            {selected && <Check className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); cycleStatus(); }}
            className={cn(
              'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200',
              task.status === 'done' ? 'bg-status-done border-status-done text-white' :
              task.status === 'in_progress' ? 'border-status-progress text-status-progress' :
              'border-muted-foreground/30 hover:border-status-todo'
            )}
          >
            {task.status === 'done' && <Check className="w-3 h-3" />}
            {task.status === 'in_progress' && <div className="w-2 h-2 rounded-full bg-status-progress" />}
          </button>
        )}

        <div className="flex flex-1 min-w-0 flex-col">
          <div className={cn('text-sm font-medium leading-snug line-clamp-3 break-words', task.status === 'done' && 'line-through opacity-60')} title={task.title}>
            {task.title}
          </div>
              <div className="flex items-center gap-2 flex-wrap mt-auto pt-2">
                {showDate && displayDateLabel && (
                  <span className={cn('text-xs sm:text-[11px] flex items-center gap-1', !dateLabelColor && 'opacity-75', dateLabelColor)}>
                    <Calendar className="w-3 h-3" /> {displayDateLabel}
                  </span>
                )}
                {task.time && (
                  <span className="text-xs sm:text-[11px] opacity-75 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {task.time}
                  </span>
                )}
                {effectiveReminder && (
                  <span className="text-xs sm:text-[11px] font-medium flex items-center gap-0.5">
                    <Bell className="w-3 h-3" /> {reminderLabel}
                  </span>
                )}
                {task.linked_id && (
                  <span className="text-xs sm:text-[11px] opacity-75 flex items-center gap-0.5"><Copy className="w-3 h-3" /> لینک‌شده</span>
                )}
                {task.subtasks && task.subtasks.length > 0 && (
                  <span className="text-xs sm:text-[11px] opacity-75 flex items-center gap-0.5">
                    <CheckSquare className="w-3 h-3" />
                    {task.subtasks.filter((s: Subtask) => s.completed).length}/{task.subtasks.length}
                  </span>
                )}
              </div>
        </div>

        <div className="flex items-start gap-1 shrink-0">
          {onSwapCards && swapGroupId && !selectionMode && (
            <button
              onPointerDown={handleSwapPointerDown}
              onPointerMove={handleSwapPointerMove}
              onPointerUp={() => handleSwapEnd(true)}
              onPointerCancel={() => handleSwapEnd(false)}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.preventDefault()}
              title="جابه‌جایی (درگ)"
              className="touch-none select-none cursor-grab active:cursor-grabbing opacity-60 p-1 rounded hover:bg-muted transition-all [@media(hover:hover)]:opacity-0 group-hover:opacity-100"
            >
              <GripVertical className="w-3.5 h-3.5 opacity-70" />
            </button>
          )}
          {!selectionMode && (
            <button onClick={(e) => { e.stopPropagation(); openFullEdit(); }} title="ویرایش کامل"
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
              <Edit2 className="w-3 h-3 opacity-60" />
            </button>
          )}
          {onToggleFavorite && !selectionMode && (
            <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(task); }}
              className={cn('transition-all', task.favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
              <Star className={cn('w-3.5 h-3.5', task.favorite ? 'fill-yellow-500 text-yellow-500' : 'opacity-50')} />
            </button>
          )}
          {expanded && !selectionMode ? <ChevronUp className="w-4 h-4 opacity-60" /> : !selectionMode ? <ChevronDown className="w-4 h-4 opacity-60" /> : null}
        </div>
      </div>

      {expanded && !selectionMode && (
        <div className="px-3 pb-3 border-t border-border/30 animate-slide-up">
          {task.subtasks && task.subtasks.length > 0 && (
            <div className="mt-2 mb-2">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                <div className="h-full bg-status-done rounded-full transition-all duration-300" style={{ width: `${subtaskProgress}%` }} />
              </div>
              <div className="space-y-1">
                {task.subtasks.map((subtask: Subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors group/sub">
                    <button onClick={(e) => { e.stopPropagation(); handleToggleSubtask(subtask.id); }} className="shrink-0">
                      <div className={cn('w-4 h-4 rounded border flex items-center justify-center transition-all',
                        subtask.completed ? 'bg-status-done border-status-done text-white' : 'border-muted-foreground/30 hover:border-status-done')}>
                        {subtask.completed && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </button>
                    <span className={cn('text-xs flex-1', subtask.completed && 'line-through opacity-60')}>
                      {subtask.title}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); handleRemoveSubtask(subtask.id); }}
                      className="opacity-0 group-hover/sub:opacity-100 p-0.5 rounded hover:bg-destructive/10 transition-all">
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showAddSubtask ? (
            <div className="flex items-center gap-2 mb-2 px-1" onClick={(e) => e.stopPropagation()}>
              <input autoFocus value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="عنوان سابتسک..."
                className="flex-1 text-xs bg-muted text-foreground border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') { setShowAddSubtask(false); setNewSubtaskTitle(''); } }} />
              <button onClick={handleAddSubtask} className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => { setShowAddSubtask(false); setNewSubtaskTitle(''); }} className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setShowAddSubtask(true); }}
              className="flex items-center gap-1.5 text-xs opacity-65 hover:opacity-100 transition-opacity mb-2 px-1">
              <Plus className="w-3 h-3" /> افزودن سابتسک
            </button>
          )}

          {showColorPicker && (
            <div className="flex items-center gap-2 mb-2 px-1 pt-2 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
              <ColorSwatches value={task.color || ''} onPick={handlePickColor} />
            </div>
          )}

          {reminderOverdue && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2 mt-1 border-t border-amber-500/30" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs sm:text-[11px] text-amber-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> یادآوری عقب افتاد:
              </span>
              {[5, 10, 30].map(m => (
                <button
                  key={m}
                  onClick={() => handleSnoozeReminder(m)}
                  className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs sm:text-[11px] text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  {m === 5 ? '۵' : m === 10 ? '۱۰' : '۳۰'} دقیقه بعد
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/30">
            <QuickBtn label="امروز" onClick={() => handleMoveToDate(getToday())} />
            <QuickBtn label="فردا" onClick={() => handleMoveToDate(getTomorrow())} />
            <QuickBtn label="بدون تاریخ" onClick={() => handleMoveToDate(null as any)} />
            <QuickBtn label="تاریخ دلخواه" onClick={() => setShowDatePicker(true)} />
            <QuickBtn label="کپی لینک‌شده" onClick={() => setShowCopyModal(true)} />
            <QuickBtn label={effectiveReminder ? 'تغییر هشدار' : 'هشدار'} onClick={openReminderModal} variant={effectiveReminder ? 'primary' : undefined} onColor={onColor} accent={accent} />
            <QuickBtn label="رنگ کارت" onClick={() => setShowColorPicker(!showColorPicker)} />
            {!isNative && (
              <QuickBtn label={isPinned ? 'بستن ویجت' : 'ویجت دسکتاپ'} onClick={handleTogglePin} variant={isPinned ? 'primary' : undefined} onColor={onColor} accent={accent} />
            )}
            <QuickBtn label="جزئیات" onClick={() => { setSelectedTask(task); setShowTaskDetail(true); }} variant="primary" onColor={onColor} accent={accent} />
            {onDelete && (
              <QuickBtn label="حذف" onClick={() => onDelete(task)} variant="danger" onColor={onColor} accent={accent} />
            )}

            {showDatePicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card text-foreground border-2 border-border rounded-xl shadow-2xl p-4 animate-scale-in w-72">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">انتخاب تاریخ</span>
                    <button onClick={() => setShowDatePicker(false)} className="p-1 rounded hover:bg-muted">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mb-3">
                    <DateInput value={newDate} onChange={setNewDate} />
                  </div>
                  <button onClick={() => { if (newDate) handleMoveToDate(newDate); }}
                    className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                    انتقال به این تاریخ
                  </button>
                </div>
              </>
            )}

            {showCopyModal && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCopyModal(false)} />
                <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card text-foreground border-2 border-border rounded-xl shadow-2xl p-4 animate-scale-in w-72">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">کپی لینک‌شده به تاریخ</span>
                    <button onClick={() => setShowCopyModal(false)} className="p-1 rounded hover:bg-muted">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">سابتسک‌ها بین هر دو تاریخ سینک می‌شوند</p>
                  <div className="mb-3">
                    <DateInput value={copyDate} onChange={setCopyDate} />
                  </div>
                  <button onClick={handleCopyLinked}
                    className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                    کپی و لینک
                  </button>
                </div>
              </>
            )}

            {showReminderModal && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowReminderModal(false)} />
                <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card text-foreground border-2 border-border rounded-xl shadow-2xl p-4 animate-scale-in w-72">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">هشدار تسک</span>
                    <button onClick={() => setShowReminderModal(false)} className="p-1 rounded hover:bg-muted">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">در تاریخ و ساعت مشخص، اعلان نمایش داده می‌شود</p>
                  {effectiveReminder && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 rounded-lg px-2 py-1.5 mb-3">
                      <Bell className="w-3.5 h-3.5" />
                      <span>هشدار فعلی: {reminderLabel}</span>
                    </div>
                  )}
                  <label className="text-xs text-muted-foreground block mb-1">تاریخ هشدار</label>
                  <div className="mb-2">
                    <DateInput value={reminderDate} onChange={setReminderDate} />
                  </div>
                  <label className="text-xs text-muted-foreground block mb-1">ساعت هشدار</label>
                  <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring" />
                  <button onClick={handleSaveReminder}
                    className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 mb-2">
                    تنظیم هشدار
                  </button>
                  {effectiveReminder && (
                    <button onClick={handleCancelReminder}
                      className="w-full py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80 flex items-center justify-center gap-1.5">
                      <BellOff className="w-3.5 h-3.5" /> لغو هشدار
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
      {hasStrip && (
        <div
          className="flex gap-[3px] h-3.5 overflow-hidden"
          style={{ backgroundColor: `${accent}33` }}
          aria-hidden="true"
        >
          {task.subtasks.map((st: Subtask) => (
            <div key={st.id} className="relative flex-1 min-w-[3px]">
              <div
                className="absolute inset-0 border border-dashed"
                style={{ borderColor: `${onColor}59` }}
              />
              <div
                className="absolute inset-0 transition-all duration-300 ease-out"
                style={{ background: st.completed ? 'hsl(var(--background))' : cardGradient(accent, cardT) }}
              />
              <div
                className={cn('absolute inset-0 transition-opacity duration-300 pointer-events-none', st.completed && 'opacity-0')}
                style={{ background: `repeating-linear-gradient(45deg, transparent 0px, transparent 3px, ${onColor}14 3px, ${onColor}14 4px)` }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickBtn({ label, onClick, variant, onColor, accent }: { label: string; onClick: () => void; variant?: 'primary' | 'danger' | 'info'; onColor?: string; accent?: string }) {
  // On colored cards, theme-tinted chips (primary/danger) can clash with the
  // card gradient. Solid onColor chips guarantee contrast on any card color:
  // primary text reuses the card accent, danger keeps red readable on the chip.
  if (onColor && accent && (variant === 'primary' || variant === 'danger')) {
    const fg = variant === 'primary' ? accent : (onColor === '#ffffff' ? '#dc2626' : '#f87171');
    return (
      <button onClick={(e) => { e.stopPropagation(); onClick(); }}
        style={{ backgroundColor: onColor, color: fg }}
        className="px-2.5 py-1 rounded-lg text-xs sm:text-[11px] font-medium transition-opacity hover:opacity-80">
        {label}
      </button>
    );
  }
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'px-2.5 py-1 rounded-lg text-xs sm:text-[11px] font-medium transition-colors',
        variant === 'primary' ? 'bg-primary/15 text-primary hover:bg-primary/25' :
        variant === 'danger' ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' :
        variant === 'info' ? 'bg-primary/10 text-primary hover:bg-primary/20' :
        'bg-muted text-muted-foreground hover:bg-muted/80'
      )}>
      {label}
    </button>
  );
}

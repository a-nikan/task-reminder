import { useState } from 'react';
import { useStore } from '../store';
import { cn, getToday, getTomorrow, formatTaskDateLocalized, formatReminderLocalized } from '../utils';
import type { Task, TaskStatus, Subtask } from '../types';
import { Check, Clock, Star, ChevronDown, ChevronUp, Edit2, Copy, CheckSquare, Plus, Trash2, X, Calendar, Bell, BellOff } from 'lucide-react';
import { DateInput } from './DateInput';

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
  dateLabelColor = 'text-muted-foreground',
  borderColor = 'border-border/50',
  hoverBg = 'hover:bg-accent/5',
  selectionMode = false,
  selected = false,
  onToggleSelect,
  reminderAt,
  onReminderChanged,
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

  const handleMoveToDate = async (date: string | null) => {
    await window.electronAPI.moveTaskToDate(task.id, date);
    setShowDatePicker(false);
    refreshCurrentView();
    showToast(date ? 'تاریخ تعیین شد' : 'تاریخ حذف شد');
  };

  const handleCopyLinked = async () => {
    if (!copyDate) {
      showToast('تاریخ مقصد را انتخاب کنید', 'error');
      return;
    }
    await window.electronAPI.copyLinkedTask(task.id, copyDate);
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
  const displayDateLabel = dateLabel && /^\d{4}-\d{2}-\d{2}$/.test(dateLabel)
    ? formatTaskDateLocalized(dateLabel, settings.calendarType)
    : dateLabel;

  return (
    <div className={cn(
      'rounded-xl border bg-card transition-all duration-200 group',
      borderColor,
      task.status === 'done' && 'opacity-60',
      expanded && !selectionMode && 'ring-1 ring-primary/30',
      selected && 'ring-2 ring-primary border-primary'
    )}>
      <div
        className={cn('flex items-start gap-3 p-3 cursor-pointer', hoverBg)}
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

        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-medium', task.status === 'done' && 'line-through text-muted-foreground')}>
            {task.title}
          </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {showDate && displayDateLabel && (
                  <span className={cn('text-[11px] flex items-center gap-1', dateLabelColor)}>
                    <Calendar className="w-3 h-3" /> {displayDateLabel}
                  </span>
                )}
                {task.time && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {task.time}
                  </span>
                )}
                {effectiveReminder && (
                  <span className="text-[11px] text-amber-500 flex items-center gap-0.5">
                    <Bell className="w-3 h-3" /> {reminderLabel}
                  </span>
                )}
                {task.linked_id && (
                  <span className="text-[11px] text-primary/70 flex items-center gap-0.5"><Copy className="w-3 h-3" /> لینک‌شده</span>
                )}
                {task.subtasks && task.subtasks.length > 0 && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                    <CheckSquare className="w-3 h-3" />
                    {task.subtasks.filter((s: Subtask) => s.completed).length}/{task.subtasks.length}
                  </span>
                )}
              </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!selectionMode && (
            <button onClick={(e) => { e.stopPropagation(); openFullEdit(); }} title="ویرایش کامل"
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all">
              <Edit2 className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
          {onToggleFavorite && !selectionMode && (
            <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(task); }}
              className={cn('transition-all', task.favorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
              <Star className={cn('w-3.5 h-3.5', task.favorite ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/50')} />
            </button>
          )}
          {expanded && !selectionMode ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : !selectionMode ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : null}
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
                    <span className={cn('text-xs flex-1', subtask.completed && 'line-through text-muted-foreground')}>
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
                className="flex-1 text-xs bg-muted border border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
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
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 px-1">
              <Plus className="w-3 h-3" /> افزودن سابتسک
            </button>
          )}

          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/30">
            <QuickBtn label="امروز" onClick={() => handleMoveToDate(getToday())} />
            <QuickBtn label="فردا" onClick={() => handleMoveToDate(getTomorrow())} />
            <QuickBtn label="بدون تاریخ" onClick={() => handleMoveToDate(null as any)} />
            <QuickBtn label="تاریخ دلخواه" onClick={() => setShowDatePicker(true)} />
            <QuickBtn label="کپی لینک‌شده" onClick={() => setShowCopyModal(true)} />
            <QuickBtn label={effectiveReminder ? 'تغییر هشدار' : 'هشدار'} onClick={openReminderModal} variant={effectiveReminder ? 'primary' : undefined} />
            <QuickBtn label="جزئیات" onClick={() => { setSelectedTask(task); setShowTaskDetail(true); }} variant="primary" />
            {onDelete && (
              <QuickBtn label="حذف" onClick={() => onDelete(task)} variant="danger" />
            )}

            {showDatePicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border-2 border-border rounded-xl shadow-2xl p-4 animate-scale-in w-72">
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
                <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border-2 border-border rounded-xl shadow-2xl p-4 animate-scale-in w-72">
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
                <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border-2 border-border rounded-xl shadow-2xl p-4 animate-scale-in w-72">
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
  );
}

function QuickBtn({ label, onClick, variant }: { label: string; onClick: () => void; variant?: 'primary' | 'danger' | 'info' }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors',
        variant === 'primary' ? 'bg-primary/15 text-primary hover:bg-primary/25' :
        variant === 'danger' ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' :
        variant === 'info' ? 'bg-primary/10 text-primary hover:bg-primary/20' :
        'bg-muted text-muted-foreground hover:bg-muted/80'
      )}>
      {label}
    </button>
  );
}

import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { cn, getStatusLabel, getPriorityLabel, getPriorityColor, getStatusBgColor, RECURRENCE_OPTIONS, REMINDER_OPTIONS, getToday, getTomorrow, formatTaskDateLocalized, formatReminderLocalized } from '../utils';
import type { Task, TaskStatus, Subtask } from '../types';
import { X, Check, Clock, Folder, Bell, Trash2, Archive, Star, Edit2, Link, Copy, Plus, CheckSquare, Tag, Repeat } from 'lucide-react';
import { DateInput } from './DateInput';
import { ColorSwatches } from './ColorSwatches';
import { followReminderAfterMove, armReminderIfFuture } from './TaskForm';

export function TaskDetailPanel() {
  const { selectedTask, setShowTaskDetail, setSelectedTask, setEditingTask, setShowEditTaskForm, categories, refreshCurrentView, showToast, pushUndo, settings, showConfirm } = useStore();
  const [task, setTask] = useState<Task | null>(selectedTask);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyDate, setCopyDate] = useState(getTomorrow());
  const [linkedTasks, setLinkedTasks] = useState<Task[]>([]);
  const [activeReminder, setActiveReminder] = useState<any>(null);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [showReminderEditor, setShowReminderEditor] = useState(false);

  useEffect(() => {
    if (selectedTask) {
      setTask(selectedTask);
      setSubtasks(selectedTask.subtasks || []);

      if (selectedTask.linked_id) {
        window.electronAPI.getLinkedTasks(selectedTask.linked_id).then(setLinkedTasks);
      } else {
        setLinkedTasks([]);
      }

      window.electronAPI.getReminder(selectedTask.id).then((r: any) => {
        setActiveReminder(r);
        if (r?.remind_at) {
          const d = new Date(r.snoozed_until || r.remind_at);
          const pad = (n: number) => String(n).padStart(2, '0');
          if (!isNaN(d.getTime())) {
            setReminderDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
            setReminderTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
          }
        } else {
          setReminderDate(selectedTask.date || getToday());
          setReminderTime(selectedTask.time || '09:00');
        }
      });
    }
  }, [selectedTask]);

  if (!task) return null;

  const tags: string[] = typeof task.tags === 'string' ? JSON.parse((task.tags as any) || '[]') : (task.tags || []);

  const handleClose = () => {
    setShowTaskDetail(false);
    setSelectedTask(null);
  };

  const reloadAll = () => {
    refreshCurrentView();
  };

  const refreshTask = async () => {
    const updated = await window.electronAPI.getTaskById(task.id);
    if (updated) {
      setTask(updated);
      setSelectedTask(updated);
      setSubtasks(updated.subtasks || []);
      if (updated.linked_id) {
        const linked = await window.electronAPI.getLinkedTasks(updated.linked_id);
        setLinkedTasks(linked);
      }
    }
    reloadAll();
  };

  const openFullEdit = () => {
    setEditingTask(task);
    setShowEditTaskForm(true);
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    await window.electronAPI.changeTaskStatus(task.id, newStatus);
    await refreshTask();
  };

  const handleMoveToDate = async (newDate: string | null) => {
    await window.electronAPI.moveTaskToDate(task.id, newDate);
    await followReminderAfterMove(task, newDate);
    await refreshTask();
  };

  const handleToggleFavorite = async () => {
    await window.electronAPI.updateTask(task.id, { favorite: !task.favorite });
    await refreshTask();
  };

  const handlePickColor = async (color: string) => {
    await window.electronAPI.updateTask(task.id, { color: color || null });
    await refreshTask();
    showToast('رنگ کارت تنظیم شد');
  };

  const handleArchive = async () => {
    pushUndo(task, 'archive');
    await window.electronAPI.archiveTask(task.id);
    handleClose();
    showToast('بایگانی شد', 'info', true);
    reloadAll();
  };

  const handleDelete = () => {
    showConfirm({
      title: 'حذف تسک',
      message: `تسک «${task.title}» حذف شود؟`,
      onConfirm: async () => {
        pushUndo(task, 'delete');
        await window.electronAPI.deleteTask(task.id);
        handleClose();
        showToast('حذف شد', 'error', true);
        reloadAll();
      },
    });
  };

  // Subtasks persist immediately
  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    const updated = await window.electronAPI.addSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
    if (updated) {
      setTask(updated);
      setSelectedTask(updated);
      setSubtasks(updated.subtasks || []);
      if (updated.linked_id) {
        const linked = await window.electronAPI.getLinkedTasks(updated.linked_id);
        setLinkedTasks(linked);
      }
    }
    reloadAll();
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    let updated;
    if (task.linked_id) {
      updated = await window.electronAPI.toggleSubtask(task.id, subtaskId);
    } else {
      const next = subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st);
      updated = await window.electronAPI.updateTask(task.id, { subtasks: next });
    }
    if (updated) {
      setTask(updated);
      setSelectedTask(updated);
      setSubtasks(updated.subtasks || []);
    }
    reloadAll();
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    const updated = await window.electronAPI.removeSubtask(task.id, subtaskId);
    if (updated) {
      setTask(updated);
      setSelectedTask(updated);
      setSubtasks(updated.subtasks || []);
    }
    reloadAll();
  };

  const handleCopyLinked = async () => {
    if (!copyDate) return;
    const created: any = await window.electronAPI.copyLinkedTask(task.id, copyDate);
    if (created?.id) {
      await armReminderIfFuture(created.id, created.date, created.time, created.reminder_offset || 0);
    }
    showToast('تسک کپی شد و لینک شد');
    setShowCopyModal(false);
    await refreshTask();
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
    if (res?.success === false) {
      setShowReminderEditor(false);
      return;
    }
    const r = await window.electronAPI.getReminder(task.id);
    setActiveReminder(r);
    setShowReminderEditor(false);
    showToast('یادآوری با موفقیت ثبت شد');
    reloadAll();
  };

  const handleCancelReminder = async () => {
    await window.electronAPI.cancelReminder(task.id);
    setActiveReminder(null);
    setShowReminderEditor(false);
    showToast('هشدار لغو شد', 'info');
    reloadAll();
  };

  const subtaskProgress = subtasks.length > 0
    ? Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-40 bg-card overflow-y-auto animate-slide-in lg:static lg:z-auto lg:h-full lg:w-80 lg:shrink-0 lg:border-l lg:border-border">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground">جزئیات تسک</h2>
          <div className="flex items-center gap-1">
            <button onClick={openFullEdit} title="ویرایش کامل" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mb-4">
          <h1 className="text-lg font-bold">{task.title}</h1>
        </div>

        {task.linked_id && (
          <div className="mb-3 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/10 text-primary text-xs">
            <Link className="w-3.5 h-3.5" />
            <span>لینک‌شده با {linkedTasks.length} تسک دیگر</span>
          </div>
        )}

        <div className="space-y-3 mb-4">
          <DetailRow label="وضعیت">
            <div className="flex gap-1.5">
              {(['todo', 'in_progress', 'done'] as TaskStatus[]).map(s => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  className={cn('px-2 py-1 rounded-md text-xs font-medium transition-colors',
                    task.status === s ? getStatusBgColor(s) + ' text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}>
                  {getStatusLabel(s)}
                </button>
              ))}
            </div>
          </DetailRow>

          <DetailRow label="اولویت">
            <span className={cn('text-sm font-medium', getPriorityColor(task.priority))}>{getPriorityLabel(task.priority)}</span>
          </DetailRow>

          <DetailRow label="تاریخ">
            <span className="text-sm">{task.date ? formatTaskDateLocalized(task.date, settings.calendarType) : 'بدون تاریخ'}</span>
          </DetailRow>

          <DetailRow label="ساعت">
            <span className="text-sm flex items-center gap-1"><Clock className="w-3 h-3" />{task.time || '—'}</span>
          </DetailRow>

          <DetailRow label="دسته‌بندی">
            <span className="text-sm flex items-center gap-1"><Folder className="w-3 h-3" />{categories.find(c => c.id === task.category_id)?.name || '—'}</span>
          </DetailRow>

          <DetailRow label="رنگ کارت">
            <ColorSwatches value={task.color || ''} onPick={handlePickColor} />
          </DetailRow>

          <DetailRow label="تگ‌ها">
            <div className="flex flex-wrap gap-1">
              {tags.length === 0 && <span className="text-sm">—</span>}
              {tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5" />#{tag}
                </span>
              ))}
            </div>
          </DetailRow>

          <DetailRow label="تکرار">
            <span className="text-sm flex items-center gap-1"><Repeat className="w-3 h-3" />{RECURRENCE_OPTIONS.find(r => r.value === task.recurrence)?.label || 'بدون تکرار'}</span>
          </DetailRow>

          <DetailRow label="یادآوری">
            <span className="text-sm flex items-center gap-1"><Bell className="w-3 h-3" />{REMINDER_OPTIONS.find(r => r.value === task.reminder_offset)?.label || 'بدون یادآوری'}</span>
          </DetailRow>
        </div>

        {task.description ? (
          <div className="mb-4 p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
          </div>
        ) : null}

        {/* Reminder */}
        <div className="mb-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              هشدار دقیق (تاریخ + ساعت)
            </span>
            {!showReminderEditor && (
              <button onClick={() => setShowReminderEditor(true)} className="text-[11px] text-primary hover:underline">
                {activeReminder ? 'تغییر' : 'تنظیم'}
              </button>
            )}
          </div>
          {activeReminder && !showReminderEditor ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-500">
                {formatReminderLocalized(activeReminder.snoozed_until || activeReminder.remind_at, settings.calendarType)}
              </span>
              <button onClick={handleCancelReminder} className="text-[11px] text-destructive hover:underline">لغو</button>
            </div>
          ) : showReminderEditor ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <DateInput value={reminderDate} onChange={setReminderDate} />
                </div>
                <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="px-2 py-1.5 rounded-lg bg-background border border-border text-xs focus:outline-none" />
              </div>
              <div className="flex gap-1.5">
                <button onClick={handleSaveReminder} className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90">ذخیره هشدار</button>
                <button onClick={() => setShowReminderEditor(false)} className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs">بستن</button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">هشداری تنظیم نشده — در زمان مشخص اعلان می‌گیری</p>
          )}
        </div>

        {/* Subtasks Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">سابتسک‌ها</span>
              {subtasks.length > 0 && (
                <span className="text-xs text-muted-foreground">({subtasks.filter(s => s.completed).length}/{subtasks.length})</span>
              )}
            </div>
          </div>

          {subtasks.length > 0 && (
            <div className="mb-2">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-status-done rounded-full transition-all duration-300" style={{ width: `${subtaskProgress}%` }} />
              </div>
            </div>
          )}

          <div className="space-y-1">
            {subtasks.map(subtask => (
              <div key={subtask.id} className="group flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                <button
                  onClick={() => handleToggleSubtask(subtask.id)}
                  className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all',
                    subtask.completed ? 'bg-status-done border-status-done text-white' : 'border-muted-foreground/30 hover:border-status-done'
                  )}
                >
                  {subtask.completed && <Check className="w-2.5 h-2.5" />}
                </button>
                <span className={cn('flex-1 text-sm', subtask.completed && 'line-through text-muted-foreground')}>
                  {subtask.title}
                </span>
                <button
                  onClick={() => handleDeleteSubtask(subtask.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 transition-all"
                >
                  <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-1 mt-2">
            <input
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
              placeholder="سابتسک جدید..."
              className="flex-1 px-2 py-1 rounded-lg bg-muted border border-border text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button onClick={handleAddSubtask} className="px-2 py-1 rounded-lg bg-primary text-primary-foreground text-xs hover:opacity-90 transition-opacity">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground mb-2">عملیات سریع</h3>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction label="ویرایش کامل" onClick={openFullEdit} icon={<Edit2 className="w-3.5 h-3.5" />} />
            <QuickAction label={task.favorite ? 'عدم مهم' : 'مهم'} onClick={handleToggleFavorite} icon={<Star className={cn('w-3.5 h-3.5', task.favorite && 'fill-yellow-500 text-yellow-500')} />} />
            <QuickAction label="امروز" onClick={() => handleMoveToDate(getToday())} />
            <QuickAction label="فردا" onClick={() => handleMoveToDate(getTomorrow())} />
            <QuickAction label="بدون تاریخ" onClick={() => handleMoveToDate(null)} />
            <QuickAction label="کپی لینک‌شده" onClick={() => setShowCopyModal(true)} icon={<Copy className="w-3.5 h-3.5" />} />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border flex gap-2">
          <button onClick={handleArchive} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs hover:bg-muted/80 transition-colors">
            <Archive className="w-3.5 h-3.5" />بایگانی
          </button>
          <button onClick={handleDelete} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs hover:bg-destructive/20 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />حذف
          </button>
        </div>

        <div className="mt-4 text-[10px] text-muted-foreground/50 space-y-0.5">
          <div>ایجاد شده: {new Date(task.created_at).toLocaleDateString('fa-IR')}</div>
          <div>به‌روزرسانی: {new Date(task.updated_at).toLocaleDateString('fa-IR')}</div>
          {task.completed_at && <div>تکمیل شده: {new Date(task.completed_at).toLocaleDateString('fa-IR')}</div>}
        </div>
      </div>

      {/* Copy Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCopyModal(false)} />
          <div className="relative bg-card rounded-2xl border border-border shadow-2xl p-6 w-80 animate-slide-up">
            <h3 className="text-base font-bold mb-2">کپی لینک‌شده</h3>
            <p className="text-xs text-muted-foreground mb-4">تسک به تاریخ جدید کپی می‌شود و سابتسک‌ها سینک خواهند شد</p>
            <div className="mb-4">
              <DateInput value={copyDate} onChange={setCopyDate} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCopyLinked} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">کپی</button>
              <button onClick={() => setShowCopyModal(false)} className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm hover:bg-muted/80">لغو</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function QuickAction({ label, onClick, icon }: { label: string; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-xs text-muted-foreground hover:bg-muted/80 transition-colors">
      {icon}{label}
    </button>
  );
}

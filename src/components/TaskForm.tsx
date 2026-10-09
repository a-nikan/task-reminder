import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { cn, getToday, getTomorrow, RECURRENCE_OPTIONS, REMINDER_OPTIONS, parseNaturalLanguage } from '../utils';
import type { Task, TaskPriority, Subtask } from '../types';
import { Calendar, Clock, Flag, Tag, Folder, Repeat, Sparkles, Plus, Check, X, Palette, Pin } from 'lucide-react';
import { DateInput } from './DateInput';
import { ColorSwatches } from './ColorSwatches';
import { v4 as uuidv4 } from 'uuid';

export interface TaskFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  priority: TaskPriority;
  categoryId: string;
  color: string;
  tags: string[];
  subtasks: Subtask[];
  recurrence: string;
  reminderOffset: number;
  reminderInterval: number;
  widget: boolean;
}

interface TaskFormProps {
  initial: TaskFormData;
  submitLabel: string;
  onSubmit: (data: TaskFormData) => Promise<void> | void;
  onCancel: () => void;
  autoSave?: boolean;
  onAutoSave?: (data: TaskFormData) => Promise<void> | void;
}

export function TaskForm({ initial, submitLabel, onSubmit, onCancel, autoSave, onAutoSave }: TaskFormProps) {
  const { categories } = useStore();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [priority, setPriority] = useState<TaskPriority>(initial.priority);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [color, setColor] = useState(initial.color);
  const [taskTags, setTaskTags] = useState<string[]>(initial.tags);
  const [recurrence, setRecurrence] = useState(initial.recurrence);
  const [reminderOffset, setReminderOffset] = useState(initial.reminderOffset);
  const [reminderInterval, setReminderInterval] = useState(initial.reminderInterval || 0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>(initial.subtasks);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [widget, setWidget] = useState(initial.widget);
  const isNativeForm = typeof (window as any).Capacitor !== 'undefined' && !!(window as any).Capacitor.isNativePlatform?.();

  // Auto-save mode (edit form): persist ~800ms after the user stops typing
  const autoSaveFirstRun = useRef(true);
  useEffect(() => {
    if (!autoSave || !onAutoSave) return;
    if (autoSaveFirstRun.current) {
      autoSaveFirstRun.current = false;
      return;
    }
    if (!title.trim()) return;
    const t = setTimeout(() => {
      void onAutoSave({
        title: title.trim(),
        description,
        date,
        time,
        priority,
        categoryId,
        color,
        tags: taskTags,
        subtasks,
        recurrence,
        reminderOffset,
        reminderInterval,
        widget,
      });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave, title, description, date, time, priority, categoryId, color, taskTags, subtasks, recurrence, reminderOffset, reminderInterval, widget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        description,
        date,
        time,
        priority,
        categoryId,
        color,
        tags: taskTags,
        subtasks,
        recurrence,
        reminderOffset,
        reminderInterval,
        widget,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleNaturalLanguage = () => {
    if (!title.trim()) return;
    const parsed = parseNaturalLanguage(title);
    if (parsed.title) setTitle(parsed.title);
    if (parsed.date) setDate(parsed.date);
    if (parsed.time) setTime(parsed.time);
    if (parsed.priority) setPriority(parsed.priority as TaskPriority);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !taskTags.includes(newTag.trim())) {
      setTaskTags([...taskTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([...subtasks, { id: uuidv4(), title: newSubtaskTitle.trim(), completed: false }]);
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editingSubTitle, setEditingSubTitle] = useState('');

  const commitSubRename = () => {
    const v = editingSubTitle.trim();
    if (editingSubId && v) {
      setSubtasks(subtasks.map(s => s.id === editingSubId ? { ...s, title: v } : s));
    }
    setEditingSubId(null);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 overflow-y-auto">
      <div className="mb-4">
        <div className="relative">
          <input
            autoFocus
            type="text"
            placeholder="عنوان تسک... (مثلاً: جلسه تیم فردا ساعت 14)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNaturalLanguage(); } }}
            className="w-full pr-10 pl-10 py-3 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="button" onClick={handleNaturalLanguage} className="absolute left-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-background text-primary transition-colors" title="تشخیص زبان طبیعی">
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mb-4">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="شرح تسک... (اختیاری)" />
      </div>

      {/* Subtasks */}      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-1.5 block">سابتسک‌ها (اختیاری)</label>
        {subtasks.length > 0 && (
          <div className="space-y-1 mb-2">
            {subtasks.map(st => (
              <div key={st.id} className="flex items-start gap-2 py-1 px-2 rounded-lg bg-muted/50">
                {st.completed
                  ? <Check className="w-3 h-3 text-status-done mt-0.5 shrink-0" />
                  : <Check className="w-3 h-3 text-muted-foreground/50 mt-0.5 shrink-0" />}
                {editingSubId === st.id ? (
                  <input
                    autoFocus
                    value={editingSubTitle}
                    onChange={(e) => setEditingSubTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitSubRename();
                      if (e.key === 'Escape') setEditingSubId(null);
                    }}
                    onBlur={commitSubRename}
                    className="flex-1 min-w-0 text-xs bg-transparent border-b border-current px-0.5 focus:outline-none"
                  />
                ) : (
                  <span
                    onClick={() => { setEditingSubId(st.id); setEditingSubTitle(st.title); }}
                    title="کلیک برای ویرایش"
                    className="flex-1 min-w-0 break-words text-xs cursor-text"
                  >
                    {st.title}
                  </span>
                )}
                <button type="button" onClick={() => handleRemoveSubtask(st.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          <input
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
            placeholder="سابتسک جدید..."
            className="flex-1 px-2 py-1.5 rounded-lg bg-muted border border-border text-xs focus:outline-none"
          />
          <button type="button" onClick={handleAddSubtask} className="px-2 py-1.5 rounded-lg bg-muted text-xs text-muted-foreground hover:bg-muted/80">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" />تاریخ</label>
          <DateInput value={date} onChange={setDate} />
          <div className="flex gap-1 mt-1">
            <button type="button" onClick={() => setDate(getToday())} className="px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground hover:bg-muted/80">امروز</button>
            <button type="button" onClick={() => setDate(getTomorrow())} className="px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground hover:bg-muted/80">فردا</button>
            <button type="button" onClick={() => setDate('')} className="px-2 py-0.5 rounded text-[10px] bg-muted text-muted-foreground hover:bg-muted/80">بدون</button>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />ساعت</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-muted border border-border text-xs focus:outline-none" />
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-1 block">تکرار هشدار تا لغو</label>
        <select value={reminderInterval} onChange={(e) => setReminderInterval(Number(e.target.value))} className="w-full px-2 py-1.5 rounded-lg bg-muted border border-border text-xs focus:outline-none">
          <option value={0}>خاموش</option>
          <option value={5}>هر ۵ دقیقه</option>
          <option value={10}>هر ۱۰ دقیقه</option>
          <option value={30}>هر ۳۰ دقیقه</option>
          <option value={60}>هر ۱ ساعت</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Flag className="w-3 h-3" />اولویت</label>
        <div className="flex gap-1.5">
          {([
            { value: 'low' as const, label: 'کم', color: 'text-priority-low' },
            { value: 'medium' as const, label: 'متوسط', color: 'text-priority-medium' },
            { value: 'high' as const, label: 'بالا', color: 'text-priority-high' },
            { value: 'urgent' as const, label: 'فوری', color: 'text-priority-urgent' },
          ]).map(p => (
            <button key={p.value} type="button" onClick={() => setPriority(p.value)}
              className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                priority === p.value ? 'bg-primary/15 border-primary text-primary' : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
              )}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Palette className="w-3 h-3" />رنگ کارت</label>
        <ColorSwatches value={color} onPick={setColor} />
      </div>

      {!isNativeForm && (
        <div className="mb-4">
          <button type="button" onClick={() => setWidget(!widget)}
            className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all',
              widget ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-muted text-muted-foreground')}>
            <Pin className="w-3.5 h-3.5" />
            {widget ? 'ویجت دسکتاپ فعال است — با ثبت باز می‌شود' : 'باز شدن به‌صورت ویجت دسکتاپ'}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-primary hover:underline">
          {showAdvanced ? 'پیشرفته ▲' : 'گزینه‌های پیشرفته ▼'}
        </button>
      </div>

      {showAdvanced && (
        <div className="space-y-3 mb-4 p-3 rounded-lg bg-muted/50 animate-slide-up">
          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Folder className="w-3 h-3" />دسته‌بندی</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs focus:outline-none">
              <option value="">بدون دسته‌بندی</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Tag className="w-3 h-3" />تگ‌ها</label>
            <div className="flex flex-wrap gap-1 mb-1">
              {taskTags.map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs flex items-center gap-1">
                  #{tag}
                  <button type="button" onClick={() => setTaskTags(taskTags.filter(t => t !== tag))} className="hover:text-destructive">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())} placeholder="تگ جدید" className="flex-1 px-2 py-1 rounded-lg bg-background border border-border text-xs focus:outline-none" />
              <button type="button" onClick={handleAddTag} className="px-2 py-1 rounded-lg bg-muted text-xs text-muted-foreground hover:bg-muted/80">+</button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Repeat className="w-3 h-3" />تکرار</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs focus:outline-none">
              {RECURRENCE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">یادآوری نسبی</label>
            <select value={reminderOffset} onChange={(e) => setReminderOffset(Number(e.target.value))} className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs focus:outline-none">
              {REMINDER_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!autoSave && (
          <button type="submit" disabled={busy} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {busy ? '...' : submitLabel}
          </button>
        )}
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm hover:bg-muted/80 transition-colors">
          {autoSave ? 'بستن' : 'لغو'}
        </button>
      </div>
    </form>
  );
}

export function scheduleReminderFromForm(
  taskId: string,
  data: TaskFormData,
  hadActiveReminder: boolean,
  oldDateTime?: string | null,
  offsetChanged?: boolean
): Promise<void> {
  const apply = async () => {
    const newKey = data.date && data.time ? `${data.date}T${data.time}` : '';
    const oldKey = oldDateTime || '';
    const scheduleChanged = newKey !== oldKey;
    const applyOffsetChange = !!offsetChanged && !!newKey;
    if (!scheduleChanged && !applyOffsetChange) return;

    const oldTs = oldDateTime ? new Date(`${oldDateTime}:00`).getTime() : NaN;
    const shouldArm = hadActiveReminder || isNaN(oldTs) || oldTs <= Date.now();
    const offsetMs = (data.reminderOffset > 0 ? data.reminderOffset : 0) * 60 * 1000;
    const remindAtTs = newKey ? new Date(`${newKey}:00`).getTime() - offsetMs : NaN;
    const future = !isNaN(remindAtTs) && remindAtTs > Date.now();

    if (shouldArm && future) {
      await window.electronAPI.setReminder(taskId, new Date(remindAtTs).toISOString());
    } else if (hadActiveReminder) {
      await window.electronAPI.cancelReminder(taskId);
    }
  };
  return apply().catch(() => {});
}

export async function followReminderAfterMove(task: Task, newDate: string | null): Promise<void> {
  if (!task.time) return;
  try {
    const oldKey = task.date && task.time ? `${task.date}T${task.time}` : '';
    const newKey = newDate ? `${newDate}T${task.time}` : '';
    if (oldKey === newKey) return;

    const active = await window.electronAPI.getReminder(task.id);
    const oldTs = task.date ? new Date(`${task.date}T${task.time}:00`).getTime() : NaN;
    const shouldArm = !!active || isNaN(oldTs) || oldTs <= Date.now();
    const offsetMs = (task.reminder_offset > 0 ? task.reminder_offset : 0) * 60 * 1000;
    const remindAtTs = newDate ? new Date(`${newDate}T${task.time}:00`).getTime() - offsetMs : NaN;
    const future = !isNaN(remindAtTs) && remindAtTs > Date.now();

    if (shouldArm && future) {
      await window.electronAPI.setReminder(task.id, new Date(remindAtTs).toISOString());
    } else if (active) {
      await window.electronAPI.cancelReminder(task.id);
    }
  } catch {
    // ignore
  }
}

export async function armReminderIfFuture(
  taskId: string,
  date: string | null,
  time: string | null,
  offsetMinutes: number
): Promise<void> {
  if (!date || !time) return;
  try {
    const offsetMs = (offsetMinutes > 0 ? offsetMinutes : 0) * 60 * 1000;
    const ts = new Date(`${date}T${time}:00`).getTime() - offsetMs;
    if (ts > Date.now()) {
      await window.electronAPI.setReminder(taskId, new Date(ts).toISOString());
    }
  } catch {
    // ignore
  }
}

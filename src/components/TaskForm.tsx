import { useState } from 'react';
import { useStore } from '../store';
import { cn, getToday, getTomorrow, RECURRENCE_OPTIONS, REMINDER_OPTIONS, parseNaturalLanguage } from '../utils';
import type { TaskPriority, Subtask } from '../types';
import { Calendar, Clock, Flag, Bell, Tag, Folder, Repeat, Sparkles, Plus, Check, X } from 'lucide-react';
import { DateInput } from './DateInput';
import { v4 as uuidv4 } from 'uuid';

export interface TaskFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  priority: TaskPriority;
  categoryId: string;
  tags: string[];
  subtasks: Subtask[];
  recurrence: string;
  reminderOffset: number;
  reminderEnabled: boolean;
  reminderDate: string;
  reminderTime: string;
}

interface TaskFormProps {
  initial: TaskFormData;
  submitLabel: string;
  onSubmit: (data: TaskFormData) => Promise<void> | void;
  onCancel: () => void;
}

export function TaskForm({ initial, submitLabel, onSubmit, onCancel }: TaskFormProps) {
  const { categories } = useStore();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [priority, setPriority] = useState<TaskPriority>(initial.priority);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [taskTags, setTaskTags] = useState<string[]>(initial.tags);
  const [recurrence, setRecurrence] = useState(initial.recurrence);
  const [reminderOffset, setReminderOffset] = useState(initial.reminderOffset);
  const [enableReminder, setEnableReminder] = useState(initial.reminderEnabled);
  const [reminderDate, setReminderDate] = useState(initial.reminderDate);
  const [reminderTime, setReminderTime] = useState(initial.reminderTime);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>(initial.subtasks);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [busy, setBusy] = useState(false);

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
        tags: taskTags,
        subtasks,
        recurrence,
        reminderOffset,
        reminderEnabled: enableReminder,
        reminderDate,
        reminderTime,
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

  return (
    <form onSubmit={handleSubmit} className="p-4 max-h-[70vh] overflow-y-auto">
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

      {/* Subtasks */}
      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-1.5 block">سابتسک‌ها (اختیاری)</label>
        {subtasks.length > 0 && (
          <div className="space-y-1 mb-2">
            {subtasks.map(st => (
              <div key={st.id} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-muted/50">
                {st.completed
                  ? <Check className="w-3 h-3 text-status-done" />
                  : <Check className="w-3 h-3 text-muted-foreground/50" />}
                <span className="flex-1 text-xs">{st.title}</span>
                <button type="button" onClick={() => handleRemoveSubtask(st.id)} className="text-muted-foreground hover:text-destructive">
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

      <div className="mb-4 p-3 rounded-xl border border-border/60 bg-muted/30">
        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer mb-2">
          <input type="checkbox" checked={enableReminder} onChange={(e) => { setEnableReminder(e.target.checked); if (e.target.checked && !reminderDate) { setReminderDate(date || getToday()); setReminderTime(time || '09:00'); } }} className="w-3.5 h-3.5 accent-primary" />
          <Bell className="w-3.5 h-3.5" />
          هشدار (اعلان در تاریخ و ساعت مشخص)
        </label>
        {enableReminder && (
          <div className="grid grid-cols-2 gap-2 animate-slide-up">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">تاریخ هشدار</label>
              <DateInput value={reminderDate} onChange={setReminderDate} />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">ساعت هشدار</label>
              <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs focus:outline-none" />
            </div>
          </div>
        )}
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

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">توضیحات</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs focus:outline-none resize-none" placeholder="توضیحات اختیاری..." />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
          {busy ? '...' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm hover:bg-muted/80 transition-colors">
          لغو
        </button>
      </div>
    </form>
  );
}

export function scheduleReminderFromForm(
  taskId: string,
  data: TaskFormData,
  hadActiveReminder: boolean
): Promise<void> {
  const apply = async () => {
    if (data.reminderEnabled && data.reminderDate && data.reminderTime) {
      const remindAt = new Date(`${data.reminderDate}T${data.reminderTime}:00`).toISOString();
      if (new Date(remindAt).getTime() > Date.now()) {
        await window.electronAPI.setReminder(taskId, remindAt);
        return;
      }
    }
    if (!data.reminderEnabled && hadActiveReminder) {
      await window.electronAPI.cancelReminder(taskId);
      return;
    }
    if (!data.reminderEnabled && data.reminderOffset > 0 && data.date && data.time) {
      const taskDt = new Date(`${data.date}T${data.time}:00`).getTime();
      if (!isNaN(taskDt)) {
        const remindAt = new Date(taskDt - data.reminderOffset * 60 * 1000).toISOString();
        if (new Date(remindAt).getTime() > Date.now()) {
          await window.electronAPI.setReminder(taskId, remindAt);
        }
      }
    }
  };
  return apply().catch(() => {});
}

import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { X } from 'lucide-react';
import { TaskForm, scheduleReminderFromForm, type TaskFormData } from './TaskForm';

function toLocalParts(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function EditTaskModal() {
  const { editingTask, setEditingTask, setShowEditTaskForm, setSelectedTask, selectedTask, refreshCurrentView, showToast } = useStore();
  const [initial, setInitial] = useState<TaskFormData | null>(null);
  const [hadActiveReminder, setHadActiveReminder] = useState(false);

  useEffect(() => {
    if (!editingTask) {
      setInitial(null);
      return;
    }
    const tags = typeof editingTask.tags === 'string'
      ? JSON.parse((editingTask.tags as any) || '[]')
      : (editingTask.tags || []);
    window.electronAPI.getReminder(editingTask.id).then((r: any) => {
      const active = r?.remind_at ? r : null;
      setHadActiveReminder(!!active);
      const parts = toLocalParts(active ? (active.snoozed_until || active.remind_at) : null);
      setInitial({
        title: editingTask.title,
        description: editingTask.description || '',
        date: editingTask.date || '',
        time: editingTask.time || '',
        priority: editingTask.priority,
        categoryId: editingTask.category_id || '',
        tags,
        subtasks: (editingTask.subtasks || []).map(s => ({ ...s })),
        recurrence: editingTask.recurrence || '',
        reminderOffset: editingTask.reminder_offset || 0,
        reminderEnabled: !!active,
        reminderDate: parts.date || editingTask.date || '',
        reminderTime: parts.time || editingTask.time || '',
      });
    }).catch(() => {
      setHadActiveReminder(false);
      setInitial({
        title: editingTask.title,
        description: editingTask.description || '',
        date: editingTask.date || '',
        time: editingTask.time || '',
        priority: editingTask.priority,
        categoryId: editingTask.category_id || '',
        tags,
        subtasks: (editingTask.subtasks || []).map(s => ({ ...s })),
        recurrence: editingTask.recurrence || '',
        reminderOffset: editingTask.reminder_offset || 0,
        reminderEnabled: false,
        reminderDate: editingTask.date || '',
        reminderTime: editingTask.time || '',
      });
    });
  }, [editingTask]);

  if (!editingTask) return null;

  const handleClose = () => {
    setShowEditTaskForm(false);
    setEditingTask(null);
  };

  const handleSubmit = async (data: TaskFormData) => {
    await window.electronAPI.updateTask(editingTask.id, {
      title: data.title,
      description: data.description,
      date: data.date || null,
      time: data.time || null,
      priority: data.priority,
      category_id: data.categoryId || null,
      tags: data.tags,
      subtasks: data.subtasks,
      recurrence: data.recurrence || null,
      reminder_offset: data.reminderOffset,
    });
    await scheduleReminderFromForm(editingTask.id, data, hadActiveReminder);
    // Keep detail panel in sync if it shows this task
    if (selectedTask?.id === editingTask.id) {
      const updated = await window.electronAPI.getTaskById(editingTask.id);
      if (updated) setSelectedTask(updated);
    }
    showToast('تسک ذخیره شد');
    refreshCurrentView();
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-lg mx-4 bg-card rounded-2xl border border-border shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-bold">ویرایش تسک</h2>
          <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {initial ? (
          <TaskForm
            key={editingTask.id}
            initial={initial}
            submitLabel="ذخیره تغییرات"
            onSubmit={handleSubmit}
            onCancel={handleClose}
          />
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">در حال بارگذاری...</div>
        )}
      </div>
    </div>
  );
}

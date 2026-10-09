import { useStore } from '../store';
import { getToday } from '../utils';
import { X } from 'lucide-react';
import { TaskForm, scheduleReminderFromForm, type TaskFormData } from './TaskForm';

export function NewTaskModal() {
  const { setShowNewTaskForm, refreshCurrentView, showToast, selectedDate } = useStore();

  const nextHour = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');

  const initial: TaskFormData = {
    title: '',
    description: '',
    date: selectedDate || getToday(),
    time: `${pad(nextHour.getHours())}:${pad(nextHour.getMinutes())}`,
    priority: 'medium',
    categoryId: '',
    color: '',
    tags: [],
    subtasks: [],
    recurrence: '',
    reminderOffset: 0,
    reminderInterval: 0,
    widget: false,
  };

  const handleSubmit = async (data: TaskFormData) => {
    const created: any = await window.electronAPI.createTask({
      title: data.title,
      description: data.description,
      date: data.date || null,
      time: data.time || null,
      priority: data.priority,
      category_id: data.categoryId || null,
      color: data.color || null,
      tags: data.tags,
      subtasks: data.subtasks,
      recurrence: data.recurrence || null,
      reminder_offset: data.reminderOffset,
      reminder_interval: data.reminderInterval || 0,
      pinned: data.widget ? 1 : 0,
      status: 'todo' as const,
    });
    if (created?.id) {
      await scheduleReminderFromForm(created.id, data, false);
      if (data.widget) await window.electronAPI.widgetOpen(created.id);
    }
    showToast('تسک ایجاد شد');
    refreshCurrentView();
    setShowNewTaskForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNewTaskForm(false)} />
        <div className="relative w-full max-w-lg mx-4 bg-card rounded-2xl border border-border shadow-2xl animate-slide-up max-h-[90%] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-base font-bold">تسک جدید</h2>
          <button onClick={() => setShowNewTaskForm(false)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <TaskForm initial={initial} submitLabel="ایجاد تسک" onSubmit={handleSubmit} onCancel={() => setShowNewTaskForm(false)} />
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { useStore } from '../store';
import type { Task, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { BulkToolbar } from './BulkToolbar';
import { useTaskSelection, useActiveReminders } from '../hooks/useTaskSelection';
import { CalendarClock, Plus } from 'lucide-react';

export function AnytimeView() {
  const { tasks, refreshCurrentView, setShowNewTaskForm, showToast, showConfirm, pushUndo } = useStore();
  const { selectionMode, selectedIds, toggleSelect, selectAll, clearSelection, setSelectionMode } = useTaskSelection();
  const { remindersMap, loadReminders } = useActiveReminders();

  useEffect(() => {
    refreshCurrentView();
    loadReminders();
  }, []);

  const reload = async () => {
    await refreshCurrentView();
    await loadReminders();
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    await window.electronAPI.changeTaskStatus(id, status);
    reload();
  };

  const handleToggleFavorite = async (task: Task) => {
    await window.electronAPI.updateTask(task.id, { favorite: !task.favorite });
    reload();
  };

  const handleDelete = (task: Task) => {
    showConfirm({
      title: 'حذف تسک',
      message: `تسک «${task.title}» حذف شود؟`,
      onConfirm: async () => {
        pushUndo(task, 'delete');
        await window.electronAPI.deleteTask(task.id);
        reload();
        showToast('حذف شد', 'error', true);
      },
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const toDelete = tasks.filter(t => selectedIds.includes(t.id));
    showConfirm({
      title: 'حذف تسک‌ها',
      message: `${count} تسک انتخاب‌شده حذف شود؟`,
      onConfirm: async () => {
        pushUndo(toDelete, 'delete');
        await window.electronAPI.deleteMultipleTasks(selectedIds);
        clearSelection();
        reload();
        showToast(`${count} تسک حذف شد`, 'error', true);
      },
    });
  };

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">بدون تاریخ / همیشه</h1>
            <p className="text-muted-foreground text-sm mt-1">تسک‌هایی که زمان مشخصی ندارند</p>
          </div>
          <button onClick={() => setShowNewTaskForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> تسک جدید
          </button>
        </div>

        <BulkToolbar
          totalCount={tasks.length}
          selectedCount={selectedIds.length}
          selectionMode={selectionMode}
          onEnterSelection={() => setSelectionMode(true)}
          onSelectAll={() => selectAll(tasks.map(t => t.id))}
          onClear={clearSelection}
          onDeleteSelected={handleDeleteSelected}
        />

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground/50 mb-4">
              <CalendarClock className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">هیچ تسک بدون تاریخی نداری</h3>
            <p className="text-sm text-muted-foreground mb-4">کارهایی که زمان مشخصی ندارند اینجا قرار می‌گیرند</p>
            <button onClick={() => setShowNewTaskForm(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">ایجاد تسک</button>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onStatusChange={handleStatusChange}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDelete}
                selectionMode={selectionMode}
                selected={selectedIds.includes(task.id)}
                onToggleSelect={(t) => toggleSelect(t.id)}
                reminderAt={remindersMap[task.id] ?? (task as any).reminder ?? null}
                onReminderChanged={loadReminders}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

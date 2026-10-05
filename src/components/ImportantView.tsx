import { useEffect } from 'react';
import { useStore } from '../store';
import type { Task, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { BulkToolbar } from './BulkToolbar';
import { useTaskSelection, useActiveReminders } from '../hooks/useTaskSelection';
import { Star, StarIcon } from 'lucide-react';

export function ImportantView() {
  const { tasks, refreshCurrentView, showToast, showConfirm, pushUndo } = useStore();
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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
            <Star className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">مهم‌ها</h1>
            <p className="text-muted-foreground text-sm">{tasks.length} تسک مهم</p>
          </div>
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
              <StarIcon className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">هیچ تسک مهمی نداری</h3>
            <p className="text-sm text-muted-foreground">روی ستاره تسک‌ها کلیک کنید تا مهم شوند</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onStatusChange={handleStatusChange}
                onToggleFavorite={handleToggleFavorite}
                onDelete={handleDelete}
                showDate={!!task.date}
                dateLabel={task.date || ''}
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

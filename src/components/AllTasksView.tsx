import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { cn, getStatusBgColor } from '../utils';
import type { Task, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { BulkToolbar } from './BulkToolbar';
import { useTaskSelection, useActiveReminders } from '../hooks/useTaskSelection';
import { ListTodo, Search } from 'lucide-react';

export function AllTasksView() {
  const { tasks, refreshCurrentView, showToast, showConfirm, pushUndo } = useStore();
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'status'>('date');
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

  const filteredTasks = tasks
    .filter(t => filter === 'all' || t.status === filter)
    .filter(t => search === '' || t.title.includes(search) || t.description?.includes(search))
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
      }
      if (sortBy === 'status') {
        const order = { in_progress: 0, todo: 1, done: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      }
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return 0;
    });

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

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">همه تسک‌ها</h1>

        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="جستجو..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-lg bg-muted border border-border text-sm focus:outline-none">
            <option value="date">تاریخ</option>
            <option value="priority">اولویت</option>
            <option value="status">وضعیت</option>
          </select>
        </div>

        <div className="flex gap-2 mb-4">
          {[
            { key: 'all' as const, label: 'همه', count: stats.total },
            { key: 'todo' as const, label: 'انجام نشده', count: stats.todo },
            { key: 'in_progress' as const, label: 'در حال انجام', count: stats.in_progress },
            { key: 'done' as const, label: 'انجام شده', count: stats.done },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
              {f.key !== 'all' && <span className={cn('w-2 h-2 rounded-full', getStatusBgColor(f.key))} />}
              {f.label} <span className="opacity-70">({f.count})</span>
            </button>
          ))}
        </div>

        <BulkToolbar
          totalCount={filteredTasks.length}
          selectedCount={selectedIds.length}
          selectionMode={selectionMode}
          onEnterSelection={() => setSelectionMode(true)}
          onSelectAll={() => selectAll(filteredTasks.map(t => t.id))}
          onClear={clearSelection}
          onDeleteSelected={handleDeleteSelected}
        />

        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground/50 mb-4">
              <ListTodo className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">
              {search ? 'نتیجه‌ای یافت نشد' : 'هیچ تسکی وجود ندارد'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {search ? 'عبارت جستجو را تغییر دهید' : 'اولین تسک خود را ایجاد کنید'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            {filteredTasks.map(task => (
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
                onLongPressSelect={() => { if (!selectionMode) setSelectionMode(true); toggleSelect(task.id); }}
                reminderAt={remindersMap[task.id] ?? (task as any).reminder ?? null}
                onReminderChanged={loadReminders}
                onTasksChanged={reload}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { useStore } from '../store';
import { cn, getStatusBgColor, getHeaderDate, getToday, formatTaskDateLocalized } from '../utils';
import type { Task, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { BulkToolbar } from './BulkToolbar';
import { useTaskSelection, useActiveReminders } from '../hooks/useTaskSelection';
import { Calendar } from 'lucide-react';

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground/50 mb-4">
        <Calendar className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function TodayView() {
  const { tasks, setTasks, refreshCurrentView, showToast, settings, selectedDate, setSelectedDate, showConfirm, pushUndo } = useStore();
  const { selectionMode, selectedIds, toggleSelect, selectAll, clearSelection, setSelectionMode } = useTaskSelection();
  const { remindersMap, loadReminders } = useActiveReminders();

  const todayStr = getToday();
  const viewingDate = selectedDate && selectedDate !== todayStr ? selectedDate : null;

  const loadDayTasks = async (dateStr: string) => {
    const dayTasks = await window.electronAPI.getTasksByDate(dateStr);
    setTasks(dayTasks);
    await loadReminders();
  };

  useEffect(() => {
    if (viewingDate) loadDayTasks(viewingDate);
    else {
      refreshCurrentView();
      loadReminders();
    }
    clearSelection();
  }, [selectedDate]);

  const reload = async () => {
    if (viewingDate) await loadDayTasks(viewingDate);
    else {
      await refreshCurrentView();
      await loadReminders();
    }
  };

  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const doneTasks = tasks.filter(t => t.status === 'done');

  const jd = viewingDate
    ? getHeaderDate(settings.calendarType, new Date(viewingDate + 'T12:00:00'))
    : getHeaderDate(settings.calendarType, new Date());
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;

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

  const sectionProps = {
    selectionMode,
    selectedIds,
    remindersMap,
    onToggleSelect: (t: Task) => toggleSelect(t.id),
    onStatusChange: handleStatusChange,
    onToggleFavorite: handleToggleFavorite,
    onDelete: handleDelete,
    onReminderChanged: loadReminders,
  };

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">{jd.title}</h1>
              <p className="text-muted-foreground text-sm mt-1">{jd.subtitle}</p>
            </div>
            {viewingDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
              >
                بازگشت به امروز
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard label="کل" value={totalTasks} color="text-foreground" />
          <StatCard label="انجام نشده" value={todoTasks.length} color="text-status-todo" />
          <StatCard label="در حال انجام" value={inProgressTasks.length} color="text-status-progress" />
          <StatCard label="انجام شده" value={doneTasks.length} color="text-status-done" />
        </div>

        {totalTasks > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">پیشرفت</span>
              <span className="font-medium">{completionRate}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-status-done rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }} />
            </div>
          </div>
        )}

        {tasks.length === 0 ? (
          <EmptyState
            title={viewingDate ? `در ${formatTaskDateLocalized(viewingDate, settings.calendarType)} تسکی نیست` : 'امروز هیچ کاری نداری 🎉'}
            subtitle={viewingDate ? undefined : 'اولین تسک خود را ایجاد کنید'}
          />
        ) : (
          <>
            <BulkToolbar
              totalCount={tasks.length}
              selectedCount={selectedIds.length}
              selectionMode={selectionMode}
              onEnterSelection={() => setSelectionMode(true)}
              onSelectAll={() => selectAll(tasks.map(t => t.id))}
              onClear={clearSelection}
              onDeleteSelected={handleDeleteSelected}
            />
            <div className="space-y-6">
              {inProgressTasks.length > 0 && (
                <TaskSection title="در حال انجام" status="in_progress" tasks={inProgressTasks} {...sectionProps} />
              )}
              {todoTasks.length > 0 && (
                <TaskSection title="انجام نشده" status="todo" tasks={todoTasks} {...sectionProps} />
              )}
              {doneTasks.length > 0 && (
                <TaskSection title="انجام شده" status="done" tasks={doneTasks} {...sectionProps} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TaskSection({ title, status, tasks, onStatusChange, onToggleFavorite, onDelete, selectionMode, selectedIds, onToggleSelect, remindersMap, onReminderChanged }: {
  title: string;
  status: TaskStatus;
  tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onToggleFavorite: (task: Task) => void;
  onDelete: (task: Task) => void;
  selectionMode: boolean;
  selectedIds: string[];
  onToggleSelect: (t: Task) => void;
  remindersMap: Record<string, string>;
  onReminderChanged: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('w-2.5 h-2.5 rounded-full', getStatusBgColor(status))} />
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">({tasks.length})</span>
      </div>
      <div className="grid grid-cols-2 gap-3 items-start">
        {tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onStatusChange={onStatusChange}
            onToggleFavorite={onToggleFavorite}
            onDelete={onDelete}
            selectionMode={selectionMode}
            selected={selectedIds.includes(task.id)}
            onToggleSelect={onToggleSelect}
            reminderAt={remindersMap[task.id] ?? (task as any).reminder ?? null}
            onReminderChanged={onReminderChanged}
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-3 rounded-xl border border-border/50 bg-card">
      <div className={cn('text-2xl font-bold', color)}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

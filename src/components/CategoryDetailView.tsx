import { useEffect } from 'react';
import { useStore } from '../store';
import { cn, getStatusBgColor, getPriorityColor } from '../utils';
import type { Task, TaskStatus } from '../types';
import { Check, Clock, Flag, Star, ChevronRight } from 'lucide-react';

export function CategoryDetailView() {
  const { selectedCategoryId, categories, tasks, loadTasks, setView, setSelectedTask, setShowTaskDetail } = useStore();
  const category = categories.find(c => c.id === selectedCategoryId);

  useEffect(() => {
    if (selectedCategoryId) {
      loadTasks({ categoryId: selectedCategoryId, archived: false });
    }
  }, [selectedCategoryId]);

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    await window.electronAPI.changeTaskStatus(id, status);
    if (selectedCategoryId) loadTasks({ categoryId: selectedCategoryId, archived: false });
  };

  if (!category) return null;

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('categories')} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{category.name}</h1>
            <p className="text-muted-foreground text-sm">{tasks.length} تسک</p>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-lg font-medium text-foreground mb-1">هیچ تسکی در این دسته‌بندی نیست</h3>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <div key={task.id} onClick={() => { setSelectedTask(task); setShowTaskDetail(true); }} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-accent/5 transition-all cursor-pointer">
                <button onClick={(e) => { e.stopPropagation(); const next: Record<TaskStatus, TaskStatus> = { todo: 'in_progress', in_progress: 'done', done: 'todo' }; handleStatusChange(task.id, next[task.status]); }}
                  className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                    task.status === 'done' ? 'bg-status-done border-status-done text-white' :
                    task.status === 'in_progress' ? 'border-status-progress text-status-progress' :
                    'border-muted-foreground/60'
                  )}
                >
                  {task.status === 'done' && <Check className="w-3 h-3" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-medium truncate', task.status === 'done' && 'line-through text-muted-foreground')}>{task.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.date && <span className="text-[11px] text-muted-foreground">{task.date}</span>}
                    {task.time && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{task.time}</span>}
                  </div>
                </div>
                <Flag className={cn('w-3.5 h-3.5', getPriorityColor(task.priority))} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

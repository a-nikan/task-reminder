import { useStore } from '../store';
import { cn } from '../utils';
import { Check, X, Undo2, AlertCircle, Info } from 'lucide-react';

export function Toast() {
  const { toast, hideToast, popUndo, refreshCurrentView, undoStack } = useStore();

  if (!toast) return null;

  const canUndo = !!toast.undoable && undoStack.length > 0;

  const handleUndo = async () => {
    const undoItem = popUndo();
    if (undoItem) {
      if (undoItem.action === 'delete') {
        for (const t of undoItem.tasks) {
          await window.electronAPI.createTask(t);
          if (t.reminder && new Date(t.reminder).getTime() > Date.now()) {
            await window.electronAPI.setReminder(t.id, t.reminder);
          }
        }
      } else if (undoItem.action === 'archive') {
        for (const t of undoItem.tasks) {
          await window.electronAPI.restoreTask(t.id);
        }
      }
      refreshCurrentView();
    }
    hideToast();
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-sm',
        toast.type === 'success' && 'bg-status-done/10 border-status-done/30 text-status-done',
        toast.type === 'error' && 'bg-destructive/10 border-destructive/30 text-destructive',
        toast.type === 'info' && 'bg-primary/10 border-primary/30 text-primary',
      )}>
        {toast.type === 'success' && <Check className="w-4 h-4 shrink-0" />}
        {toast.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
        {toast.type === 'info' && <Info className="w-4 h-4 shrink-0" />}
        <span className="text-sm font-medium">{toast.message}</span>
        {canUndo && (
          <button onClick={handleUndo} className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-xs hover:bg-white/20 transition-colors">
            <Undo2 className="w-3 h-3" />
            بازگشت
          </button>
        )}
        <button onClick={hideToast} className="p-0.5 rounded hover:bg-white/10 transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

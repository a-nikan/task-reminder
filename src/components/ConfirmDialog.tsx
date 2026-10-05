import { useEffect } from 'react';
import { useStore } from '../store';
import { AlertTriangle, X } from 'lucide-react';

export function ConfirmDialog() {
  const { confirmDialog, hideConfirm } = useStore();

  useEffect(() => {
    if (!confirmDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDialog]);

  if (!confirmDialog) return null;

  const handleConfirm = async () => {
    const action = confirmDialog.onConfirm;
    hideConfirm();
    await action();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={hideConfirm} />
      <div className="relative bg-card border-2 border-border rounded-2xl shadow-2xl p-5 w-80 animate-scale-in">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-foreground mb-1">{confirmDialog.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{confirmDialog.message}</p>
          </div>
          <button onClick={hideConfirm} className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {confirmDialog.confirmLabel || 'حذف'}
          </button>
          <button
            onClick={hideConfirm}
            className="flex-1 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}

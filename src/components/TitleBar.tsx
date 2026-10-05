import { useStore } from '../store';
import { Minus, Square, X, Maximize2 } from 'lucide-react';

export function TitleBar() {
  const { isMaximized } = useStore();

  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isNative) return null;

  const handleMinimize = () => window.electronAPI.minimize();
  const handleMaximize = () => window.electronAPI.maximize();
  const handleClose = () => window.electronAPI.close();

  return (
    <div className="h-8 bg-background border-b border-border flex items-center justify-between px-2 drag-region select-none shrink-0">
      <div className="flex items-center gap-2 no-drag">
        <div className="w-3 h-3 rounded-full bg-status-todo" />
        <span className="text-xs font-medium text-muted-foreground">Nick Task Reminder</span>
      </div>
      <div className="flex items-center gap-0.5 no-drag">
        <button
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors"
        >
          {isMaximized ? <Square className="w-3 h-3" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive hover:text-destructive-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

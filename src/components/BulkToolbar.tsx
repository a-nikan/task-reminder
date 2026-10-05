import { CheckSquare, Square, Trash2, X } from 'lucide-react';
import { cn } from '../utils';

interface BulkToolbarProps {
  totalCount: number;
  selectedCount: number;
  selectionMode: boolean;
  onEnterSelection: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onDeleteSelected: () => void;
}

export function BulkToolbar({
  totalCount,
  selectedCount,
  selectionMode,
  onEnterSelection,
  onSelectAll,
  onClear,
  onDeleteSelected,
}: BulkToolbarProps) {
  if (!selectionMode) {
    return (
      <div className="flex justify-end mb-3">
        <button
          onClick={onEnterSelection}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground bg-muted hover:bg-muted/80 transition-colors"
        >
          <CheckSquare className="w-3.5 h-3.5" />
          انتخاب چندتایی
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl border border-primary/30 bg-primary/5 animate-slide-up">
      <span className="text-xs font-medium">
        {selectedCount} از {totalCount} انتخاب شده
      </span>
      <div className="flex-1" />
      <button
        onClick={onSelectAll}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground hover:bg-muted/80"
      >
        <Square className="w-3.5 h-3.5" />
        همه
      </button>
      <button
        onClick={onDeleteSelected}
        disabled={selectedCount === 0}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
          selectedCount === 0
            ? 'bg-muted text-muted-foreground/50 cursor-not-allowed'
            : 'bg-destructive text-destructive-foreground hover:opacity-90'
        )}
      >
        <Trash2 className="w-3.5 h-3.5" />
        حذف ({selectedCount})
      </button>
      <button
        onClick={onClear}
        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

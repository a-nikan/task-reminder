import { useSwapDrag } from '../hooks/useCardSwap';
import { cn } from '../utils';
import type { Subtask } from '../types';
import { Check, GripVertical, Trash2 } from 'lucide-react';

interface SubtaskRowProps {
  subtask: Subtask;
  groupId: string;
  titleClassName?: string;
  completedClassName?: string;
  /** When set (colored card/widget), checkbox and icons use tonal onColor styling */
  accent?: string;
  onColor?: string;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onDrop: (aId: string, bId: string) => void;
}

/**
 * One subtask row: drag handle (swap with another row), checkbox pinned to
 * the top of multi-line text, remove button. Used on cards, detail panel
 * and the desktop widget.
 */
export function SubtaskRow({
  subtask,
  groupId,
  titleClassName = 'text-xs',
  completedClassName = 'line-through opacity-60',
  accent,
  onColor,
  onToggle,
  onRemove,
  onDrop,
}: SubtaskRowProps) {
  const { dragging, dragOffset, dragHandleProps } = useSwapDrag({
    groupId,
    itemId: subtask.id,
    onDrop,
  });
  const tonal = !!accent && !!onColor;

  return (
    <div
      data-swap-id={subtask.id}
      style={dragging ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` } : undefined}
      className={cn(
        'flex items-start gap-2 py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors group/subrow',
        dragging && 'relative z-30 scale-[1.03] shadow-lg pointer-events-none transition-none'
      )}
    >
      <button
        {...dragHandleProps}
        title="جابه‌جایی"
        className="touch-none select-none cursor-grab active:cursor-grabbing opacity-60 p-0.5 rounded hover:bg-muted transition-all [@media(hover:hover)]:opacity-0 group-hover/subrow:opacity-100 shrink-0"
      >
        <GripVertical className="w-3 h-3 opacity-70" />
      </button>
      <button onClick={(e) => { e.stopPropagation(); onToggle(subtask.id); }} className="shrink-0">
        <div
          className={cn('w-4 h-4 rounded border flex items-center justify-center transition-all',
            subtask.completed
              ? tonal ? '' : 'bg-status-done border-status-done text-white'
              : 'border-muted-foreground/30 hover:border-status-done')}
          style={tonal ? {
            borderColor: subtask.completed ? undefined : `${onColor}55`,
            backgroundColor: subtask.completed ? onColor : 'transparent',
            color: subtask.completed ? accent : undefined,
          } : undefined}
        >
          {subtask.completed && <Check className="w-2.5 h-2.5" />}
        </div>
      </button>
      <span className={cn('flex-1 min-w-0 break-words', titleClassName, subtask.completed && completedClassName)}>
        {subtask.title}
      </span>
      <button onClick={(e) => { e.stopPropagation(); onRemove(subtask.id); }}
        className="opacity-60 [@media(hover:hover)]:opacity-0 group-hover/subrow:opacity-100 p-0.5 rounded hover:bg-destructive/10 transition-all shrink-0">
        <Trash2 className="w-3 h-3 text-destructive" />
      </button>
    </div>
  );
}

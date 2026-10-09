import { useState } from 'react';
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
  hoverClassName?: string;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDrop: (draggedId: string) => void;
  onDragMove?: (clientX: number, clientY: number, draggedId: string) => void;
  onDragEnd?: () => void;
}

/**
 * One subtask row: drag handle (insert above/below another row), checkbox pinned to
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
  hoverClassName = 'hover:bg-muted/50',
  onToggle,
  onRemove,
  onRename,
  onDrop,
  onDragMove,
  onDragEnd,
}: SubtaskRowProps) {
  const { dragging, dragOffset, dragHandleProps } = useSwapDrag({
    groupId,
    itemId: subtask.id,
    onDrop,
    onDragMove: (x, y, id) => onDragMove?.(x, y, id),
    onDragEnd: () => onDragEnd?.(),
  });
  const tonal = !!accent && !!onColor;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const commitRename = () => {
    const v = draft.trim();
    setEditing(false);
    if (v && v !== subtask.title) onRename(subtask.id, v);
  };

  return (
      <div
        data-swap-id={subtask.id}
        style={dragging ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` } : undefined}
        className={cn(
        'flex items-start gap-2 py-1 px-1 rounded-lg transition-colors group/subrow',
        hoverClassName,
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
              : 'border-muted-foreground/60 bg-black/[0.08] hover:border-status-done')}
          style={tonal ? {
            borderColor: subtask.completed ? undefined : `${onColor}99`,
            backgroundColor: subtask.completed ? onColor : `${onColor}14`,
            color: subtask.completed ? accent : undefined,
          } : undefined}
        >
          {subtask.completed && <Check className="w-2.5 h-2.5" />}
        </div>
      </button>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-transparent border-b border-current px-0.5 py-0 focus:outline-none"
          style={{ fontSize: 'var(--font-size-subtask)', fontFamily: 'var(--hand-font)', lineHeight: 'var(--text-leading)', WebkitTextStroke: 'var(--stroke-subtask)' }}
        />
      ) : (
        <span
          onClick={(e) => { e.stopPropagation(); setDraft(subtask.title); setEditing(true); }}
          title="کلیک برای ویرایش"
          className={cn('flex-1 min-w-0 break-words cursor-text', titleClassName, subtask.completed && completedClassName)}
          style={{ fontSize: 'var(--font-size-subtask)', fontFamily: 'var(--hand-font)', lineHeight: 'var(--text-leading)', WebkitTextStroke: 'var(--stroke-subtask)' }}
        >
          {subtask.title}
        </span>
      )}
      <button onClick={(e) => { e.stopPropagation(); onRemove(subtask.id); }}
        className="opacity-60 [@media(hover:hover)]:opacity-0 group-hover/subrow:opacity-100 p-0.5 rounded hover:bg-destructive/10 transition-all shrink-0">
        <Trash2 className="w-3 h-3 text-destructive" />
      </button>
    </div>
  );
}

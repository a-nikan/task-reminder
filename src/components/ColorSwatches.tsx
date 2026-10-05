import { cn } from '../utils';

export const CARD_PALETTE = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

interface ColorSwatchesProps {
  value: string;
  onPick: (color: string) => void;
  className?: string;
}

export function ColorSwatches({ value, onPick, className }: ColorSwatchesProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <button
        type="button"
        onClick={() => onPick('')}
        className={cn(
          'h-6 px-2 rounded-full text-[10px] font-medium border transition-all',
          value === ''
            ? 'border-foreground/70 bg-muted text-foreground'
            : 'border-border/60 text-muted-foreground hover:border-foreground/40'
        )}
      >
        رندوم
      </button>
      {CARD_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onClick={() => onPick(c)}
          className={cn(
            'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
            value === c ? 'border-foreground/70 scale-110' : 'border-transparent'
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

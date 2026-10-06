import { useState } from 'react';
import { useStore } from '../store';
import { cn } from '../utils';
import { Pencil, Check, RotateCcw } from 'lucide-react';

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

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const CARD_COLORS_KEY = 'customCardColors';

export function getCardPalette(settings: Record<string, string> | undefined): string[] {
  try {
    const raw = settings?.[CARD_COLORS_KEY];
    if (!raw) return CARD_PALETTE;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length === CARD_PALETTE.length &&
      parsed.every(c => typeof c === 'string' && HEX_RE.test(c))
    ) {
      return parsed;
    }
  } catch {
    // fall through to defaults
  }
  return CARD_PALETTE;
}

interface ColorSwatchesProps {
  value: string;
  onPick: (color: string) => void;
  className?: string;
}

export function ColorSwatches({ value, onPick, className }: ColorSwatchesProps) {
  const settings = useStore(s => s.settings);
  const updateSettings = useStore(s => s.updateSettings);
  const showToast = useStore(s => s.showToast);
  const [editing, setEditing] = useState(false);
  const palette = getCardPalette(settings);
  const isCustom = !!settings?.[CARD_COLORS_KEY];

  const handleCustomColor = async (index: number, hex: string) => {
    if (!HEX_RE.test(hex)) return;
    const next = [...palette];
    next[index] = hex;
    await updateSettings({ [CARD_COLORS_KEY]: JSON.stringify(next) });
    showToast('رنگ پیش‌فرض به‌روز شد');
  };

  const handleReset = async () => {
    await updateSettings({ [CARD_COLORS_KEY]: '' });
    setEditing(false);
    showToast('رنگ‌های پیش‌فرض برگردانده شد', 'info');
  };

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
      {palette.map((c, i) =>
        editing ? (
          <label
            key={i}
            title="تغییر این رنگ"
            className="relative w-6 h-6 rounded-full border-2 border-dashed border-foreground/50 cursor-pointer transition-transform hover:scale-110"
            style={{ backgroundColor: c }}
          >
            <input
              type="color"
              value={c}
              onChange={(e) => handleCustomColor(i, e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label={`تغییر رنگ ${i + 1}`}
            />
          </label>
        ) : (
          <button
            key={i}
            type="button"
            title={c}
            onClick={() => onPick(c)}
            className={cn(
              'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
              value.toLowerCase() === c.toLowerCase() ? 'border-foreground/70 scale-110' : 'border-transparent'
            )}
            style={{ backgroundColor: c }}
          />
        )
      )}
      <button
        type="button"
        title={editing ? 'پایان ویرایش' : 'ویرایش رنگ‌های پیش‌فرض'}
        onClick={() => setEditing(!editing)}
        className={cn(
          'w-6 h-6 rounded-full border flex items-center justify-center transition-colors',
          editing
            ? 'border-primary/60 bg-primary/15 text-primary'
            : 'border-border/60 text-muted-foreground hover:border-foreground/40'
        )}
      >
        {editing ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
      </button>
      {editing && isCustom && (
        <button
          type="button"
          title="بازگردانی رنگ‌های پیش‌فرض"
          onClick={handleReset}
          className="h-6 px-2 rounded-full text-[10px] font-medium border border-border/60 text-muted-foreground hover:border-foreground/40 flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          پیش‌فرض
        </button>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { useStore } from '../store';
import { cn } from '../utils';
import { toJalaali, toGregorian, jalaaliMonthLength, JALALI_MONTHS } from '../utils';

interface DateInputProps {
  value: string; // gregorian YYYY-MM-DD or ''
  onChange: (gregorian: string) => void;
  className?: string;
  allowClear?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

function parseGregorian(value: string): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return { y: parts[0], m: parts[1], d: parts[2] };
}

/**
 * Date input that follows the calendar setting:
 * - gregorian: native <input type="date">
 * - jalali: three selects (day/month/year) in Jalali, stored as gregorian YYYY-MM-DD
 */
export function DateInput({ value, onChange, className, allowClear = false }: DateInputProps) {
  const { settings } = useStore();
  const isJalali = (settings.calendarType || 'gregorian') === 'jalali';

  const jalali = useMemo(() => {
    const g = parseGregorian(value);
    if (!g) return null;
    try {
      const j = toJalaali(g.y, g.m, g.d);
      return { jy: j.jy, jm: j.jm, jd: j.jd };
    } catch {
      return null;
    }
  }, [value]);

  const todayJ = useMemo(() => {
    const now = new Date();
    return toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }, []);

  if (!isJalali) {
    return (
      <div className={cn('flex gap-1', className)}>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-1.5 rounded-lg bg-muted border border-border text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {allowClear && value && (
          <button type="button" onClick={() => onChange('')} className="px-2 py-1 rounded-lg bg-muted text-xs text-muted-foreground hover:bg-muted/80">
            بدون
          </button>
        )}
      </div>
    );
  }

  const curJy = jalali?.jy ?? todayJ.jy;
  const curJm = jalali?.jm ?? todayJ.jm;
  const curJd = jalali?.jd ?? 0;

  const years: number[] = [];
  for (let y = todayJ.jy - 10; y <= todayJ.jy + 10; y++) years.push(y);

  const daysInMonth = jalaaliMonthLength(curJy, curJm);
  const days: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const emit = (jy: number, jm: number, jd: number) => {
    if (!jd) return;
    try {
      const g = toGregorian(jy, jm, jd);
      onChange(`${g.gy}-${pad(g.gm)}-${pad(g.gd)}`);
    } catch {
      // ignore invalid
    }
  };

  const selectClass =
    'px-1 py-1.5 rounded-lg bg-muted border border-border text-xs focus:outline-none focus:ring-1 focus:ring-ring';

  return (
    <div className={cn('flex gap-1', className)}>
      <select
        value={curJd || ''}
        onChange={(e) => {
          const jd = Number(e.target.value);
          if (jd) emit(curJy, curJm, Math.min(jd, daysInMonth));
        }}
        className={cn(selectClass, 'flex-1')}
      >
        <option value="">روز</option>
        {days.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <select
        value={curJm}
        onChange={(e) => {
          const jm = Number(e.target.value);
          const maxDay = jalaaliMonthLength(curJy, jm);
          emit(curJy, jm, Math.min(curJd || 1, maxDay));
        }}
        className={cn(selectClass, 'flex-1')}
      >
        {JALALI_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select
        value={curJy}
        onChange={(e) => {
          const jy = Number(e.target.value);
          const maxDay = jalaaliMonthLength(jy, curJm);
          emit(jy, curJm, Math.min(curJd || 1, maxDay));
        }}
        className={cn(selectClass, 'w-[76px]')}
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      {allowClear && value && (
        <button type="button" onClick={() => onChange('')} className="px-2 py-1 rounded-lg bg-muted text-xs text-muted-foreground hover:bg-muted/80 shrink-0">
          بدون
        </button>
      )}
    </div>
  );
}

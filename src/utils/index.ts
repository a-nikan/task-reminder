import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateShort(date: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export function getWeekLater(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

export function isOverdue(date: string | null): boolean {
  if (!date) return false;
  return date < getToday();
}

export function isToday(date: string | null): boolean {
  if (!date) return false;
  return date === getToday();
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getMonthName(month: number): string {
  const months = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
  return months[month];
}

export function getDayName(day: number): string {
  const days = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  return days[day];
}

export function getShortDayName(day: number): string {
  const days = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];
  return days[day];
}

export function getGregorianDate(date?: Date): { year: number; month: number; day: number; monthName: string; dayName: string } {
  const d = date || new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const parts = formatter.formatToParts(d);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0');
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  const monthName = parts.find(p => p.type === 'month')?.value || '';
  const dayName = parts.find(p => p.type === 'weekday')?.value || '';
  return { year, month, day, monthName, dayName };
}

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const JALALI_DAYS = [
  'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'
];

import { toJalaali as toJalaaliLib, toGregorian as toGregorianLib, isLeapJalaaliYear as isLeapLib, jalaaliMonthLength as jMonthLengthLib } from 'jalaali-js';

export function toJalaali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  return toJalaaliLib(gy, gm, gd);
}

export function toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  return toGregorianLib(jy, jm, jd);
}

export function isLeapJalaliYear(jy: number): boolean {
  return isLeapLib(jy);
}

export function jalaaliMonthLength(jy: number, jm: number): number {
  return jMonthLengthLib(jy, jm);
}

export function getJalaliDate(date?: Date): { year: number; month: number; day: number; monthName: string; dayName: string } {
  const d = date || new Date();
  const j = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return {
    year: j.jy,
    month: j.jm,
    day: j.jd,
    monthName: JALALI_MONTHS[j.jm - 1],
    dayName: JALALI_DAYS[d.getDay()],
  };
}

export function getHeaderDate(calendarType: string | undefined, date?: Date): { title: string; subtitle: string } {
  if (calendarType === 'jalali') {
    const j = getJalaliDate(date);
    return { title: `${j.dayName}، ${j.day} ${j.monthName}`, subtitle: `سال ${j.year} شمسی` };
  }
  const g = getGregorianDate(date);
  return { title: `امروز، ${g.dayName}`, subtitle: `${g.monthName} ${g.day}, ${g.year}` };
}

export function formatTaskDateLocalized(dateStr: string | null, calendarType: string | undefined): string {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    if (calendarType === 'jalali') {
      const j = toJalaali(y, m, d);
      return `${j.jd} ${JALALI_MONTHS[j.jm - 1]}`;
    }
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d} ${monthsShort[m - 1]}`;
  } catch {
    return dateStr || '';
  }
}

export function formatReminderLocalized(iso: string | null | undefined, calendarType: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    if (calendarType === 'jalali') {
      const datePart = d.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' });
      const timePart = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      return `${datePart} ${timePart}`;
    }
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  } catch {
    return '';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'todo': return 'text-status-todo';
    case 'in_progress': return 'text-status-progress';
    case 'done': return 'text-status-done';
    default: return 'text-muted-foreground';
  }
}

export function getStatusBgColor(status: string): string {
  switch (status) {
    case 'todo': return 'bg-status-todo';
    case 'in_progress': return 'bg-status-progress';
    case 'done': return 'bg-status-done';
    default: return 'bg-muted';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'todo': return 'انجام نشده';
    case 'in_progress': return 'در حال انجام';
    case 'done': return 'انجام شده';
    default: return status;
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'low': return 'text-priority-low';
    case 'medium': return 'text-priority-medium';
    case 'high': return 'text-priority-high';
    case 'urgent': return 'text-priority-urgent';
    default: return 'text-muted-foreground';
  }
}

export function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'low': return 'کم';
    case 'medium': return 'متوسط';
    case 'high': return 'بالا';
    case 'urgent': return 'فوری';
    default: return priority;
  }
}

export function parseNaturalLanguage(text: string): { title: string; date?: string; time?: string; priority?: string } {
  let title = text;
  let date: string | undefined;
  let time: string | undefined;
  let priority: string | undefined;

  const today = getToday();
  const tomorrow = getTomorrow();

  if (text.includes('امروز')) {
    date = today;
    title = title.replace(/امروز/g, '').trim();
  }
  if (text.includes('فردا')) {
    date = tomorrow;
    title = title.replace(/فردا/g, '').trim();
  }
  if (text.includes('دیروز')) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    date = d.toISOString().split('T')[0];
    title = title.replace(/دیروز/g, '').trim();
  }

  const timeMatch = text.match(/ساعت\s*(\d{1,2}):?(\d{0,2})/);
  if (timeMatch) {
    const hour = timeMatch[1].padStart(2, '0');
    const min = (timeMatch[2] || '00').padStart(2, '0');
    time = `${hour}:${min}`;
    title = title.replace(/ساعت\s*\d{1,2}:?\d{0,2}/, '').trim();
  }

  const simpleTimeMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch && simpleTimeMatch) {
    time = `${simpleTimeMatch[1].padStart(2, '0')}:${simpleTimeMatch[2]}`;
    title = title.replace(/\d{1,2}:\d{2}/, '').trim();
  }

  if (text.includes('فوری') || text.includes('urgent')) {
    priority = 'urgent';
    title = title.replace(/فوری|urgent/g, '').trim();
  } else if (text.includes('مهم') || text.includes('high')) {
    priority = 'high';
    title = title.replace(/مهم|high/g, '').trim();
  }

  title = title.replace(/\s+/g, ' ').trim();

  return { title, date, time, priority };
}

export const RECURRENCE_OPTIONS = [
  { value: '', label: 'بدون تکرار' },
  { value: 'daily', label: 'هر روز' },
  { value: 'weekly', label: 'هر هفته' },
  { value: 'monthly', label: 'هر ماه' },
  { value: 'weekdays', label: 'روزهای هفته' },
  { value: 'weekly:1', label: 'هر دوشنبه' },
  { value: 'weekly:2', label: 'هر سه‌شنبه' },
  { value: 'weekly:3', label: 'هر چهارشنبه' },
  { value: 'weekly:4', label: 'هر پنجشنبه' },
  { value: 'weekly:5', label: 'هر جمعه' },
  { value: 'weekly:6', label: 'هر شنبه' },
];

export const REMINDER_OPTIONS = [
  { value: 0, label: 'بدون یادآوری' },
  { value: -1, label: 'سر زمان' },
  { value: 5, label: '۵ دقیقه قبل' },
  { value: 10, label: '۱۰ دقیقه قبل' },
  { value: 30, label: '۳۰ دقیقه قبل' },
  { value: 60, label: '۱ ساعت قبل' },
  { value: 1440, label: '۱ روز قبل' },
];

export const SNOOZE_OPTIONS = [
  { value: 5, label: '۵ دقیقه' },
  { value: 10, label: '۱۰ دقیقه' },
  { value: 30, label: '۳۰ دقیقه' },
  { value: 60, label: '۱ ساعت' },
  { value: 1440, label: 'فردا' },
];

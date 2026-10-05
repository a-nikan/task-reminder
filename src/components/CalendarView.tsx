import { useEffect, useState } from 'react';
import { useStore } from '../store';
import {
  cn, getToday, getDaysInMonth, getFirstDayOfMonth,
  toJalaali, toGregorian, jalaaliMonthLength, JALALI_MONTHS,
  formatTaskDateLocalized, getStatusBgColor,
} from '../utils';
import type { Task, CalendarView as CV } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { BulkToolbar } from './BulkToolbar';
import { useTaskSelection, useActiveReminders } from '../hooks/useTaskSelection';

function toLocalDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDaysLocal(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const GREG_MONTH_NAMES = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
const DAY_NAMES_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const DAY_NAMES_FULL = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

export function CalendarView() {
  const { tasks, loadCalendarTasks, setSelectedDate, setView, calendarView, setCalendarView, settings, refreshCurrentView, showToast, showConfirm, pushUndo } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hover, setHover] = useState<{ x: number; y: number; dateStr: string } | null>(null);
  const { selectionMode, selectedIds, toggleSelect, selectAll, clearSelection, setSelectionMode } = useTaskSelection();
  const { remindersMap, loadReminders } = useActiveReminders();

  const calendarType = settings.calendarType || 'gregorian';
  const isJalali = calendarType === 'jalali';

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Jalali cursor derived from gregorian cursor
  const jyjm = toJalaali(year, month + 1, 1);
  const jy = jyjm.jy;
  const jm = jyjm.jm;

  // Week range (week starts Saturday): offset from Saturday
  const weekOffset = (currentDate.getDay() + 1) % 7;
  const weekStart = addDaysLocal(currentDate, -weekOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysLocal(weekStart, i));

  const loadRange = () => {
    if (calendarView === 'day') {
      const ds = toLocalDateStr(currentDate);
      loadCalendarTasks(ds, ds);
    } else if (calendarView === 'week') {
      loadCalendarTasks(toLocalDateStr(weekStart), toLocalDateStr(addDaysLocal(weekStart, 6)));
    } else if (isJalali) {
      const startG = toGregorian(jy, jm, 1);
      const endG = toGregorian(jy, jm, jalaaliMonthLength(jy, jm));
      const pad = (n: number) => String(n).padStart(2, '0');
      const start = `${startG.gy}-${pad(startG.gm)}-${pad(startG.gd)}`;
      const end = `${endG.gy}-${pad(endG.gm)}-${pad(endG.gd)}`;
      loadCalendarTasks(start, end);
    } else {
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = getDaysInMonth(year, month);
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      loadCalendarTasks(start, end);
    }
    loadReminders();
  };

  useEffect(() => {
    loadRange();
  }, [year, month, isJalali, calendarView, toLocalDateStr(currentDate)]);

  const reload = async () => {
    loadRange();
    await refreshCurrentView();
  };

  const tasksByDate: Record<string, Task[]> = {};
  tasks.forEach(t => {
    if (t.date) {
      if (!tasksByDate[t.date]) tasksByDate[t.date] = [];
      tasksByDate[t.date].push(t);
    }
  });

  const today = getToday();

  const openDay = (dateStr: string) => {
    setHover(null);
    setSelectedDate(dateStr);
    setView('today');
  };

  const prevMonth = () => {
    setHover(null);
    if (isJalali) {
      const prev = jm === 1 ? { jy: jy - 1, jm: 12 } : { jy, jm: jm - 1 };
      const g = toGregorian(prev.jy, prev.jm, 1);
      setCurrentDate(new Date(g.gy, g.gm - 1, g.gd));
    } else {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };
  const nextMonth = () => {
    setHover(null);
    if (isJalali) {
      const next = jm === 12 ? { jy: jy + 1, jm: 1 } : { jy, jm: jm + 1 };
      const g = toGregorian(next.jy, next.jm, 1);
      setCurrentDate(new Date(g.gy, g.gm - 1, g.gd));
    } else {
      setCurrentDate(new Date(year, month + 1, 1));
    }
  };

  const prevStep = () => {
    setHover(null);
    if (calendarView === 'day') setCurrentDate(addDaysLocal(currentDate, -1));
    else if (calendarView === 'week') setCurrentDate(addDaysLocal(currentDate, -7));
    else prevMonth();
  };
  const nextStep = () => {
    setHover(null);
    if (calendarView === 'day') setCurrentDate(addDaysLocal(currentDate, 1));
    else if (calendarView === 'week') setCurrentDate(addDaysLocal(currentDate, 7));
    else nextMonth();
  };
  const goToday = () => { setHover(null); setCurrentDate(new Date()); };

  const monthTitle = isJalali ? `${JALALI_MONTHS[jm - 1]} ${jy}` : `${GREG_MONTH_NAMES[month]} ${year}`;
  const weekTitle = `${formatTaskDateLocalized(toLocalDateStr(weekStart), calendarType)} تا ${formatTaskDateLocalized(toLocalDateStr(addDaysLocal(weekStart, 6)), calendarType)}`;
  const headerTitle = calendarView === 'day'
    ? formatTaskDateLocalized(toLocalDateStr(currentDate), calendarType)
    : calendarView === 'week' ? weekTitle : monthTitle;

  const handleCellHover = (e: React.MouseEvent, dateStr: string) => {
    setHover({ x: e.clientX, y: e.clientY, dateStr });
  };
  const handleCellLeave = () => setHover(null);

  const hoverTasks = hover ? (tasksByDate[hover.dateStr] || []) : [];
  const hoverLeft = hover ? Math.max(8, Math.min(hover.x + 14, window.innerWidth - 280)) : 0;
  const hoverTop = hover ? hover.y + 14 : 0;
  const hoverFlip = hover ? hover.y > window.innerHeight - 300 : false;

  // Day-view task actions
  const handleStatusChange = async (id: string, status: Task['status']) => {
    await window.electronAPI.changeTaskStatus(id, status);
    reload();
  };
  const handleToggleFavorite = async (task: Task) => {
    await window.electronAPI.updateTask(task.id, { favorite: !task.favorite });
    reload();
  };
  const handleDelete = (task: Task) => {
    showConfirm({
      title: 'حذف تسک',
      message: `تسک «${task.title}» حذف شود؟`,
      onConfirm: async () => {
        pushUndo(task, 'delete');
        await window.electronAPI.deleteTask(task.id);
        reload();
        showToast('حذف شد', 'error', true);
      },
    });
  };
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const toDelete = tasks.filter(t => selectedIds.includes(t.id));
    showConfirm({
      title: 'حذف تسک‌ها',
      message: `${count} تسک انتخاب‌شده حذف شود؟`,
      onConfirm: async () => {
        pushUndo(toDelete, 'delete');
        await window.electronAPI.deleteMultipleTasks(selectedIds);
        clearSelection();
        reload();
        showToast(`${count} تسک حذف شد`, 'error', true);
      },
    });
  };

  const dayDateStr = toLocalDateStr(currentDate);
  const dayTasks = (tasksByDate[dayDateStr] || []).slice().sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return 0;
  });
  const dayWeekday = DAY_NAMES_FULL[(currentDate.getDay() + 1) % 7];

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">تقویم</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {headerTitle} ({isJalali ? 'شمسی' : 'میلادی'})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              {(['month', 'week', 'day'] as CV[]).map(v => (
                <button
                  key={v}
                  onClick={() => { setHover(null); clearSelection(); setCalendarView(v); }}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                    calendarView === v ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {v === 'month' ? 'ماه' : v === 'week' ? 'هفته' : 'روز'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button onClick={prevStep} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{headerTitle}</h2>
            <button onClick={goToday} className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
              امروز
            </button>
          </div>
          <button onClick={nextStep} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {calendarView === 'month' && (
          <div className="grid grid-cols-7 gap-px bg-border/30 rounded-xl overflow-hidden border border-border/50">
            {DAY_NAMES_SHORT.map((d, i) => (
              <div key={i} className="bg-card p-2 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {renderCells()}
          </div>
        )}

        {calendarView === 'week' && (
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((d, i) => {
              const dateStr = toLocalDateStr(d);
              const dayTasks = tasksByDate[dateStr] || [];
              const isCurrentDay = dateStr === today;
              const num = isJalali ? toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate()).jd : d.getDate();
              return (
                <div
                  key={dateStr}
                  onClick={() => openDay(dateStr)}
                  onMouseEnter={(e) => handleCellHover(e, dateStr)}
                  onMouseMove={(e) => handleCellHover(e, dateStr)}
                  onMouseLeave={handleCellLeave}
                  className={cn(
                    'rounded-xl border p-2 cursor-pointer transition-all min-h-[140px] bg-card',
                    isCurrentDay ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-accent/5'
                  )}
                >
                  <div className="text-center mb-2">
                    <div className="text-[10px] text-muted-foreground">{DAY_NAMES_SHORT[i]}</div>
                    <div className={cn(
                      'text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mx-auto mt-0.5',
                      isCurrentDay ? 'bg-primary text-primary-foreground' : 'text-foreground'
                    )}>
                      {num}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 4).map(t => (
                      <div key={t.id} className="text-[10px] truncate px-1.5 py-1 rounded-md bg-muted/60 flex items-center gap-1">
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', getStatusBgColor(t.status))} />
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))}
                    {dayTasks.length > 4 && (
                      <div className="text-[10px] text-muted-foreground text-center">+{dayTasks.length - 4} مورد دیگر</div>
                    )}
                    {dayTasks.length === 0 && (
                      <div className="text-[10px] text-muted-foreground/50 text-center mt-4">—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {calendarView === 'day' && (
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl border border-border/50 bg-card">
              <div className={cn('text-lg font-bold', dayDateStr === today ? 'text-primary' : 'text-foreground')}>
                {dayWeekday}، {formatTaskDateLocalized(dayDateStr, calendarType)}
              </div>
              <span className="text-xs text-muted-foreground">({dayTasks.length} تسک)</span>
            </div>
            <BulkToolbar
              totalCount={dayTasks.length}
              selectedCount={selectedIds.length}
              selectionMode={selectionMode}
              onEnterSelection={() => setSelectionMode(true)}
              onSelectAll={() => selectAll(dayTasks.map(t => t.id))}
              onClear={clearSelection}
              onDeleteSelected={handleDeleteSelected}
            />
            {dayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-muted-foreground">در این روز تسکی ثبت نشده</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dayTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onToggleFavorite={handleToggleFavorite}
                    onDelete={handleDelete}
                    selectionMode={selectionMode}
                    selected={selectedIds.includes(task.id)}
                    onToggleSelect={(t) => toggleSelect(t.id)}
                    reminderAt={remindersMap[task.id] ?? (task as any).reminder ?? null}
                    onReminderChanged={loadReminders}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {hover && calendarView !== 'day' && (
          <div
            className="fixed z-50 w-64 pointer-events-none animate-fade-in"
            style={{
              left: hoverLeft,
              top: hoverFlip ? undefined : hoverTop,
              bottom: hoverFlip ? window.innerHeight - hover.y + 14 : undefined,
            }}
          >
            <div className="rounded-xl border-2 border-border bg-card shadow-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">{formatTaskDateLocalized(hover.dateStr, calendarType)}</span>
                <span className="text-[10px] text-muted-foreground">{hoverTasks.length} تسک</span>
              </div>
              {hoverTasks.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">تسکی در این روز نیست</p>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {hoverTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-muted/50">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', getStatusBgColor(t.status))} />
                      <span className={cn('flex-1 text-[11px] truncate', t.status === 'done' && 'line-through text-muted-foreground')}>
                        {t.title}
                      </span>
                      {t.time && <span className="text-[10px] text-muted-foreground shrink-0">{t.time}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function renderCells() {
    const cells: React.ReactNode[] = [];

    if (isJalali) {
      const daysInMonth = jalaaliMonthLength(jy, jm);
      const firstG = toGregorian(jy, jm, 1);
      const firstDate = new Date(firstG.gy, firstG.gm - 1, firstG.gd);
      const firstDay = firstDate.getDay();
      const prevJm = jm === 1 ? 12 : jm - 1;
      const prevJy = jm === 1 ? jy - 1 : jy;
      const prevMonthDays = jalaaliMonthLength(prevJy, prevJm);

      for (let i = firstDay - 1; i >= 0; i--) {
        const jDay = prevMonthDays - i;
        const g = toGregorian(prevJy, prevJm, jDay);
        const dateStr = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
        cells.push(
          <DayCell key={`prev-${jDay}`} day={jDay} dateStr={dateStr} tasks={tasksByDate[dateStr] || []} today={today} dim onClick={() => {}} onHover={handleCellHover} onLeave={handleCellLeave} />
        );
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const g = toGregorian(jy, jm, day);
        const dateStr = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
        cells.push(
          <DayCell
            key={`current-${day}`}
            day={day}
            dateStr={dateStr}
            tasks={tasksByDate[dateStr] || []}
            today={today}
            onClick={() => openDay(dateStr)}
            onHover={handleCellHover}
            onLeave={handleCellLeave}
          />
        );
      }

      const totalCells = cells.length;
      const remaining = (7 - (totalCells % 7)) % 7;
      const nextJm = jm === 12 ? 1 : jm + 1;
      const nextJy = jm === 12 ? jy + 1 : jy;
      for (let i = 1; i <= remaining; i++) {
        const g = toGregorian(nextJy, nextJm, i);
        const dateStr = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
        cells.push(
          <DayCell key={`next-${i}`} day={i} dateStr={dateStr} tasks={tasksByDate[dateStr] || []} today={today} dim onClick={() => {}} onHover={handleCellHover} onLeave={handleCellLeave} />
        );
      }
    } else {
      const daysInMonth = getDaysInMonth(year, month);
      const firstDay = getFirstDayOfMonth(year, month);
      const prevMonthDays = getDaysInMonth(year, month - 1);

      for (let i = firstDay - 1; i >= 0; i--) {
        const day = prevMonthDays - i;
        const d = new Date(year, month - 1, day);
        const dateStr = toLocalDateStr(d);
        cells.push(
          <DayCell key={`prev-${day}`} day={day} dateStr={dateStr} tasks={tasksByDate[dateStr] || []} today={today} dim onClick={() => {}} onHover={handleCellHover} onLeave={handleCellLeave} />
        );
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, month, day);
        const dateStr = toLocalDateStr(d);
        cells.push(
          <DayCell
            key={`current-${day}`}
            day={day}
            dateStr={dateStr}
            tasks={tasksByDate[dateStr] || []}
            today={today}
            onClick={() => openDay(dateStr)}
            onHover={handleCellHover}
            onLeave={handleCellLeave}
          />
        );
      }

      const totalCells = cells.length;
      const remaining = (7 - (totalCells % 7)) % 7;
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i);
        const dateStr = toLocalDateStr(d);
        cells.push(
          <DayCell key={`next-${i}`} day={i} dateStr={dateStr} tasks={tasksByDate[dateStr] || []} today={today} dim onClick={() => {}} onHover={handleCellHover} onLeave={handleCellLeave} />
        );
      }
    }

    return cells;
  }
}

function DayCell({ day, dateStr, tasks, today, dim, onClick, onHover, onLeave }: {
  day: number;
  dateStr: string;
  tasks: Task[];
  today: string;
  dim?: boolean;
  onClick: () => void;
  onHover: (e: React.MouseEvent, dateStr: string) => void;
  onLeave: () => void;
}) {
  const isCurrentDay = dateStr === today;

  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const progressCount = tasks.filter(t => t.status === 'in_progress').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

  return (
    <div
      onClick={onClick}
      onMouseEnter={(e) => onHover(e, dateStr)}
      onMouseMove={(e) => onHover(e, dateStr)}
      onMouseLeave={onLeave}
      className={cn(
        'min-h-[80px] p-1.5 rounded-lg border transition-all duration-150',
        dim ? 'border-transparent opacity-30' : 'cursor-pointer hover:bg-accent/10',
        !dim && (isCurrentDay ? 'border-primary bg-primary/5' : 'border-border/30')
      )}
    >
      <div className={cn(
        'text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full',
        isCurrentDay && !dim ? 'bg-primary text-primary-foreground' : 'text-foreground'
      )}>
        {day}
      </div>
      <div className="space-y-0.5">
        {tasks.slice(0, 3).map(t => (
          <div key={t.id} className="text-[10px] truncate px-1 py-0.5 rounded bg-muted/50">
            {t.title}
          </div>
        ))}
        {tasks.length > 3 && (
          <div className="text-[10px] text-muted-foreground px-1">+{tasks.length - 3}</div>
        )}
      </div>
      {tasks.length > 0 && (
        <div className="flex gap-1 mt-1">
          {todoCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-status-todo" />}
          {progressCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-status-progress" />}
          {doneCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-status-done" />}
        </div>
      )}
    </div>
  );
}

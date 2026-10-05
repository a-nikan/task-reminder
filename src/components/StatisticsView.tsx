import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { cn } from '../utils';
import type { TaskStats } from '../types';
import { BarChart3, CheckCircle, Clock, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';

export function StatisticsView() {
  const { stats, loadStats } = useStore();
  const [version, setVersion] = useState('');

  useEffect(() => { loadStats(); }, []);

  const completionRate = stats ? (stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0) : 0;

  const dayNames = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

  const bestDay = stats?.weeklyStats?.length
    ? stats.weeklyStats.reduce((best, curr) => (curr.count > best.count ? curr : best), stats.weeklyStats[0])
    : null;

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">آمار</h1>

        {stats && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatCard icon={<CheckCircle className="w-5 h-5 text-status-done" />} label="انجام شده" value={stats.done} sub={`از ${stats.total}`} />
              <StatCard icon={<Clock className="w-5 h-5 text-status-progress" />} label="در حال انجام" value={stats.in_progress} />
              <StatCard icon={<AlertTriangle className="w-5 h-5 text-status-todo" />} label="عقب‌افتاده" value={stats.overdue} />
            </div>

            <div className="p-4 rounded-xl border border-border/50 bg-card mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">نرخ تکمیل</h3>
                <span className="text-2xl font-bold text-primary">{completionRate}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-l from-status-done to-status-done/70 rounded-full transition-all duration-700" style={{ width: `${completionRate}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 rounded-xl border border-border/50 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-medium">تسک‌های امروز</h3>
                </div>
                <div className="text-2xl font-bold">{stats.todayCount}</div>
                <div className="text-xs text-muted-foreground mt-1">{stats.todayDone} انجام شده</div>
              </div>
              <div className="p-4 rounded-xl border border-border/50 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-medium">هفته اخیر</h3>
                </div>
                <div className="text-2xl font-bold">{stats.weekCompleted}</div>
                <div className="text-xs text-muted-foreground mt-1">تسک تکمیل شده</div>
              </div>
            </div>

            {stats.weeklyStats && stats.weeklyStats.length > 0 && (
              <div className="p-4 rounded-xl border border-border/50 bg-card mb-6">
                <h3 className="text-sm font-medium mb-4">عملکرد هفتگی (۳۰ روز اخیر)</h3>
                <div className="flex items-end gap-2 h-32">
                  {dayNames.map((name, i) => {
                    const stat = stats.weeklyStats.find(s => String(s.dayOfWeek) === String(i));
                    const count = stat?.count || 0;
                    const maxCount = Math.max(...stats.weeklyStats.map(s => s.count), 1);
                    const height = (count / maxCount) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">{count}</span>
                        <div className="w-full rounded-t-md bg-primary/20 relative" style={{ height: `${Math.max(height, 4)}%` }}>
                          <div className="absolute bottom-0 w-full rounded-t-md bg-primary transition-all duration-500" style={{ height: `${count > 0 ? 100 : 0}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{name.slice(0, 2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {bestDay && (
              <div className="p-4 rounded-xl border border-border/50 bg-card">
                <h3 className="text-sm font-medium mb-2">بهترین روز هفته</h3>
                <div className="text-lg font-bold text-primary">{dayNames[Number(bestDay.dayOfWeek)] || 'نامشخص'}</div>
                <div className="text-xs text-muted-foreground">{bestDay.count} تسک تکمیل شده</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="p-4 rounded-xl border border-border/50 bg-card">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

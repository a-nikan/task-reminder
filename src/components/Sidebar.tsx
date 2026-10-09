import { useEffect, useState } from 'react';
import { useStore } from '../store';
import {
  CalendarDays, ListTodo, Clock, AlertTriangle, Star, LayoutGrid,
  BarChart3, Settings, Plus, Keyboard, RefreshCw
} from 'lucide-react';
import { syncNow } from '../platform/lanSync';
import { cn, getToday, getHeaderDate } from '../utils';
import type { ViewType } from '../types';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
}

const mainNav: NavItem[] = [
  { id: 'today', label: 'امروز', icon: <CalendarDays className="w-4.5 h-4.5" />, shortcut: 'Ctrl+T' },
  { id: 'calendar', label: 'تقویم', icon: <CalendarDays className="w-4.5 h-4.5" />, shortcut: 'Ctrl+C' },
  { id: 'all', label: 'همه تسک‌ها', icon: <ListTodo className="w-4.5 h-4.5" />, shortcut: 'Ctrl+L' },
  { id: 'anytime', label: 'بدون تاریخ', icon: <Clock className="w-4.5 h-4.5" />, shortcut: 'Ctrl+A' },
  { id: 'overdue', label: 'عقب‌افتاده', icon: <AlertTriangle className="w-4.5 h-4.5" />, shortcut: 'Ctrl+O' },
  { id: 'important', label: 'مهم‌ها', icon: <Star className="w-4.5 h-4.5" /> },
];

const bottomNav: NavItem[] = [
  { id: 'categories', label: 'دسته‌بندی‌ها', icon: <LayoutGrid className="w-4.5 h-4.5" /> },
  { id: 'statistics', label: 'آمار', icon: <BarChart3 className="w-4.5 h-4.5" /> },
  { id: 'settings', label: 'تنظیمات', icon: <Settings className="w-4.5 h-4.5" /> },
];

export function Sidebar() {
  const {
    view, setView, settings, setSelectedDate,
    setShowNewTaskForm, setOnboardingComplete, updateSettings,
    sidebarOpen, setSidebarOpen, showToast, refreshCurrentView,
  } = useStore();

  const [appVersion, setAppVersion] = useState('');
  const [syncing, setSyncing] = useState(false);
  // Manual LAN sync is a phone feature (desktop IS the server)
  const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

  useEffect(() => {
    window.electronAPI.getVersion().then(v => setAppVersion(v)).catch(() => {});
  }, []);

  const navigate = (id: typeof view) => {
    if (id === 'today') setSelectedDate(null);
    setView(id);
    setSidebarOpen(false);
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const r = await syncNow();
      if (r.ok) {
        await refreshCurrentView();
        setSidebarOpen(false);
      }
      else if (r.error === 'not_configured') showToast('ابتدا آدرس و توکن را در تنظیمات وارد کنید', 'error');
      else if (r.error === 'unreachable') showToast('به کامپیوتر وصل نشد — هر دو به یک وای‌فای متصل و برنامه ویندوز باز باشد', 'error');
      else if (r.error === 'timeout') showToast('کامپیوتر پاسخ نداد — دوباره تلاش کنید', 'error');
      else if (r.error === 'bad_token') showToast('توکن نادرست است', 'error');
      else if (r.error !== 'busy') showToast('همگام‌سازی ناموفق بود', 'error');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 't') { e.preventDefault(); setSelectedDate(null); setView('today'); }
      if (e.ctrlKey && e.key === 'c') { e.preventDefault(); setView('calendar'); }
      if (e.ctrlKey && e.key === 'l') { e.preventDefault(); setView('all'); }
      if (e.ctrlKey && e.key === 'a') { e.preventDefault(); setView('anytime'); }
      if (e.ctrlKey && e.key === 'o') { e.preventDefault(); setView('overdue'); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); setShowNewTaskForm(true); }
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); useStore.getState().setShowCommandPalette(true); }
      if (e.key === 'Escape') {
        useStore.getState().setShowCommandPalette(false);
        useStore.getState().setShowNewTaskForm(false);
        useStore.getState().setShowTaskDetail(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const today = getToday();
  const header = getHeaderDate(settings.calendarType, new Date());

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          'w-60 h-full bg-sidebar border-l border-sidebar-border flex flex-col shrink-0 select-none',
          'fixed inset-y-0 right-0 z-40 transition-transform duration-200',
          'lg:static lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
      <div className="p-3 border-b border-sidebar-border">
        <button
          onClick={() => setShowNewTaskForm(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          تسک جدید
        </button>
      </div>

      <div className="p-2 text-xs text-muted-foreground px-3 pt-3">
        <div className="font-medium text-foreground text-sm">{header.title}</div>
        <div>{header.subtitle}</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1">
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                view === item.id
                  ? 'bg-accent/15 text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className={view === item.id ? 'text-primary' : ''}>{item.icon}</span>
              <span className="flex-1 text-right">{item.label}</span>
              {item.shortcut && (
                <span className="hidden lg:block text-[10px] text-muted-foreground/50 font-mono">{item.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <div className="px-2 py-1 border-t border-sidebar-border">
        <div className="space-y-0.5">
          {bottomNav.map((item) => (
            <button
              key={item.id}
              onClick={() => { setView(item.id); setSidebarOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                view === item.id
                  ? 'bg-accent/15 text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className={view === item.id ? 'text-primary' : ''}>{item.icon}</span>
              <span className="flex-1 text-right">{item.label}</span>
            </button>
          ))}
          {isNative && (
          <button
            onClick={handleSync}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
            <span className="flex-1 text-right">{syncing ? 'در حال همگام‌سازی...' : 'همگام‌سازی'}</span>
          </button>
          )}
        </div>
      </div>

      <div className="p-3 border-t border-sidebar-border">
        <div className="hidden lg:flex items-center gap-2 text-[10px] text-muted-foreground/50">
          <Keyboard className="w-3 h-3" />
          <span>Ctrl+/ راهنما</span>
        </div>
        <div className="text-[10px] text-muted-foreground/30 mt-1">{appVersion ? `v${appVersion}` : ''}</div>
      </div>
      </aside>
    </>
  );
}

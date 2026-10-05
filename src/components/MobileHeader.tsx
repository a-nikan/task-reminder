import { Menu, ArrowRight } from 'lucide-react';
import { useStore } from '../store';
import type { ViewType } from '../types';

const viewTitles: Record<string, string> = {
  today: 'امروز',
  calendar: 'تقویم',
  all: 'همه تسک‌ها',
  anytime: 'بدون تاریخ',
  overdue: 'عقب‌افتاده',
  important: 'مهم‌ها',
  categories: 'دسته‌بندی‌ها',
  'category-detail': 'دسته‌بندی',
  statistics: 'آمار',
  settings: 'تنظیمات',
};

export function MobileHeader() {
  const view = useStore((s) => s.view) as ViewType;
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const setView = useStore((s) => s.setView);
  const setSelectedCategoryId = useStore((s) => s.setSelectedCategoryId);
  const selectedTask = useStore((s) => s.selectedTask);
  const setSelectedTask = useStore((s) => s.setSelectedTask);
  const showNewTaskForm = useStore((s) => s.showNewTaskForm);
  const showEditTaskForm = useStore((s) => s.showEditTaskForm);
  const showCommandPalette = useStore((s) => s.showCommandPalette);
  const setShowNewTaskForm = useStore((s) => s.setShowNewTaskForm);
  const setShowEditTaskForm = useStore((s) => s.setShowEditTaskForm);
  const setShowCommandPalette = useStore((s) => s.setShowCommandPalette);

  const goBack = () => {
    if (showCommandPalette) { setShowCommandPalette(false); return; }
    if (showEditTaskForm) { setShowEditTaskForm(false); return; }
    if (showNewTaskForm) { setShowNewTaskForm(false); return; }
    if (selectedTask) { setSelectedTask(null); return; }
    if (view === 'category-detail') { setView('categories'); return; }
    setView('today');
    setSelectedCategoryId(null);
  };

  const isHome = view === 'today';

  return (
    <header className="lg:hidden h-11 shrink-0 bg-background border-b border-border flex items-center gap-3 px-3 select-none">
      <button
        onClick={() => (isHome ? setSidebarOpen(true) : goBack())}
        className="p-1.5 rounded-md hover:bg-muted text-foreground transition-colors"
        aria-label={isHome ? 'منو' : 'بازگشت'}
      >
        {isHome ? <Menu className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
      </button>
      <span className="text-sm font-medium text-foreground">{viewTitles[view] || 'Nick Task Reminder'}</span>
    </header>
  );
}

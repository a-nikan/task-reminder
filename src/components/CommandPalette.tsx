import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { cn } from '../utils';
import { Search, CalendarDays, ListTodo, Clock, AlertTriangle, Star, BarChart3, Settings, Plus, LayoutGrid, ArrowRight, Moon, Sun } from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

export function CommandPalette() {
  const { setShowCommandPalette, setView, setShowNewTaskForm, searchTasks, setSearchResults, searchResults, theme, setTheme, setSelectedTask, setShowTaskDetail } = useStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = [
    { id: 'new-task', label: 'ایجاد تسک جدید', icon: <Plus className="w-4 h-4" />, action: () => { setShowNewTaskForm(true); setShowCommandPalette(false); }, category: 'عملیات' },
    { id: 'today', label: 'رفتن به امروز', icon: <CalendarDays className="w-4 h-4" />, action: () => { setView('today'); setShowCommandPalette(false); }, category: 'ناوبری' },
    { id: 'calendar', label: 'باز کردن تقویم', icon: <CalendarDays className="w-4 h-4" />, action: () => { setView('calendar'); setShowCommandPalette(false); }, category: 'ناوبری' },
    { id: 'all', label: 'همه تسک‌ها', icon: <ListTodo className="w-4 h-4" />, action: () => { setView('all'); setShowCommandPalette(false); }, category: 'ناوبری' },
    { id: 'anytime', label: 'تسک‌های بدون تاریخ', icon: <Clock className="w-4 h-4" />, action: () => { setView('anytime'); setShowCommandPalette(false); }, category: 'ناوبری' },
    { id: 'overdue', label: 'تسک‌های عقب‌افتاده', icon: <AlertTriangle className="w-4 h-4" />, action: () => { setView('overdue'); setShowCommandPalette(false); }, category: 'ناوبری' },
    { id: 'important', label: 'تسک‌های مهم', icon: <Star className="w-4 h-4" />, action: () => { setView('important'); setShowCommandPalette(false); }, category: 'ناوبری' },
    { id: 'categories', label: 'دسته‌بندی‌ها', icon: <LayoutGrid className="w-4 h-4" />, action: () => { setView('categories'); setShowCommandPalette(false); }, category: 'ناوبری' },
    { id: 'statistics', label: 'آمار', icon: <BarChart3 className="w-4 h-4" />, action: () => { setView('statistics'); setShowCommandPalette(false); }, category: 'ناوبری' },
    { id: 'settings', label: 'تنظیمات', icon: <Settings className="w-4 h-4" />, action: () => { setView('settings'); setShowCommandPalette(false); }, category: 'ناوبری' },
    { id: 'theme', label: `تغییر به حالت ${theme === 'dark' ? 'روشن' : 'تاریک'}`, icon: theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />, action: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); setShowCommandPalette(false); }, category: 'عملیات' },
  ];

  const filteredCommands = query.trim()
    ? commands.filter(c => c.label.includes(query))
    : commands;

  const taskResults = searchResults.length > 0 ? searchResults.map(t => ({
    id: `task-${t.id}`,
    label: t.title,
    icon: <ListTodo className="w-4 h-4" />,
    action: () => { setSelectedTask(t); setShowTaskDetail(true); setShowCommandPalette(false); },
    category: 'تسک‌ها',
  })) : [];

  const allItems = [...filteredCommands, ...taskResults];

  useEffect(() => {
    if (query.trim().length >= 2) {
      searchTasks(query).then(results => setSearchResults(results.slice(0, 5)));
    } else {
      setSearchResults([]);
    }
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && allItems[selectedIndex]) {
        allItems[selectedIndex].action();
      } else if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, allItems]);

  const groupedItems = allItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof allItems>);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCommandPalette(false)} />
      <div className="h-[18%] shrink-0" />
      <div className="relative w-full max-w-md mx-4 bg-card rounded-2xl border border-border shadow-2xl overflow-hidden animate-slide-up">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="چه کاری می‌خواهید انجام دهید؟"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono">ESC</kbd>
        </div>

        <div className="max-h-[300px] overflow-y-auto py-2">
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category}>
              <div className="px-4 py-1 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider">{category}</div>
              {items.map(item => {
                const globalIndex = allItems.indexOf(item);
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors',
                      globalIndex === selectedIndex ? 'bg-accent/15 text-foreground' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
                    <span className="flex-1 text-right">{item.label}</span>
                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          ))}
          {allItems.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">نتیجه‌ای یافت نشد</div>
          )}
        </div>
      </div>
    </div>
  );
}

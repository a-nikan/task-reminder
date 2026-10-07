import { useEffect } from 'react';
import { useStore } from './store';
import { Sidebar } from './components/Sidebar';
import { MobileHeader } from './components/MobileHeader';
import { TitleBar } from './components/TitleBar';
import { TodayView } from './components/TodayView';
import { CalendarView } from './components/CalendarView';
import { AllTasksView } from './components/AllTasksView';
import { AnytimeView } from './components/AnytimeView';
import { OverdueView } from './components/OverdueView';
import { ImportantView } from './components/ImportantView';
import { CategoriesView } from './components/CategoriesView';
import { CategoryDetailView } from './components/CategoryDetailView';
import { StatisticsView } from './components/StatisticsView';
import { SettingsView } from './components/SettingsView';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { NewTaskModal } from './components/NewTaskModal';
import { EditTaskModal } from './components/EditTaskModal';
import { CommandPalette } from './components/CommandPalette';
import { Toast } from './components/Toast';
import { ReminderAlert } from './components/ReminderAlert';
import { TaskWidget } from './components/TaskWidget';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Onboarding } from './components/Onboarding';

export default function App() {
  const {
    view, setView, loadSettings, loadCategories, loadTags,
    showTaskDetail, showNewTaskForm, showEditTaskForm, showCommandPalette,
    onboardingComplete, setShowNewTaskForm, showToast, refreshCurrentView,
    setIsMaximized, settings,
  } = useStore();

  useEffect(() => {
    const init = async () => {
      await loadSettings();
      await loadCategories();
      await loadTags();
    };
    init();

    window.electronAPI.onMaximizeChange((maximized) => {
      setIsMaximized(maximized);
    });

    window.electronAPI.onNewTask(() => {
      setShowNewTaskForm(true);
    });

    window.electronAPI.onNotificationAction(async (data) => {
      let popped = false;
      try {
        const rem = await window.electronAPI.getReminder(data.taskId);
        const effective = rem ? (rem.snoozed_until || rem.remind_at) : null;
        const native = typeof (window as any).Capacitor !== 'undefined' && !!(window as any).Capacitor.isNativePlatform?.();
        if (!native && rem && effective && new Date(effective).getTime() <= Date.now() + 5000) {
          useStore.getState().pushReminderAlert({ taskId: data.taskId, title: data.title, remindAt: effective });
          popped = true;
        }
      } catch {
        // fall through to toast
      }
      if (!popped) showToast(`⏰ یادآوری: ${data.title}`, 'info');
      refreshCurrentView();
    });

    window.electronAPI.onOpenTask(async (data) => {
      try {
        const task = await window.electronAPI.getTaskById(data.taskId);
        if (task) {
          useStore.getState().setSelectedTask(task);
          useStore.getState().setShowTaskDetail(true);
          refreshCurrentView();
        }
      } catch {
        // ignore
      }
    });

    window.electronAPI.onTasksChanged(async (taskId) => {
      try {
        await refreshCurrentView();
        const sel = useStore.getState().selectedTask;
        if (sel && (!taskId || sel.id === taskId)) {
          const updated = await window.electronAPI.getTaskById(sel.id).catch(() => null);
          if (updated) useStore.getState().setSelectedTask(updated);
          else {
            useStore.getState().setSelectedTask(null);
            useStore.getState().setShowTaskDetail(false);
          }
        }
      } catch {
        // ignore
      }
    });

    window.electronAPI.onNavigateTo((viewName: string) => {
      const validViews = ['today', 'calendar', 'all', 'anytime', 'overdue', 'important', 'settings'];
      if (validViews.includes(viewName)) {
        setView(viewName as any);
      }
    });
  }, []);

  useEffect(() => {
    if (window.location.hash.match(/^#\/?widget\//)) return;
    const s = parseInt(settings.uiScale || '100', 10);
    const z = isNaN(s) ? 1 : Math.min(2, Math.max(0.5, s / 100));
    document.documentElement.style.setProperty('--zoom', String(z));
    const root = document.getElementById('root');
    if (root) {
      const st = root.style as any;
      // zoom scales layout too: shrink the root box so painted output fills exactly 100vw x 100vh
      st.zoom = String(z);
      st.width = `${100 / z}vw`;
      st.height = `${100 / z}vh`;
    }
  }, [settings.uiScale]);

  const widgetMatch = window.location.hash.match(/^#\/?widget\/(.+)$/);
  if (widgetMatch) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-transparent">
        <TaskWidget taskId={decodeURIComponent(widgetMatch[1])} />
        <Toast />
      </div>
    );
  }

  const renderView = () => {    switch (view) {
      case 'today': return <TodayView />;
      case 'calendar': return <CalendarView />;
      case 'all': return <AllTasksView />;
      case 'anytime': return <AnytimeView />;
      case 'overdue': return <OverdueView />;
      case 'important': return <ImportantView />;
      case 'categories': return <CategoriesView />;
      case 'category-detail': return <CategoryDetailView />;
      case 'statistics': return <StatisticsView />;
      case 'settings': return <SettingsView />;
      default: return <TodayView />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {!onboardingComplete && settings.onboardingComplete !== 'true' && <Onboarding />}
      <TitleBar />
      <MobileHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden relative">
          {renderView()}
        </main>
        {showTaskDetail && <TaskDetailPanel />}
      </div>
      {showNewTaskForm && <NewTaskModal />}
      {showEditTaskForm && <EditTaskModal />}
      {showCommandPalette && <CommandPalette />}
      <Toast />
      <ReminderAlert />
      <ConfirmDialog />
    </div>
  );
}

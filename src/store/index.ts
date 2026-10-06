import { create } from 'zustand';
import type { Task, Category, Tag, Settings, TaskStats, ViewType, TaskStatus, TaskPriority, CalendarView } from '../types';

declare global {
  interface Window {
    electronAPI: {
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      onMaximizeChange: (callback: (maximized: boolean) => void) => void;
      getTasks: (filters?: any) => Promise<Task[]>;
      getTaskById: (id: string) => Promise<Task>;
      createTask: (task: any) => Promise<Task>;
      updateTask: (id: string, updates: any) => Promise<Task>;
      deleteTask: (id: string) => Promise<{ success: boolean }>;
      deleteMultipleTasks: (ids: string[]) => Promise<{ success: boolean; deleted?: number }>;
      deleteAllTasks: () => Promise<{ success: boolean }>;
      archiveTask: (id: string) => Promise<Task>;
      restoreTask: (id: string) => Promise<Task>;
      moveTaskToDate: (id: string, date: string | null) => Promise<Task>;
      changeTaskStatus: (id: string, status: string) => Promise<Task>;
      reorderTasks: (taskIds: string[]) => Promise<{ success: boolean }>;
      getTasksByDate: (date: string) => Promise<Task[]>;
      getOverdueTasks: () => Promise<Task[]>;
      getAnytimeTasks: () => Promise<Task[]>;
      getImportantTasks: () => Promise<Task[]>;
      searchTasks: (query: string) => Promise<Task[]>;
      getTaskStats: () => Promise<TaskStats>;
      getTodayTasks: () => Promise<Task[]>;
      getCalendarTasks: (startDate: string, endDate: string) => Promise<Task[]>;
      getCategories: () => Promise<Category[]>;
      createCategory: (cat: any) => Promise<Category>;
      updateCategory: (id: string, updates: any) => Promise<Category>;
      deleteCategory: (id: string) => Promise<{ success: boolean }>;
      getTags: () => Promise<Tag[]>;
      createTag: (tag: any) => Promise<Tag>;
      deleteTag: (id: string) => Promise<{ success: boolean }>;
      getSettings: () => Promise<Record<string, string>>;
      updateSettings: (settings: any) => Promise<{ success: boolean }>;
      exportData: (format: string) => Promise<any>;
      importData: (filePath?: string) => Promise<any>;
      getSyncSnapshot: () => Promise<any>;
      applySyncSnapshot: (snap: any) => Promise<any>;
      lanInfo: () => Promise<{ running: boolean; port: number; addresses: string[]; token: string; error: string | null }>;
      lanRegenToken: () => Promise<{ success: boolean; token: string }>;
      showNotification: (title: string, body: string, actions?: string[]) => Promise<void>;
      setReminder: (taskId: string, remindAt: string) => Promise<any>;
      cancelReminder: (taskId: string) => Promise<any>;
      getReminder: (taskId: string) => Promise<any>;
      getActiveReminders: () => Promise<Record<string, string>>;
      snoozeReminder: (taskId: string, minutes: number) => Promise<any>;
      onNewTask: (callback: () => void) => void;
      onNotificationAction: (callback: (data: { taskId: string; reminderId: string; title: string }) => void) => void;
      onOpenTask: (callback: (data: { taskId: string }) => void) => void;
      onNavigateTo: (callback: (view: string) => void) => void;
      getVersion: () => Promise<string>;
      setAutoLaunch: (enabled: boolean) => Promise<any>;
      getAutoLaunch: () => Promise<boolean>;
      widgetOpen: (taskId: string) => Promise<any>;
      widgetClose: (taskId: string) => Promise<any>;
      widgetSetOnTop: (taskId: string, onTop: boolean) => Promise<any>;
      showTaskInMain: (taskId: string) => Promise<any>;
      notifyWidgetChanged: (taskId: string) => Promise<any>;
      onTasksChanged: (callback: (taskId: string) => void) => void;
      copyLinkedTask: (taskId: string, newDate: string) => Promise<Task>;
      toggleSubtask: (taskId: string, subtaskId: string) => Promise<Task>;
      addSubtask: (taskId: string, title: string) => Promise<Task>;
      removeSubtask: (taskId: string, subtaskId: string) => Promise<Task>;
      getLinkedTasks: (linkedId: string) => Promise<Task[]>;
    };
  }
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}

interface AppState {
  view: ViewType;
  setView: (view: ViewType) => void;
  selectedCategoryId: string | null;
  setSelectedCategoryId: (id: string | null) => void;
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
  calendarView: CalendarView;
  setCalendarView: (view: CalendarView) => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  loadTasks: (filters?: any) => Promise<void>;
  loadTodayTasks: () => Promise<void>;
  loadAnytimeTasks: () => Promise<void>;
  loadOverdueTasks: () => Promise<void>;
  loadImportantTasks: () => Promise<void>;
  loadCalendarTasks: (start: string, end: string) => Promise<void>;

  categories: Category[];
  loadCategories: () => Promise<void>;
  tags: Tag[];
  loadTags: () => Promise<void>;

  stats: TaskStats | null;
  loadStats: () => Promise<void>;

  settings: Record<string, string>;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Record<string, string>) => Promise<void>;

  selectedTask: Task | null;
  setSelectedTask: (task: Task | null) => void;
  showTaskDetail: boolean;
  setShowTaskDetail: (show: boolean) => void;
  showNewTaskForm: boolean;
  setShowNewTaskForm: (show: boolean) => void;
  editingTask: Task | null;
  setEditingTask: (task: Task | null) => void;
  showEditTaskForm: boolean;
  setShowEditTaskForm: (show: boolean) => void;

  showCommandPalette: boolean;
  setShowCommandPalette: (show: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: Task[];
  setSearchResults: (results: Task[]) => void;

  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  accentColor: string;
  setAccentColor: (color: string) => void;

  isMaximized: boolean;
  setIsMaximized: (maximized: boolean) => void;

  toast: { message: string; type: 'success' | 'error' | 'info'; undoable?: boolean } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info', undoable?: boolean) => void;
  hideToast: () => void;

  reminderAlerts: { taskId: string; title: string; remindAt: string }[];
  pushReminderAlert: (alert: { taskId: string; title: string; remindAt: string }) => void;
  popReminderAlert: () => void;

  undoStack: { tasks: Task[]; action: string }[];
  pushUndo: (tasks: Task | Task[], action: string) => void;
  popUndo: () => { tasks: Task[]; action: string } | undefined;

  confirmDialog: ConfirmOptions | null;
  showConfirm: (options: ConfirmOptions) => void;
  hideConfirm: () => void;

  searchTasks: (query: string) => Promise<Task[]>;
  changeTaskStatus: (id: string, status: string) => Promise<void>;
  refreshCurrentView: () => Promise<void>;

  onboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  view: 'today',
  setView: (view) => set({ view }),
  selectedCategoryId: null,
  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
  selectedDate: null,
  setSelectedDate: (date) => set({ selectedDate: date }),
  calendarView: 'month',
  setCalendarView: (view) => set({ calendarView: view }),

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  loadTasks: async (filters) => {
    const tasks = await window.electronAPI.getTasks(filters);
    set({ tasks });
  },
  loadTodayTasks: async () => {
    const tasks = await window.electronAPI.getTodayTasks();
    set({ tasks });
  },
  loadAnytimeTasks: async () => {
    const tasks = await window.electronAPI.getAnytimeTasks();
    set({ tasks });
  },
  loadOverdueTasks: async () => {
    const tasks = await window.electronAPI.getOverdueTasks();
    set({ tasks });
  },
  loadImportantTasks: async () => {
    const tasks = await window.electronAPI.getImportantTasks();
    set({ tasks });
  },
  loadCalendarTasks: async (start, end) => {
    const tasks = await window.electronAPI.getCalendarTasks(start, end);
    set({ tasks });
  },

  categories: [],
  loadCategories: async () => {
    const categories = await window.electronAPI.getCategories();
    set({ categories });
  },
  tags: [],
  loadTags: async () => {
    const tags = await window.electronAPI.getTags();
    set({ tags });
  },

  stats: null,
  loadStats: async () => {
    const stats = await window.electronAPI.getTaskStats();
    set({ stats });
  },

  settings: {},
  loadSettings: async () => {
    const settings = await window.electronAPI.getSettings();
    const theme = (settings.theme as 'dark' | 'light' | 'system') || 'dark';

    const applyTheme = (t: 'dark' | 'light') => {
      document.documentElement.classList.toggle('dark', t === 'dark');
    };

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    } else {
      applyTheme(theme);
    }

    set({ settings, theme, accentColor: settings.accentColor || 'purple' });
  },
  updateSettings: async (newSettings) => {
    await window.electronAPI.updateSettings(newSettings);
    const settings = { ...get().settings, ...newSettings };
    if (newSettings.theme) {
      document.documentElement.classList.toggle('dark', newSettings.theme === 'dark');
      set({ settings, theme: newSettings.theme as 'dark' | 'light' });
    } else {
      set({ settings });
    }
  },

  selectedTask: null,
  setSelectedTask: (task) => set({ selectedTask: task }),
  showTaskDetail: false,
  setShowTaskDetail: (show) => set({ showTaskDetail: show }),
  showNewTaskForm: false,
  setShowNewTaskForm: (show) => set({ showNewTaskForm: show }),
  editingTask: null,
  setEditingTask: (task) => set({ editingTask: task }),
  showEditTaskForm: false,
  setShowEditTaskForm: (show) => set({ showEditTaskForm: show }),

  showCommandPalette: false,
  setShowCommandPalette: (show) => set({ showCommandPalette: show }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  searchResults: [],
  setSearchResults: (results) => set({ searchResults: results }),

  theme: 'dark',
  setTheme: (theme) => {
    const applyTheme = (t: 'dark' | 'light') => {
      document.documentElement.classList.toggle('dark', t === 'dark');
    };

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    } else {
      applyTheme(theme);
    }
    get().updateSettings({ theme });
  },
  accentColor: 'purple',
  setAccentColor: (color) => {
    get().updateSettings({ accentColor: color });
  },

  isMaximized: false,
  setIsMaximized: (maximized) => set({ isMaximized: maximized }),

  toast: null,
  showToast: (message, type = 'success', undoable = false) => {
    const t = { message, type, undoable };
    set({ toast: t });
    setTimeout(() => {
      if (get().toast === t) set({ toast: null });
    }, 6000);
  },
  hideToast: () => set({ toast: null }),

  reminderAlerts: [],
  pushReminderAlert: (alert) => {
    if (get().reminderAlerts.some(a => a.taskId === alert.taskId)) return;
    set({ reminderAlerts: [...get().reminderAlerts, alert] });
  },
  popReminderAlert: () => set({ reminderAlerts: get().reminderAlerts.slice(1) }),

  undoStack: [],
  pushUndo: (tasks, action) => {
    const items = Array.isArray(tasks) ? tasks : [tasks];
    if (items.length === 0) return;
    const stack = get().undoStack;
    const entry = { tasks: items, action };
    set({ undoStack: [...stack, entry] });
    setTimeout(() => {
      const s = get().undoStack;
      set({ undoStack: s.filter(e => e !== entry) });
    }, 6000);
  },
  popUndo: () => {
    const stack = get().undoStack;
    if (stack.length === 0) return undefined;
    const last = stack[stack.length - 1];
    set({ undoStack: stack.slice(0, -1) });
    return last;
  },

  confirmDialog: null,
  showConfirm: (options) => set({ confirmDialog: options }),
  hideConfirm: () => set({ confirmDialog: null }),

  onboardingComplete: false,
  setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),

  searchTasks: async (query: string) => {
    return await window.electronAPI.searchTasks(query);
  },
  changeTaskStatus: async (id: string, status: string) => {
    await window.electronAPI.changeTaskStatus(id, status);
  },
  refreshCurrentView: async () => {
    const state = get();
    switch (state.view) {
      case 'today': await state.loadTodayTasks(); break;
      case 'all': await state.loadTasks({ archived: false }); break;
      case 'anytime': await state.loadAnytimeTasks(); break;
      case 'overdue': await state.loadOverdueTasks(); break;
      case 'important': await state.loadImportantTasks(); break;
      case 'calendar': {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        await state.loadCalendarTasks(start, end);
        break;
      }
      default: await state.loadTodayTasks(); break;
    }
    await state.loadStats();
  },
}));

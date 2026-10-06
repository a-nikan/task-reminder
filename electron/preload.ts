import { contextBridge, ipcRenderer, shell } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizeChange: (callback: (maximized: boolean) => void) =>
    ipcRenderer.on('window:maximize-change', (_event, maximized) => callback(maximized)),

  // Tasks
  getTasks: (filters?: any) => ipcRenderer.invoke('tasks:get', filters),
  getTaskById: (id: string) => ipcRenderer.invoke('tasks:getById', id),
  createTask: (task: any) => ipcRenderer.invoke('tasks:create', task),
  updateTask: (id: string, updates: any) => ipcRenderer.invoke('tasks:update', id, updates),
  deleteTask: (id: string) => ipcRenderer.invoke('tasks:delete', id),
  deleteMultipleTasks: (ids: string[]) => ipcRenderer.invoke('tasks:deleteMultiple', ids),
  deleteAllTasks: () => ipcRenderer.invoke('tasks:deleteAll'),
  archiveTask: (id: string) => ipcRenderer.invoke('tasks:archive', id),
  restoreTask: (id: string) => ipcRenderer.invoke('tasks:restore', id),
  moveTaskToDate: (id: string, date: string | null) => ipcRenderer.invoke('tasks:moveToDate', id, date),
  changeTaskStatus: (id: string, status: string) => ipcRenderer.invoke('tasks:changeStatus', id, status),
  reorderTasks: (taskIds: string[]) => ipcRenderer.invoke('tasks:reorder', taskIds),
  getTasksByDate: (date: string) => ipcRenderer.invoke('tasks:getByDate', date),
  getOverdueTasks: () => ipcRenderer.invoke('tasks:getOverdue'),
  getAnytimeTasks: () => ipcRenderer.invoke('tasks:getAnytime'),
  getImportantTasks: () => ipcRenderer.invoke('tasks:getImportant'),
  searchTasks: (query: string) => ipcRenderer.invoke('tasks:search', query),
  getTaskStats: () => ipcRenderer.invoke('tasks:getStats'),
  getTodayTasks: () => ipcRenderer.invoke('tasks:getToday'),
  getCalendarTasks: (startDate: string, endDate: string) => ipcRenderer.invoke('tasks:getCalendar', startDate, endDate),
  copyLinkedTask: (taskId: string, newDate: string) => ipcRenderer.invoke('tasks:copyLinked', taskId, newDate),
  toggleSubtask: (taskId: string, subtaskId: string) => ipcRenderer.invoke('tasks:toggleSubtask', taskId, subtaskId),
  addSubtask: (taskId: string, title: string) => ipcRenderer.invoke('tasks:addSubtask', taskId, title),
  removeSubtask: (taskId: string, subtaskId: string) => ipcRenderer.invoke('tasks:removeSubtask', taskId, subtaskId),
  getLinkedTasks: (linkedId: string) => ipcRenderer.invoke('tasks:getLinked', linkedId),

  // Categories
  getCategories: () => ipcRenderer.invoke('categories:get'),
  createCategory: (cat: any) => ipcRenderer.invoke('categories:create', cat),
  updateCategory: (id: string, updates: any) => ipcRenderer.invoke('categories:update', id, updates),
  deleteCategory: (id: string) => ipcRenderer.invoke('categories:delete', id),

  // Tags
  getTags: () => ipcRenderer.invoke('tags:get'),
  createTag: (tag: any) => ipcRenderer.invoke('tags:create', tag),
  deleteTag: (id: string) => ipcRenderer.invoke('tags:delete', id),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),

  // Backup
  exportData: (format: string) => ipcRenderer.invoke('data:export', format),
  importData: (filePath: string) => ipcRenderer.invoke('data:import', filePath),
  selectExportPath: (format: string) => ipcRenderer.invoke('dialog:export', format),
  selectImportPath: () => ipcRenderer.invoke('dialog:import'),

  // Sync
  getSyncSnapshot: () => ipcRenderer.invoke('sync:snapshot'),
  applySyncSnapshot: (snap: any) => ipcRenderer.invoke('sync:apply', snap),
  lanInfo: () => ipcRenderer.invoke('lan:info'),
  lanRegenToken: () => ipcRenderer.invoke('lan:regenToken'),

  // Notifications
  showNotification: (title: string, body: string, actions?: string[]) =>
    ipcRenderer.invoke('notification:show', title, body, actions),
  onNotificationAction: (callback: (data: { id: string; action: string }) => void) =>
    ipcRenderer.on('notification:action', (_event, data) => callback(data)),

  // Reminders
  setReminder: (taskId: string, remindAt: string) => ipcRenderer.invoke('reminder:set', taskId, remindAt),
  cancelReminder: (taskId: string) => ipcRenderer.invoke('reminder:cancel', taskId),
  getReminder: (taskId: string) => ipcRenderer.invoke('reminder:get', taskId),
  getActiveReminders: () => ipcRenderer.invoke('reminders:getActive'),
  snoozeReminder: (taskId: string, minutes: number) => ipcRenderer.invoke('reminder:snooze', taskId, minutes),

  // App events
  onNewTask: (callback: () => void) => ipcRenderer.on('new-task', () => callback()),
  onShowToday: (callback: () => void) => ipcRenderer.on('show-today', () => callback()),
  onNavigateTo: (callback: (view: string) => void) => ipcRenderer.on('navigate-to', (_event, view) => callback(view)),
  onOpenTask: (callback: (data: { taskId: string }) => void) => ipcRenderer.on('open-task', (_event, data) => callback(data)),

  // Shell
  openExternal: (url: string) => shell.openExternal(url),

  // App version
  getVersion: () => ipcRenderer.invoke('app:version'),

  // Startup
  setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('app:setAutoLaunch', enabled),
  getAutoLaunch: () => ipcRenderer.invoke('app:getAutoLaunch'),

  // Desktop widgets (Windows only)
  widgetOpen: (taskId: string) => ipcRenderer.invoke('widget:open', taskId),
  widgetClose: (taskId: string) => ipcRenderer.invoke('widget:close', taskId),
  widgetSetOnTop: (taskId: string, onTop: boolean) => ipcRenderer.invoke('widget:setOnTop', taskId, onTop),
  showTaskInMain: (taskId: string) => ipcRenderer.invoke('widget:showTask', taskId),
});

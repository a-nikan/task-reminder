import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import { Browser } from '@capacitor/browser';
import { App as CapacitorApp } from '@capacitor/app';
import type { DatabaseSchema, Task } from '../../shared/types';
import { createEmptyDb, migrateDatabase, seedDefaultData } from '../../shared/migrate';
import { nowIso, mergeImportedData, makeSnapshot, applySnapshot } from '../../shared/sync';
import * as ops from '../../shared/operations';
import { useStore } from '../store';

const DB_FILE = 'taskreminder.json';
const BACKUP_DIR = 'TaskReminder';

let db: DatabaseSchema | null = null;

type NotificationActionData = { taskId: string; reminderId: string; title: string };

const listeners = {
  newTask: [] as (() => void)[],
  notificationAction: [] as ((data: NotificationActionData) => void)[],
  openTask: [] as ((data: { taskId: string }) => void)[],
  navigateTo: [] as ((view: string) => void)[],
};

function getDb(): DatabaseSchema {
  if (!db) throw new Error('Database not initialized');
  return db;
}

async function save(): Promise<void> {
  if (!db) return;
  await Filesystem.writeFile({
    path: DB_FILE,
    directory: Directory.Data,
    data: JSON.stringify(db, null, 2),
    encoding: Encoding.UTF8,
  });
}

async function initialize(): Promise<void> {
  let raw: string | null = null;
  try {
    const res = await Filesystem.readFile({ path: DB_FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
    raw = String(res.data);
  } catch {
    raw = null;
  }

  let loaded: DatabaseSchema;
  if (raw) {
    try {
      loaded = JSON.parse(raw);
    } catch {
      loaded = createEmptyDb();
    }
  } else {
    loaded = createEmptyDb();
  }

  migrateDatabase(loaded);
  db = loaded;
  seedDefaultData(getDb());

  // Dismiss reminders that already fired while the app was not running
  dismissPastDue();
  await save();

  await ensurePermission();
  let actionsOk = false;
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'reminder-snooze',
          actions: [
            { id: 'snooze_5', title: '۵ دقیقه بعد' },
            { id: 'snooze_10', title: '۱۰ دقیقه بعد' },
            { id: 'snooze_30', title: '۳۰ دقیقه بعد' },
          ],
        },
      ],
    });
    actionsOk = true;
  } catch {
    // action buttons not supported on this device
  }
  actionsEnabled = actionsOk;
  await rescheduleAll();
  await registerListeners();
}

const ready: Promise<void> = initialize().catch(err => {
  console.error('Android bridge init failed:', err);
});

// Serialize all API calls so DB reads/writes never interleave
let chain: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.then(() => undefined, () => undefined);
  return next;
}

function run<T>(fn: (d: DatabaseSchema) => T, persist = false): Promise<T> {
  return enqueue(async () => {
    await ready;
    const result = fn(getDb());
    if (persist) {
      await save();
      await rescheduleAll();
    }
    return result;
  });
}

async function ensurePermission(): Promise<boolean> {
  try {
    let status = await LocalNotifications.checkPermissions();
    if (status.display !== 'granted') {
      status = await LocalNotifications.requestPermissions();
    }
    return status.display === 'granted';
  } catch {
    return false;
  }
}

const REMINDER_STALE_MS = 24 * 60 * 60 * 1000;
let actionsEnabled = false;

function dismissPastDue(): void {
  if (!db) return;
  const now = new Date().toISOString();
  const nowMs = Date.now();
  for (const r of db.reminders) {
    if (r.dismissed) continue;
    const eff = r.snoozed_until || r.remind_at;
    const ts = new Date(eff).getTime();
    if (isNaN(ts) || ts > nowMs) continue;
    // Keep not-yet-shown misses within 24h so rescheduleAll can notify them;
    // drop once shown (fired_at) or older than 24h.
    if (!r.fired_at && nowMs - ts <= REMINDER_STALE_MS) continue;
    r.dismissed = 1;
    const task = db.tasks.find(t => t.id === r.task_id);
    if (task) {
      task.reminder = null;
      task.updated_at = nowIso();
    }
  }
}

function permissionErrorToast(): void {
  useStore
    .getState()
    .showToast(
      'مجوز اعلان داده نشده؛ یادآوری ثبت نشد — در تنظیمات گوشی، اعلان‌های برنامه را فعال کن',
      'error'
    );
}

let exactPromptShown = false;

async function maybePromptExactAlarm(): Promise<void> {
  if (exactPromptShown) return;
  try {
    const s = await LocalNotifications.checkExactNotificationSetting();
    if (s.exact_alarm === 'granted') return;
    exactPromptShown = true;
    useStore
      .getState()
      .showToast(
        'برای دقیق بودن زمان یادآوری، صفحه مجوز «زنگ هشدار» را باز می‌کنم؛ گزینهٔ برنامه را روشن کن',
        'info'
      );
    await LocalNotifications.changeExactNotificationSetting();
  } catch {
    // not supported on this device
  }
}

function toNotifId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000000000) + 1;
}

function formatReminderTime(iso: string, calendarType?: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    if (calendarType === 'jalali') {
      const datePart = d.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' });
      const timePart = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      return `زمان هشدار: ${datePart} ساعت ${timePart}`;
    }
    const datePart = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `زمان هشدار: ${datePart} ساعت ${timePart}`;
  } catch {
    return '';
  }
}

function formatTaskDate(dateStr: string, calendarType?: string): string {
  if (!dateStr) return '';
  try {
    if (calendarType === 'jalali') {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function buildReminderBody(task: Task, remindAtIso: string, calendarType?: string): string {
  const when = formatReminderTime(remindAtIso, calendarType);
  let body = `یادآوری تسک${when ? `\n${when}` : ''}`;
  if (task.date) body += `\nتاریخ تسک: ${formatTaskDate(task.date, calendarType)}`;
  if (task.time) body += ` ساعت ${task.time}`;
  return body;
}

async function rescheduleAll(): Promise<void> {
  if (!db) return;
  try {
    await LocalNotifications.cancelAll();

    const d = db;
    const nowMs = Date.now();
    const calendarType = d.settings.calendarType;
    let exactOk = false;
    try {
      exactOk = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
    } catch {
      exactOk = false;
    }
    const specs: LocalNotificationSchema[] = [];
    const used = new Set<number>();
    let needSave = false;

    for (const r of d.reminders) {
      if (r.dismissed) continue;
      const task = d.tasks.find(t => t.id === r.task_id);
      if (!task || task.archived || task.status === 'done') continue;
      const atIso = r.snoozed_until || r.remind_at;
      const ts = new Date(atIso).getTime();
      if (isNaN(ts)) continue;
      if (ts <= nowMs) {
        // Missed while device off/app closed: catch up within 24h (fires ~now),
        // drop anything older. Mark fired so later resumes don't repeat it.
        if (nowMs - ts > REMINDER_STALE_MS) continue;
        if (!r.fired_at) {
          r.fired_at = new Date().toISOString();
          needSave = true;
        }
      }
      const notifId = toNotifId(r.id);
      if (used.has(notifId)) continue;
      used.add(notifId);
      specs.push({
        id: notifId,
        title: `⏰ ${task.title}`,
        body: buildReminderBody(task, atIso, calendarType),
        schedule: { at: new Date(Math.max(ts, nowMs + 500)), allowWhileIdle: true },
        extra: { taskId: task.id, reminderId: r.id, title: task.title },
        foreground: true,
        autoCancel: true,
        isExactNotification: exactOk,
        ...(actionsEnabled ? { actionTypeId: 'reminder-snooze' } : {}),
      });
    }

    if (specs.length) {
      if (await ensurePermission()) {
        await LocalNotifications.schedule({ notifications: specs });
      }
    }
    if (needSave) await save();
  } catch (e) {
    console.warn('reschedule failed:', e);
  }
}

async function dismissReminderById(reminderId: string): Promise<void> {
  if (!db) return;
  const r = db.reminders.find(x => x.id === reminderId);
  if (!r || r.dismissed) return;
  r.dismissed = 1;
  const task = db.tasks.find(t => t.id === r.task_id);
  if (task) {
    task.reminder = null;
    task.updated_at = nowIso();
  }
  await save();
}

/** Repeat mode: re-arm an interval reminder for its next round (never dismisses). */
async function rearmIntervalReminder(rem: any): Promise<void> {
  if (!db) return;
  const mins = (rem as any).interval_minutes || 0;
  if (mins <= 0) return;
  const newTime = new Date(Date.now() + mins * 60000).toISOString();
  rem.snoozed_until = newTime;
  rem.fired_at = null;
  const task = db.tasks.find(t => t.id === rem.task_id);
  if (task) {
    task.reminder = newTime;
    task.updated_at = nowIso();
  }
  await save();
  await rescheduleAll();
}

async function registerListeners(): Promise<void> {
  await CapacitorApp.addListener('backButton', () => {
    const s = useStore.getState();
    if (s.sidebarOpen) { s.setSidebarOpen(false); return; }
    if (s.confirmDialog) { s.hideConfirm(); return; }
    if (s.showCommandPalette) { s.setShowCommandPalette(false); return; }
    if (s.showNewTaskForm) { s.setShowNewTaskForm(false); return; }
    if (s.showEditTaskForm) { s.setShowEditTaskForm(false); return; }
    if (s.selectedTask) { s.setSelectedTask(null); return; }
    if (s.view !== 'today') {
      s.setView('today');
      s.setSelectedCategoryId(null);
      return;
    }
    void CapacitorApp.minimizeApp();
  });

  await CapacitorApp.addListener('appStateChange', state => {
    if (state.isActive) {
      void enqueue(async () => {
        await ready;
        dismissPastDue();
        await save();
        await rescheduleAll();
      });
    }
  });

  await LocalNotifications.addListener('localNotificationReceived', notification => {
    const extra: any = notification.extra ?? {};
    void enqueue(async () => {
      await ready;
      if (extra.reminderId) {
        const rem = db?.reminders.find(x => x.id === String(extra.reminderId));
        const snoozedFuture = !!(rem && rem.snoozed_until && new Date(rem.snoozed_until).getTime() > Date.now());
        if (snoozedFuture) return;
        if (rem && (rem as any).interval_minutes > 0) {
          await rearmIntervalReminder(rem);
        } else {
          await dismissReminderById(String(extra.reminderId));
        }
      }
      const data: NotificationActionData = {
        taskId: String(extra.taskId || ''),
        reminderId: String(extra.reminderId || ''),
        title: String(extra.title || 'یادآوری'),
      };
      listeners.notificationAction.forEach(cb => cb(data));
    });
  });

  await LocalNotifications.addListener('localNotificationActionPerformed', action => {
    const extra: any = action.notification?.extra ?? {};
    const actionId = String((action as any).actionId || '');
    void enqueue(async () => {
      await ready;
      const snoozeMatch = /^snooze_(\d+)$/.exec(actionId);
      if (snoozeMatch && extra.taskId) {
        const minutes = parseInt(snoozeMatch[1], 10) || 10;
        snoozeReminderInDb(String(extra.taskId), minutes);
        await save();
        await rescheduleAll();
        const labels: Record<number, string> = { 5: '۵', 10: '۱۰', 30: '۳۰' };
        useStore.getState().showToast(`⏳ ${labels[minutes] || minutes} دقیقه بعد دوباره یادآوری می‌شود`, 'info');
        return;
      }
      const firedRem = extra.reminderId ? db?.reminders.find(x => x.id === String(extra.reminderId)) : null;
      if (firedRem && (firedRem as any).interval_minutes > 0) {
        await rearmIntervalReminder(firedRem);
      } else if (extra.reminderId) {
        await dismissReminderById(String(extra.reminderId));
      }
      const data: NotificationActionData = {
        taskId: String(extra.taskId || ''),
        reminderId: String(extra.reminderId || ''),
        title: String(extra.title || 'یادآوری'),
      };
      listeners.notificationAction.forEach(cb => cb(data));
      if (data.taskId) listeners.openTask.forEach(cb => cb({ taskId: data.taskId }));
    });
  });
}

function setReminderInDb(taskId: string, remindAt: string): any {
  const d = getDb();
  d.reminders.forEach(r => {
    if (r.task_id === taskId && !r.dismissed) r.dismissed = 1;
  });
  const id = `rem-${taskId}-${Date.now()}`;
  const task = d.tasks.find(t => t.id === taskId);
  d.reminders.push({
    id,
    task_id: taskId,
    remind_at: remindAt,
    snoozed_until: null,
    dismissed: 0,
    interval_minutes: (task as any)?.reminder_interval || null,
    created_at: new Date().toISOString(),
  });
  if (task) {
    task.reminder = remindAt;
    task.updated_at = new Date().toISOString();
  }
  return { success: true, id, remind_at: remindAt };
}

function cancelReminderInDb(taskId: string): any {
  const d = getDb();
  d.reminders.forEach(r => {
    if (r.task_id === taskId && !r.dismissed) r.dismissed = 1;
  });
  const task = d.tasks.find(t => t.id === taskId);
  if (task) {
    task.reminder = null;
    task.updated_at = new Date().toISOString();
  }
  return { success: true };
}

function getReminderInDb(taskId: string): any {
  const d = getDb();
  const now = new Date().toISOString();
  const active = (d.reminders || [])
    .filter(r => r.task_id === taskId && !r.dismissed)
    .sort((a, b) => (a.remind_at || '').localeCompare(b.remind_at || ''));
  const future = active.find(r => (r.snoozed_until || r.remind_at) >= now);
  return future || active[0] || null;
}

function getActiveRemindersInDb(): Record<string, string> {
  const d = getDb();
  const map: Record<string, string> = {};
  (d.reminders || []).forEach(r => {
    if (!r.dismissed && r.task_id && r.remind_at) {
      const effective = r.snoozed_until || r.remind_at;
      if (!map[r.task_id] || effective < map[r.task_id]) map[r.task_id] = effective;
    }
  });
  return map;
}

function snoozeReminderInDb(taskId: string, minutes: number): any {
  const d = getDb();
  const newTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const rows = d.reminders.filter(r => r.task_id === taskId);
  rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const target = rows[0];
  if (!target) return { success: false };
  target.snoozed_until = newTime;
  target.dismissed = 0;
  target.fired_at = null;
  const task = d.tasks.find(t => t.id === taskId);
  if (task) {
    task.reminder = newTime;
    task.updated_at = new Date().toISOString();
  }
  return { success: true, snoozed_until: newTime };
}

function pickFileText(accept: string): Promise<string | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    let done = false;
    const finish = (value: string | null) => {
      if (!done) {
        done = true;
        resolve(value);
      }
    };
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return finish(null);
      const reader = new FileReader();
      reader.onload = () => finish(String(reader.result));
      reader.onerror = () => finish(null);
      reader.readAsText(file);
    });
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

async function exportData(format: string): Promise<any> {
  await ready;
  const d = getDb();
  let content: string;
  if (format === 'csv') {
    let csv = 'Type,id,title,description,status,priority,date,time,category_id,created_at\n';
    d.tasks.forEach(t => {
      csv += `task,"${t.id}","${t.title}","${t.description || ''}","${t.status}","${t.priority}","${t.date || ''}","${t.time || ''}","${t.category_id || ''}","${t.created_at}"\n`;
    });
    content = csv;
  } else {
    content = JSON.stringify({ tasks: d.tasks, categories: d.categories, tags: d.tags, exportDate: new Date().toISOString() }, null, 2);
  }
  const fileName = `taskreminder-backup.${format === 'csv' ? 'csv' : 'json'}`;
  const filePath = `${BACKUP_DIR}/${fileName}`;
  try {
    await Filesystem.mkdir({ path: BACKUP_DIR, directory: Directory.Documents, recursive: true });
  } catch {
    // already exists
  }
  await Filesystem.writeFile({ path: filePath, directory: Directory.Documents, data: content, encoding: Encoding.UTF8 });
  try {
    const { uri } = await Filesystem.getUri({ path: filePath, directory: Directory.Documents });
    await Share.share({ title: 'پشتیبان Nick Task Reminder', files: [uri] });
  } catch {
    // share sheet cancelled or unavailable; file is still saved
  }
  return { success: true, path: filePath };
}

async function importData(): Promise<any> {
  await ready;
  const text = await pickFileText('.json,application/json');
  if (text == null) return { success: false };
  try {
    const data = JSON.parse(text);
    mergeImportedData(getDb(), data);
    await save();
    await rescheduleAll();
    return { success: true };
  } catch (e) {
    console.error('import failed:', e);
    return { success: false };
  }
}

async function showNotification(title: string, body: string): Promise<void> {
  await ready;
  if (!(await ensurePermission())) {
    permissionErrorToast();
    return;
  }
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: (Date.now() % 100000) + 900000,
          title,
          body,
          autoCancel: true,
        },
      ],
    });
  } catch (e) {
    console.warn('show notification failed:', e);
  }
}

async function getVersion(): Promise<string> {
  try {
    const info = await CapacitorApp.getInfo();
    return info.version || '1.0';
  } catch {
    return '1.0';
  }
}

export function createAndroidApi(): Window['electronAPI'] {
  return {
    minimize: async () => {},
    maximize: async () => {},
    close: async () => {},
    isMaximized: async () => false,
    onMaximizeChange: () => {},

    getTasks: (filters?: any) => run(d => ops.queryTasks(d, filters)),
    getTaskById: (id: string) => run(d => ops.getTaskById(d, id) as Task),
    createTask: (task: any) => run(d => ops.createTask(d, task), true),
    updateTask: (id: string, updates: any) => run(d => ops.updateTask(d, id, updates) as Task, true),
    deleteTask: (id: string) =>
      run(
        d => {
          ops.deleteTask(d, id);
          return { success: true as const };
        },
        true,
      ),
    deleteMultipleTasks: (ids: string[]) =>
      run(
        d => {
          const deleted = ops.deleteMultipleTasks(d, ids);
          return { success: true as const, deleted };
        },
        true,
      ),
    deleteAllTasks: () =>
      run(
        d => {
          ops.deleteAllTasks(d);
          return { success: true as const };
        },
        true,
      ),
    archiveTask: (id: string) => run(d => ops.archiveTask(d, id) as Task, true),
    restoreTask: (id: string) => run(d => ops.restoreTask(d, id) as Task, true),
    moveTaskToDate: (id: string, date: string | null) => run(d => ops.moveTaskToDate(d, id, date) as Task, true),
    changeTaskStatus: (id: string, status: string) => run(d => ops.changeTaskStatus(d, id, status) as Task, true),
    reorderTasks: (taskIds: string[]) =>
      run(
        d => {
          ops.reorderTasks(d, taskIds);
          return { success: true as const };
        },
        true,
      ),
    getTasksByDate: (date: string) => run(d => ops.getTasksByDate(d, date)),
    getOverdueTasks: () => run(d => ops.getOverdueTasks(d)),
    getAnytimeTasks: () => run(d => ops.getAnytimeTasks(d)),
    getImportantTasks: () => run(d => ops.getImportantTasks(d)),
    searchTasks: (query: string) => run(d => ops.searchTasks(d, query)),
    getTaskStats: () => run(d => ops.getTaskStats(d)),
    getTodayTasks: () => run(d => ops.getTodayTasks(d)),
    getCalendarTasks: (startDate: string, endDate: string) => run(d => ops.getCalendarTasks(d, startDate, endDate)),
    copyLinkedTask: (taskId: string, newDate: string) => run(d => ops.copyLinkedTask(d, taskId, newDate) as Task, true),
    toggleSubtask: (taskId: string, subtaskId: string) => run(d => ops.toggleSubtask(d, taskId, subtaskId) as Task, true),
    addSubtask: (taskId: string, title: string) => run(d => ops.addSubtask(d, taskId, title) as Task, true),
    removeSubtask: (taskId: string, subtaskId: string) => run(d => ops.removeSubtask(d, taskId, subtaskId) as Task, true),
    getLinkedTasks: (linkedId: string) => run(d => ops.getLinkedTasks(d, linkedId)),

    getCategories: () => run(d => ops.getCategoriesWithCount(d)),
    createCategory: (cat: any) => run(d => ops.createCategory(d, cat), true),
    updateCategory: (id: string, updates: any) => run(d => ops.updateCategory(d, id, updates) as any, true),
    deleteCategory: (id: string) =>
      run(
        d => {
          ops.deleteCategory(d, id);
          return { success: true as const };
        },
        true,
      ),

    getTags: () => run(d => ops.getTags(d)),
    createTag: (tag: any) => run(d => ops.createTag(d, tag), true),
    deleteTag: (id: string) =>
      run(
        d => {
          ops.deleteTag(d, id);
          return { success: true as const };
        },
        true,
      ),

    getSettings: () => run(d => d.settings),
    updateSettings: (settings: any) =>
      run(
        d => {
          ops.updateSettings(d, settings);
          return { success: true as const };
        },
        true,
      ),

    exportData: (format: string) => enqueue(() => exportData(format)),
    importData: () => enqueue(() => importData()),
    showNotification: (title: string, body: string) => enqueue(() => showNotification(title, body)),

    setReminder: (taskId: string, remindAt: string) =>
      enqueue(async () => {
        await ready;
        const granted = await ensurePermission();
        if (!granted) {
          permissionErrorToast();
          return { success: false as const, error: 'permission' };
        }
        const result = setReminderInDb(taskId, remindAt);
        await save();
        await rescheduleAll();
        await maybePromptExactAlarm();
        return result;
      }),
    cancelReminder: (taskId: string) => run(d => cancelReminderInDb(taskId), true),
    getReminder: (taskId: string) => run(d => getReminderInDb(taskId)),
    getActiveReminders: () => run(d => getActiveRemindersInDb()),
    snoozeReminder: (taskId: string, minutes: number) => run(d => snoozeReminderInDb(taskId, minutes), true),
    setReminderInterval: (taskId: string, minutes: number) =>
      run(
        d => {
          ops.setReminderInterval(d, taskId, minutes);
          return { success: true as const };
        },
        true,
      ),

    // Desktop widgets are Windows-only; no-ops on Android
    widgetOpen: async () => ({ success: false as const }),
    widgetClose: async () => ({ success: false as const }),
    widgetSetOnTop: async () => ({ success: false as const }),
    showTaskInMain: async () => ({ success: false as const }),
    editTaskInMain: async () => ({ success: false as const }),
    widgetResize: async () => ({ success: false as const }),
    openExternal: (url: string) => enqueue(() => Browser.open({ url })),
    notifyWidgetChanged: async () => ({ success: true as const }),
    onTasksChanged: () => {},

    onNewTask: callback => {
      listeners.newTask.push(callback);
    },
    onNotificationAction: callback => {
      listeners.notificationAction.push(callback);
    },
    onOpenTask: callback => {
      listeners.openTask.push(callback);
    },
    onEditTask: () => {},
    onNavigateTo: callback => {
      listeners.navigateTo.push(callback);
    },

    getVersion: () => getVersion(),
    getSyncSnapshot: () => enqueue(async () => {
      await ready;
      return JSON.parse(JSON.stringify(makeSnapshot(getDb())));
    }),
    applySyncSnapshot: (snap: any) => enqueue(async () => {
      await ready;
      const d = getDb();
      applySnapshot(d, snap);
      const now = new Date().toISOString();
      for (const t of d.tasks) {
        if (!t.reminder || t.reminder <= now || t.status === 'done' || t.archived) continue;
        const active = (d.reminders || []).some(r =>
          r.task_id === t.id && !r.dismissed && (r.snoozed_until || r.remind_at) === t.reminder
        );
        if (!active) setReminderInDb(t.id, t.reminder);
      }
      await save();
      await rescheduleAll();
      return { success: true };
    }),
    setAutoLaunch: async () => ({ success: true }),
    getAutoLaunch: async () => false,
    lanInfo: async () => ({ running: false, port: 0, addresses: [], token: '', error: null }),
    lanRegenToken: async () => ({ success: false, token: '' }),
  };
}

export function installAndroidApi(): void {
  window.electronAPI = createAndroidApi();
}

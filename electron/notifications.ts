import { BrowserWindow, Notification, ipcMain } from 'electron';
import { getDatabase, saveDatabase } from './database';

let checkInterval: NodeJS.Timeout | null = null;

export function setupNotifications(mainWindow: BrowserWindow | null): void {
  checkInterval = setInterval(() => checkReminders(mainWindow), 30000);
  checkReminders(mainWindow);

  ipcMain.handle('notification:show', (_event, title: string, body: string, _actions?: string[]) => {
    showSystemNotification(title, body);
  });

  ipcMain.handle('reminder:set', (_event, taskId: string, remindAt: string) => {
    const db = getDatabase();
    // Cancel previous active reminders for this task to avoid duplicates
    db.reminders.forEach(r => { if (r.task_id === taskId && !r.dismissed) r.dismissed = 1; });
    const id = `rem-${taskId}-${Date.now()}`;
    db.reminders.push({ id, task_id: taskId, remind_at: remindAt, snoozed_until: null, dismissed: 0, created_at: new Date().toISOString() });
    // Also mirror on task for easy display/sync
    const task = db.tasks.find((t: any) => t.id === taskId);
    if (task) {
      task.reminder = remindAt;
      task.updated_at = new Date().toISOString();
    }
    saveDatabase();
    return { success: true, id, remind_at: remindAt };
  });

  ipcMain.handle('reminder:cancel', (_event, taskId: string) => {
    const db = getDatabase();
    db.reminders.forEach(r => { if (r.task_id === taskId && !r.dismissed) r.dismissed = 1; });
    const task = db.tasks.find((t: any) => t.id === taskId);
    if (task) {
      task.reminder = null;
      task.updated_at = new Date().toISOString();
    }
    saveDatabase();
    return { success: true };
  });

  ipcMain.handle('reminder:get', (_event, taskId: string) => {
    const db = getDatabase();
    const now = new Date().toISOString();
    const active = (db.reminders || [])
      .filter(r => r.task_id === taskId && !r.dismissed)
      .sort((a, b) => (a.remind_at || '').localeCompare(b.remind_at || ''));
    // Prefer future reminder, else earliest active
    const future = active.find(r => (r.snoozed_until || r.remind_at) >= now);
    return future || active[0] || null;
  });

  ipcMain.handle('reminders:getActive', () => {
    const db = getDatabase();
    const map: Record<string, string> = {};
    (db.reminders || []).forEach(r => {
      if (!r.dismissed && r.task_id && r.remind_at) {
        const effective = r.snoozed_until || r.remind_at;
        if (!map[r.task_id] || effective < map[r.task_id]) map[r.task_id] = effective;
      }
    });
    return map;
  });

  ipcMain.handle('reminder:snooze', (_event, taskId: string, minutes: number) => {
    const db = getDatabase();
    const newTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    db.reminders.forEach(r => {
      if (r.task_id === taskId && !r.dismissed) {
        r.snoozed_until = newTime;
        r.fired_at = null;
      }
    });
    const task = db.tasks.find((t: any) => t.id === taskId);
    if (task) {
      task.reminder = newTime;
      task.updated_at = new Date().toISOString();
    }
    saveDatabase();
    return { success: true, snoozed_until: newTime };
  });
}

function checkReminders(mainWindow: BrowserWindow | null): void {
  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    const nowMs = Date.now();
    const STALE_MS = 24 * 60 * 60 * 1000;

    const pendingReminders = db.reminders.filter(r =>
      !r.dismissed &&
      !r.fired_at &&
      (!r.snoozed_until || r.snoozed_until <= now) &&
      r.remind_at <= now
    );

    let dirty = false;
    for (const reminder of pendingReminders) {
      const task = db.tasks.find(t => t.id === reminder.task_id);
      const effective = reminder.snoozed_until || reminder.remind_at;
      const overdueMs = nowMs - new Date(effective).getTime();
      if (task && !task.archived && task.status !== 'done') {
        if (overdueMs > STALE_MS) {
          reminder.dismissed = 1;
          (task as any).reminder = null;
          (task as any).updated_at = now;
          dirty = true;
          continue;
        }
        const when = formatReminderTime(effective, (db.settings as any)?.calendarType);
        showTaskNotification(
          mainWindow,
          `⏰ ${task.title}`,
          `یادآوری تسک${when ? `\n${when}` : ''}${task.date ? `\nتاریخ تسک: ${formatTaskDate(task.date, (db.settings as any)?.calendarType)}` : ''}${task.time ? ` ساعت ${task.time}` : ''}`,
          task.id
        );
        reminder.fired_at = now;
        dirty = true;
        mainWindow?.webContents.send('notification:action', { taskId: task.id, reminderId: reminder.id, title: task.title });
      } else {
        reminder.dismissed = 1;
        if (task) {
          (task as any).reminder = null;
          (task as any).updated_at = now;
        }
        dirty = true;
      }
    }
    if (dirty) saveDatabase();
  } catch (error) {
    console.error('Error checking reminders:', error);
  }
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

function showSystemNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
}

function showTaskNotification(mainWindow: BrowserWindow | null, title: string, body: string, taskId: string): void {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, silent: false });
  n.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('open-task', { taskId });
    }
  });
  n.show();
}

import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { getDatabase, saveDatabase } from './database';

const widgetWindows = new Map<string, BrowserWindow>();
let mainWindowRef: BrowserWindow | null = null;

export function setWidgetMainWindow(w: BrowserWindow | null): void {
  mainWindowRef = w;
}

interface WidgetGeom {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  onTop?: boolean;
}

const WIDGET_MIN_W = 230;
const WIDGET_MIN_H = 170;
const WIDGET_MAX_W = 460;
const WIDGET_MAX_H = 700;
const WIDGET_DEF_W = 320;
const WIDGET_DEF_H = 440;

function readGeometries(): Record<string, WidgetGeom> {
  try {
    const raw = getDatabase().settings?.widgetGeometries;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveGeometry(taskId: string, win: BrowserWindow): void {
  try {
    if (win.isDestroyed()) return;
    const geoms = readGeometries();
    const [x, y] = win.getPosition();
    const [w, h] = win.getSize();
    const prev = geoms[taskId] || {};
    geoms[taskId] = { ...prev, x, y, w, h, onTop: win.isAlwaysOnTop() };
    const db = getDatabase();
    db.settings.widgetGeometries = JSON.stringify(geoms);
    saveDatabase();
  } catch {
    // ignore persistence errors
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function openTaskWidget(taskId: string): { success: boolean; reason?: string } {
  const existing = widgetWindows.get(taskId);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return { success: true };
  }
  widgetWindows.delete(taskId);

  const db = getDatabase();
  const task = db.tasks.find(t => t.id === taskId);
  if (!task || task.archived) return { success: false, reason: 'not-found' };

  const saved = readGeometries()[taskId] || {};
  const n = widgetWindows.size;
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
  const w = clamp(saved.w || WIDGET_DEF_W, WIDGET_MIN_W, WIDGET_MAX_W);
  const h = clamp(saved.h || WIDGET_DEF_H, WIDGET_MIN_H, WIDGET_MAX_H);
  const fallbackX = clamp(screenW - w - 40, 0, Math.max(0, screenW - w));
  const x = saved.x ?? Math.min(fallbackX, 80 + n * 36);
  const y = saved.y ?? 80 + n * 36;

  const win = new BrowserWindow({
    x,
    y,
    width: w,
    height: h,
    minWidth: WIDGET_MIN_W,
    minHeight: WIDGET_MIN_H,
    maxWidth: WIDGET_MAX_W,
    maxHeight: WIDGET_MAX_H,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: true,
    alwaysOnTop: !!saved.onTop,
    show: false,
    title: task.title,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    win.loadURL(`http://localhost:5173/#/widget/${taskId}`);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), { hash: `/widget/${taskId}` });
  }

  widgetWindows.set(taskId, win);
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) win.show();
  });
  const persist = () => saveGeometry(taskId, win);
  const notifyMain = () => {
    try {
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('tasks:changed', taskId);
      }
    } catch {
      // ignore
    }
  };
  win.on('moved', persist);
  win.on('resized', persist);
  win.on('close', persist);
  win.on('closed', () => {
    widgetWindows.delete(taskId);
    notifyMain();
  });
  return { success: true };
}

export function closeTaskWidget(taskId: string): { success: boolean } {
  const win = widgetWindows.get(taskId);
  if (win && !win.isDestroyed()) win.close();
  else widgetWindows.delete(taskId);
  return { success: true };
}

export function setWidgetOnTop(taskId: string, onTop: boolean): { success: boolean } {
  const win = widgetWindows.get(taskId);
  if (!win || win.isDestroyed()) return { success: false };
  win.setAlwaysOnTop(!!onTop);
  try {
    const geoms = readGeometries();
    const prev = geoms[taskId] || {};
    geoms[taskId] = { ...prev, onTop: !!onTop };
    const db = getDatabase();
    db.settings.widgetGeometries = JSON.stringify(geoms);
    saveDatabase();
  } catch {
    // ignore
  }
  return { success: true };
}

export function restoreWidgets(): void {
  try {
    const db = getDatabase();
    db.tasks
      .filter(t => (t as any).pinned && !t.archived)
      .forEach(t => openTaskWidget(t.id));
  } catch {
    // ignore
  }
}

export function setupWidgetIpc(): void {
  ipcMain.handle('widget:open', (_event, taskId: string) => openTaskWidget(taskId));
  ipcMain.handle('widget:close', (_event, taskId: string) => closeTaskWidget(taskId));
  ipcMain.handle('widget:setOnTop', (_event, taskId: string, onTop: boolean) => setWidgetOnTop(taskId, onTop));
  ipcMain.handle('widget:changed', (event, taskId: string) => {
    try {
      const senderId = event.sender.id;
      if (mainWindowRef && !mainWindowRef.isDestroyed() && mainWindowRef.webContents.id !== senderId) {
        mainWindowRef.webContents.send('tasks:changed', taskId);
      }
      widgetWindows.forEach(win => {
        try {
          if (!win.isDestroyed() && win.webContents.id !== senderId) {
            win.webContents.send('tasks:changed', taskId);
          }
        } catch {
          // ignore
        }
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  });
  ipcMain.handle('widget:showTask', (_event, taskId: string) => {
    try {
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        if (mainWindowRef.isMinimized()) mainWindowRef.restore();
        mainWindowRef.show();
        mainWindowRef.focus();
        mainWindowRef.webContents.send('open-task', { taskId });
      }
      return { success: true };
    } catch {
      return { success: false };
    }
  });
}

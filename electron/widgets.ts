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

function dbScale(): number {
  const s = parseInt(getDatabase().settings?.widgetScale || '100', 10);
  return (isNaN(s) ? 100 : Math.min(200, Math.max(50, s))) / 100;
}

function scaledLimits(s: number): { minW: number; minH: number; maxW: number; maxH: number } {
  return {
    minW: Math.round(WIDGET_MIN_W * s),
    minH: Math.round(WIDGET_MIN_H * s),
    maxW: Math.round(WIDGET_MAX_W * s),
    maxH: Math.round(WIDGET_MAX_H * s),
  };
}

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
    // Geometries are stored canonical (at 100% scale); scale is applied on open/resize
    const s = dbScale();
    const geoms = readGeometries();
    const [x, y] = win.getPosition();
    const [w, h] = win.getSize();
    const prev = geoms[taskId] || {};
    geoms[taskId] = { ...prev, x, y, w: Math.round(w / s), h: Math.round(h / s), onTop: win.isAlwaysOnTop() };
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
  const s = dbScale();
  const lim = scaledLimits(s);
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
  const w = clamp(Math.round((saved.w || WIDGET_DEF_W) * s), lim.minW, lim.maxW);
  const h = clamp(Math.round((saved.h || WIDGET_DEF_H) * s), lim.minH, lim.maxH);
  const fallbackX = clamp(screenW - w - 40, 0, Math.max(0, screenW - w));
  const x = saved.x ?? Math.min(fallbackX, 80 + n * 36);
  const y = saved.y ?? 80 + n * 36;

  const win = new BrowserWindow({
    x,
    y,
    width: w,
    height: h,
    minWidth: lim.minW,
    minHeight: lim.minH,
    maxWidth: lim.maxW,
    maxHeight: lim.maxH,
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
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  win.on('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(persist, 400);
  });
  win.on('close', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    persist();
  });
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
  ipcMain.handle('widget:editTask', (_event, taskId: string) => {
    try {
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        if (mainWindowRef.isMinimized()) mainWindowRef.restore();
        mainWindowRef.show();
        mainWindowRef.focus();
        mainWindowRef.webContents.send('edit-task', { taskId });
      }
      return { success: true };
    } catch {
      return { success: false };
    }
  });
  ipcMain.handle('widget:resize', (_event, taskId: string) => {
    try {
      const win = widgetWindows.get(taskId);
      if (!win || win.isDestroyed()) return { success: false };
      // Re-apply the saved canonical size at the current scale
      const s = dbScale();
      const lim = scaledLimits(s);
      win.setMinimumSize(lim.minW, lim.minH);
      win.setMaximumSize(lim.maxW, lim.maxH);
      const g = readGeometries()[taskId] || {};
      win.setSize(
        clamp(Math.round((g.w || WIDGET_DEF_W) * s), lim.minW, lim.maxW),
        clamp(Math.round((g.h || WIDGET_DEF_H) * s), lim.minH, lim.maxH)
      );
      saveGeometry(taskId, win);
      return { success: true };
    } catch {
      return { success: false };
    }
  });
}

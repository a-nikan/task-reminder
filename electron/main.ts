import { app, BrowserWindow, ipcMain, Notification, nativeImage, Tray, Menu, screen, shell, type NativeImage } from 'electron';
import path from 'path';
import { initDatabase, getDatabase } from './database';
import { setupIpcHandlers } from './ipc-handlers';
import { setupNotifications } from './notifications';
import { startLanServer } from './lanServer';
import { setupWidgetIpc, restoreWidgets, setWidgetMainWindow } from './widgets';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const isDev = !app.isPackaged;

// Pin userData forever so renaming the product never orphans existing data
app.setPath('userData', path.join(app.getPath('appData'), 'task-reminder'));

function getIconPath(): string {
  if (isDev) {
    return path.join(__dirname, '../public/icon.png');
  }
  return path.join(app.getAppPath(), 'public/icon.png');
}

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 900,
    minHeight: 600,
    title: 'Nick Task Reminder',
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    const db = getDatabase();
    const startupView = db.settings?.startupView || 'today';
    mainWindow?.webContents.send('navigate-to', startupView);
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    setWidgetMainWindow(null);
  });
  setWidgetMainWindow(mainWindow);
  setupTextContextMenu(mainWindow);
}

/** Right-click menu (cut/copy/paste/select-all) for inputs and selected text. */
export function setupTextContextMenu(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_event, params) => {
    const { editFlags, selectionText } = params;
    const items: any[] = [];
    if (editFlags.canCut) items.push({
      label: 'برش', click: () => win.webContents.cut(),
    });
    if (editFlags.canCopy || (selectionText && !editFlags.canCopy)) items.push({
      label: 'کپی', click: () => win.webContents.copy(),
    });
    if (editFlags.canPaste) items.push({
      label: 'چسباندن', click: () => win.webContents.paste(),
    });
    if (editFlags.canSelectAll) items.push({
      label: 'انتخاب همه', click: () => win.webContents.selectAll(),
    });
    if (items.length === 0) return;
    Menu.buildFromTemplate(items).popup();
  });
}

function createTray(): void {
  const iconPath = path.join(__dirname, '../public/icon.png');
  let icon: NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    }
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'نمایش برنامه',
      click: () => mainWindow?.show(),
    },
    {
      label: 'ایجاد تسک جدید',
      click: () => mainWindow?.webContents.send('new-task'),
    },
    { type: 'separator' },
    {
      label: 'خروج',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Nick Task Reminder');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
  createTray();
  setupIpcHandlers(mainWindow);
  setupNotifications(mainWindow);
  startLanServer();
  setupWidgetIpc();
  restoreWidgets();

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    try {
      await shell.openExternal(String(url));
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

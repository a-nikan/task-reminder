import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import { getDatabase, saveDatabase } from './database';
import fs from 'fs';
import {
  addSubtask,
  archiveTask,
  changeTaskStatus,
  copyLinkedTask,
  createCategory,
  createTag,
  createTask,
  deleteAllTasks,
  deleteCategory,
  deleteMultipleTasks,
  deleteTag,
  deleteTask,
  getAnytimeTasks,
  getCalendarTasks,
  getCategoriesWithCount,
  getImportantTasks,
  getLinkedTasks,
  getOverdueTasks,
  getTags,
  getTaskById,
  getTaskStats,
  getTasksByDate,
  getTodayTasks,
  moveTaskToDate,
  queryTasks,
  removeSubtask,
  reorderTasks,
  restoreTask,
  searchTasks,
  toggleSubtask,
  updateCategory,
  updateSettings,
  updateTask,
} from '../shared';
import { mergeImportedData, makeSnapshot, type SyncSnapshot } from '../shared/sync';
import { applyRemoteSnapshot } from './syncApply';
import { getLanInfo, regenLanToken } from './lanServer';

export function setupIpcHandlers(mainWindow: BrowserWindow | null): void {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  if (mainWindow) {
    mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximize-change', true));
    mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximize-change', false));
  }

  // Tasks
  ipcMain.handle('tasks:get', (_event, filters?: any) => queryTasks(getDatabase(), filters));

  ipcMain.handle('tasks:getById', (_event, id: string) => getTaskById(getDatabase(), id));

  ipcMain.handle('tasks:create', (_event, task: any) => {
    const result = createTask(getDatabase(), task);
    saveDatabase();
    return result;
  });

  ipcMain.handle('tasks:update', (_event, id: string, updates: any) => {
    const result = updateTask(getDatabase(), id, updates);
    saveDatabase();
    return result;
  });

  ipcMain.handle('tasks:delete', (_event, id: string) => {
    deleteTask(getDatabase(), id);
    saveDatabase();
    return { success: true };
  });

  ipcMain.handle('tasks:deleteMultiple', (_event, ids: string[]) => {
    const deleted = deleteMultipleTasks(getDatabase(), ids);
    saveDatabase();
    return { success: true, deleted };
  });

  ipcMain.handle('tasks:deleteAll', () => {
    deleteAllTasks(getDatabase());
    saveDatabase();
    return { success: true };
  });

  ipcMain.handle('tasks:archive', (_event, id: string) => {
    const result = archiveTask(getDatabase(), id);
    saveDatabase();
    return result;
  });

  ipcMain.handle('tasks:restore', (_event, id: string) => {
    const result = restoreTask(getDatabase(), id);
    saveDatabase();
    return result;
  });

  ipcMain.handle('tasks:moveToDate', (_event, id: string, date: string | null) => {
    const result = moveTaskToDate(getDatabase(), id, date);
    saveDatabase();
    return result;
  });

  ipcMain.handle('tasks:changeStatus', (_event, id: string, status: string) => {
    const result = changeTaskStatus(getDatabase(), id, status);
    saveDatabase();
    return result;
  });

  ipcMain.handle('tasks:reorder', (_event, taskIds: string[]) => {
    reorderTasks(getDatabase(), taskIds);
    saveDatabase();
    return { success: true };
  });

  ipcMain.handle('tasks:getByDate', (_event, date: string) => getTasksByDate(getDatabase(), date));

  ipcMain.handle('tasks:getOverdue', () => getOverdueTasks(getDatabase()));

  ipcMain.handle('tasks:getAnytime', () => getAnytimeTasks(getDatabase()));

  ipcMain.handle('tasks:getImportant', () => getImportantTasks(getDatabase()));

  ipcMain.handle('tasks:search', (_event, query: string) => searchTasks(getDatabase(), query));

  ipcMain.handle('tasks:getStats', () => getTaskStats(getDatabase()));

  ipcMain.handle('tasks:getToday', () => getTodayTasks(getDatabase()));

  ipcMain.handle('tasks:getCalendar', (_event, startDate: string, endDate: string) =>
    getCalendarTasks(getDatabase(), startDate, endDate));

  ipcMain.handle('tasks:copyLinked', (_event, taskId: string, newDate: string) => {
    const result = copyLinkedTask(getDatabase(), taskId, newDate);
    saveDatabase();
    return result;
  });

  ipcMain.handle('tasks:toggleSubtask', (_event, taskId: string, subtaskId: string) => {
    const result = toggleSubtask(getDatabase(), taskId, subtaskId);
    saveDatabase();
    return result;
  });

  ipcMain.handle('tasks:addSubtask', (_event, taskId: string, title: string) => {
    const result = addSubtask(getDatabase(), taskId, title);
    saveDatabase();
    return result;
  });

  ipcMain.handle('tasks:removeSubtask', (_event, taskId: string, subtaskId: string) => {
    const result = removeSubtask(getDatabase(), taskId, subtaskId);
    saveDatabase();
    return result;
  });

  ipcMain.handle('tasks:getLinked', (_event, linkedId: string) => getLinkedTasks(getDatabase(), linkedId));

  // Categories
  ipcMain.handle('categories:get', () => getCategoriesWithCount(getDatabase()));

  ipcMain.handle('categories:create', (_event, cat: any) => {
    const result = createCategory(getDatabase(), cat);
    saveDatabase();
    return result;
  });

  ipcMain.handle('categories:update', (_event, id: string, updates: any) => {
    const result = updateCategory(getDatabase(), id, updates);
    saveDatabase();
    return result;
  });

  ipcMain.handle('categories:delete', (_event, id: string) => {
    deleteCategory(getDatabase(), id);
    saveDatabase();
    return { success: true };
  });

  // Tags
  ipcMain.handle('tags:get', () => getTags(getDatabase()));

  ipcMain.handle('tags:create', (_event, tag: any) => {
    const result = createTag(getDatabase(), tag);
    saveDatabase();
    return result;
  });

  ipcMain.handle('tags:delete', (_event, id: string) => {
    deleteTag(getDatabase(), id);
    saveDatabase();
    return { success: true };
  });

  // Settings
  ipcMain.handle('settings:get', () => getDatabase().settings);

  ipcMain.handle('settings:update', (_event, settings: Record<string, string>) => {
    updateSettings(getDatabase(), settings);
    saveDatabase();
    return { success: true };
  });

  // Backup / Export
  ipcMain.handle('data:export', async (_event, format: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'خروجی گرفتن از داده‌ها',
      defaultPath: `taskreminder-backup.${format}`,
      filters: format === 'json' ? [{ name: 'JSON', extensions: ['json'] }] : [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (result.canceled || !result.filePath) return { success: false };

    const db = getDatabase();
    if (format === 'json') {
      fs.writeFileSync(result.filePath, JSON.stringify({ tasks: db.tasks, categories: db.categories, tags: db.tags, exportDate: new Date().toISOString() }, null, 2), 'utf-8');
    } else {
      let csv = 'Type,id,title,description,status,priority,date,time,category_id,created_at\n';
      db.tasks.forEach((t: any) => {
        csv += `task,"${t.id}","${t.title}","${t.description || ''}","${t.status}","${t.priority}","${t.date || ''}","${t.time || ''}","${t.category_id || ''}","${t.created_at}"\n`;
      });
      fs.writeFileSync(result.filePath, csv, 'utf-8');
    }
    return { success: true, path: result.filePath };
  });

  ipcMain.handle('data:import', async (_event, filePath?: string) => {
    let fileToImport = filePath;
    if (!fileToImport) {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: 'وارد کردن داده',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths[0]) return { success: false };
      fileToImport = result.filePaths[0];
    }

    const data = JSON.parse(fs.readFileSync(fileToImport, 'utf-8'));
    mergeImportedData(getDatabase(), data);
    saveDatabase();
    return { success: true };
  });

  ipcMain.handle('sync:snapshot', () => makeSnapshot(getDatabase()));

  ipcMain.handle('sync:apply', (_event, remote: SyncSnapshot) => {
    const db = getDatabase();
    applyRemoteSnapshot(db, remote);
    saveDatabase();
    return { success: true };
  });

  ipcMain.handle('lan:info', () => getLanInfo());
  ipcMain.handle('lan:regenToken', () => ({ success: true, token: regenLanToken() }));

  ipcMain.handle('dialog:export', async (_event, format: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, { title: 'ذخیره خروجی', defaultPath: `taskreminder-backup.${format}` });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.handle('dialog:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { title: 'انتخاب فایل', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('app:version', () => app.getVersion());

  ipcMain.handle('app:setAutoLaunch', (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled, path: app.getPath('exe') });
    return { success: true };
  });

  ipcMain.handle('app:getAutoLaunch', () => app.getLoginItemSettings().openAtLogin);
}

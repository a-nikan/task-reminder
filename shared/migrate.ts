import type { DatabaseSchema } from './types';
import { SCHEMA_VERSION, nowIso } from './sync';

export function createEmptyDb(): DatabaseSchema {
  return { tasks: [], categories: [], tags: [], settings: {}, reminders: [], tombstones: [] };
}

export function migrateDatabase(database: DatabaseSchema): void {
  if (!database.categories) database.categories = [];
  if (!database.tags) database.tags = [];
  if (!database.tasks) database.tasks = [];
  if (!database.settings) database.settings = {};
  if (!database.reminders) database.reminders = [];
  if (!database.tombstones) database.tombstones = [];

  database.tasks.forEach(t => {
    if (!t.subtasks) t.subtasks = [];
    if (t.linked_id === undefined) t.linked_id = null;
    if (t.color === undefined) t.color = null;
    if ((t as any).pinned === undefined) (t as any).pinned = 0;
    if ((t as any).text_dir === undefined) (t as any).text_dir = null;
    if ((t as any).reminder_interval === undefined) (t as any).reminder_interval = 0;
    if (!t.updated_at) t.updated_at = t.created_at || nowIso();
    if (!t.created_at) t.created_at = t.updated_at;
  });
  database.categories.forEach(c => {
    if (!c.updated_at) c.updated_at = c.created_at || nowIso();
    if (!c.created_at) c.created_at = c.updated_at;
  });
  database.tags.forEach(t => {
    if (!t.updated_at) t.updated_at = t.created_at || nowIso();
    if (!t.created_at) t.created_at = t.updated_at;
  });

  database.schema_version = SCHEMA_VERSION;
}

export function seedDefaultData(database: DatabaseSchema): void {
  const now = nowIso();

  if (database.categories.length === 0) {
    database.categories = [
      { id: 'cat-work', name: 'کار', color: '#ef4444', icon: 'briefcase', created_at: now, updated_at: now },
      { id: 'cat-personal', name: 'شخصی', color: '#3b82f6', icon: 'user', created_at: now, updated_at: now },
      { id: 'cat-university', name: 'دانشگاه', color: '#8b5cf6', icon: 'graduation-cap', created_at: now, updated_at: now },
      { id: 'cat-shopping', name: 'خرید', color: '#f59e0b', icon: 'shopping-cart', created_at: now, updated_at: now },
      { id: 'cat-project', name: 'پروژه', color: '#10b981', icon: 'folder', created_at: now, updated_at: now },
      { id: 'cat-study', name: 'مطالعه', color: '#06b6d4', icon: 'book-open', created_at: now, updated_at: now },
    ];
  }

  if (database.tags.length === 0) {
    database.tags = [
      { id: 'tag-urgent', name: 'urgent', color: '#ef4444', created_at: now, updated_at: now },
      { id: 'tag-project', name: 'project', color: '#3b82f6', created_at: now, updated_at: now },
      { id: 'tag-meeting', name: 'meeting', color: '#f59e0b', created_at: now, updated_at: now },
      { id: 'tag-personal', name: 'personal', color: '#8b5cf6', created_at: now, updated_at: now },
    ];
  }

  if (Object.keys(database.settings).length === 0) {
    database.settings = {
      theme: 'dark',
      accentColor: 'purple',
      startup: 'true',
      showOnStartup: 'true',
      morningNotification: 'true',
      language: 'fa',
      onboardingComplete: 'false',
      calendarType: 'gregorian',
      cardTransparency: '0',
      widgetTransparency: '0',
      uiScale: '100',
      widgetScale: '100',
    };
  }
  if (!database.settings.calendarType) database.settings.calendarType = 'gregorian';
  if (!database.settings.widgetTransparency) database.settings.widgetTransparency = '0';
  if (!database.settings.uiScale) database.settings.uiScale = '100';
  if (!database.settings.widgetScale) database.settings.widgetScale = '100';
  if (database.settings.fontBoldTitle === undefined) database.settings.fontBoldTitle = database.settings.fontBold || 'false';
  if (database.settings.fontBoldSubtask === undefined) database.settings.fontBoldSubtask = database.settings.fontBold || 'false';
  if (database.settings.fontBoldDescription === undefined) database.settings.fontBoldDescription = database.settings.fontBold || 'false';
}

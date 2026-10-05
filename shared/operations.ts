import { v4 as uuidv4 } from 'uuid';
import type {
  Category,
  DatabaseSchema,
  Subtask,
  Tag,
  Task,
  TaskFilters,
  TaskStats,
} from './types';
import { addTombstone, addTombstones, nowIso, removeTombstone } from './sync';

const LINKED_SYNC_FIELDS = ['title', 'description', 'status', 'priority', 'time', 'subtasks', 'tags', 'recurrence', 'reminder_offset', 'completed_at'] as const;

export function syncLinkedTaskFull(db: DatabaseSchema, taskId: string): void {
  const task = db.tasks.find(t => t.id === taskId);
  if (!task || !task.linked_id) return;

  const linkedTasks = db.tasks.filter(t => t.linked_id === task.linked_id && t.id !== taskId);
  for (const linked of linkedTasks) {
    for (const field of LINKED_SYNC_FIELDS) {
      (linked as any)[field] = (task as any)[field];
    }
    linked.updated_at = nowIso();
  }
}

// ---------- Tasks ----------

export function createTask(db: DatabaseSchema, input: any): Task {
  const id = input.id || uuidv4();
  const now = nowIso();

  const newTask: Task = {
    id,
    title: input.title,
    description: input.description || '',
    status: input.status || 'todo',
    priority: input.priority || 'medium',
    date: input.date || null,
    time: input.time || null,
    reminder: input.reminder || null,
    reminder_offset: input.reminder_offset || 0,
    category_id: input.category_id || null,
    tags: input.tags || [],
    subtasks: input.subtasks || [],
    linked_id: input.linked_id || null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    recurrence: input.recurrence || null,
    recurrence_parent: input.recurrence_parent || null,
    order_index: input.order_index || db.tasks.length,
    archived: input.archived ? 1 : 0,
    favorite: input.favorite ? 1 : 0,
  };

  removeTombstone(db, id);
  db.tasks.push(newTask);
  return newTask;
}

export function updateTask(db: DatabaseSchema, id: string, updates: any): Task | null {
  const task = db.tasks.find(t => t.id === id);
  if (!task) return null;

  const now = nowIso();
  const allowedFields = ['title', 'description', 'status', 'priority', 'date', 'time', 'reminder', 'reminder_offset', 'category_id', 'tags', 'subtasks', 'linked_id', 'recurrence', 'recurrence_parent', 'order_index', 'archived', 'favorite'];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      if (key === 'archived' || key === 'favorite') {
        (task as any)[key] = value ? 1 : 0;
      } else {
        (task as any)[key] = value;
      }
    }
  }

  if (updates.status === 'done') {
    task.completed_at = now;
  }

  task.updated_at = now;

  if (task.linked_id) {
    syncLinkedTaskFull(db, task.id);
  }

  return task;
}

export function deleteTask(db: DatabaseSchema, id: string): boolean {
  const task = db.tasks.find(t => t.id === id);
  db.tasks = db.tasks.filter(t => t.id !== id);
  db.reminders = db.reminders.filter(r => r.task_id !== id);
  if (task) addTombstone(db, id, 'task');
  return !!task;
}

export function deleteMultipleTasks(db: DatabaseSchema, ids: string[]): number {
  const idSet = new Set(ids);
  const existing = db.tasks.filter(t => idSet.has(t.id));
  db.tasks = db.tasks.filter(t => !idSet.has(t.id));
  db.reminders = db.reminders.filter(r => !idSet.has(r.task_id));
  addTombstones(db, existing.map(t => t.id), 'task');
  return existing.length;
}

export function deleteAllTasks(db: DatabaseSchema): void {
  const ids = db.tasks.map(t => t.id);
  db.tasks = [];
  db.reminders = [];
  addTombstones(db, ids, 'task');
}

export function archiveTask(db: DatabaseSchema, id: string): Task | null {
  const task = db.tasks.find(t => t.id === id);
  if (task) {
    task.archived = 1;
    task.updated_at = nowIso();
  }
  return task || null;
}

export function restoreTask(db: DatabaseSchema, id: string): Task | null {
  const task = db.tasks.find(t => t.id === id);
  if (task) {
    task.archived = 0;
    task.updated_at = nowIso();
  }
  return task || null;
}

export function moveTaskToDate(db: DatabaseSchema, id: string, date: string | null): Task | null {
  const task = db.tasks.find(t => t.id === id);
  if (task) {
    task.date = date;
    task.updated_at = nowIso();
  }
  return task || null;
}

export function changeTaskStatus(db: DatabaseSchema, id: string, status: string): Task | null {
  const task = db.tasks.find(t => t.id === id);
  if (task) {
    task.status = status as Task['status'];
    task.completed_at = status === 'done' ? nowIso() : null;
    task.updated_at = nowIso();
    syncLinkedTaskFull(db, task.id);
  }
  return task || null;
}

export function reorderTasks(db: DatabaseSchema, taskIds: string[]): boolean {
  taskIds.forEach((id, index) => {
    const task = db.tasks.find(t => t.id === id);
    if (task) task.order_index = index;
  });
  return true;
}

export function copyLinkedTask(db: DatabaseSchema, taskId: string, newDate: string): Task | null {
  const sourceTask = db.tasks.find(t => t.id === taskId);
  if (!sourceTask) return null;

  const now = nowIso();
  const linkedId = sourceTask.linked_id || uuidv4();

  const newTask: Task = {
    ...sourceTask,
    id: uuidv4(),
    date: newDate,
    status: 'todo',
    completed_at: null,
    subtasks: (sourceTask.subtasks || []).map(st => ({ ...st, completed: false })),
    linked_id: linkedId,
    created_at: now,
    updated_at: now,
  };

  if (!sourceTask.linked_id) {
    sourceTask.linked_id = linkedId;
    sourceTask.updated_at = now;
  }

  db.tasks.push(newTask);
  return newTask;
}

export function toggleSubtask(db: DatabaseSchema, taskId: string, subtaskId: string): Task | null {
  const task = db.tasks.find(t => t.id === taskId);
  if (!task) return null;

  const subtask = (task.subtasks || []).find(st => st.id === subtaskId);
  if (!subtask) return null;

  subtask.completed = !subtask.completed;
  task.updated_at = nowIso();

  if (task.linked_id) {
    syncLinkedTaskFull(db, task.id);
  }

  return task;
}

export function addSubtask(db: DatabaseSchema, taskId: string, title: string): Task | null {
  const task = db.tasks.find(t => t.id === taskId);
  if (!task) return null;

  const newSubtask: Subtask = { id: uuidv4(), title, completed: false };
  if (!task.subtasks) task.subtasks = [];
  task.subtasks.push(newSubtask);
  task.updated_at = nowIso();

  if (task.linked_id) {
    syncLinkedTaskFull(db, task.id);
  }

  return task;
}

export function removeSubtask(db: DatabaseSchema, taskId: string, subtaskId: string): Task | null {
  const task = db.tasks.find(t => t.id === taskId);
  if (!task) return null;

  task.subtasks = (task.subtasks || []).filter(st => st.id !== subtaskId);
  task.updated_at = nowIso();

  if (task.linked_id) {
    syncLinkedTaskFull(db, task.id);
  }

  return task;
}

// ---------- Task queries ----------

function sortByOrder(tasks: Task[]): Task[] {
  return tasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
}

export function queryTasks(db: DatabaseSchema, filters?: TaskFilters): Task[] {
  let tasks = db.tasks.filter(t => !t.archived);

  if (filters) {
    if (filters.status) tasks = tasks.filter(t => t.status === filters.status);
    if (filters.date) tasks = tasks.filter(t => t.date === filters.date);
    if (filters.dateFrom) tasks = tasks.filter(t => t.date && t.date >= filters.dateFrom!);
    if (filters.dateTo) tasks = tasks.filter(t => t.date && t.date <= filters.dateTo!);
    if (filters.categoryId) tasks = tasks.filter(t => t.category_id === filters.categoryId);
    if (filters.priority) tasks = tasks.filter(t => t.priority === filters.priority);
    if (filters.archived !== undefined) tasks = db.tasks.filter(t => t.archived === (filters.archived ? 1 : 0));
    if (filters.favorite) tasks = tasks.filter(t => t.favorite);
    if (filters.noDate) tasks = tasks.filter(t => !t.date);
    if (filters.hasDate) tasks = tasks.filter(t => t.date);
  }

  return sortByOrder(tasks);
}

export function getTaskById(db: DatabaseSchema, id: string): Task | null {
  return db.tasks.find(t => t.id === id) || null;
}

export function getTasksByDate(db: DatabaseSchema, date: string): Task[] {
  return sortByOrder(db.tasks.filter(t => t.date === date && !t.archived));
}

export function getOverdueTasks(db: DatabaseSchema): Task[] {
  const today = nowIso().split('T')[0];
  return db.tasks
    .filter(t => t.date && t.date < today && t.status !== 'done' && !t.archived)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

export function getAnytimeTasks(db: DatabaseSchema): Task[] {
  return sortByOrder(db.tasks.filter(t => !t.date && !t.archived));
}

export function getImportantTasks(db: DatabaseSchema): Task[] {
  return sortByOrder(db.tasks.filter(t => t.favorite && !t.archived));
}

export function searchTasks(db: DatabaseSchema, query: string): Task[] {
  const q = query.toLowerCase();
  return db.tasks
    .filter(t => !t.archived && (t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getTodayTasks(db: DatabaseSchema): Task[] {
  const today = nowIso().split('T')[0];
  return sortByOrder(db.tasks.filter(t => t.date === today && !t.archived));
}

export function getCalendarTasks(db: DatabaseSchema, startDate: string, endDate: string): Task[] {
  return db.tasks
    .filter(t => t.date && t.date >= startDate && t.date <= endDate && !t.archived)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

export function getLinkedTasks(db: DatabaseSchema, linkedId: string): Task[] {
  return db.tasks.filter(t => t.linked_id === linkedId && !t.archived);
}

export function getTaskStats(db: DatabaseSchema): TaskStats {
  const today = nowIso().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const activeTasks = db.tasks.filter(t => !t.archived);

  const dailyStats: Record<string, number> = {};
  const weeklyStats: Record<string, number> = {};

  db.tasks.forEach(t => {
    if (t.completed_at) {
      const day = t.completed_at.split('T')[0];
      if (day >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) {
        dailyStats[day] = (dailyStats[day] || 0) + 1;
      }
      const dow = new Date(t.completed_at).getDay().toString();
      weeklyStats[dow] = (weeklyStats[dow] || 0) + 1;
    }
  });

  return {
    total: activeTasks.length,
    todo: activeTasks.filter(t => t.status === 'todo').length,
    in_progress: activeTasks.filter(t => t.status === 'in_progress').length,
    done: activeTasks.filter(t => t.status === 'done').length,
    overdue: activeTasks.filter(t => t.date && t.date < today && t.status !== 'done').length,
    todayCount: activeTasks.filter(t => t.date === today).length,
    todayDone: activeTasks.filter(t => t.date === today && t.status === 'done').length,
    weekCompleted: db.tasks.filter(t => t.completed_at && t.completed_at >= weekAgo).length,
    dailyStats: Object.entries(dailyStats).map(([day, count]) => ({ day, count })),
    weeklyStats: Object.entries(weeklyStats).map(([dayOfWeek, count]) => ({ dayOfWeek, count })),
  };
}

// ---------- Categories ----------

export function getCategoriesWithCount(db: DatabaseSchema): Category[] {
  return db.categories.map(cat => ({
    ...cat,
    taskCount: db.tasks.filter(t => t.category_id === cat.id && !t.archived).length,
  }));
}

export function createCategory(db: DatabaseSchema, cat: any): Category {
  const now = nowIso();
  const newCat: Category = {
    id: cat.id || uuidv4(),
    name: cat.name,
    color: cat.color || '#6366f1',
    icon: cat.icon || 'folder',
    created_at: now,
    updated_at: now,
  };
  removeTombstone(db, newCat.id);
  db.categories.push(newCat);
  return newCat;
}

export function updateCategory(db: DatabaseSchema, id: string, updates: any): Category | null {
  const cat = db.categories.find(c => c.id === id);
  if (cat) {
    Object.assign(cat, updates);
    cat.updated_at = nowIso();
  }
  return cat || null;
}

export function deleteCategory(db: DatabaseSchema, id: string): boolean {
  const cat = db.categories.find(c => c.id === id);
  db.categories = db.categories.filter(c => c.id !== id);
  if (cat) addTombstone(db, id, 'category');
  return !!cat;
}

// ---------- Tags ----------

export function getTags(db: DatabaseSchema): Tag[] {
  return db.tags;
}

export function createTag(db: DatabaseSchema, tag: any): Tag {
  const now = nowIso();
  const newTag: Tag = {
    id: tag.id || uuidv4(),
    name: tag.name,
    color: tag.color || '#8b5cf6',
    created_at: now,
    updated_at: now,
  };
  removeTombstone(db, newTag.id);
  db.tags.push(newTag);
  return newTag;
}

export function deleteTag(db: DatabaseSchema, id: string): boolean {
  const tag = db.tags.find(t => t.id === id);
  db.tags = db.tags.filter(t => t.id !== id);
  if (tag) addTombstone(db, id, 'tag');
  return !!tag;
}

// ---------- Settings ----------

export function updateSettings(db: DatabaseSchema, settings: Record<string, string>): void {
  Object.assign(db.settings, settings);
}

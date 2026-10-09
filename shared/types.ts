export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  date: string | null;
  time: string | null;
  reminder: string | null;
  reminder_offset: number;
  reminder_interval: number;
  category_id: string | null;
  color: string | null;
  pinned: number;
  text_dir: string | null;
  tags: string[];
  subtasks: Subtask[];
  linked_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  recurrence: string | null;
  recurrence_parent: string | null;
  order_index: number;
  archived: number;
  favorite: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  created_at?: string;
  updated_at?: string;
  taskCount?: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at?: string;
  updated_at?: string;
}

export interface Reminder {
  id: string;
  task_id: string;
  remind_at: string;
  snoozed_until: string | null;
  dismissed: number;
  fired_at?: string | null;
  interval_minutes?: number | null;
  created_at: string;
}

export type EntityType = 'task' | 'category' | 'tag';

export interface Tombstone {
  id: string;
  entity: EntityType;
  deleted_at: string;
}

export interface DatabaseSchema {
  schema_version?: number;
  tasks: Task[];
  categories: Category[];
  tags: Tag[];
  settings: Record<string, string>;
  reminders: Reminder[];
  tombstones: Tombstone[];
}

export interface TaskFilters {
  status?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  priority?: string;
  archived?: boolean;
  favorite?: boolean;
  noDate?: boolean;
  hasDate?: boolean;
}

export interface TaskStats {
  total: number;
  todo: number;
  in_progress: number;
  done: number;
  overdue: number;
  todayCount: number;
  todayDone: number;
  weekCompleted: number;
  dailyStats: { day: string; count: number }[];
  weeklyStats: { dayOfWeek: string; count: number }[];
}

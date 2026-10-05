export * from '../../shared/types';

export interface Settings {
  theme: string;
  accentColor: string;
  startup: string;
  showOnStartup: string;
  morningNotification: string;
  language: string;
  onboardingComplete: string;
  calendarType: string;
}

export type ViewType = 'today' | 'calendar' | 'all' | 'anytime' | 'overdue' | 'important' | 'categories' | 'statistics' | 'settings' | 'category-detail';

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: import('../../shared/types').Task[];
}

export type CalendarView = 'month' | 'week' | 'day';

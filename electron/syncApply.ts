import type { DatabaseSchema } from '../shared/types';
import { applySnapshot, type SyncSnapshot } from '../shared/sync';

export function applyRemoteSnapshot(db: DatabaseSchema, remote: SyncSnapshot): void {
  applySnapshot(db, remote);
  const now = new Date().toISOString();
  for (const t of db.tasks) {
    if (!t.reminder || t.reminder <= now || t.status === 'done' || t.archived) continue;
    const active = (db.reminders || []).some(r =>
      r.task_id === t.id && !r.dismissed && (r.snoozed_until || r.remind_at) === t.reminder
    );
    if (active) continue;
    (db.reminders || []).forEach(r => { if (r.task_id === t.id && !r.dismissed) r.dismissed = 1; });
    db.reminders.push({
      id: `rem-${t.id}-${Date.now()}`,
      task_id: t.id,
      remind_at: t.reminder,
      snoozed_until: null,
      dismissed: 0,
      created_at: now,
    });
  }
}

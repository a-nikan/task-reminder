import type { Category, DatabaseSchema, EntityType, Tag, Task, Tombstone } from './types';

export const SCHEMA_VERSION = 2;

export function nowIso(): string {
  return new Date().toISOString();
}

export function addTombstone(db: DatabaseSchema, id: string, entity: EntityType): void {
  if (!db.tombstones) db.tombstones = [];
  db.tombstones = db.tombstones.filter(t => t.id !== id);
  db.tombstones.push({ id, entity, deleted_at: nowIso() });
}

export function addTombstones(db: DatabaseSchema, ids: string[], entity: EntityType): void {
  if (!db.tombstones) db.tombstones = [];
  const idSet = new Set(ids);
  db.tombstones = db.tombstones.filter(t => !(idSet.has(t.id) && t.entity === entity));
  const deletedAt = nowIso();
  for (const id of ids) {
    db.tombstones.push({ id, entity, deleted_at: deletedAt });
  }
}

export function removeTombstone(db: DatabaseSchema, id: string): void {
  if (!db.tombstones) return;
  db.tombstones = db.tombstones.filter(t => t.id !== id);
}

export function isTombstoned(db: DatabaseSchema, id: string, entity: EntityType): Tombstone | undefined {
  if (!db.tombstones) return undefined;
  return db.tombstones.find(t => t.id === id && t.entity === entity);
}

export type MergeWinner = 'local' | 'remote' | 'equal';

export function compareByUpdatedAt(local?: string | null, remote?: string | null): MergeWinner {
  const l = local || '';
  const r = remote || '';
  if (l === r) return 'equal';
  return l > r ? 'local' : 'remote';
}

export interface MergeResult<T> {
  winner: MergeWinner;
  value: T;
}

export function mergeEntity<T extends { updated_at?: string }>(local: T, remote: T): MergeResult<T> {
  const winner = compareByUpdatedAt(local.updated_at, remote.updated_at);
  if (winner === 'remote') return { winner, value: remote };
  return { winner, value: local };
}

type Syncable = Task | Category | Tag;

function mergeCollection<T extends Syncable>(local: T[], incoming: T[], deleted: Tombstone[]): T[] {
  const byId = new Map<string, T>();
  for (const item of local) byId.set(item.id, item);

  for (const item of incoming) {
    const localItem = byId.get(item.id);
    const tombstone = deleted.find(t => t.id === item.id);
    if (tombstone && compareByUpdatedAt(tombstone.deleted_at, item.updated_at || '') === 'local') {
      continue;
    }
    if (!localItem) {
      byId.set(item.id, item);
      continue;
    }
    const { value } = mergeEntity(localItem, item);
    byId.set(item.id, value);
  }

  return Array.from(byId.values());
}

export interface ImportedData {
  tasks?: Task[];
  categories?: Category[];
  tags?: Tag[];
}

export function mergeImportedData(db: DatabaseSchema, incoming: ImportedData): void {
  const tombstones = db.tombstones || [];
  if (incoming.tasks) db.tasks = mergeCollection(db.tasks, incoming.tasks, tombstones.filter(t => t.entity === 'task'));
  if (incoming.categories) db.categories = mergeCollection(db.categories, incoming.categories, tombstones.filter(t => t.entity === 'category'));
  if (incoming.tags) db.tags = mergeCollection(db.tags, incoming.tags, tombstones.filter(t => t.entity === 'tag'));
}

export interface SyncSnapshot {
  schema_version: number;
  tasks: Task[];
  categories: Category[];
  tags: Tag[];
  tombstones: Tombstone[];
}

export function makeSnapshot(db: DatabaseSchema): SyncSnapshot {
  return {
    schema_version: SCHEMA_VERSION,
    tasks: db.tasks || [],
    categories: db.categories || [],
    tags: db.tags || [],
    tombstones: db.tombstones || [],
  };
}

export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot): SyncSnapshot {
  const tombMap = new Map<string, Tombstone>();
  for (const t of [...(local.tombstones || []), ...(remote.tombstones || [])]) {
    const key = `${t.entity}:${t.id}`;
    const cur = tombMap.get(key);
    if (!cur || (t.deleted_at || '') > (cur.deleted_at || '')) tombMap.set(key, t);
  }
  const tombs = Array.from(tombMap.values());
  const tombIndex = new Map(tombs.map(t => [`${t.entity}:${t.id}`, t] as const));

  const mergeCol = <T extends { id: string; updated_at?: string }>(items: T[], incoming: T[] | undefined, entity: EntityType): T[] => {
    const byId = new Map<string, T>();
    for (const it of items) byId.set(it.id, it);
    for (const it of incoming || []) {
      const tomb = tombIndex.get(`${entity}:${it.id}`);
      if (tomb && compareByUpdatedAt(tomb.deleted_at, it.updated_at || '') === 'local') continue;
      const cur = byId.get(it.id);
      if (!cur) byId.set(it.id, it);
      else byId.set(it.id, mergeEntity(cur, it).value);
    }
    const out: T[] = [];
    for (const it of byId.values()) {
      const tomb = tombIndex.get(`${entity}:${it.id}`);
      if (tomb && compareByUpdatedAt(tomb.deleted_at, it.updated_at || '') === 'local') continue;
      out.push(it);
    }
    return out;
  };

  return {
    schema_version: SCHEMA_VERSION,
    tasks: mergeCol(local.tasks, remote.tasks, 'task'),
    categories: mergeCol(local.categories, remote.categories, 'category'),
    tags: mergeCol(local.tags, remote.tags, 'tag'),
    tombstones: tombs,
  };
}

export function applySnapshot(db: DatabaseSchema, snap: SyncSnapshot): void {
  const merged = mergeSnapshots(makeSnapshot(db), snap);
  db.tasks = merged.tasks;
  db.categories = merged.categories;
  db.tags = merged.tags;
  db.tombstones = merged.tombstones;
}

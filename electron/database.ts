import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { DatabaseSchema } from '../shared/types';
import { createEmptyDb, migrateDatabase, seedDefaultData } from '../shared/migrate';

let db: DatabaseSchema | null = null;
let dbPath: string = '';

function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'taskreminder.json');
}

export function initDatabase(): void {
  dbPath = getDbPath();

  let loaded: DatabaseSchema;
  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      loaded = JSON.parse(raw);
    } catch {
      loaded = createEmptyDb();
    }
  } else {
    loaded = createEmptyDb();
  }

  migrateDatabase(loaded);
  db = loaded;
  seedDefaultData(db);
  saveDatabase();
}

export function getDatabase(): DatabaseSchema {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function saveDatabase(): void {
  if (!db) return;
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

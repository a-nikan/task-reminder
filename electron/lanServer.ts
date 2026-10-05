import http from 'http';
import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import { getDatabase, saveDatabase } from './database';
import { makeSnapshot, type SyncSnapshot } from '../shared/sync';
import { applyRemoteSnapshot } from './syncApply';

const PORT = 8787;
const MAX_BODY = 64 * 1024 * 1024;

let server: http.Server | null = null;
let token = '';
let lastError: string | null = null;

function tokenFilePath(): string {
  return path.join(app.getPath('userData'), 'lan.json');
}

function loadToken(): string {
  try {
    const raw = fs.readFileSync(tokenFilePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === 'string' && parsed.token.length >= 16) return parsed.token;
  } catch { /* first run */ }
  const fresh = crypto.randomBytes(16).toString('hex');
  try {
    fs.writeFileSync(tokenFilePath(), JSON.stringify({ token: fresh }), 'utf-8');
  } catch { /* non-fatal: token won't persist */ }
  return fresh;
}

export interface LanInfo {
  running: boolean;
  port: number;
  addresses: string[];
  token: string;
  error: string | null;
}

function lanAddresses(): string[] {
  const ifs = os.networkInterfaces();
  const addrs: string[] = [];
  for (const list of Object.values(ifs)) {
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && !iface.internal) addrs.push(iface.address);
    }
  }
  const score = (ip: string): number => {
    if (ip.startsWith('192.168.')) return 0;
    if (ip.startsWith('10.')) return 1;
    const m = ip.match(/^172\.(\d+)\./);
    if (m) {
      const second = Number(m[1]);
      if (second >= 16 && second <= 31) return 2;
    }
    return 3;
  };
  addrs.sort((a, b) => score(a) - score(b));
  return addrs.map(ip => `http://${ip}:${PORT}`);
}

export function getLanInfo(): LanInfo {
  return {
    running: !!server,
    port: PORT,
    addresses: lanAddresses(),
    token,
    error: lastError,
  };
}

export function regenLanToken(): string {
  token = crypto.randomBytes(16).toString('hex');
  try {
    fs.writeFileSync(tokenFilePath(), JSON.stringify({ token }), 'utf-8');
  } catch { /* ignore */ }
  return token;
}

function cors(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function checkAuth(req: http.IncomingMessage, url: URL): boolean {
  const header = req.headers.authorization || '';
  const fromHeader = header.startsWith('Bearer ') ? header.slice(7) : '';
  const fromQuery = url.searchParams.get('t') || '';
  const provided = fromHeader || fromQuery;
  if (!provided || provided.length !== token.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(token));
  } catch {
    return false;
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  cors(res);
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    json(res, 200, { app: 'taskreminder', name: 'Nick Task Reminder' });
    return;
  }

  if (url.pathname !== '/sync') {
    json(res, 404, { error: 'not_found' });
    return;
  }

  if (!checkAuth(req, url)) {
    json(res, 401, { error: 'unauthorized' });
    return;
  }

  if (req.method === 'GET') {
    json(res, 200, { snapshot: makeSnapshot(getDatabase()) });
    return;
  }

  if (req.method === 'POST') {
    let body: string;
    try {
      body = await readBody(req);
    } catch {
      json(res, 413, { error: 'body_too_large' });
      return;
    }
    let incoming: { snapshot?: SyncSnapshot };
    try {
      incoming = JSON.parse(body);
    } catch {
      json(res, 400, { error: 'invalid_json' });
      return;
    }
    if (!incoming.snapshot || !Array.isArray(incoming.snapshot.tasks)) {
      json(res, 400, { error: 'invalid_snapshot' });
      return;
    }
    try {
      const db = getDatabase();
      applyRemoteSnapshot(db, incoming.snapshot);
      saveDatabase();
      json(res, 200, { snapshot: makeSnapshot(db) });
    } catch (e) {
      json(res, 500, { error: 'apply_failed', detail: String(e) });
    }
    return;
  }

  json(res, 405, { error: 'method_not_allowed' });
}

export function startLanServer(): void {
  if (server) return;
  token = token || loadToken();

  const srv = http.createServer((req, res) => {
    void handle(req, res).catch(() => {
      try { res.destroy(); } catch { /* ignore */ }
    });
  });

  srv.on('error', (err: NodeJS.ErrnoException) => {
    lastError = err.code === 'EADDRINUSE'
      ? `پورت ${PORT} توسط برنامه دیگری اشغال شده است`
      : String(err.message || err);
    server = null;
  });

  srv.listen(PORT, '0.0.0.0', () => {
    server = srv;
    lastError = null;
    console.log(`LAN sync server on port ${PORT}`);
  });

  srv.on('close', () => {
    if (server === srv) server = null;
  });
}

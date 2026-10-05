import { useStore } from '../store';
import { mergeSnapshots, type SyncSnapshot } from '../../shared/sync';

const ADDR_KEY = 'tr-lan-addr';
const TOKEN_KEY = 'tr-lan-token';
const LAST_SYNC_KEY = 'tr-lan-lastsync';

export interface LanStatus {
  configured: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  address: string;
}

let address = localStorage.getItem(ADDR_KEY) || '';
let token = localStorage.getItem(TOKEN_KEY) || '';
let lastSyncAt: string | null = localStorage.getItem(LAST_SYNC_KEY);
let syncing = false;
let lastError: string | null = null;
let changeTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(s: LanStatus) => void>();

export function normalizeAddress(raw: string): string {
  let a = (raw || '').trim();
  if (!a) return '';
  if (!/^https?:\/\//i.test(a)) a = 'http://' + a;
  return a.replace(/\/+$/, '');
}

export function getConfig(): { address: string; token: string } {
  return { address, token };
}

export function setConfig(newAddress: string, newToken: string): void {
  address = normalizeAddress(newAddress);
  token = (newToken || '').trim();
  localStorage.setItem(ADDR_KEY, address);
  localStorage.setItem(TOKEN_KEY, token);
  lastError = null;
  emit();
}

export function clearConfig(): void {
  address = '';
  token = '';
  lastSyncAt = null;
  lastError = null;
  localStorage.removeItem(ADDR_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
  emit();
}

export function getStatus(): LanStatus {
  return {
    configured: !!address && !!token,
    syncing,
    lastSyncAt,
    lastError,
    address,
  };
}

export function onStatus(cb: (s: LanStatus) => void): () => void {
  listeners.add(cb);
  cb(getStatus());
  return () => { listeners.delete(cb); };
}

function emit(): void {
  const s = getStatus();
  listeners.forEach(cb => cb(s));
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function syncNow(): Promise<{ ok: boolean; error?: string }> {
  const cfg = getStatus();
  if (!cfg.configured) return { ok: false, error: 'not_configured' };
  if (syncing) return { ok: false, error: 'busy' };
  syncing = true;
  lastError = null;
  emit();

  try {
    // Pre-check: /health is a simple GET (no auth header → no CORS preflight),
    // so failures here clearly mean "address/network unreachable".
    try {
      const h = await fetchWithTimeout(`${address}/health`);
      if (!h.ok) throw new Error('health_failed');
    } catch {
      syncing = false;
      lastError = 'unreachable';
      emit();
      return { ok: false, error: 'unreachable' };
    }

    const auth = { Authorization: `Bearer ${token}` };

    const getRes = await fetchWithTimeout(`${address}/sync`, { headers: auth });
    if (getRes.status === 401) {
      syncing = false;
      lastError = 'bad_token';
      emit();
      return { ok: false, error: 'bad_token' };
    }
    if (!getRes.ok) throw new Error(`server_${getRes.status}`);
    const getData = await getRes.json() as { snapshot?: SyncSnapshot };
    if (!getData.snapshot || !Array.isArray(getData.snapshot.tasks)) throw new Error('bad_response');

    const local = (await window.electronAPI.getSyncSnapshot()) as SyncSnapshot;
    const merged = mergeSnapshots(local, getData.snapshot);

    if (JSON.stringify(local) !== JSON.stringify(merged)) {
      await window.electronAPI.applySyncSnapshot(merged);
      try {
        useStore.getState().refreshCurrentView();
      } catch { /* store not ready */ }
    }

    const postRes = await fetchWithTimeout(`${address}/sync`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot: merged }),
    });
    if (postRes.status === 401) {
      syncing = false;
      lastError = 'bad_token';
      emit();
      return { ok: false, error: 'bad_token' };
    }
    if (!postRes.ok) throw new Error(`server_${postRes.status}`);
    const postData = await postRes.json() as { snapshot?: SyncSnapshot };
    if (postData.snapshot && JSON.stringify(postData.snapshot) !== JSON.stringify(merged)) {
      await window.electronAPI.applySyncSnapshot(postData.snapshot);
      try {
        useStore.getState().refreshCurrentView();
      } catch { /* store not ready */ }
    }

    lastSyncAt = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, lastSyncAt);
    syncing = false;
    lastError = null;
    emit();
    return { ok: true };
  } catch (e: any) {
    syncing = false;
    const name = String(e?.name || '');
    const msg = String(e?.message || e);
    if (name === 'AbortError' || /abort/i.test(msg)) lastError = 'timeout';
    else if (msg === 'Failed to fetch' || msg === 'network_error') lastError = 'unreachable';
    else lastError = msg;
    emit();
    return { ok: false, error: lastError };
  }
}

let intervalStarted = false;

export function initAutoSync(): void {
  if (intervalStarted) return;
  intervalStarted = true;

  useStore.subscribe(() => {
    if (!address || !token || syncing) return;
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(() => { void syncNow(); }, 15000);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && address && token && !syncing) void syncNow();
  });

  window.addEventListener('online', () => {
    if (address && token && !syncing) void syncNow();
  });

  // Pull changes made on the other device while this one sits idle
  setInterval(() => {
    if (address && token && !syncing && document.visibilityState === 'visible') void syncNow();
  }, 120000);
}

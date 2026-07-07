import type { SessionSnapshot } from './stores/project';
import type { ProjectState } from './types';

/**
 * Local session persistence (IndexedDB) so users can pick up where they left
 * off. Everything stays on the device: the source image blob plus the wizard
 * parameters. Pipeline results are NOT stored — the pipeline is deterministic
 * and recomputes identically on restore.
 */

export interface SavedSession extends SessionSnapshot {
  version: number;
  savedAt: number;
  imageBlob: Blob;
}

const DB_NAME = 'tintpath';
const STORE_NAME = 'session';
const KEY = 'current';
const DB_VERSION = 1;
const SESSION_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export function makeSnapshot(s: ProjectState): SessionSnapshot {
  return {
    step: s.step,
    sourceName: s.sourceName,
    rotation: s.rotation,
    crop: s.crop ? { ...s.crop } : null,
    paperFormat: { ...s.paperFormat },
    orientation: s.orientation,
    detailLevel: s.detailLevel,
    minRegionSize: s.minRegionSize,
    reduceNoise: s.reduceNoise,
    smoothing: s.smoothing,
    laserMode: s.laserMode,
    numberOpacity: s.numberOpacity,
    lineScale: s.lineScale,
    jpgQuality: s.jpgQuality,
    activeFilter: s.activeFilter,
    paletteHexes: s.palette.length > 0 ? s.palette.map((c) => c.hex) : null,
    customPalette: s.customPalette ? [...s.customPalette] : null,
  };
}

/** Persist the current project state. No-op when there is nothing to save. */
export async function persistState(s: ProjectState): Promise<void> {
  if (typeof indexedDB === 'undefined' || !s.sourceBlob || !s.sourceImage) return;
  const session: SavedSession = {
    version: SESSION_VERSION,
    savedAt: Date.now(),
    imageBlob: s.sourceBlob,
    ...makeSnapshot(s),
  };
  try {
    await withStore('readwrite', (store) => store.put(session, KEY));
  } catch {
    // Storage full or blocked — resume simply won't be offered.
  }
}

export async function loadSession(): Promise<SavedSession | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const result = (await withStore('readonly', (store) => store.get(KEY))) as
      | SavedSession
      | undefined;
    if (!result || result.version !== SESSION_VERSION) return null;
    if (!(result.imageBlob instanceof Blob)) return null;
    return result;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    await withStore('readwrite', (store) => store.delete(KEY));
  } catch {
    // Nothing to clear or storage blocked.
  }
}

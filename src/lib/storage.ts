export type PersistedState<T> = T;

const DB_NAME = 'patchbook';
const STORE_NAME = 'state';
const KEY = 'review';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open Patchbook storage'));
  });
}

export async function loadState<T>(): Promise<T | null> {
  try {
    const db = await openDB();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(KEY);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Could not read Patchbook storage'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    try {
      const raw = localStorage.getItem('patchbook-session');
      return raw ? JSON.parse(raw) as T : null;
    } catch {
      return null;
    }
  }
}

export async function saveState<T>(value: T): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error ?? new Error('Could not save Patchbook storage'));
    });
  } catch {
    try {
      localStorage.setItem('patchbook-session', JSON.stringify(value));
    } catch {
      // Storage is best-effort; the active review remains in memory.
    }
  }
}

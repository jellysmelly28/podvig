// Minimal IndexedDB wrapper. All data stays on the device.
const NAME = 'podvig';
const VERSION = 1;
const STORES = {
  kv: 'k', areas: 'id', trackers: 'id', entries: 'k', events: 'id', tasks: 'id',
  // reserved for later phases
  transactions: 'id', sessions: 'id', faith: 'k',
};
let db;

export function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath });
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const store = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);

export const all = (name) => wrap(store(name).getAll());
export const put = (name, obj) => wrap(store(name, 'readwrite').put(obj));
export const del = (name, key) => wrap(store(name, 'readwrite').delete(key));

export function replaceAll(name, items) {
  return new Promise((res, rej) => {
    const tx = db.transaction(name, 'readwrite');
    const s = tx.objectStore(name);
    s.clear();
    for (const it of items) s.put(it);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export const storeNames = Object.keys(STORES);

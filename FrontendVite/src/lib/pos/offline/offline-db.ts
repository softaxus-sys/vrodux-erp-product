/**
 * Minimal promise wrapper over IndexedDB for the offline POS. Zero dependencies — the same call as
 * lib/pdf.ts. Works in the browser and in the Electron desktop app (file:// origin).
 */

export type StoreName = "kv" | "sessions" | "events";

const DB_VERSION = 1;

export function openOfflineDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser has no offline storage (IndexedDB), so offline POS can't run here."));
      return;
    }
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "clientRef" });
      if (!db.objectStoreNames.contains("events")) {
        const events = db.createObjectStore("events", { keyPath: "clientRef" });
        events.createIndex("bySession", "sessionRef");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open offline storage."));
  });
}

function asPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Resolve only once the transaction COMMITS — a request succeeding is not the same as being durable. */
function committed(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error ?? new Error("Offline storage write failed."));
    t.onabort = () => reject(t.error ?? new Error("Offline storage write was aborted."));
  });
}

export async function idbGet<T>(db: IDBDatabase, store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return asPromise(db.transaction(store, "readonly").objectStore(store).get(key)) as Promise<T | undefined>;
}

export async function idbAll<T>(db: IDBDatabase, store: StoreName): Promise<T[]> {
  return asPromise(db.transaction(store, "readonly").objectStore(store).getAll()) as Promise<T[]>;
}

/** Write several rows (and deletes) atomically: a sale and its stock decrement land together or not at all. */
export async function idbWrite(
  db: IDBDatabase,
  stores: StoreName[],
  ops: Array<
    | { store: StoreName; put: unknown; key?: IDBValidKey }
    | { store: StoreName; del: IDBValidKey }
  >,
): Promise<void> {
  const t = db.transaction(stores, "readwrite");
  const done = committed(t);
  for (const op of ops) {
    const os = t.objectStore(op.store);
    if ("put" in op) os.put(op.put, op.key);
    else os.delete(op.del);
  }
  await done;
}

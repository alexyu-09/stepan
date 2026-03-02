const DB_NAME = 'StepanDB';
const DB_VERSION = 2;
const SESSION_STORE = 'sessions';
const HISTORY_STORE = 'history';

export interface SavedSession {
    id: string;
    data: any[][];
    rawRows: any[][] | null;
    mapping: any;
    skuPrefix: string;
    startRow: number;
    filename: string;
    timestamp: number;
}

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(SESSION_STORE)) {
                db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(HISTORY_STORE)) {
                db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
            }
            // Inventory tracker stores (v2)
            if (!db.objectStoreNames.contains('inventory_trackers')) {
                db.createObjectStore('inventory_trackers', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('inventory_snapshots')) {
                db.createObjectStore('inventory_snapshots', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('tracker_settings')) {
                db.createObjectStore('tracker_settings', { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const saveCurrentSession = async (session: SavedSession) => {
    const db = await initDB();
    const tx = db.transaction(SESSION_STORE, 'readwrite');
    const store = tx.objectStore(SESSION_STORE);
    store.put({ ...session, id: 'current' });
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
};

export const loadCurrentSession = async (): Promise<SavedSession | null> => {
    const db = await initDB();
    const tx = db.transaction(SESSION_STORE, 'readonly');
    const store = tx.objectStore(SESSION_STORE);
    const request = store.get('current');
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

export const clearCurrentSession = async () => {
    const db = await initDB();
    const tx = db.transaction(SESSION_STORE, 'readwrite');
    tx.objectStore(SESSION_STORE).delete('current');
};

export const addToHistory = async (session: Omit<SavedSession, 'id'>) => {
    const db = await initDB();
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    const id = `hist_${Date.now()}`;
    tx.objectStore(HISTORY_STORE).add({ ...session, id });
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(id);
        tx.onerror = () => reject(tx.error);
    });
};

export const getHistory = async (): Promise<SavedSession[]> => {
    const db = await initDB();
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    const store = tx.objectStore(HISTORY_STORE);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const results = request.result || [];
            // Sort by newest first
            resolve(results.sort((a, b) => b.timestamp - a.timestamp));
        };
        request.onerror = () => reject(request.error);
    });
};

export const deleteHistoryItem = async (id: string) => {
    const db = await initDB();
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    tx.objectStore(HISTORY_STORE).delete(id);
};

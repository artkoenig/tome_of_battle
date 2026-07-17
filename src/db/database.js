const DB_NAME = 'TomeOfBattleDB';
const DB_VERSION = 2;

const SETTINGS_STORE = 'settings';

// Key of the single record that persists whether rule/weapon/magic-item chips
// link to 6th.whfb.app. Absence of this record means the setting was never
// changed, so the default applies.
const WHFB6_LINKING_SETTING_KEY = 'whfb6LinkingEnabled';

// Default for the whfb6 linking setting on a fresh install: linking is on,
// which mirrors the app's behaviour before the setting existed.
export const WHFB6_LINKING_DEFAULT = true;

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // Store for parsed game systems (metadata, cost types, catalogs)
      if (!db.objectStoreNames.contains('systems')) {
        db.createObjectStore('systems', { keyPath: 'id' });
      }

      // Store for user created army rosters
      if (!db.objectStoreNames.contains('rosters')) {
        db.createObjectStore('rosters', { keyPath: 'id' });
      }

      // Store for app settings, each a single keyed record (see SETTINGS_STORE
      // key constants).
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
      }
    };
  });
}

export async function saveSystem(system) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('systems', 'readwrite');
    const store = transaction.objectStore('systems');
    const request = store.put(system);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSystem(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('systems', 'readonly');
    const store = transaction.objectStore('systems');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSystems() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('systems', 'readonly');
    const store = transaction.objectStore('systems');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSystem(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('systems', 'readwrite');
    const store = transaction.objectStore('systems');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveRoster(roster) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('rosters', 'readwrite');
    const store = transaction.objectStore('rosters');
    const request = store.put(roster);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getRoster(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('rosters', 'readonly');
    const store = transaction.objectStore('rosters');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllRosters() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('rosters', 'readonly');
    const store = transaction.objectStore('rosters');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRoster(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('rosters', 'readwrite');
    const store = transaction.objectStore('rosters');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Reads the persisted whfb6 linking setting. When no record has ever been
 * written (fresh install), resolves to {@link WHFB6_LINKING_DEFAULT}.
 * @returns {Promise<boolean>}
 */
export async function getWhfb6LinkingEnabled() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readonly');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.get(WHFB6_LINKING_SETTING_KEY);
    request.onsuccess = () => {
      const record = request.result;
      resolve(record ? record.value : WHFB6_LINKING_DEFAULT);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persists the whfb6 linking setting as a single keyed record.
 * @param {boolean} value
 * @returns {Promise<void>}
 */
export async function setWhfb6LinkingEnabled(value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.put({ id: WHFB6_LINKING_SETTING_KEY, value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

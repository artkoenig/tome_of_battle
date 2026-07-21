const DB_NAME = 'TomeOfBattleDB';
const DB_VERSION = 2;

// Object stores of the app database. `systems` holds parsed game systems
// (metadata, cost types, catalogues), `rosters` the user created army lists and
// `settings` one keyed record per app setting.
const SYSTEMS_STORE = 'systems';
const ROSTERS_STORE = 'rosters';
const SETTINGS_STORE = 'settings';

const TRANSACTION_MODE = {
  READ_ONLY: 'readonly',
  READ_WRITE: 'readwrite',
};

// Key of the single record that persists whether rule/weapon/magic-item chips
// link to 6th.whfb.app. Absence of this record means the setting was never
// changed, so the default applies.
const WHFB6_LINKING_SETTING_KEY = 'whfb6LinkingEnabled';

// Default for the whfb6 linking setting on a fresh install: linking is on,
// which mirrors the app's behaviour before the setting existed.
export const WHFB6_LINKING_DEFAULT = true;

function openConnection() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const database = request.result;

      for (const storeName of [SYSTEMS_STORE, ROSTERS_STORE, SETTINGS_STORE]) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: 'id' });
        }
      }
    };
  });
}

/**
 * The single database connection shared by every data-access function below,
 * cached together with the IndexedDB factory it was opened from. A connection
 * is only valid for that factory, so replacing the global `indexedDB` — a page
 * resetting its storage, or a test installing a fresh in-memory factory —
 * transparently forces a reconnect.
 * @type {{factory: IDBFactory, database: Promise<IDBDatabase>} | null}
 */
let cachedConnection = null;

function discardConnection(connection) {
  if (cachedConnection === connection) {
    cachedConnection = null;
  }
}

function connectToDatabase() {
  if (cachedConnection && cachedConnection.factory === indexedDB) {
    return cachedConnection.database;
  }

  const connection = { factory: indexedDB, database: null };
  connection.database = openConnection()
    .then((database) => {
      // A connection closed by the browser (storage cleared, database deleted)
      // or superseded by a version change must not stay cached.
      database.onclose = () => discardConnection(connection);
      database.onversionchange = () => {
        database.close();
        discardConnection(connection);
      };
      return database;
    })
    .catch((error) => {
      discardConnection(connection);
      throw error;
    });

  cachedConnection = connection;
  return connection.database;
}

/**
 * Runs a single request against one object store on the shared connection:
 * resolves the connection, opens the transaction, hands `executeRequest` the
 * store and settles with the request's result.
 * @param {string} storeName
 * @param {string} mode one of {@link TRANSACTION_MODE}
 * @param {(store: IDBObjectStore) => IDBRequest} executeRequest
 * @returns {Promise<*>} the request's result
 */
async function runStoreRequest(storeName, mode, executeRequest) {
  const database = await connectToDatabase();
  return new Promise((resolve, reject) => {
    const store = database.transaction(storeName, mode).objectStore(storeName);
    const request = executeRequest(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readFromStore(storeName, executeRequest) {
  return runStoreRequest(storeName, TRANSACTION_MODE.READ_ONLY, executeRequest);
}

async function writeToStore(storeName, executeRequest) {
  await runStoreRequest(storeName, TRANSACTION_MODE.READ_WRITE, executeRequest);
}

export function saveSystem(system) {
  return writeToStore(SYSTEMS_STORE, (store) => store.put(system));
}

export function getSystem(id) {
  return readFromStore(SYSTEMS_STORE, (store) => store.get(id));
}

export async function getAllSystems() {
  return (await readFromStore(SYSTEMS_STORE, (store) => store.getAll())) || [];
}

export function deleteSystem(id) {
  return writeToStore(SYSTEMS_STORE, (store) => store.delete(id));
}

export function saveRoster(roster) {
  return writeToStore(ROSTERS_STORE, (store) => store.put(roster));
}

export function getRoster(id) {
  return readFromStore(ROSTERS_STORE, (store) => store.get(id));
}

export async function getAllRosters() {
  return (await readFromStore(ROSTERS_STORE, (store) => store.getAll())) || [];
}

export function deleteRoster(id) {
  return writeToStore(ROSTERS_STORE, (store) => store.delete(id));
}

/**
 * Reads the persisted whfb6 linking setting. When no record has ever been
 * written (fresh install), resolves to {@link WHFB6_LINKING_DEFAULT}.
 * @returns {Promise<boolean>}
 */
export async function getWhfb6LinkingEnabled() {
  const record = await readFromStore(SETTINGS_STORE, (store) =>
    store.get(WHFB6_LINKING_SETTING_KEY)
  );
  return record ? record.value : WHFB6_LINKING_DEFAULT;
}

/**
 * Persists the whfb6 linking setting as a single keyed record.
 * @param {boolean} value
 * @returns {Promise<void>}
 */
export function setWhfb6LinkingEnabled(value) {
  return writeToStore(SETTINGS_STORE, (store) =>
    store.put({ id: WHFB6_LINKING_SETTING_KEY, value })
  );
}

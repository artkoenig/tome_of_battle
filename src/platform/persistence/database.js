const DB_NAME = 'TomeOfBattleDB';
// 3 seit Issue 0190: der Store `games` kam hinzu. Ein Nutzer traegt seine
// IndexedDB ueber Releases hinweg (ADR 0002), also legt `onupgradeneeded` jeden
// fehlenden Store an, statt eine frische Datenbank vorauszusetzen.
const DB_VERSION = 3;

// Object stores of the app database. `systems` holds parsed game systems
// (metadata, cost types, catalogues), `rosters` the user created army lists,
// `games` the running game per list (Issue 0190 — wounds, round, VP, CP live
// outside the list record so a wound never rewrites a roster) and `settings`
// one keyed record per app setting.
const SYSTEMS_STORE = 'systems';
const ROSTERS_STORE = 'rosters';
const GAMES_STORE = 'games';
const SETTINGS_STORE = 'settings';

/** @type {{ READ_ONLY: IDBTransactionMode, READ_WRITE: IDBTransactionMode }} */
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

// Key of the single record that persists the army list overview's filter
// (Issue 0203). Like the whfb6 flag it is one keyed record in the settings
// store, so no store and no persisted shape changes: an absent record is the
// empty filter and needs no migration.
const DASHBOARD_FILTER_SETTING_KEY = 'dashboardFilter';

/**
 * Nothing filtered — the state of a fresh install and the fallback for a record
 * that was written by an older or a broken build.
 *
 * @type {{ systemIds: string[], factionIds: string[] }}
 */
export const DASHBOARD_FILTER_DEFAULT = { systemIds: [], factionIds: [] };

/**
 * Reads the persisted overview filter. A record whose halves are not both
 * arrays is read as "nothing filtered" rather than trusted — a filter is what
 * hides a user's army lists, so a broken record must not hide anything.
 * @returns {Promise<{ systemIds: string[], factionIds: string[] }>}
 */
export async function getDashboardFilter() {
  const record = await readFromStore(SETTINGS_STORE, (store) =>
    store.get(DASHBOARD_FILTER_SETTING_KEY)
  );
  const value = record ? record.value : null;
  if (!value) return DASHBOARD_FILTER_DEFAULT;
  return {
    systemIds: Array.isArray(value.systemIds) ? value.systemIds : [],
    factionIds: Array.isArray(value.factionIds) ? value.factionIds : [],
  };
}

/**
 * Persists the overview filter as a single keyed record.
 * @param {{ systemIds: string[], factionIds: string[] }} filter
 * @returns {Promise<void>}
 */
export function setDashboardFilter(filter) {
  return writeToStore(SETTINGS_STORE, (store) =>
    store.put({
      id: DASHBOARD_FILTER_SETTING_KEY,
      value: { systemIds: [...filter.systemIds], factionIds: [...filter.factionIds] },
    })
  );
}

function openConnection() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const database = request.result;

      for (const storeName of [SYSTEMS_STORE, ROSTERS_STORE, GAMES_STORE, SETTINGS_STORE]) {
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
 * @typedef {{factory: IDBFactory, database: Promise<IDBDatabase>}} Connection
 *
 * @type {Connection | null}
 */
let cachedConnection = null;

function discardConnection(connection) {
  if (cachedConnection === connection) {
    cachedConnection = null;
  }
}

function connectToDatabase() {
  // Die Fabrik zuerst lesen: fehlt `indexedDB` ganz (Node ohne DOM), soll der
  // ReferenceError hier fliegen — vor dem ersten Promise, das sonst als
  // unbehandelte Ablehnung zurueckbliebe.
  const factory = indexedDB;
  if (cachedConnection && cachedConnection.factory === factory) {
    return cachedConnection.database;
  }

  // Der Verbindungs-Datensatz entsteht erst mit seinem Promise, damit er nie ein
  // `database: null` traegt. Die Rueckrufe unten laufen fruehestens im naechsten
  // Microtask und sehen `connection` deshalb immer gesetzt.
  /** @type {Connection} */
  let connection;
  const database = openConnection()
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

  connection = { factory, database };
  cachedConnection = connection;
  return database;
}

/**
 * Runs a single request against one object store on the shared connection:
 * resolves the connection, opens the transaction, hands `executeRequest` the
 * store and settles with the request's result.
 * @param {string} storeName
 * @param {IDBTransactionMode} mode one of {@link TRANSACTION_MODE}
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
 * Persists one game record.
 * @param {{ id: string, rosterId: string, round: number, vp: number, cp: number,
 *   wounds: Object<string, number|number[]> }} game
 * @returns {Promise<void>}
 */
export function saveGame(game) {
  return writeToStore(GAMES_STORE, (store) => store.put(game));
}

async function getAllGames() {
  return (await readFromStore(GAMES_STORE, (store) => store.getAll())) || [];
}

/**
 * The running game of one list, or `undefined`. There is at most one per list
 * (Issue 0190): the store is small enough — one record per list with a game in
 * progress — that a scan is cheaper than a secondary index.
 * @param {string} rosterId
 * @returns {Promise<Object|undefined>}
 */
export async function getGameForRoster(rosterId) {
  const games = await getAllGames();
  return games.find((game) => game.rosterId === rosterId);
}

/**
 * Removes every game of one list. Deleting a list deletes its game, and ending
 * a game discards it — both come through here.
 * @param {string} rosterId
 * @returns {Promise<void>}
 */
export async function deleteGamesOfRoster(rosterId) {
  const games = await getAllGames();
  for (const game of games.filter((candidate) => candidate.rosterId === rosterId)) {
    await writeToStore(GAMES_STORE, (store) => store.delete(game.id));
  }
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

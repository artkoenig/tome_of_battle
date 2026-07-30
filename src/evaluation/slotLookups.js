/**
 * Reine Lookups über die Fähigkeitsdatensätze des Evaluator-Berichts
 * (Issue 0121, Task 6; ADR-0035/0036).
 *
 * Der Bericht führt je Slot — jeder Stelle, an der eine Auswahl stehen kann —
 * einen Datensatz unter seinem stabilen Pfad (`capabilities`,
 * `src/evaluator/evaluator.js`). Was die Oberfläche daraus liest („wer ist in
 * diesem Rahmen wählbar?", „welcher Slot gehört zu dieser Definition?") sind
 * reine Lookups auf diese Map und gehören deshalb zum Verbraucher, nicht in
 * die Engine (`report.js`, Leitprinzip 3). Dieses Modul ist die eine Stelle
 * dieser Lookups; es rechnet nichts nach.
 */

/** Die eine, geteilte leere Slot-Map für fehlende Berichte. */
export const EMPTY_CAPABILITIES = new Map();

/**
 * True, wenn `path` ein **direktes** Kind von `parentPath` bezeichnet
 * (genau ein weiteres Pfadsegment).
 *
 * @param {string} path
 * @param {string} parentPath
 * @returns {boolean}
 */
function isDirectChildPath(path, parentPath) {
  if (!path.startsWith(`${parentPath}/`)) return false;
  return !path.slice(parentPath.length + 1).includes('/');
}

/**
 * Die direkten Kind-Slots eines Rahmens (Kontingent oder belegte Auswahl), in
 * Slot-Reihenfolge des Berichts. Die Map-Einfügereihenfolge des Berichts ist
 * die Baumreihenfolge; sie wird unverändert übernommen.
 *
 * @param {Map<string, object>|null|undefined} capabilities  Slot-Map des Berichts.
 * @param {string|null|undefined} parentPath  Slot-Pfad des Rahmens (z. B. `"0"`).
 * @returns {Array<{ path: string, capability: object }>}
 */
export function childSlotsOf(capabilities, parentPath) {
  if (!capabilities || parentPath === null || parentPath === undefined) return [];
  const slots = [];
  for (const [path, capability] of capabilities) {
    if (isDirectChildPath(path, parentPath)) slots.push({ path, capability });
  }
  return slots;
}

/**
 * Der direkte Kind-Slot eines Rahmens, der die Definition `defId` trägt —
 * über die eigene (`defId`, bei Verweisen die Link-Id) oder die aufgelöste
 * Ziel-Id (`targetDefId`). `undefined`, wenn der Rahmen keinen solchen Slot
 * führt.
 *
 * @param {Map<string, object>|null|undefined} capabilities
 * @param {string|null|undefined} parentPath
 * @param {string|null|undefined} defId
 * @returns {object|undefined}
 */
export function findChildSlot(capabilities, parentPath, defId) {
  if (defId === null || defId === undefined) return undefined;
  for (const { capability } of childSlotsOf(capabilities, parentPath)) {
    if (capability.defId === defId || capability.targetDefId === defId) return capability;
  }
  return undefined;
}

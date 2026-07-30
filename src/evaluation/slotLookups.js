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

/** Die Ankerart der Kategorie-Slots im Bericht (`report.js`-Ankervertrag). */
const CATEGORY_ANCHOR_KIND = 'categoryAnchor';

/**
 * Die Kategorie-Anker-Slots eines Kontingents, in Slot-Reihenfolge des
 * Berichts. Jeder trägt eine Kategorie des Kontingents: sein `defId` ist der
 * `categoryLink` (verlinkter Fall) oder die Kategorie selbst (unverlinkter
 * Fall); `targetDefId` zeigt im verlinkten Fall auf die Kategorie.
 *
 * @param {Map<string, object>|null|undefined} capabilities
 * @param {string|null|undefined} forcePath  Slot-Pfad des Kontingents (z. B. `"0"`).
 * @returns {Array<{ path: string, capability: object }>}
 */
export function categoryAnchorSlotsOf(capabilities, forcePath) {
  return childSlotsOf(capabilities, forcePath)
    .filter(({ capability }) => capability.anchorKind === CATEGORY_ANCHOR_KIND);
}

/**
 * Der Kategorie-Anker-Slot einer Kategorie unter einem Kontingent — gefunden
 * über die Kategorie-Id (eigene oder aufgelöste Ziel-Id des Ankers).
 * `undefined`, wenn das Kontingent keinen solchen Anker führt.
 *
 * @param {Map<string, object>|null|undefined} capabilities
 * @param {string|null|undefined} forcePath
 * @param {string|null|undefined} categoryId
 * @returns {object|undefined}
 */
export function findCategoryAnchorSlot(capabilities, forcePath, categoryId) {
  if (categoryId === null || categoryId === undefined) return undefined;
  for (const { capability } of categoryAnchorSlotsOf(capabilities, forcePath)) {
    if (capability.defId === categoryId || capability.targetDefId === categoryId) return capability;
  }
  return undefined;
}

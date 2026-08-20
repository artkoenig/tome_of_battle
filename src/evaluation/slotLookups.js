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

/**
 * Der Fähigkeitsdatensatz einer App-Selektion: ihr Slot-Pfad steht in
 * `pathBySelectionId` (`useEvaluation`), der Datensatz darunter im Bericht.
 * `undefined`, solange der Bericht für diese Selektion keinen Slot führt.
 *
 * @param {Map<string, object>|null|undefined} capabilities
 * @param {Map<string, string>|null|undefined} pathBySelectionId
 * @param {{ id?: string }|null|undefined} selection
 * @returns {object|undefined}
 */
export function slotOfSelection(capabilities, pathBySelectionId, selection) {
  const path = selection?.id === undefined ? undefined : pathBySelectionId?.get(selection.id);
  return path === undefined ? undefined : capabilities?.get(path);
}

/**
 * True, wenn diese Selektion eine **eigenständige Untereinheit** ist — die
 * Antwort des Berichts (`capability.isIndependentSubUnit`, Issue 0156), nicht
 * mehr die eines zweiten Katalog-Durchlaufs in der Oberfläche. Ohne Slot im
 * Bericht bleibt es bei `false`: dann gibt es auch nichts zu zeichnen, dem die
 * Frage gälte.
 *
 * @param {Map<string, object>|null|undefined} capabilities
 * @param {Map<string, string>|null|undefined} pathBySelectionId
 * @param {{ id?: string }|null|undefined} selection
 * @returns {boolean}
 */
export function isIndependentSubUnitSlot(capabilities, pathBySelectionId, selection) {
  return slotOfSelection(capabilities, pathBySelectionId, selection)?.isIndependentSubUnit === true;
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
 * Die Ankerarten, deren Slots eine **aufstellbare Einheit** dieses Kontingents
 * bezeichnen: belegt, angeboten oder als Pflicht-Phantom gefordert. Gruppen- und
 * Kategorie-Anker sind Rahmen und zählen nicht.
 */
const UNIT_SLOT_ANCHOR_KINDS = new Set(['occupied', 'offerAnchor', 'mandatoryPhantom']);

/**
 * True, wenn das Kontingent überhaupt einen Slot führt, dessen **effektive
 * Primärkategorie** (`capability.primaryCategoryId`, aus dem Bericht — nie aus
 * rohen Katalog-Links) diese Kategorie ist.
 *
 * Das ist die Frage „ist diese Kategorie ein bedienbarer Slot oder bloß ein
 * Regel-Schlagwort?" — dieselbe Menge, die auch der Kategorie-Hinzufüger
 * anbietet (ADR 0003 §4), nur ohne dessen Sichtbarkeits- und Herkunftsfilter.
 *
 * @param {Map<string, object>|null|undefined} capabilities
 * @param {string|null|undefined} forcePath
 * @param {string|null|undefined} categoryId
 * @returns {boolean}
 */
export function hasUnitSlotsInCategory(capabilities, forcePath, categoryId) {
  if (categoryId === null || categoryId === undefined) return false;
  return childSlotsOf(capabilities, forcePath).some(({ capability }) =>
    UNIT_SLOT_ANCHOR_KINDS.has(capability.anchorKind)
    && capability.primaryCategoryId === categoryId);
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

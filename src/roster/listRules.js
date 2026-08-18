/**
 * Klassifikation: Ist eine (Wurzel-)Selektion eine *Listenregel* — eine
 * listenweite Einstellung — statt einer aushebbaren Einheit?
 *
 * Battlescribe-Einträge tragen einen `type` (`unit | model | upgrade`). Einheiten
 * und Modelle sind kampffeldrelevante Entitäten; ein auf Force-Wurzel-Ebene
 * eingebundener `upgrade`-Eintrag (z. B. „Allow experimental rules?",
 * „Campaign/Scenario rules") ist dagegen eine listenweite Konfiguration — eine
 * Listenregel. Die Unterscheidung folgt damit ausschließlich den Katalogdaten und
 * nie einem hartkodierten Kategorienamen (ADR 0003).
 */
import { findEntryInSystem, resolveEntry } from './catalogResolver.js';

/**
 * @typedef {Object} RosterForceContext Roster-/Force-Umfeld einer Kategorie-Auswertung.
 * @property {import('../types.js').Roster} [roster]
 * @property {import('../types.js').Force} [force]
 */
import { collectPrimaryCategoryEntries, isSelectionEntryHidden } from './entryVisibility.js';
import { collectRootOfferEntries } from './rootOffers.js';
import { getEffectiveModifiers, getModifiedConstraintValue } from './modifierEvaluator.js';
import { ConstraintKind, SelectionEntryKind } from '../parser/schema/battlescribeSchema.generated.js';
import { ConstraintScope } from './battlescribeConstants.js';
import { computeRosterCounts } from './rosterCounter.js';

/**
 * True, wenn ein aufgelöster Entry-Typ eine Listenregel bezeichnet. Nur der
 * `upgrade`-Typ zählt als Listenregel; `unit` und `model` sind kampffeldrelevante
 * Einheiten. Ein unbekannter/fehlender Typ gilt bewusst *nicht* als Listenregel,
 * damit im Zweifel nichts fälschlich als Einstellung behandelt (und ausgeblendet)
 * wird.
 */
export function isListRuleEntryKind(entryKind) {
  return entryKind === SelectionEntryKind.UPGRADE;
}

/**
 * True, wenn die gegebene Selektion eine Listenregel ist. Löst dazu den
 * Katalog-Eintrag der Selektion auf und prüft dessen `type`. Ohne auflösbaren
 * Eintrag wird konservativ `false` zurückgegeben.
 */
export function isListRuleSelection(system, selection, catalogueId = null) {
  if (!selection) return false;
  const entryId = selection.entryLinkId || selection.selectionEntryId;
  if (!entryId) return false;
  const entry = findEntryInSystem(system, entryId, catalogueId);
  const resolved = resolveEntry(system, entry, catalogueId);
  return isListRuleEntryKind(resolved?.type);
}

/**
 * Einmalige Aufzählung der *primären* Katalog-Einträge einer Kategorie: liefert
 * die Gesamtzahl sowie die Teilmenge der Listenregel-Einträge. Sowohl die
 * Gruppen-Klassifikation als auch die Ankreuzlisten-Zustände lassen sich so aus
 * **einem** Katalog-Durchlauf ableiten, statt `collectPrimaryCategoryEntries`
 * mehrfach zu durchlaufen.
 * @param {object} system
 * @param {object} catalogue
 * @param {string} categoryId
 * @param {RosterForceContext} [context]
 */
function enumeratePrimaryEntries(system, catalogue, categoryId, { roster, force } = {}) {
  let total = 0;
  const ruleEntries = [];
  for (const item of collectPrimaryCategoryEntries(system, catalogue, categoryId, { roster, force })) {
    total += 1;
    if (isListRuleEntryKind(item.resolved.type)) ruleEntries.push(item);
  }
  return { total, ruleEntries };
}

/** Die id, unter der eine Selektion ihren Katalog-Eintrag referenziert. */
function selectionEntryRef(selection) {
  return selection.entryLinkId || selection.selectionEntryId;
}

/**
 * True, wenn eine Listenregel ein reiner **binärer Schalter** ist (an/aus per
 * Ankreuzfeld). Datengetrieben (ADR 0003): binär, solange der Eintrag keine echte
 * Mengen-Beschränkung `max > 1` trägt. Ein Wurzel-Tor mit `max > 1` (bislang
 * nirgends belegt) gilt als nicht-binär und fällt in der Oberfläche auf den
 * Mengen-Adder zurück. Ausgewertet wird die statische roster-/force-weite
 * `max`-Beschränkung; ein fehlender oder negativer Wert bedeutet „unbeschränkt
 * binär".
 */
function isBinaryListRule(resolved) {
  const maxConstraint = (resolved?.constraints || []).find(
    (c) => c.type === ConstraintKind.MAX && (!c.scope || c.scope === ConstraintScope.ROSTER || c.scope === ConstraintScope.FORCE)
  );
  if (!maxConstraint) return true;
  // Der effektive (modifier-angepasste) Max-Wert entscheidet, nicht der rohe Katalogwert:
  // ein Modifier, der die Obergrenze verändert, wirkt damit auch auf die Schalter-vs-Adder-
  // Klassifikation. Ohne Roster-Kontext greifen hier nur unbedingte Modifier.
  const effectiveMax = getModifiedConstraintValue(maxConstraint, getEffectiveModifiers(resolved), {});
  return effectiveMax === undefined || effectiveMax === null || effectiveMax < 0 || effectiveMax <= 1;
}

/** True, wenn der aufgelöste Eintrag konfigurierbare Unteroptionen trägt (Behälter-Regel). */
function isContainerListRule(resolved) {
  if (!resolved) return false;
  return (
    (resolved.selectionEntries?.length > 0) ||
    (resolved.entryLinks?.length > 0) ||
    (resolved.selectionEntryGroups?.length > 0)
  );
}

/**
 * True, wenn der aufgelöste Eintrag eine **eindeutige Pflicht-Listenregel**
 * ist (Issue 0138, §9.9 der BSData-Doku): ein eigener `min`-Constraint ≥ 1 mit
 * `scope="force"` oder `scope="roster"` **direkt** am Eintrag/Link — kein
 * `!c.scope`-Kulanz-Fallback wie bei {@link isBinaryListRule}, denn ein
 * ungeschriebener scope meint die eigene Instanzgrenze, nicht die armeeweite
 * Pflicht aus §9.9 — kombiniert mit fehlenden eigenen Unterauswahlen (kein
 * Behälter). Der effektive (modifier-angepasste) `min`-Wert entscheidet, nicht
 * der rohe Katalogwert, ausgewertet ohne Roster-Kontext (nur unbedingte
 * Modifier greifen).
 *
 * **Kosten spielen keine Rolle** (Issue 0140): ein solcher Eintrag lässt dem
 * Nutzer keine Entscheidung — die Armee muss ihn führen und seine Kosten
 * zahlen, was immer sie sind.
 *
 * Diese Funktion prüft **nur** die oben genannten Merkmale (kein Behälter,
 * eigener `min`-Constraint mit explizit geschriebenem `scope`, effektiver
 * `min` ≥ 1). Den Typ `upgrade` prüft sie **nicht** — dieser Filter sitzt in
 * ihren beiden Aufrufern, die je über {@link isListRuleEntryKind} vorsortieren
 * ({@link findMissingMandatoryListRuleSelections} sowie
 * {@link buildListRuleStates} über die Aufzählung in
 * `enumeratePrimaryEntries`). Erst zusammen mit diesem Typ-Filter schließen die
 * Merkmale echte, wählbare Einheiten aus.
 * @param {Object} resolved der aufgelöste Katalog-Eintrag/-Link.
 * @returns {boolean}
 */
export function isUnconditionalMandatoryListRule(resolved) {
  if (!resolved) return false;
  if (isContainerListRule(resolved)) return false;

  const minConstraint = (resolved.constraints || []).find(
    (c) => c.type === ConstraintKind.MIN && (c.scope === ConstraintScope.FORCE || c.scope === ConstraintScope.ROSTER)
  );
  if (!minConstraint) return false;

  const effectiveMin = getModifiedConstraintValue(minConstraint, getEffectiveModifiers(resolved), {});
  return effectiveMin >= 1;
}

/**
 * Findet die vorhandene Selektion einer Force, die auf die aufgelöste Entry-ID
 * `resolvedId` verweist. Abgleich über die *aufgelöste* ID, damit auch importierte
 * Roster, die eine Regel über eine andere Link-/Entry-Repräsentation referenzieren,
 * als präsent erkannt werden.
 */
function findPresentSelection(system, selections, resolvedId, catalogueId) {
  for (const sel of selections || []) {
    const ref = selectionEntryRef(sel);
    if (!ref) continue;
    const resolved = resolveEntry(system, findEntryInSystem(system, ref, catalogueId), catalogueId);
    if (resolved?.id === resolvedId) return sel;
  }
  return null;
}

/**
 * @typedef {Object} MissingMandatoryListRuleSelection
 * @property {Object} entry       der (unaufgelöste) Katalog-Eintrag/-Link der Regel.
 * @property {Object} resolved    ihr aufgelöster Katalog-Eintrag.
 * @property {?string} categoryId ihre primäre Kategorie (falls eine deklariert ist).
 */

/**
 * Sucht in den **Wurzel-Pools** eines Katalogs (dieselben, die
 * {@link collectPrimaryCategoryEntries} durchläuft:
 * `selectionEntries`/`entryLinks`) nach eindeutigen
 * Pflicht-Listenregeln ({@link isUnconditionalMandatoryListRule}), die aktuell
 * weder ausgeblendet noch bereits in `force.selections` vertreten sind
 * (Issue 0138, AC1/AC2/AC3/AC7).
 *
 * Durchsucht die Wurzel-Pools direkt statt kategorienweise über
 * {@link resolveListRuleGroup} zu gehen — Kriterium 1 verlangt keine
 * Kategorie-Zugehörigkeit, nur „nicht ausgeblendet"; eine Bindung an die „reine
 * Listenregel-Kategorie"-Prüfung würde einen sonst zulässigen Eintrag in einer
 * gemischten Kategorie stillschweigend übersehen.
 *
 * Rein: liest nur, verändert weder `system` noch `force`. Der Sichtbarkeits-
 * Kontext wird aus `force` selbst hergeleitet (kein separates Roster nötig),
 * sodass eine soeben hinzugekommene Auswahl im **selben** Aufruf bereits in
 * die `hidden`-Auswertung einfließt (AC3 — laufendes Nachtriggern).
 *
 * @param {Object} system     das geparste Spielsystem.
 * @param {Object} catalogue  der Katalog, dessen Wurzel-Pools durchsucht werden.
 * @param {import('../types.js').Force} force  das zu prüfende Kontingent.
 * @returns {MissingMandatoryListRuleSelection[]}
 */
export function findMissingMandatoryListRuleSelections(system, catalogue, force) {
  const missing = [];
  if (!system || !catalogue || !force) return missing;

  const catalogueId = catalogue.id;
  // Nur die Wurzelangebote (`collectRootOfferEntries`): ein Eintrag, der allein in
  // der geteilten Bibliothek steht, ist keine Listenregel des Kontingents, sondern
  // ein Link-Ziel — z. B. „Pure of Heart" (Hochelfen), das nur die Honours-Gruppe
  // eines Helden einbindet.
  const pools = collectRootOfferEntries(catalogue);

  // Nur eine Force liegt vor (kein volles Roster) — die eigene, roster-ähnliche
  // Hülle nähert die kontingentweite Selektions-/Kategorie-Zählung an, die
  // `isSelectionEntryHidden` für bedingte `hidden`-Modifier (z. B. „Army of
  // Sylvania" nach Wahl eines bestimmten Generals) braucht.
  const { selectionCounts, categoryCounts } = computeRosterCounts({ forces: [force] }, system);
  const visibilityContext = {
    system,
    roster: undefined,
    force,
    catalogueId,
    selectionCounts,
    forceCategoryCounts: categoryCounts[force.id] || {},
  };

  const seenResolvedIds = new Set();
  for (const entry of pools) {
    const resolved = resolveEntry(system, entry, catalogueId);
    if (!resolved) continue;
    if (!isListRuleEntryKind(resolved.type)) continue;
    if (seenResolvedIds.has(resolved.id)) continue;
    if (!isUnconditionalMandatoryListRule(resolved)) continue;
    if (isSelectionEntryHidden(entry, visibilityContext)) continue;
    seenResolvedIds.add(resolved.id);

    if (findPresentSelection(system, force.selections, resolved.id, catalogueId)) continue;

    const categoryId = resolved.categoryLinks?.find((link) => link.primary)?.targetId ?? null;
    missing.push({ entry, resolved, categoryId });
  }
  return missing;
}

/**
 * @typedef {Object} ListRuleState Zustand einer einzelnen Listenregel für die
 *   Ankreuzliste.
 * @property {Object} entry       der Katalog-Eintrag/-Link der Regel.
 * @property {string} name        der Anzeigename der Regel (aus dem aufgelösten Eintrag).
 * @property {string} categoryId  die (Gruppierungs-)Kategorie der Regel.
 * @property {string} resolvedId  die aufgelöste Entry-ID (stabiler Abgleich).
 * @property {boolean} checked    true ⇔ die Regel ist im Roster präsent.
 * @property {?Object} selection  die präsente Roster-Selektion (falls `checked`).
 * @property {boolean} isBinary   true ⇔ reiner Schalter (Ankreuzfeld), sonst Mengen-Adder.
 * @property {boolean} isContainer true ⇔ die Regel trägt konfigurierbare Unteroptionen.
 * @property {boolean} mandatory  true ⇔ eindeutige Pflicht-Listenregel (Issue 0138):
 *   ihre Checkbox ist gesperrt, solange die Regel **präsent** ist (`checked`) —
 *   eine fehlende Pflichtregel bleibt ankreuzbar und damit von Hand behebbar
 *   (Issue 0140, Kriterium 4).
 */

/**
 * Baut aus den bereits aufgezählten Listenregel-Einträgen die
 * {@link ListRuleState}s. Dedupliziert per aufgelöster Entry-ID; `checked` leitet
 * sich rein aus der Roster-Präsenz ab (kein gespeicherter Zustand).
 */
function buildListRuleStates(system, ruleEntries, selections, catalogueId, categoryId) {
  const seenResolvedIds = new Set();
  const states = [];
  for (const { entry, resolved } of ruleEntries) {
    if (seenResolvedIds.has(resolved.id)) continue;
    seenResolvedIds.add(resolved.id);

    const selection = findPresentSelection(system, selections, resolved.id, catalogueId);
    states.push({
      entry,
      name: resolved.name,
      categoryId,
      resolvedId: resolved.id,
      checked: !!selection,
      selection: selection || null,
      isBinary: isBinaryListRule(resolved),
      isContainer: isContainerListRule(resolved),
      mandatory: isUnconditionalMandatoryListRule(resolved),
    });
  }
  return states;
}

/**
 * Klassifiziert eine Kategorie-Gruppe **und** liefert – in einem einzigen
 * Katalog-Durchlauf – die Ankreuzlisten-Zustände. Der Editor fragt genau diese
 * eine Funktion, statt im JSX über Solver-Interna zu verzweigen, und reicht die
 * `states` an die `ListRuleChecklist` weiter (so wird die Kategorie nur einmal
 * traversiert, kein doppeltes `collectPrimaryCategoryEntries`).
 *
 * `isListRuleGroup`: Sind bereits Selektionen in der Kategorie präsent, wird nach
 * ihnen geurteilt (sind alle Listenregeln?); ist die Kategorie (noch) leer, nach
 * ihren Katalog-Einträgen (sind alle primären Einträge Listenregeln?). Eine
 * gemischte Kategorie gilt bewusst nicht als Listenregel-Gruppe. `states` wird nur
 * für eine echte Listenregel-Gruppe befüllt, sonst leer.
 *
 * @param {object} system
 * @param {object} catalogue
 * @param {string} categoryId
 * @param {RosterForceContext} [context]
 * @returns {{ isListRuleGroup: boolean, states: ListRuleState[] }}
 */
export function resolveListRuleGroup(system, catalogue, categoryId, { roster, force } = {}) {
  const catalogueId = force?.catalogueId || roster?.catalogueId;
  const allSelections = force?.selections || [];
  const categorySelections = allSelections.filter((s) => s.category === categoryId);
  const { total, ruleEntries } = enumeratePrimaryEntries(system, catalogue, categoryId, { roster, force });

  const isListRuleGroup = categorySelections.length > 0
    ? categorySelections.every((s) => isListRuleSelection(system, s, catalogueId))
    : total > 0 && ruleEntries.length === total;

  const states = isListRuleGroup
    ? buildListRuleStates(system, ruleEntries, allSelections, catalogueId, categoryId)
    : [];

  return { isListRuleGroup, states };
}

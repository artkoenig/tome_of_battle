import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import {
  childSelectionsOf, rootSelectionsOf, countSelections, countSelectionsInSubtree
} from '../roster/rosterTree.js';
import { getSelectionTotalCost, TOP_LEVEL_PARENT_COUNT } from './rosterCounter.js';
import { ConstraintScope, isEntryScope, isCostField, isSharedQuery } from './battlescribeConstants.js';
import { SelectionEntryKind } from '../parser/schema/battlescribeSchema.generated.js';
import { SELECTIONS_FIELD } from '../parser/xmlParser.js';
import '../types.js';

/**
 * Zentraler Zähl-Kern der Query-Engine (ADR 0029).
 *
 * Eine BSData-Query — Constraint, Condition oder Repeat — misst eine Zahl `n`:
 * *was* (`field`: Anzahl Selektionen oder Summe einer Kostenart) in *welchem
 * Bezugsrahmen* (`scope` + `shared` + `includeChildSelections` + `includeChildForces`).
 * Dieses Modul beantwortet genau diese Frage an **einer** Stelle und ersetzt damit
 * die vormals über den Solver verstreuten, parallel gewachsenen Scope-Resolver.
 *
 * Die Auswertung ist in zwei Schichten getrennt:
 *
 * - {@link resolveScopeAnchor} (L2a) ist die **einzige** scope-bewusste Stelle: sie
 *   bildet ein Scope-Token (`roster`/`force`/`parent`/`self` bzw. eine Eintrags-/
 *   Kategorie-ID) auf einen **Anker** ab — einen Knoten-Teilbaum, einen Container
 *   oder einen vorberechneten Zähl-Eimer. `shared="false"` hat dabei Vorrang vor
 *   dem `scope` und bindet den Anker an die eine tragende Instanz (ADR 0003 §4).
 * - {@link measureOver} (L2b) zählt/summiert über den Anker als **Parameter**, ohne
 *   die Scope-Schlüsselwörter zu kennen. Sie honoriert `shared`/`includeChild…` und
 *   nutzt genau **einen** Ziel-Matcher.
 *
 * {@link measureQuery} (L2) fügt beide zusammen. Weil Zähler und — bei Prozent-
 * Grenzen — Nenner denselben Anker teilen, können sie im Bezugsrahmen nicht mehr
 * auseinanderdriften.
 */

/**
 * @typedef {Object} QueryContext Der einmal pro Prüflauf gebündelte, unveränderliche
 *   Auswertungs-Kontext (L1, ADR 0029). Er macht die faktische Zweiphasigkeit —
 *   erst Zähl-Index bauen, dann darüber laufen — zu einem benannten Vertrag, statt
 *   sie als implizites Wissen jeder Aufrufstelle zu verstreuen.
 * @property {import('../types.js').Roster} roster        das geprüfte Roster.
 * @property {Object} system                              das geparste Spielsystem.
 * @property {Object} counts                              die vorberechneten Zähltabellen (computeRosterCounts).
 * @property {string} forceCatalogueId                    Katalog, gegen den Verweise auflösen.
 */

/**
 * @typedef {Object} QuerySubject Der an eine konkrete Instanz gebundene Rahmen, in dem
 *   die Query ausgewertet wird — das *was zählt für wen*. Bei einem über einen
 *   vorberechneten Zähl-Eimer aufgelösten Rahmen (Kategorie-Anker, definitionsseitige
 *   Pflicht-Grenze ohne vorhandene Instanz) gibt es keine tragende Auswahl und keinen
 *   aufgelösten Eintrag; die Instanz-bezogenen Felder sind dann `null`.
 * @property {import('../types.js').Selection|null} selection  die tragende Auswahl.
 * @property {import('../types.js').Selection|null} parentSelection  ihr Elternknoten (für `parent`).
 * @property {Object|null} force                          das Kontingent der Auswahl.
 * @property {Object|null} entry                          die aufgelöste Katalogdefinition der Auswahl.
 * @property {string|null} entryId                        die Link-/Eintrags-ID der Auswahl.
 */

/** Bündelt den L1-Auswertungs-Kontext als benannten Vertrag (ADR 0029). */
export function createQueryContext({ roster, system, counts, forceCatalogueId }) {
  return Object.freeze({ roster, system, counts, forceCatalogueId });
}

/**
 * Was über einen Anker gemessen wird.
 * - `INSTANCES`: die Anzahl der Instanzen des Subjekt-Eintrags im Anker (der Zähler
 *   einer Constraint/Condition).
 * - `REFERENCE`: die gesamte Bezugsgröße des Ankers (der Nenner einer Prozent-Grenze) —
 *   Auswahlanzahl bei `selections`, Kostensumme bei einer Kostenart.
 */
export const MeasureTarget = Object.freeze({
  INSTANCES: 'instances',
  REFERENCE: 'reference'
});

/** Die Anker-Arten, auf die ein Scope abgebildet wird (siehe {@link resolveScopeAnchor}). */
const AnchorKind = Object.freeze({
  SUBTREE: 'subtree',
  CONTAINER: 'container',
  AGGREGATE: 'aggregate',
  ENTRY_BUCKET: 'entryBucket',
  GROUP: 'group',
  COUNT_BUCKET: 'countBucket'
});

/**
 * True, wenn ein aufgelöster Eintrag über einen seiner categoryLinks zur Kategorie `categoryId`
 * gehört. Geteilte Katalog-Logik der Ziel-Prüfung (siehe {@link createEntryInstanceMatcher}).
 */
export const entryHasCategoryLink = (resolvedEntry, categoryId) =>
  !!resolvedEntry?.categoryLinks?.some(cl => cl.targetId === categoryId || cl.id === categoryId);

/** Eine leere Selektions-Liste; die geteilte Instanz hält Identitätsvergleiche stabil. */
const NO_SELECTIONS = Object.freeze([]);

/**
 * True, wenn die gezählte **Ziel**-ID eine Kategorie benennt (statt eines Eintrags).
 * Das ist die einzige Stelle, die die §7.7-Domänenregel als Ziel-Typ-Regel kodiert:
 * ein Kategorie-Zähler aggregiert **armeeweit** über alle Kontingente, ein
 * Eintrags-Zähler bleibt an seinen Scope-Rahmen (z. B. `force` = pro Kontingent)
 * gebunden. Kategorien sind im System als `categoryEntries` definiert (SSOT); ein
 * unbelegtes Kategorie-Ziel ist trotzdem eine Kategorie und wird hier erkannt.
 * @param {string|null|undefined} targetId  die zu zählende Ziel-ID.
 * @param {Object} [system]                 das Spielsystem mit seinen Kategorie-Definitionen.
 * @returns {boolean}
 */
const isCategoryTargetId = (targetId, system) =>
  !!targetId && !!system?.categoryEntries?.some(ce => ce.id === targetId);

/**
 * Baut einen **Gruppen-Anker** aus den bereits ausgewählten Mitglieds-Selektionen einer
 * SelectionEntryGroup. Die *Zugehörigkeit* zu einer Gruppe (welche Katalog-Ids ihr angehören,
 * über Aliasse und Links hinweg) ist definitionsseitige Katalog-Logik und wird vom Aufrufer
 * aufgelöst; der Kern zählt/summiert nur noch über die übergebene, flache Trefferliste. So misst
 * eine Gruppengrenze — Anzahl wie Kosten — über **dieselbe** Stelle wie jeder andere Bezugsrahmen.
 * @param {import('../types.js').Selection[]} matchedSelections  die der Gruppe zugehörigen Selektionen (flach).
 * @returns {Object} der Gruppen-Anker.
 */
export function resolveGroupAnchor(matchedSelections) {
  return { kind: AnchorKind.GROUP, matchedSelections: matchedSelections ?? NO_SELECTIONS };
}

/** Eine Auswahl ohne ausdrückliche `number` steht für genau eine Instanz. */
const SINGLE_INSTANCE_COUNT = 1;

/**
 * Prädikat „diese Auswahl ist eine Instanz des Ziels". Der **einzige** Ziel-Matcher der
 * Engine: er trägt sowohl die Grenzen-Zählung (Ziel = der Eintrag, an dem die Grenze hängt,
 * per {@link QuerySubject}) als auch die Condition-/Repeat-Zählung (Ziel = `childId`/`field`,
 * das eine Eintrags-ID, eine Kategorie oder das Schlüsselwort „model" benennen kann).
 *
 * Verglichen wird über die aufgelöste **Ziel-ID**, nicht die Verweis-ID: verschiedene Links
 * können auf dasselbe Ziel zeigen (ADR 0003 §4). Zwei Ausprägungen, die BSData zwischen den
 * beiden Zählungen unterscheidet, sind ausdrückliche Optionen statt zweier Matcher-Kopien:
 * `matchCategoryMembership` zählt zusätzlich eine Auswahl, deren Eintrag nur über einen
 * categoryLink zum Ziel gehört; `matchUnitsAsModels` lässt das Schlüsselwort „model" auch
 * `unit`-Einträge abdecken.
 *
 * @param {{entryId?: string, entry?: Object|null, force?: Object|null, catalogueId?: string|null}} target
 *   die Ziel-Beschreibung: die zu treffende ID, optional ihre bereits aufgelöste Definition
 *   (sonst wird sie aufgelöst) und der Katalog, gegen den Kandidaten auflösen. Ein
 *   {@link QuerySubject} erfüllt diese Form (`entryId`/`entry`/`force`).
 * @param {{system?: Object}} ctx  nur das Spielsystem wird gelesen (Kandidaten-Auflösung).
 * @param {{matchCategoryMembership?: boolean, matchUnitsAsModels?: boolean}} [options]
 * @returns {(candidate: import('../types.js').Selection) => boolean}
 */
export function createEntryInstanceMatcher(target, ctx, { matchCategoryMembership = false, matchUnitsAsModels = false } = {}) {
  const { entryId, force } = target;
  const { system } = ctx;
  const catalogueId = target.catalogueId ?? (force ? force.catalogueId : null);
  const resolveInCatalogue = (id) => resolveEntry(system, findEntryInSystem(system, id, catalogueId), catalogueId);
  const targetEntry = target.entry ?? (system ? resolveInCatalogue(entryId) : null);
  const targetCanonicalId = targetEntry ? (targetEntry.targetId || targetEntry.id) : entryId;
  const modelLikeTypes = matchUnitsAsModels
    ? [SelectionEntryKind.MODEL, SelectionEntryKind.UNIT]
    : [SelectionEntryKind.MODEL];

  return (candidate) => {
    const candidateId = candidate.entryLinkId || candidate.selectionEntryId;
    if (candidateId === entryId) return true;
    if (!system) return false;

    const resolvedCandidate = resolveInCatalogue(candidateId);
    if (!resolvedCandidate) return false;
    if (resolvedCandidate.targetId === entryId) return true;

    const candidateCanonicalId = resolvedCandidate.targetId || resolvedCandidate.id;
    if (candidateCanonicalId === targetCanonicalId) return true;
    if (matchCategoryMembership && entryHasCategoryLink(resolvedCandidate, entryId)) return true;
    return entryId === SelectionEntryKind.MODEL && modelLikeTypes.includes(resolvedCandidate.type);
  };
}

/** Baut einen **Teilbaum-Anker** über die eine Instanz, an der eine nicht geteilte Query hängt. */
function resolveSubtreeAnchor(selection) {
  return { kind: AnchorKind.SUBTREE, selection };
}

/** Baut einen **Container-Anker** über die direkten Kinder eines Eltern-Containers (Scope `parent`). */
function resolveContainerAnchor(containerSelections) {
  return { kind: AnchorKind.CONTAINER, containerSelections: containerSelections ?? NO_SELECTIONS };
}

/**
 * Baut einen **Zähl-Eimer-Anker** über die vorberechneten Zähltabellen: die Anzahl greift auf
 * `selectionCounts[targetId]` zu, fällt auf die Kategorie-Zählung `forceCategoryCounts[targetId]`
 * und zuletzt auf 0 zurück. `selectionCounts` ist roster-weit über alle Kontingente aggregiert
 * (computeRosterCounts), sodass eine kategoriezählende Bedingung die **aggregierte** Kategorie-Zahl
 * liest, nicht die eines einzelnen Kontingents (ADR 0029).
 *
 * Beide Tabellen werden gegen `null`/`undefined` auf eine leere Tabelle normalisiert: manche
 * Aufrufer (z. B. die Hidden-Flag-Auswertung in `entryVisibility`) reichen bewusst
 * `forceCategoryCounts: null` durch, um „keine Kategorie-Zähler vorhanden" auszudrücken — eine
 * fehlende Tabelle zählt als 0, nicht als Fehler.
 * @param {string} targetId              die Ziel-ID (Eintrag oder Kategorie), deren Zähler gelesen wird.
 * @param {{selectionCounts?: Object|null, forceCategoryCounts?: Object|null}} tables
 * @returns {Object} der Zähl-Eimer-Anker.
 */
export function resolveCountBucketAnchor(targetId, { selectionCounts, forceCategoryCounts } = {}) {
  return {
    kind: AnchorKind.COUNT_BUCKET,
    targetId,
    selectionCounts: selectionCounts ?? {},
    forceCategoryCounts: forceCategoryCounts ?? {}
  };
}

/** Die höhere der beiden Zählungen für Link-ID und aufgelöste Ziel-ID des Subjekts. */
function countEntryInstancesInBucket(countsByEntryId, { entry, entryId }) {
  return Math.max(
    countsByEntryId[entryId] || 0,
    entry?.targetId ? countsByEntryId[entry.targetId] || 0 : 0
  );
}

/**
 * L2a — Bildet ein Scope-Token auf einen Anker ab. Die **einzige** Stelle, die die
 * geschlossene Scope-Liste kennt.
 *
 * `shared="false"` bindet unabhängig vom `scope` an den Teilbaum der tragenden
 * Instanz. Andernfalls bestimmt der `scope` den Rahmen — **einheitlich für
 * Constraint, Condition und Repeat** (die XSD kennt für die drei keinen Unterschied,
 * `Catalogue.xsd:421-434`); die maßgebliche Zähl-Frame folgt dem **Ziel-Typ**, nicht
 * der Query-Art:
 * - Eintrags-/Kategorie-ID → vorberechneter Zähl-Eimer (mit Container als Bezugsgröße);
 *   `selectionCounts` ist roster-weit über alle Kontingente aggregiert, sodass ein
 *   Kategorie-Scope **armeeweit** zählt (§7.7) — bewusst, nicht durch Zufall der
 *   Fallback-Reihenfolge,
 * - `parent` → die Kinder des Eltern-Containers (ersatzweise die des Kontingents),
 * - `roster` → das ganze Roster (Zähl-Eimer + Wurzel-Selektionen),
 * - `force` → **Kategorie-Ziel armeeweit** (§7.7), **Eintrags-Ziel pro Kontingent**;
 *   `includeChildForces` weitet ohnehin auf das ganze Roster.
 *
 * @param {Object} query    die Query (Constraint/Condition/Repeat) mit `scope`/`shared`/`includeChildForces`.
 * @param {QuerySubject} subject
 * @param {QueryContext} ctx
 * @returns {Object} der Anker.
 */
export function resolveScopeAnchor(query, subject, ctx) {
  const { selection, parentSelection, force } = subject;
  const { roster, system, counts } = ctx;
  const { selectionCounts, forceSelectionCounts, categoryCounts } = counts;

  const scope = query.scope;

  // `parent` ist ein instanz-relativer Rahmen — die Kinder des Eltern-Containers —
  // und geht **vor** `shared="false"`: der shared-Teilbaum bindet an die tragende
  // Instanz, doch der parent-Rahmen ist bereits an genau diese eine Instanz gebunden,
  // sodass `shared="false"` ihn nicht weiter einschränkt (ADR 0003 §4).
  if (scope === ConstraintScope.PARENT) {
    const container = parentSelection ?? force;
    return resolveContainerAnchor(childSelectionsOf(container));
  }

  if (!isSharedQuery(query)) {
    return resolveSubtreeAnchor(selection);
  }

  if (isEntryScope(scope)) {
    const forceCategoryCounts = force ? (categoryCounts[force.id] || {}) : {};
    const container = parentSelection ?? force;
    // Ziel-Typ-Regel (§7.7, {@link isCategoryTargetId}): benennt der Scope eine
    // **Kategorie**, so ist eine unbelegte Kategorie echte **0** (kein Einzelinstanz-
    // Ersatz). Nur ein selbst-referenzieller **Eintrags**-Scope zählt die tragende
    // Instanz als 1. Damit trägt derselbe Anker eine Kategorie-Pflicht (`min`) wie
    // eine -Obergrenze — einheitlich über **alle** Aufrufer (auch die force-deklarierten
    // Kategorie-Limits), statt über einen zweiten Kategorie-Anker.
    return {
      kind: AnchorKind.ENTRY_BUCKET,
      scopeId: scope,
      isCategoryScope: isCategoryTargetId(scope, system),
      selectionCounts,
      forceCategoryCounts,
      containerSelections: childSelectionsOf(container)
    };
  }

  if (scope === ConstraintScope.ROSTER) {
    return {
      kind: AnchorKind.AGGREGATE,
      counts: selectionCounts,
      nodes: rootSelectionsOf(roster),
      isRosterScope: true
    };
  }

  if (scope === ConstraintScope.FORCE) {
    // Ziel-Typ-Regel (§7.7, {@link isCategoryTargetId}): ein Kategorie-Ziel aggregiert
    // armeeweit über alle Kontingente — auch unter `force`-Scope, weil `forceSelectionCounts`
    // nur Einträge je Kontingent führt und Kategorien gerade kontingentübergreifend gelten.
    // Ein Eintrags-Ziel bleibt am Kontingent (`forceSelectionCounts[force.id]`).
    //
    // `includeChildForces` meint laut BSData das Kontingent samt seiner Nachfahren.
    // Der .ros-Import legt verschachtelte Kontingente als Geschwister auf Rosterebene
    // flach (ADR 0011 §5), sodass die Nachfahren-Beziehung im Modell nicht überlebt —
    // das ganze Roster ist die nächstliegende verfügbare Obermenge.
    const countsCategory = isCategoryTargetId(subject.entryId, system);
    const armyWide = query.includeChildForces || countsCategory;
    const perForceCounts = force ? (forceSelectionCounts[force.id] || {}) : selectionCounts;
    return {
      kind: AnchorKind.AGGREGATE,
      counts: armyWide ? selectionCounts : perForceCounts,
      nodes: query.includeChildForces ? rootSelectionsOf(roster) : childSelectionsOf(force),
      isRosterScope: false
    };
  }

  return resolveSubtreeAnchor(selection);
}

/** Summiert die Kosten der Kostenart `field` über eine Selektions-Liste. */
function sumScopeCost(selections, field, subject, ctx) {
  const { roster, system, counts, forceCatalogueId } = ctx;
  return selections.reduce(
    (total, sel) => total + getSelectionTotalCost(sel, field, TOP_LEVEL_PARENT_COUNT, {
      system, roster, currentCatalogueId: forceCatalogueId, parentSelection: subject.parentSelection, counts
    }),
    0
  );
}

/** Die Selektionen, über die ein Anker seine Bezugsgröße (Nenner) misst. */
function referenceSelectionsOf(anchor, subject) {
  switch (anchor.kind) {
    case AnchorKind.SUBTREE: return subject.selection ? [subject.selection] : [];
    case AnchorKind.CONTAINER:
    case AnchorKind.ENTRY_BUCKET: return anchor.containerSelections;
    case AnchorKind.AGGREGATE: return anchor.nodes;
    case AnchorKind.GROUP: return anchor.matchedSelections;
    default: return [];
  }
}

/** Die Bezugsgröße (Nenner) einer Prozent-Grenze über den Anker. */
function measureReference(anchor, { field, includeChildSelections, subject, ctx }) {
  const { roster, system } = ctx;

  if (isCostField(field, system, roster)) {
    // Roster-weite Prozentgrenze der maßgeblichen Kostenart: das eingestellte
    // Punktebudget ist die natürliche Bezugsgröße, sofern vorhanden.
    if (anchor.kind === AnchorKind.AGGREGATE && anchor.isRosterScope &&
        field === roster?.costLimitType && roster?.costLimit) {
      return roster.costLimit;
    }
    return sumScopeCost(referenceSelectionsOf(anchor, subject), field, subject, ctx);
  }

  if (anchor.kind === AnchorKind.SUBTREE) {
    return countSelectionsInSubtree(subject.selection, { includeChildSelections });
  }
  return countSelections(referenceSelectionsOf(anchor, subject), { includeChildSelections });
}

/**
 * Die Anzahl der Instanzen des Ziels (Zähler) über den Anker. Zählt ein Anker über einen
 * Ziel-Matcher (Teilbaum/Container), so verwendet er den ausdrücklich übergebenen `matcher`
 * — den eine Condition/ein Repeat mit ihren eigenen Optionen baut — und fällt sonst auf den
 * aus dem Subjekt abgeleiteten Grenzen-Matcher zurück.
 */
function measureInstances(anchor, { includeChildSelections, matcher, subject, ctx }) {
  const instanceCount = subject.selection?.number || SINGLE_INSTANCE_COUNT;
  const matchesTarget = matcher ?? createEntryInstanceMatcher(subject, ctx);

  switch (anchor.kind) {
    case AnchorKind.SUBTREE:
      return countSelectionsInSubtree(subject.selection, { includeChildSelections, predicate: matchesTarget });
    case AnchorKind.CONTAINER:
      return countSelections(anchor.containerSelections, { includeChildSelections, predicate: matchesTarget });
    case AnchorKind.AGGREGATE:
      return countEntryInstancesInBucket(anchor.counts, subject);
    case AnchorKind.ENTRY_BUCKET:
      // Ein Kategorie-Scope fällt bei Leere auf echte 0 zurück, ein Eintrags-Scope auf
      // die eine tragende Instanz (`instanceCount`) — die Unterscheidung trifft
      // {@link resolveScopeAnchor} über `isCategoryScope`, hier wird sie nur gelesen.
      return anchor.selectionCounts[anchor.scopeId] ||
        anchor.forceCategoryCounts[anchor.scopeId] ||
        (anchor.isCategoryScope ? 0 : instanceCount);
    case AnchorKind.GROUP:
      // Die Trefferliste ist bereits flach aufgelöst; ihre eigene Anzahl ist die
      // Summe der `number` je Treffer, ohne erneutes Absteigen in Kinder.
      return countSelections(anchor.matchedSelections, {});
    case AnchorKind.COUNT_BUCKET:
      // Aggregierter Zähler einer Condition/eines Repeats über die vorberechneten Tabellen;
      // eine unbelegte Ziel-ID ist echte 0 (kein Einzelinstanz-Ersatz).
      return anchor.selectionCounts[anchor.targetId] || anchor.forceCategoryCounts[anchor.targetId] || 0;
    default:
      return instanceCount;
  }
}

/**
 * L2b — Zählt/summiert über einen Anker. Völlig scope-agnostisch: der Anker ist ein
 * Parameter, die Funktion kennt kein `roster`/`force`/`parent`.
 * @param {Object} anchor  Ergebnis von {@link resolveScopeAnchor} bzw. eines Anker-Konstruktors.
 * @param {{target: string, field?: string, includeChildSelections?: boolean, matcher?: Function, subject?: Partial<QuerySubject>, ctx?: Partial<QueryContext>}} spec
 * @returns {number}
 */
export function measureOver(anchor, { target, field = SELECTIONS_FIELD, includeChildSelections = false, matcher, subject = {}, ctx = {} }) {
  if (target === MeasureTarget.REFERENCE) {
    return measureReference(anchor, { field, includeChildSelections, subject, ctx });
  }
  return measureInstances(anchor, { includeChildSelections, matcher, subject, ctx });
}

/**
 * L2 — Misst die Anzahl der Instanzen des Subjekt-Eintrags im Bezugsrahmen der Query.
 * Fügt {@link resolveScopeAnchor} und {@link measureOver} zusammen und liefert ein
 * Ergebnis, das seinen Anker mitträgt, sodass eine Prozent-Grenze ihren Nenner über
 * **denselben** Anker misst wie den Zähler (kein Zähler/Nenner-Drift, ADR 0029).
 * @param {Object} query
 * @param {QuerySubject} subject
 * @param {QueryContext} ctx
 * @returns {{value: number, anchor: Object}}
 */
export function measureQuery(query, subject, ctx) {
  const anchor = resolveScopeAnchor(query, subject, ctx);
  const value = measureOver(anchor, {
    target: MeasureTarget.INSTANCES,
    includeChildSelections: query.includeChildSelections,
    subject,
    ctx
  });
  return { value, anchor };
}

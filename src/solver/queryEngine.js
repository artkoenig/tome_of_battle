import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import {
  childSelectionsOf, rootSelectionsOf, countSelections, countSelectionsInSubtree
} from './rosterTree.js';
import { getSelectionTotalCost, TOP_LEVEL_PARENT_COUNT } from './rosterCounter.js';
import { isCostField } from './constraintScope.js';
import { ConstraintScope, isEntryScope, isSharedQuery } from './battlescribeConstants.js';
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
 *   die Query ausgewertet wird — das *was zählt für wen*.
 * @property {import('../types.js').Selection} selection  die tragende Auswahl.
 * @property {import('../types.js').Selection|null} parentSelection  ihr Elternknoten (für `parent`).
 * @property {Object|null} force                          das Kontingent der Auswahl.
 * @property {Object} entry                               die aufgelöste Katalogdefinition der Auswahl.
 * @property {string} entryId                             die Link-/Eintrags-ID der Auswahl.
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
  ENTRY_BUCKET: 'entryBucket'
});

/** Eine Auswahl ohne ausdrückliche `number` steht für genau eine Instanz. */
const SINGLE_INSTANCE_COUNT = 1;

/**
 * Prädikat „diese Auswahl ist eine Instanz des Subjekt-Eintrags". Verglichen wird
 * über die aufgelöste Ziel-ID, nicht die Link-ID: verschiedene Links können auf
 * dasselbe Ziel zeigen (ADR 0003 §4). Der **einzige** Ziel-Matcher der Engine.
 * @param {QuerySubject} subject
 * @param {QueryContext} ctx
 * @returns {(candidate: import('../types.js').Selection) => boolean}
 */
export function createEntryInstanceMatcher(subject, ctx) {
  const { entry, entryId, force } = subject;
  const { system } = ctx;
  const catalogueId = force ? force.catalogueId : null;
  return (candidate) => {
    const candidateId = candidate.entryLinkId || candidate.selectionEntryId;
    if (candidateId === entryId) return true;
    if (!entry?.targetId) return false;
    if (candidateId === entry.targetId) return true;
    const candidateDef = findEntryInSystem(system, candidateId, catalogueId);
    const resolvedCandidate = resolveEntry(system, candidateDef, catalogueId);
    return resolvedCandidate?.targetId === entry.targetId;
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
 * Instanz. Andernfalls bestimmt der `scope` den Anker:
 * - Eintrags-/Kategorie-ID → vorberechneter Zähl-Eimer (mit Container als Bezugsgröße),
 * - `parent` → die Kinder des Eltern-Containers (ersatzweise die des Kontingents),
 * - `roster` → das ganze Roster (Zähl-Eimer + Wurzel-Selektionen),
 * - `force` → das Kontingent, per `includeChildForces` auf das ganze Roster geweitet.
 *
 * @param {Object} query    die Query (Constraint/Condition) mit `scope`/`shared`/`includeChildForces`.
 * @param {QuerySubject} subject
 * @param {QueryContext} ctx
 * @returns {Object} der Anker.
 */
export function resolveScopeAnchor(query, subject, ctx) {
  const { selection, parentSelection, force } = subject;
  const { roster, counts } = ctx;
  const { selectionCounts, forceSelectionCounts, categoryCounts } = counts;

  if (!isSharedQuery(query)) {
    return { kind: AnchorKind.SUBTREE, selection };
  }

  const scope = query.scope;

  if (isEntryScope(scope)) {
    const forceCategoryCounts = force ? (categoryCounts[force.id] || {}) : {};
    const container = parentSelection ?? force;
    return {
      kind: AnchorKind.ENTRY_BUCKET,
      scopeId: scope,
      selectionCounts,
      forceCategoryCounts,
      containerSelections: childSelectionsOf(container)
    };
  }

  if (scope === ConstraintScope.PARENT) {
    const container = parentSelection ?? force;
    return { kind: AnchorKind.CONTAINER, containerSelections: childSelectionsOf(container) };
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
    // `includeChildForces` meint laut BSData das Kontingent samt seiner Nachfahren.
    // Der .ros-Import legt verschachtelte Kontingente als Geschwister auf Rosterebene
    // flach (ADR 0011 §5), sodass die Nachfahren-Beziehung im Modell nicht überlebt —
    // das ganze Roster ist die nächstliegende verfügbare Obermenge.
    return {
      kind: AnchorKind.AGGREGATE,
      counts: query.includeChildForces
        ? selectionCounts
        : (force ? forceSelectionCounts[force.id] || {} : {}),
      nodes: query.includeChildForces ? rootSelectionsOf(roster) : childSelectionsOf(force),
      isRosterScope: false
    };
  }

  return { kind: AnchorKind.SUBTREE, selection };
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

/** Die Anzahl der Instanzen des Subjekt-Eintrags (Zähler) über den Anker. */
function measureInstances(anchor, { includeChildSelections, subject, ctx }) {
  const matcher = createEntryInstanceMatcher(subject, ctx);
  const instanceCount = subject.selection?.number || SINGLE_INSTANCE_COUNT;

  switch (anchor.kind) {
    case AnchorKind.SUBTREE:
      return countSelectionsInSubtree(subject.selection, { includeChildSelections, predicate: matcher });
    case AnchorKind.CONTAINER:
      return countSelections(anchor.containerSelections, { includeChildSelections, predicate: matcher });
    case AnchorKind.AGGREGATE:
      return countEntryInstancesInBucket(anchor.counts, subject);
    case AnchorKind.ENTRY_BUCKET:
      return anchor.selectionCounts[anchor.scopeId] ||
        anchor.forceCategoryCounts[anchor.scopeId] ||
        instanceCount;
    default:
      return instanceCount;
  }
}

/**
 * L2b — Zählt/summiert über einen Anker. Völlig scope-agnostisch: der Anker ist ein
 * Parameter, die Funktion kennt kein `roster`/`force`/`parent`.
 * @param {Object} anchor  Ergebnis von {@link resolveScopeAnchor}.
 * @param {{target: string, field?: string, includeChildSelections?: boolean, subject: QuerySubject, ctx: QueryContext}} spec
 * @returns {number}
 */
export function measureOver(anchor, { target, field = SELECTIONS_FIELD, includeChildSelections = false, subject, ctx }) {
  if (target === MeasureTarget.REFERENCE) {
    return measureReference(anchor, { field, includeChildSelections, subject, ctx });
  }
  return measureInstances(anchor, { includeChildSelections, subject, ctx });
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

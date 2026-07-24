import { findEntryInSystem, resolveEntry } from './catalogResolver.js';
import { getModifiedConstraintValue, evaluateConstraintWithCauses, getEffectiveModifiers, collectTriggeredMessages, ValidationSeverity } from './modifierEvaluator.js';
import { ConditionKind, ConstraintKind } from '../parser/schema/battlescribeSchema.generated.js';
import { calculateRosterCosts, computeRosterCounts, getSelectionTotalCost, resolveCostTypeLabel, resolveCostLimitLabel, TOP_LEVEL_PARENT_COUNT } from './rosterCounter.js';
import { isPercentConstraint, applyPercentage } from './constraintScope.js';
import {
  ConstraintScope, isEntryScope, isCostField, isRosterLimitField, costTypeIdOfRosterLimitField
} from './battlescribeConstants.js';
import { createQueryContext, resolveScopeAnchor, resolveGroupAnchor, resolveCategoryAnchor, measureOver, MeasureTarget } from './queryEngine.js';
import { findForceEntryById } from './forceEntries.js';
import { isCategoryLinkHidden, isSelectionEntryHidden } from './entryVisibility.js';
import { collectForceScopedMinSelectors, collectRosterScopedMinSelectors } from './armyWideSelectors.js';
import { getInheritedCategoryMaxConstraint } from './categoryLimits.js';
import { ValidationMessageKey } from './validationMessages.js';
import '../types.js';

/**
 * Autoritative Sperr-Klassifikation der Aushebe-Verfügbarkeit (ADR-0022). Bildet **jeden**
 * vom Validator erzeugten Verstoß-`type` darauf ab, ob er einen Kandidaten im Aushebe-Dialog
 * sperrt: `true` = Obergrenze/„nicht erlaubt" (`*-max`, Autoren-`error`), `false` = Budget-/
 * „zu-wenig"-Zustand des normalen, unfertigen Bauflusses (`*-min`, Punktelimit, unresolved).
 *
 * Einzige Wahrheitsquelle für diese Frage: der Dialog liest ausschließlich das hieraus
 * gestempelte `blocksAddAvailability`-Flag jedes Verstoßes, nie die Typ-Namenskonvention.
 */
export const VIOLATION_BLOCKS_ADD_AVAILABILITY = Object.freeze({
  'roster-limit': false,
  'force-roster-limit': false,
  'force-selector-min': false,
  'roster-selector-min': false,
  'category-min': false,
  'category-max': true,
  'entry-min': false,
  'entry-max': true,
  'entry-percent-min': false,
  'entry-percent-max': true,
  'group-count-min': false,
  'group-count-max': true,
  'group-points-min': false,
  'group-points-max': true,
  'group-percent-min': false,
  'group-percent-max': true,
  'unresolved-entry': false,
  'modifier-error': true,
  'modifier-warning': false,
  'modifier-info': false
});

/**
 * Sperr-Flag eines Verstoß-Typs. Wirft bei unklassifiziertem Typ, damit ein neu eingeführter
 * Verstoß nicht stillschweigend als „nicht sperrend" durchrutscht (Driftschutz, ADR-0022).
 * @param {string} type
 * @returns {boolean}
 */
export function classifyBlocksAddAvailability(type) {
  const blocks = VIOLATION_BLOCKS_ADD_AVAILABILITY[type];
  if (typeof blocks !== 'boolean') {
    throw new Error(
      `Unklassifizierter Validierungstyp „${type}": in VIOLATION_BLOCKS_ADD_AVAILABILITY ergänzen (ADR-0022).`
    );
  }
  return blocks;
}

/**
 * Einziger Erzeugungspunkt eines Verstoßes: hängt ihn an die Fehlerliste und stempelt ihn
 * mit dem autoritativen `blocksAddAvailability`-Flag. Alle Prüfungen laufen hierüber, sodass
 * kein Verstoß ungestempelt oder unklassifiziert entstehen kann.
 * @param {import('../types.js').ValidationError[]} errors
 * @param {import('../types.js').ValidationError} violation
 */
function pushViolation(errors, violation) {
  errors.push({ ...violation, blocksAddAvailability: classifyBlocksAddAvailability(violation.type) });
}

/**
 * Spread-ready optionales Ursachen-Feld eines Verstoßes (ADR 0027): trägt `causes` nur, wenn
 * mindestens eine Ursache sauber auflösbar war. Ohne Ursache bleibt das Feld weg, sodass der
 * Verstoß byte-gleich zum bisherigen Verhalten bleibt (abwärtskompatibel).
 * @param {import('../types.js').ValidationCause[]} causes
 * @returns {{causes: import('../types.js').ValidationCause[]}|{}}
 */
function withCauses(causes) {
  return causes.length > 0 ? { causes } : {};
}

/**
 * @typedef {Object} ValidationContext Alles, was während der Prüfung einer Force
 *   unverändert bleibt. Jede `check*`-Funktion nimmt genau dieses Bündel entgegen,
 *   statt seine Felder einzeln durchzureichen; nur der jeweils geprüfte Gegenstand
 *   (Selection, Eintrag, Constraint) kommt als eigenes Argument dazu.
 * @property {import('../types.js').Roster} roster  das geprüfte Roster.
 * @property {Object} system            das geparste Spielsystem (gst + Kataloge).
 * @property {Object} force             die gerade geprüfte Force.
 * @property {Object} forceDef          ihre forceEntry-Definition im System.
 * @property {Object} counts            die vorberechneten Zählungen des Rosters.
 * @property {string} forceCatalogueId  Katalog, gegen den Verweise dieser Force auflösen.
 * @property {import('../types.js').ValidationError[]} errors  Sammelziel aller Verstöße.
 */

/**
 * Bündelt den unveränderlichen Prüfkontext einer Force. Der Katalog der Force wird
 * hier einmal festgelegt, statt ihn in jedem Prüfschritt erneut herzuleiten.
 * @returns {ValidationContext}
 */
function buildValidationContext({ roster, system, force, forceDef, counts, errors }) {
  return {
    roster,
    system,
    force,
    forceDef,
    counts,
    forceCatalogueId: force.catalogueId || roster.catalogueId,
    errors
  };
}

/**
 * Validates a roster against a game system's rules and constraints.
 * @param {import('../types.js').Roster} roster
 * @param {Object} system
 * @returns {import('../types.js').ValidationError[]}
 */
export function validateRoster(roster, system) {
  const errors = [];
  if (!roster || !system) return errors;

  const counts = computeRosterCounts(roster, system);

  checkRosterCostLimit(roster, system, errors);
  checkMandatoryRosterSelectors({ roster, system, counts, errors });

  roster.forces.forEach(force => {
    const forceDef = findForceEntryById(system, force.forceEntryId);
    if (!forceDef) return;

    const context = buildValidationContext({ roster, system, force, forceDef, counts, errors });

    checkForceCategoryLimits(context);
    checkMandatoryForceSelectors(context);
    checkForceOwnRosterPointsLimit(context);

    force.selections?.forEach(selection =>
      checkSelectionTree({ selection, parentSelection: null }, context)
    );
  });

  return errors;
}

/**
 * True, sobald mindestens ein Validierungseintrag das Spielen blockiert (Schweregrad
 * `error`). Rein informative Einträge (`warning`/`info`) blockieren nicht. Einziger Ort
 * der Play-Gate-Entscheidung, statt die bloße Listenlänge zu prüfen — so führt ein
 * informativer Hinweis nicht mehr fälschlich zum gesperrten Play-Button.
 * @param {import('../types.js').ValidationError[]} validationErrors
 * @returns {boolean}
 */
export function hasBlockingViolations(validationErrors) {
  return countBlockingViolations(validationErrors) > 0;
}

/** Anzahl der blockierenden (severity="error") Eintraege — nicht-blockierende warning/info zaehlen nicht mit. */
export function countBlockingViolations(validationErrors) {
  return (validationErrors || []).filter(error => error.severity === ValidationSeverity.ERROR).length;
}

/** Kosten des Rosters gegen das eingestellte Limit prüfen. */
function checkRosterCostLimit(roster, system, errors) {
  const costs = calculateRosterCosts(roster, system);
  if (!roster.costLimit || !roster.costLimitType) return;

  const limit = roster.costLimit;
  const current = costs[roster.costLimitType] || 0;
  if (current > limit) {
    pushViolation(errors, {
      type: 'roster-limit',
      messageKey: ValidationMessageKey.ROSTER_LIMIT,
      messageParams: { current, limit, unitLabel: resolveCostLimitLabel(roster, system) },
      severity: ValidationSeverity.ERROR
    });
  }
}

/**
 * Query-Subjekt ohne konkrete Selection-Instanz: benutzt, wenn über einen
 * Kategorie-, Force- oder Roster-Anker gemessen wird, ohne an einer einzelnen
 * Auswahl zu hängen (Kategorie- und Pflicht-Präsenz-Prüfungen). Ohne `entry`
 * bleiben `entry`/`entryId` null; mit `entry` trägt es dessen id.
 */
function nullInstanceSubject(force, entry = null) {
  return { selection: null, parentSelection: null, force, entry, entryId: entry?.id ?? null };
}

/**
 * Min/Max-Limits einer Force-deklarierten Kategorie prüfen. Die Kategorie-Belegung
 * zählt **armeeweit** über alle Kontingente (settled decision „Kategorie immer
 * armeeweit", §7.7) — einheitlich mit der Art, wie Conditions, Constraints und Repeats
 * seit ADR 0029 Kategorie-Ziele zählen. Bei Ein-Force-Rostern (der von der App
 * erzeugte Regelfall, `createRoster.js`) ist das deckungsgleich mit der früheren
 * per-Kontingent-Zählung; erst bei mehreren Kontingenten wird die armeeweite Aggregation
 * sichtbar — und ist die kompositions-korrekte Lesart einer Kategoriegrenze.
 * @param {ValidationContext} context
 */
function checkForceCategoryLimits({ roster, system, force, forceDef, counts, errors, forceCatalogueId }) {
  const { selectionCounts, categoryCounts } = counts;
  const queryCtx = createQueryContext({ roster, system, counts, forceCatalogueId });

  forceDef.categoryLinks?.forEach(catLink => {
    const targetCatId = catLink.targetId;
    const forceCategoryCounts = categoryCounts[force.id] || {};

    if (isCategoryLinkHidden(catLink, { system, roster, selectionCounts, forceCategoryCounts })) {
      return;
    }

    const catDef = system.categoryEntries?.find(ce => ce.id === targetCatId);
    const catName = catDef ? catDef.name : catLink.name;
    // Armeeweite Kategorie-Belegung über den zentralen Zähl-Kern (ADR 0029): der
    // Kategorie-Anker liest die roster-weite Kategorie-Summe. Diese steht bereits in
    // `selectionCounts` — derselben Quelle, die der ENTRY_BUCKET-Anker zuerst liest —
    // sodass ein Kategorie-Ziel überall genau dieselbe armeeweite Zahl ergibt (SSOT,
    // keine zweite Aggregation). Eine leere Kategorie ist echte 0: derselbe Wert trägt
    // Ober- (max) wie Pflichtgrenze (min).
    const count = measureOver(
      resolveCategoryAnchor(targetCatId, selectionCounts),
      {
        target: MeasureTarget.INSTANCES,
        subject: nullInstanceSubject(force),
        ctx: queryCtx
      }
    );
    const ctx = { roster, counts, selectionCounts, forceCategoryCounts, force, system };

    // 1. Constraints am categoryLink (samt Quirk-geerbtem max), Modifier vom Link.
    collectCategoryLinkConstraints({ catLink, forceDef, system, targetCatId }).forEach(con =>
      evaluateForceCategoryConstraint({
        con,
        modifiers: con.isFallback ? con.modifiers : getEffectiveModifiers(catLink),
        count, catName, forceDef, force, targetCatId, ctx, errors
      })
    );

    // 2. Force-weite Constraints direkt an der categoryEntry-Definition (neuer
    //    Lexicanum-Datensatz), Modifier von der categoryEntry. Der alte Datensatz
    //    deklariert hier nichts mit force-Scope, bleibt also unberührt.
    collectCategoryEntryForceConstraints(catDef).forEach(con =>
      evaluateForceCategoryConstraint({
        con,
        modifiers: getEffectiveModifiers(catDef),
        count, catName, forceDef, force, targetCatId, ctx, errors
      })
    );
  });
}

/**
 * Prüft armeeweite Pflichtauswahlen: Wurzel-Katalogeinträge mit force-scoped `min`-
 * Constraint (z. B. die Vampire-Counts-Bloodline — „mindestens eine pro Kontingent").
 * Solange ein solcher Eintrag gar nicht im Roster liegt, sieht ihn die eintragsweise
 * Constraint-Prüfung nie, sodass eine komplett fehlende Pflichtauswahl unbemerkt bliebe.
 * Hier wird nur der Fall „gar nicht vorhanden" gemeldet; ein vorhandener, aber zu geringer
 * Count bleibt bei der eintragsweisen Prüfung, damit kein Fehler doppelt erscheint.
 * Versteckte Selektoren (nur in bestimmten Armee-Varianten wählbar) werden übersprungen,
 * damit ihre Pflicht nicht für Armeen greift, die sie nicht nehmen können.
 * @param {ValidationContext} context
 */
function checkMandatoryForceSelectors({ roster, system, force, forceDef, counts, errors, forceCatalogueId }) {
  const { selectionCounts, categoryCounts } = counts;
  const forceCategoryCounts = categoryCounts[force.id] || {};
  const queryCtx = createQueryContext({ roster, system, counts, forceCatalogueId });

  collectForceScopedMinSelectors(system, forceCatalogueId).forEach(({ entry, minConstraint }) => {
    if (isSelectionEntryHidden(entry, {
      system, roster, selectionCounts, forceCategoryCounts, force, catalogueId: forceCatalogueId
    })) return;

    const ctx = { roster, system, counts, selectionCounts, forceCategoryCounts, force, parentCatalogueId: forceCatalogueId };
    const { value: minValue, causes } = evaluateConstraintWithCauses(minConstraint, getEffectiveModifiers(entry), ctx);
    if (minValue <= 0) return;

    // Die kontingentweite Belegung des Pflicht-Eintrags läuft über den zentralen Zähl-Kern
    // (ADR 0029): ein `force`-Anker über den vorberechneten Zähl-Eimer. Fehlt der Eintrag,
    // ist die Belegung 0 und die `min`-Pflicht schlägt an — der geforderte „fehlt ganz"-Fall.
    const mandatorySubject = nullInstanceSubject(force, entry);
    const currentCount = measureOver(
      resolveScopeAnchor({ scope: ConstraintScope.FORCE }, mandatorySubject, queryCtx),
      { target: MeasureTarget.INSTANCES, subject: mandatorySubject, ctx: queryCtx }
    );
    if (currentCount === 0) {
      pushViolation(errors, {
        type: 'force-selector-min',
        forceId: force.id,
        messageKey: ValidationMessageKey.FORCE_SELECTOR_MIN,
        messageParams: { entryName: entry.name, forceName: forceDef.name, count: minValue },
        severity: ValidationSeverity.ERROR,
        ...withCauses(causes)
      });
    }
  });
}

/**
 * Prüft armeeweite Pflichtauswahlen mit **roster**-scoped `min`-Constraint (z. B. die
 * Ogre-Kingdoms-„Bulls": „mindestens eine Bullen-Einheit im ganzen Roster"). Anders als
 * die force-scoped Variante zählt eine solche Pflicht über **alle** Kontingente zusammen
 * (roster-weite Selektions-Zähler statt kontingentweiter), gilt also fürs ganze Roster und
 * wird **einmal pro Roster** gemeldet — ohne `forceId`.
 *
 * Wie {@link checkMandatoryForceSelectors} nur der „gar nicht vorhanden"-Fall (Count == 0);
 * ein vorhandener, aber zu geringer Count bleibt der eintragsweisen Prüfung überlassen, damit
 * kein Fehler doppelt erscheint. Versteckte Selektoren (`isSelectionEntryHidden`) werden
 * übersprungen. Ein Eintrag wird je Katalog nur einmal betrachtet, damit ein Roster mit
 * mehreren Kontingenten desselben Katalogs die fehlende Pflicht nicht mehrfach meldet.
 * @param {{ roster: import('../types.js').Roster, system: Object, counts: Object,
 *   errors: import('../types.js').ValidationError[] }} context
 */
function checkMandatoryRosterSelectors({ roster, system, counts, errors }) {
  const { selectionCounts, categoryCounts } = counts;
  // A `scope="roster"` requirement is evaluated army-wide, so its hidden/min result must not
  // depend on which contingent happens to be iterated first. We therefore aggregate the
  // per-force category counts into one roster-wide tally and evaluate each selector against
  // that single, force-independent context — otherwise a conditional min gated on a category
  // present only in a later contingent would be missed once the entry is marked "considered".
  const rosterCategoryCounts = aggregateRosterCategoryCounts(categoryCounts);
  const consideredSelectors = new Set();

  roster.forces.forEach(force => {
    const catalogueId = force.catalogueId || roster.catalogueId;
    const queryCtx = createQueryContext({ roster, system, counts, forceCatalogueId: catalogueId });

    collectRosterScopedMinSelectors(system, catalogueId).forEach(({ entry, minConstraint }) => {
      const selectorKey = `${catalogueId}::${entry.id}`;
      if (consideredSelectors.has(selectorKey)) return;
      consideredSelectors.add(selectorKey);

      const ctx = {
        system, roster, counts, selectionCounts, forceCategoryCounts: rosterCategoryCounts,
        catalogueId, parentCatalogueId: catalogueId
      };
      if (isSelectionEntryHidden(entry, ctx)) return;

      const { value: minValue, causes } = evaluateConstraintWithCauses(minConstraint, getEffectiveModifiers(entry), ctx);
      if (minValue <= 0) return;

      // Roster-weite Belegung über den zentralen Zähl-Kern (ADR 0029): ein `roster`-Anker
      // über die roster-weiten Zähl-Eimer. Fehlt der Eintrag im ganzen Roster, ist die
      // Belegung 0 und die armeeweite `min`-Pflicht schlägt an.
      const mandatorySubject = nullInstanceSubject(force, entry);
      const armyWideCount = measureOver(
        resolveScopeAnchor({ scope: ConstraintScope.ROSTER }, mandatorySubject, queryCtx),
        { target: MeasureTarget.INSTANCES, subject: mandatorySubject, ctx: queryCtx }
      );
      if (armyWideCount === 0) {
        pushViolation(errors, {
          type: 'roster-selector-min',
          messageKey: ValidationMessageKey.ROSTER_SELECTOR_MIN,
          messageParams: { entryName: entry.name, count: minValue },
          severity: ValidationSeverity.ERROR,
          ...withCauses(causes)
        });
      }
    });
  });
}

/**
 * Merges the per-force category counts (`{ [forceId]: { [categoryId]: n } }`) into one
 * roster-wide tally (`{ [categoryId]: n }`), summing a category that appears in more than
 * one contingent. Used by the roster-scoped mandatory-selector check so its evaluation is
 * independent of contingent iteration order.
 * @param {Record<string, Record<string, number>>} categoryCounts
 * @returns {Record<string, number>}
 */
function aggregateRosterCategoryCounts(categoryCounts) {
  /** @type {Record<string, number>} */
  const rosterWide = {};
  for (const perForce of Object.values(categoryCounts || {})) {
    for (const [categoryId, count] of Object.entries(perForce)) {
      rosterWide[categoryId] = (rosterWide[categoryId] || 0) + count;
    }
  }
  return rosterWide;
}

/**
 * Prüft die forceEntry-eigene Punktelimit-Constraint eines gewählten Kontingents.
 *
 * Bewusst eng auf das real belegte Muster gefasst (Vampire-Counts-Sonderheere „Army
 * of the Lichemaster" und „Vampire Coast"): Die forceEntry trägt eine eigene
 * `min`-Constraint `field="limit::<costTypeId>" scope="roster"` (Basis 0) plus einen
 * Modifier, der diese beim Wählen des Sonderheeres — gegatet auf die eigene
 * forceEntry-Id — auf 2000 anhebt. Netto: „Wer dieses Sonderheer wählt, muss die
 * Liste auf ≥2000 Punkte bauen." Da die Constraint nur für ein tatsächlich im Roster
 * liegendes Kontingent geprüft wird, ist die Gate-Bedingung (dieses Kontingent ist
 * gewählt) definitionsgemäß erfüllt; deshalb greift `getModifiedConstraintValue` auf
 * die eigengegateten Modifier ohne weitere Kontextauswertung.
 *
 * Keine generische Auswertung forceEntry-eigener Modifier auf beliebige Constraints —
 * dafür existiert kein realer Anwendungsfall.
 * @param {ValidationContext} context
 */
function checkForceOwnRosterPointsLimit({ roster, forceDef, errors }) {
  const limitConstraints = (forceDef.constraints || []).filter(isRosterPointsLimitConstraint);
  if (limitConstraints.length === 0) return;

  const selfGatedModifiers = collectSelfGatedModifiers(forceDef);

  limitConstraints.forEach(con => {
    const applicableModifiers = selfGatedModifiers.filter(mod => mod.field === con.id);
    if (applicableModifiers.length === 0) return;

    const requiredLimit = getModifiedConstraintValue(con, applicableModifiers, {});
    if (requiredLimit <= 0) return; // Basis 0 ohne greifenden Modifier: keine Untergrenze.

    const costTypeId = costTypeIdOfRosterLimitField(con.field);
    const currentLimit = roster.costLimitType === costTypeId ? (roster.costLimit || 0) : 0;

    if (con.type === ConstraintKind.MIN && currentLimit < requiredLimit) {
      pushViolation(errors, {
        type: 'force-roster-limit',
        forceId: forceDef.id,
        messageKey: ValidationMessageKey.FORCE_ROSTER_LIMIT,
        messageParams: { forceName: forceDef.name, limit: requiredLimit },
        severity: ValidationSeverity.ERROR
      });
    }
  });
}

/** Eine forceEntry-eigene Constraint, die das Roster-Punktelimit begrenzt. */
function isRosterPointsLimitConstraint(con) {
  return con.scope === ConstraintScope.ROSTER && isRosterLimitField(con.field);
}

/**
 * Effektive Modifier der forceEntry, die genau auf die eigene forceEntry-Id gegatet
 * sind (`instanceOf`-Bedingung mit `childId`/`scope` == forceDef.id). Nur diese
 * eigengegateten Modifier gelten für das belegte „eigenes Punktelimit anheben"-Muster;
 * ihre Bedingung ist erfüllt, sobald das Kontingent im Roster liegt, weshalb sie hier
 * bedingungsfrei angewendet werden dürfen.
 */
function collectSelfGatedModifiers(forceDef) {
  return getEffectiveModifiers(forceDef)
    .filter(mod => modifierIsGatedOnOwnForce(mod, forceDef.id))
    .map(mod => ({ ...mod, conditions: [], conditionGroups: [] }));
}

/** Wahr, wenn eine `instanceOf`-Bedingung des Modifiers die eigene forceEntry-Id nennt. */
function modifierIsGatedOnOwnForce(mod, forceEntryId) {
  return (mod.conditions || []).some(con => conditionReferencesForce(con, forceEntryId)) ||
    (mod.conditionGroups || []).some(group => conditionGroupReferencesForce(group, forceEntryId));
}

function conditionReferencesForce(con, forceEntryId) {
  return con?.type === ConditionKind.INSTANCE_OF && (con.childId === forceEntryId || con.scope === forceEntryId);
}

function conditionGroupReferencesForce(group, forceEntryId) {
  return (group?.conditions || []).some(con => conditionReferencesForce(con, forceEntryId)) ||
    (group?.conditionGroups || []).some(nested => conditionGroupReferencesForce(nested, forceEntryId));
}

/** Constraints am categoryLink, ergänzt um den per System-Quirk geerbten max-Constraint. */
function collectCategoryLinkConstraints({ catLink, forceDef, system, targetCatId }) {
  const constraints = [...(catLink.constraints || [])];

  // System-Quirk: Kategorie erbt einen fehlenden max-Constraint von einer anderen Kategorie.
  // Dieselbe Quelle (`categoryLimits`) beliefert die Kategorie-Anzeige, sodass Validierung
  // und Oberfläche denselben geerbten max verwenden (ADR 0003 §2, ADR 0029).
  const inherited = getInheritedCategoryMaxConstraint({
    system, forceDef, targetCatId, ownConstraints: constraints
  });
  if (inherited) {
    constraints.push({ ...inherited.constraint, isFallback: true, modifiers: inherited.modifiers });
  }
  return constraints;
}

/**
 * Force-weite Constraints, die direkt an der categoryEntry-Definition hängen.
 * Diese modellieren native Kategoriegrenzen des neuen Datensatzes und wurden von
 * der reinen categoryLink-Auswertung bisher übersehen.
 */
function collectCategoryEntryForceConstraints(catDef) {
  return (catDef?.constraints || []).filter(con => con.scope === ConstraintScope.FORCE);
}

/** Einen einzelnen Kategorie-Constraint gegen den aktuellen Kategorie-Count prüfen. */
function evaluateForceCategoryConstraint({ con, modifiers, count, catName, forceDef, force, targetCatId, ctx, errors }) {
  const { value: finalValue, causes } = evaluateConstraintWithCauses(con, modifiers, ctx);
  if (finalValue < 0) return; // z. B. max="-1": die Kategorie ist unbegrenzt.

  if (con.type === ConstraintKind.MIN && count < finalValue) {
    pushViolation(errors, {
      type: 'category-min',
      forceId: force.id,
      categoryId: targetCatId,
      messageKey: ValidationMessageKey.CATEGORY_MIN,
      messageParams: { count: finalValue, categoryName: catName, forceName: forceDef.name },
      severity: ValidationSeverity.ERROR,
      ...withCauses(causes)
    });
  }
  if (con.type === ConstraintKind.MAX && count > finalValue) {
    pushViolation(errors, {
      type: 'category-max',
      forceId: force.id,
      categoryId: targetCatId,
      messageKey: ValidationMessageKey.CATEGORY_MAX,
      messageParams: { count: finalValue, categoryName: catName, forceName: forceDef.name },
      severity: ValidationSeverity.ERROR,
      ...withCauses(causes)
    });
  }
}

/**
 * Eine Selection samt Kindern rekursiv gegen ihre Entry- und Gruppen-Constraints prüfen.
 * @param {{selection: Object, parentSelection: Object|null}} subject
 * @param {ValidationContext} context
 */
function checkSelectionTree({ selection, parentSelection }, context) {
  const { system, errors, forceCatalogueId } = context;

  const entryId = selection.entryLinkId || selection.selectionEntryId;
  const rawEntry = findEntryInSystem(system, entryId, forceCatalogueId);
  const entry = resolveEntry(system, rawEntry, forceCatalogueId);

  if (!entry) {
    // ADR-0011-Resilienz: die Auswahl bleibt unter ihrem gespeicherten Namen sichtbar
    // (nicht entfernt/umgebogen) — nur als Validierungsfehler gemeldet.
    pushViolation(errors, {
      type: 'unresolved-entry',
      selectionId: selection.id,
      messageKey: ValidationMessageKey.UNRESOLVED_ENTRY,
      messageParams: { selectionName: selection.name },
      severity: ValidationSeverity.ERROR
    });
  } else {
    checkEntryConstraints({ selection, parentSelection, entry, entryId }, context);
    checkGroupConstraints({ selection, entry }, context);
    checkSelectionMessages({ selection, parentSelection, entry }, context);
  }

  selection.selections?.forEach(child =>
    checkSelectionTree({ selection: child, parentSelection: selection }, context)
  );
}

/**
 * Wertet die vom Katalogautor hinterlegten Klartext-Hinweise (`field="error"/"warning"/
 * "info"`-Modifier) des aufgelösten Eintrags aus. Trifft die Bedingung eines solchen
 * Modifiers zu, entsteht ein Validierungseintrag mit dem passenden Schweregrad: `error`
 * blockiert wie ein Regelverstoß, `warning`/`info` sind rein informativ. Die
 * Bedingungsauswertung teilt sich denselben ctx wie die Constraint-Prüfung (SSOT).
 */
function checkSelectionMessages({ selection, parentSelection, entry }, context) {
  const { roster, system, force, counts, errors, forceCatalogueId } = context;
  const { selectionCounts, categoryCounts } = counts;
  const ctx = {
    roster,
    selectionCounts,
    forceCategoryCounts: Object.values(categoryCounts).reduce((acc, c) => ({ ...acc, ...c }), {}),
    selection,
    parentSelection,
    force,
    system,
    parentCatalogueId: forceCatalogueId
  };

  collectTriggeredMessages(entry, ctx).forEach(({ severity, message }) => {
    pushViolation(errors, {
      type: `modifier-${severity}`,
      selectionId: selection.id,
      message,
      severity
    });
  });
}

/**
 * Individuelle Constraints des aufgelösten Eintrags prüfen (min/max/percent je Scope).
 * Der Bezugsrahmen jeder Constraint wird über den zentralen Zähl-Kern
 * ({@link resolveScopeAnchor}/{@link measureOver}, ADR 0029) aufgelöst, statt hier
 * eigene Scope-Logik nachzubauen. Die Grenze (`finalValue`) samt ihrer Ursachen
 * (ADR 0027) stammt unverändert aus {@link evaluateConstraintWithCauses}.
 * @param {{selection: Object, parentSelection: Object|null, entry: Object, entryId: string}} subject
 * @param {ValidationContext} context
 */
function checkEntryConstraints({ selection, parentSelection, entry, entryId }, context) {
  if (!entry.constraints) return;

  const { roster, system, force, counts, errors, forceCatalogueId } = context;
  const { selectionCounts, categoryCounts } = counts;

  const queryCtx = createQueryContext({ roster, system, counts, forceCatalogueId });
  const subject = { selection, parentSelection, force, entry, entryId };

  entry.constraints.forEach(con => {
    const ctx = {
      roster,
      counts,
      selectionCounts,
      forceCategoryCounts: Object.values(categoryCounts).reduce((acc, c) => ({ ...acc, ...c }), {}),
      selection,
      parentSelection,
      force,
      system,
      parentCatalogueId: forceCatalogueId
    };
    const { value: finalValue, causes } = evaluateConstraintWithCauses(con, getEffectiveModifiers(entry), ctx);
    if (finalValue < 0) return;

    // Check scope applicability for specific category/entry scoped constraints
    if (isEntryScope(con.scope)) {
      const belongsToScope = (selection.selectionEntryId === con.scope || selection.entryLinkId === con.scope) ||
                            (entry.categoryLinks?.some(cl => cl.targetId === con.scope)) ||
                            (parentSelection && (parentSelection.selectionEntryId === con.scope || parentSelection.entryLinkId === con.scope));
      if (!belongsToScope) return;
    }

    const anchor = resolveScopeAnchor(con, subject, queryCtx);
    const count = measureOver(anchor, {
      target: MeasureTarget.INSTANCES,
      includeChildSelections: con.includeChildSelections,
      subject,
      ctx: queryCtx
    });

    if (isPercentConstraint(con)) {
      checkEntryPercentConstraint({ con, finalValue, causes, count, anchor, subject }, { context, queryCtx });
      return;
    }

    if (con.type === ConstraintKind.MIN && count < finalValue) {
      pushViolation(errors, {
        type: 'entry-min',
        selectionId: selection.id,
        messageKey: ValidationMessageKey.ENTRY_MIN,
        messageParams: { selectionName: selection.name, count: finalValue },
        severity: ValidationSeverity.ERROR,
        ...withCauses(causes)
      });
    }
    if (con.type === ConstraintKind.MAX && count > finalValue) {
      pushViolation(errors, {
        type: 'entry-max',
        selectionId: selection.id,
        messageKey: ValidationMessageKey.ENTRY_MAX,
        messageParams: { selectionName: selection.name, count: finalValue },
        severity: ValidationSeverity.ERROR,
        ...withCauses(causes)
      });
    }
  });
}

/**
 * Prüft eine Prozent-Constraint (percentValue) eines Eintrags: die Bezugsgröße
 * (Nenner) ist die Summe des Feldes im Scope, der Grenzwert `value%` davon.
 * Punkte-Felder werden gegen die Kosten des Eintrags, `selections` gegen dessen
 * Anzahl geprüft.
 *
 * Der Nenner läuft durch **denselben** Anker wie der Zähler ({@link measureOver}
 * mit `REFERENCE`, ADR 0029), sodass Zähler und Nenner im Bezugsrahmen nicht
 * auseinanderdriften können.
 */
function checkEntryPercentConstraint({ con, finalValue, causes, count, anchor, subject }, { context, queryCtx }) {
  const { roster, system, errors, forceCatalogueId, counts } = context;
  const { selection, parentSelection } = subject;
  const measuresCost = isCostField(con.field, system, roster);
  const numerator = measuresCost
    ? getSelectionTotalCost(selection, con.field, TOP_LEVEL_PARENT_COUNT, {
        system, roster, currentCatalogueId: forceCatalogueId, parentSelection, counts
      })
    : count;
  const reference = measureOver(anchor, {
    target: MeasureTarget.REFERENCE,
    field: con.field,
    includeChildSelections: con.includeChildSelections,
    subject,
    ctx: queryCtx
  });
  const threshold = applyPercentage(finalValue, reference);
  // Gemessen wird die Kostenart der Constraint selbst (`con.field`) — ihre
  // Bezeichnung stammt daher aus genau dieser Kostenart (Pass-through). Ohne
  // Kostenbezug ist die Bezugsgröße die Auswahlanzahl (an der Oberfläche übersetzt).
  const unitLabel = measuresCost ? resolveCostTypeLabel(system, con.field) : undefined;

  if (con.type === ConstraintKind.MIN && numerator < threshold) {
    pushViolation(errors, {
      type: 'entry-percent-min',
      selectionId: selection.id,
      messageKey: ValidationMessageKey.ENTRY_PERCENT_MIN,
      messageParams: { selectionName: selection.name, percent: finalValue, unitLabel },
      severity: ValidationSeverity.ERROR,
      ...withCauses(causes)
    });
  }
  if ((con.type === ConstraintKind.MAX || con.type === 'percent') && numerator > threshold) {
    pushViolation(errors, {
      type: 'entry-percent-max',
      selectionId: selection.id,
      messageKey: ValidationMessageKey.ENTRY_PERCENT_MAX,
      messageParams: { selectionName: selection.name, percent: finalValue, unitLabel },
      severity: ValidationSeverity.ERROR,
      ...withCauses(causes)
    });
  }
}

/** Constraints aller SelectionEntryGroups des Eintrags prüfen (Anzahl- und Punkte-Limits). */
function checkGroupConstraints({ selection, entry }, context) {
  const { roster, system, force, counts, errors, forceCatalogueId } = context;
  const { selectionCounts, categoryCounts } = counts;
  const forceCategoryCounts = force ? (categoryCounts[force.id] || {}) : {};

  const queryCtx = createQueryContext({ roster, system, counts, forceCatalogueId });
  // Der Bezugsrahmen einer Gruppengrenze hängt an der Auswahl, die die Gruppe besitzt
  // (`selection`): ihre Kinder bilden den Gruppentopf, und dieselbe Auswahl ist der
  // `parent` einer scope-bezogenen Prozent-Referenz. Deshalb `parentSelection: selection`.
  const groupEntryId = selection.entryLinkId || selection.selectionEntryId;
  const groupSubject = { selection, parentSelection: selection, force, entry, entryId: groupEntryId };

  const groups = [];
  const collectGroups = (def) => {
    if (!def) return;
    def.selectionEntryGroups?.forEach(g => {
      groups.push(g);
      collectGroups(g);
    });
    def.entryLinks?.forEach(el => {
      if (el.type === 'selectionEntryGroup') {
        const resolvedGroup = resolveEntry(system, el, forceCatalogueId);
        if (resolvedGroup) {
          groups.push(resolvedGroup);
          collectGroups(resolvedGroup);
        }
      }
    });
    def.selectionEntries?.forEach(se => {
      const resolvedSE = resolveEntry(system, se, forceCatalogueId);
      if (resolvedSE && resolvedSE.type !== 'model') {
        collectGroups(resolvedSE);
      }
    });
  };

  collectGroups(entry);

  groups.forEach(group => {
    const groupItemIds = new Set();
    const visitedDefs = new Set();
    const collectGroupItemIds = (gDef) => {
      if (!gDef || visitedDefs.has(gDef.id)) return;
      if (gDef.id) visitedDefs.add(gDef.id);

      gDef.selectionEntries?.forEach(item => {
        groupItemIds.add(item.id);
        const res = resolveEntry(system, item, forceCatalogueId);
        if (res) groupItemIds.add(res.id);
      });
      gDef.entryLinks?.forEach(link => {
        groupItemIds.add(link.id);
        groupItemIds.add(link.targetId);
        const res = resolveEntry(system, link, forceCatalogueId);
        if (res) {
          groupItemIds.add(res.id);
          collectGroupItemIds(res);
        }
      });
      gDef.selectionEntryGroups?.forEach(subG => {
        collectGroupItemIds(subG);
      });
    };

    collectGroupItemIds(group);

    // Selections belonging to the group. `includeChildSelections` widens the match
    // to nested selections; without it only the group owner's direct children count.
    const collectGroupMatches = (list, includeChildSelections) => {
      if (!list) return [];
      return list.flatMap(s => {
        const sId = s.entryLinkId || s.selectionEntryId;
        const self = groupItemIds.has(sId) ? [s] : [];
        const nested = includeChildSelections ? collectGroupMatches(s.selections, includeChildSelections) : [];
        return [...self, ...nested];
      });
    };

    group.constraints?.forEach(con => {
      // No parentSelection here: a group's own "parent" scope is the selection that owns
      // the group (`selection`, whose `.selections` this function itself scans below for
      // matches), not `selection`'s outer parent. Passing the outer parent would make a
      // self-incrementing modifier (e.g. "raise the cap for every Dispel Scroll already
      // taken") scan one level too high whenever the group sits behind an intermediate
      // wrapper selection, silently contributing 0 and leaving the base cap in place.
      const ctx = { roster, counts, selectionCounts, forceCategoryCounts, selection, force, system, parentCatalogueId: forceCatalogueId };
      const { value: finalValue, causes } = evaluateConstraintWithCauses(con, getEffectiveModifiers(group), ctx);
      if (finalValue < 0) return;

      // Check scope applicability for specific category/entry scoped constraints
      if (isEntryScope(con.scope)) {
        const belongsToScope = (selection.selectionEntryId === con.scope || selection.entryLinkId === con.scope) ||
                              (entry.categoryLinks?.some(cl => cl.targetId === con.scope));
        if (!belongsToScope) return;
      }

      // Die Gruppen-Belegung läuft über den zentralen Zähl-Kern (ADR 0029): ein Gruppen-Anker
      // über die aufgelöste, flache Trefferliste zählt (Anzahl) bzw. summiert (Kosten) sie an
      // **einer** Stelle — dieselbe, die jeder andere Bezugsrahmen nutzt.
      const matchingSelections = collectGroupMatches(selection.selections, con.includeChildSelections);
      const groupAnchor = resolveGroupAnchor(matchingSelections);
      const totalCount = measureOver(groupAnchor, { target: MeasureTarget.INSTANCES, subject: groupSubject, ctx: queryCtx });

      const measuresCost = isCostField(con.field, system, roster);
      // Summiert wird die Kostenart, die die Constraint selbst nennt (`con.field`),
      // nicht die des Rosters: eine Gruppengrenze darf eine andere Kostenart messen
      // („höchstens 5 Zauberwürfel") als die, nach der die Liste gebaut wird. Über
      // `roster.costLimitType` zu summieren vergliche Punkte gegen eine Würfelgrenze
      // (ADR-0003 §3a).
      const totalCost = measuresCost
        ? measureOver(groupAnchor, { target: MeasureTarget.REFERENCE, field: con.field, subject: groupSubject, ctx: queryCtx })
        : 0;

      if (isPercentConstraint(con)) {
        checkGroupPercentConstraint(
          { con, finalValue, causes, totalCount, totalCost, measuresCost, group, selection },
          { context, queryCtx, subject: groupSubject }
        );
        return;
      }

      if (measuresCost) {
        // `totalCost` ist über `con.field` summiert — die Meldung benennt daher
        // genau diese Kostenart, nicht eine festgeschriebene Einheit.
        const costLabel = resolveCostTypeLabel(system, con.field);
        if (con.type === ConstraintKind.MAX && totalCost > finalValue) {
          pushViolation(errors, {
            type: 'group-points-max',
            selectionId: selection.id,
            messageKey: ValidationMessageKey.GROUP_POINTS_MAX,
            messageParams: { groupName: group.name, limit: finalValue, selectionName: selection.name, unitLabel: costLabel },
            severity: ValidationSeverity.ERROR,
            ...withCauses(causes)
          });
        }
        if (con.type === ConstraintKind.MIN && totalCost < finalValue && totalCost > 0) {
          pushViolation(errors, {
            type: 'group-points-min',
            selectionId: selection.id,
            messageKey: ValidationMessageKey.GROUP_POINTS_MIN,
            messageParams: { groupName: group.name, limit: finalValue, selectionName: selection.name, unitLabel: costLabel },
            severity: ValidationSeverity.ERROR,
            ...withCauses(causes)
          });
        }
      } else {
        if (con.type === ConstraintKind.MAX && totalCount > finalValue) {
          pushViolation(errors, {
            type: 'group-count-max',
            selectionId: selection.id,
            messageKey: ValidationMessageKey.GROUP_COUNT_MAX,
            messageParams: { groupName: group.name, count: finalValue, selectionName: selection.name },
            severity: ValidationSeverity.ERROR,
            ...withCauses(causes)
          });
        }
        if (con.type === ConstraintKind.MIN && totalCount < finalValue && totalCount > 0) {
          pushViolation(errors, {
            type: 'group-count-min',
            selectionId: selection.id,
            messageKey: ValidationMessageKey.GROUP_COUNT_MIN,
            messageParams: { groupName: group.name, count: finalValue, selectionName: selection.name },
            severity: ValidationSeverity.ERROR,
            ...withCauses(causes)
          });
        }
      }
    });
  });
}

/**
 * Prüft eine Prozent-Constraint (percentValue) einer SelectionEntryGroup: die
 * Gruppensumme (Kosten oder Anzahl) gegen `value%` der Bezugsgröße im Scope.
 *
 * Der Nenner läuft durch **denselben** Zähl-Kern wie jede andere Referenz
 * ({@link measureOver} mit `REFERENCE` über den Scope-Anker der Constraint, ADR 0029),
 * statt über einen eigenen Referenz-Resolver. Der Scope-Anker wird bewusst
 * `shared`-agnostisch gebildet — die Bezugsgröße einer Gruppe ist ihr Scope-Rahmen,
 * nicht eine einzelne tragende Instanz.
 */
function checkGroupPercentConstraint({ con, finalValue, causes, totalCount, totalCost, measuresCost, group, selection }, { context, queryCtx, subject }) {
  const { system, errors } = context;
  const numerator = measuresCost ? totalCost : totalCount;
  const scopeAnchor = resolveScopeAnchor({ scope: con.scope, includeChildForces: con.includeChildForces }, subject, queryCtx);
  const reference = measureOver(scopeAnchor, {
    target: MeasureTarget.REFERENCE,
    field: con.field,
    includeChildSelections: con.includeChildSelections,
    subject,
    ctx: queryCtx
  });
  const threshold = applyPercentage(finalValue, reference);
  // `totalCost` wird über `con.field` summiert (siehe checkGroupConstraints) — die
  // Bezeichnung muss dieselbe Kostenart benennen. Zähler und Nenner teilen dieselbe
  // Kostenart, passen also zusammen. Ohne Kostenbezug ist die Bezugsgröße die
  // Auswahlanzahl (an der Oberfläche übersetzt).
  const unitLabel = measuresCost ? resolveCostTypeLabel(system, con.field) : undefined;

  if (con.type === ConstraintKind.MIN && numerator < threshold) {
    pushViolation(errors, {
      type: 'group-percent-min',
      selectionId: selection.id,
      messageKey: ValidationMessageKey.GROUP_PERCENT_MIN,
      messageParams: { groupName: group.name, percent: finalValue, unitLabel },
      severity: ValidationSeverity.ERROR,
      ...withCauses(causes)
    });
  }
  if ((con.type === ConstraintKind.MAX || con.type === 'percent') && numerator > threshold) {
    pushViolation(errors, {
      type: 'group-percent-max',
      selectionId: selection.id,
      messageKey: ValidationMessageKey.GROUP_PERCENT_MAX,
      messageParams: { groupName: group.name, percent: finalValue, unitLabel },
      severity: ValidationSeverity.ERROR,
      ...withCauses(causes)
    });
  }
}

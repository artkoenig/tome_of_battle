// Meldungsprojektion der Evaluator-Verletzungen (Issue 0121 Task 4): übersetzt
// die sprachfreie Einordnung des Auswertungsberichts (ADR 0034) in i18n-Texte
// (ADR 0026). Die Engine ordnet ein, hier wird formuliert. Dies ist die
// **einzige** Meldungsprojektion der App; das frühere `formatValidationError.js`
// des Solvers ist mit ihm gelöscht.
//
// Schlüssel-Schema: `validation.evaluator.<measure>.<kind>.<scopeGroup>[.percent]`.
// Das Einordnungs-Vokabular (ConstraintKind/LimitMeasure/ScopeKind) steht hier
// als Literale, nicht als Import aus `src/domain/evaluator/model.js`: der Evaluator ist
// von außen nur über seine Fassade erreichbar (ADR 0030, maschinell erzwungen
// durch oxlint `no-restricted-imports` und dependency-cruiser
// `evaluator-nur-ueber-fassade`), und die Fassade reicht bewusst nur den Bericht
// heraus. Drift zwischen diesen Literalen und den echten Enums fängt
// `violationMessageCoverage.test.js`, der das Kreuzprodukt aus den Enums selbst
// bildet.

const KEY_PREFIX = 'validation.evaluator';

// Rückfall für unbekannte künftige kind/measure-Werte — lieber ein generischer
// Satz als ein Throw oder ein roher Schlüssel in der Oberfläche.
const GENERIC_KEY = `${KEY_PREFIX}.generic`;

// Vorlage eines einzelnen Ursachen-Listenpunkts (ADR 0027), analog zu
// `validation.causeItem` des Solvers: der Katalogname bleibt Pass-through
// (ADR 0003) und wird nur je Sprache in Anführungszeichen gesetzt.
const CAUSE_ITEM_KEY = `${KEY_PREFIX}.causeItem`;

/**
 * Überschrift der Ursachenliste (ADR 0027). Sie gehört zur Anzeige, nicht zur
 * Einordnung, und wird deshalb von der Komponente selbst übersetzt — dieses
 * Modul veröffentlicht nur den Schlüssel. Seit Issue 0121 liegt er, wie die
 * übrigen Schlüssel dieser Projektion, unter `validation.evaluator.*`.
 */
export const CAUSES_TITLE_KEY = `${KEY_PREFIX}.causesTitle`;

// `MessageOrigin.AUTHOR_MESSAGE`: der Katalogtext ist bereits ein fertiger Satz
// des Autors und wird unverändert durchgereicht (ADR 0028), nie übersetzt.
const AUTHOR_MESSAGE_ORIGIN = 'authorMessage';

// `MessageOrigin.HIDDEN_SELECTION`: eine Auswahl, die in der Liste liegt, dem
// Nutzer aber gar nicht angeboten werden dürfte (Issue 0119). Sie trägt keine
// Grenze und keinen Katalogtext — nur ihren Anker; der Satz kommt deshalb aus
// einem eigenen Schlüssel mit dem Namen des Ankers als einzigem Parameter.
const HIDDEN_SELECTION_ORIGIN = 'hiddenSelection';
const HIDDEN_SELECTION_KEY = `${KEY_PREFIX}.hiddenSelection`;

/** Die bekannten Grenzen-Arten (`ConstraintKind`). */
const KNOWN_KINDS = new Set(['min', 'max']);

/** Die bekannten Messgrößen (`LimitMeasure`). */
const KNOWN_MEASURES = new Set(['selectionCount', 'forceCount', 'costSum', 'budgetLimit', 'rosterBudget']);

/** Messgrößen, deren Grenze eine Kostenart trägt (`limit.costTypeId`). */
const COST_MEASURES = new Set(['costSum', 'budgetLimit', 'rosterBudget']);

/**
 * Gruppiert die Art des Bezugsrahmens (`ScopeKind`) auf die drei
 * Schlüssel-Gruppen: `roster` und `force` tragen eigene Sätze, alles Übrige —
 * parent, self, unit, ancestor, primary-catalogue, entryId, categoryId und jede
 * künftige Scope-Art — fällt in `local`: den lokalen Kontext trägt der
 * Anker-Name, nicht der Schlüssel.
 *
 * @param {string | undefined} scopeKind
 * @returns {'roster' | 'force' | 'local'}
 */
function scopeGroupOf(scopeKind) {
  if (scopeKind === 'roster') return 'roster';
  if (scopeKind === 'force') return 'force';
  return 'local';
}

/**
 * Der effektive Prozentsatz einer Prozentgrenze aus ihrer Herleitungskette:
 * das Ergebnis des letzten Kettenschritts, ohne Schritte der Basiswert. `bound`
 * bleibt daneben der abgeleitete Absolutwert — so liefert es die Fassade
 * (`violationClassification.js`: „bei einer Prozentgrenze ist `bound` der
 * abgeleitete absolute Wert, während die Herleitungskette den Prozentsatz
 * beschreibt").
 *
 * @param {{ base: number, steps: Array<{ result: number }> } | null | undefined} derivation
 * @returns {number | undefined}
 */
function effectivePercent(derivation) {
  const steps = derivation?.steps;
  if (steps && steps.length > 0) return steps[steps.length - 1].result;
  return derivation?.base;
}

/**
 * Übersetzt eine eingeordnete Verletzung des Evaluator-Berichts in den
 * Anzeigetext der aktiven UI-Sprache:
 *
 * - Abgeleitete Grenzen (`origin: 'derivedLimit'`) wählen den Schlüssel
 *   `validation.evaluator.<measure>.<kind>.<scopeGroup>[.percent]` mit den
 *   Parametern `name`/`actual`/`bound` (+ `costTypeId` bei kostenbezogenen
 *   Messgrößen, + `percent` bei Prozentgrenzen, + `count` = `bound` für die
 *   Numerus-Wahl der Vorlage).
 * - Unbekannte künftige kind/measure-Werte fallen auf den generischen
 *   Schlüssel zurück — nie ein Throw.
 * - Autoren-Meldungen (`origin: 'authorMessage'`) geben den Katalogtext
 *   unverändert zurück, ohne `translate` aufzurufen.
 * - Versteckte Auswahlen (`origin: 'hiddenSelection'`) wählen den Schlüssel
 *   `validation.evaluator.hiddenSelection` mit dem Anker-Namen als Parameter —
 *   sie tragen keine Grenze, aus der ein Grenzen-Schlüssel folgen könnte.
 * - Ein fehlender Verstoß (null/undefined) ergibt einen leeren String.
 *
 * @param {object | null | undefined} violation  eine Verletzung aus dem Bericht
 *   der Evaluator-Fassade (`src/domain/evaluator/evaluator.js`, `violations`).
 * @param {(key: string, params?: Record<string, unknown>) => string} translate
 * @returns {string}
 */
export function formatViolation(violation, translate) {
  if (!violation) return '';
  if (violation.origin === AUTHOR_MESSAGE_ORIGIN) return violation.text ?? '';
  if (violation.origin === HIDDEN_SELECTION_ORIGIN) {
    return translate(HIDDEN_SELECTION_KEY, { name: violation.anchor?.name });
  }

  const limit = violation.limit ?? {};
  const params = {
    name: violation.anchor?.name,
    actual: violation.actual,
    bound: violation.bound,
  };

  if (!KNOWN_KINDS.has(limit.kind) || !KNOWN_MEASURES.has(limit.measure)) {
    return translate(GENERIC_KEY, params);
  }

  if (COST_MEASURES.has(limit.measure)) params.costTypeId = limit.costTypeId;

  // `count` steuert allein die Numerus-Wahl pluralisierter Vorlagen (ADR 0026);
  // einfache Vorlagen ignorieren den Parameter.
  params.count = violation.bound;

  let key = `${KEY_PREFIX}.${limit.measure}.${limit.kind}.${scopeGroupOf(limit.scope?.kind)}`;
  if (limit.isPercent === true) {
    key += '.percent';
    params.percent = effectivePercent(violation.derivation);
  }
  return translate(key, params);
}

/**
 * Rendert die sprachfreien Ursachen einer Verletzung (ADR 0027) zu fertigen
 * Listenpunkten der aktiven UI-Sprache — je Ursache ein Aufruf der
 * `causeItem`-Vorlage mit dem Zeugen-Namen (Pass-through, ADR 0003), in
 * Reihenfolge. Ohne (oder mit leerem) `causes`-Feld — und damit auch für
 * Autoren-Meldungen, die nie Ursachen tragen — ist das Ergebnis leer.
 *
 * @param {object | null | undefined} violation  eine Verletzung aus dem Bericht
 *   der Evaluator-Fassade.
 * @param {(key: string, params?: Record<string, unknown>) => string} translate
 * @returns {string[]} ein Anzeigetext je Ursache, in Reihenfolge
 */
export function formatViolationCauses(violation, translate) {
  const causes = violation?.causes;
  if (!causes || causes.length === 0) return [];
  return causes.map((cause) => translate(CAUSE_ITEM_KEY, { name: cause.witness?.name }));
}

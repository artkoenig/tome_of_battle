/**
 * Constraint-Schicht (`docs/evaluator-architecture.md` §3.6/§4.7).
 *
 * Jede Grenze liefert nie nur "verletzt ja/nein", sondern das volle Tripel
 * Ist-Wert / effektiver Grenzwert / Delta plus Bezugsinstanz. Diese Schicht
 * wertet MIN- und MAX-Grenzen ueber Selektionsanzahl *und* Kostensummen aus und
 * leitet Prozentgrenzen aus dem Nenner ihres Bezugsrahmens ab (eine zentrale
 * Rundungskonvention). Sie ruft ausschliesslich das Query-Primitiv und reicht die
 * Grenzen-Flags (`shared`, `includeChildSelections`, `includeChildForces`) an
 * dieses durch. Der Grenzwert kommt aus der Effektiv-Werte-Schicht (Slice 04):
 * ein Modifikator kann den Roh-Grenzwert veraendert haben — bei Prozentgrenzen
 * fliesst der effektive Prozentsatz durch dieselbe `resolveBound`-Stelle.
 *
 * Jedes Ergebnis sagt zusaetzlich, ob es **berichtsfaehig** ist (`isReportable`):
 * ein Ergebnis am **Angebots-Anker** speist nur den Faehigkeitsdatensatz seines
 * Slots und wird nie als Verletzung gemeldet (ADR-0035). Die Grenzen werden dort
 * trotzdem voll ausgewertet — genau daraus liest der Datensatz Hoechstmass,
 * Belegung und Restspielraum ab.
 */

import { ConstraintKind, SUSPENDED, UNRESOLVED_BUDGET, DiagnosticKind, diagnostic, isLinkDefinition, isReportableAnchorKind, limitMeasureOfCountedField } from './model.js';
import { allNodes, limitsOf } from './evalTree.js';
import { query, createQueryContext } from './query.js';
import { roundHalfUp } from './rounding.js';

const PERCENT_DIVISOR = 100;

/**
 * Bestimmt den effektiven Grenzwert einer Grenze. Der Roh-Grenzwert stammt aus
 * der Effektiv-Werte-Schicht (durch Modifikatoren ggf. veraendert); traegt der
 * Knoten dort keinen Wert, gilt der Basiswert der Grenze. Bei einer Prozentgrenze
 * wird der Grenzwert aus dem im Bezugsrahmen gezaehlten Nenner abgeleitet; ein
 * Nenner 0 fuehrt zu `SUSPENDED` samt Null-Nenner-Diagnose (A4), nie zu einer
 * Verletzung. Nenner und Zaehler teilen Scope und Flags, damit sie nicht
 * auseinanderdriften.
 */
function resolveBound(limit, node, effective, ctx) {
  const raw = effective.limitValue(node, limit.id) ?? limit.value;
  if (!limit.isPercent) return raw;
  const denominator = query(ctx, limit.field, limit.scope, null, limit.flags);
  // Unaufloesbares Budget-Feld als Nenner (Diagnose aus `query`): die Grenze wird
  // fail-closed suspendiert statt mit dem Sentinel weiterzurechnen.
  if (denominator === UNRESOLVED_BUDGET) return SUSPENDED;
  if (denominator === 0) {
    ctx.diagnostics.push(diagnostic(DiagnosticKind.ZERO_DENOMINATOR, { limitId: limit.id }));
    return SUSPENDED;
  }
  return roundHalfUp((denominator * raw) / PERCENT_DIVISOR);
}

/**
 * Das **Zaehl-Ziel** einer Grenze: die Definition, deren Bestand sie misst
 * (`design.md`, Kontrakt 5).
 *
 * Ist der Anker ein **Verweis** — ein `entryLink` wie ein `categoryLink` —, zaehlt
 * die Grenze unter der **aufgeloesten Ziel-Id**, nicht unter der Verweis-Id. Das
 * Format haelt das zweimal ausdruecklich fest (`docs/battlescribe-data-format.md`
 * §3.4/§7.6: „`scope="parent"` vergleicht aufgeloeste Ziel-Ids, nicht
 * `entryLinkId`s — verschiedene Links koennen auf dasselbe Ziel zeigen"). Preis der
 * Regel: eine `max`-Grenze aggregiert ueber alle Verweise auf dasselbe Ziel im
 * Rahmen — bewusst hingenommen, weil die Alternative dem Format widerspraeche.
 *
 * Ein Praedikat statt einer Sonderbehandlung fuer `categoryLink`: beide Verweisarten
 * folgen derselben Regel, und ein Vorkommen unter einem `entryLink` zaehlt seit
 * ADR-0037 genauso ueber sein Ziel wie ein Kategorie-Anker.
 */
function countingTargetIdOf(def) {
  if (!isLinkDefinition(def)) return def.id;
  return def.resolved?.id ?? def.targetId;
}

/**
 * Wertet eine einzelne Grenze am Knoten aus und liefert ihr Ergebnis-Tripel,
 * oder `null`, wenn die Grenze suspendiert ist. Ziel der Zaehlung ist das
 * {@link countingTargetIdOf Zaehl-Ziel} der Bezugsinstanz.
 */
function evaluateLimit(limit, node, effective, ctx) {
  const bound = resolveBound(limit, node, effective, ctx);
  if (bound === SUSPENDED) return null;
  
  // Battlescribe uses -1 to represent an "unlimited" bound (no limit). 
  // An unlimited bound never fires and does not restrict headroom.
  if (bound === -1) return null;

  const actual = query(ctx, limit.field, limit.scope, countingTargetIdOf(node.def), limit.flags);
  // Zaehlt die Grenze selbst ein unaufloesbares Budget-Feld (Diagnose aus `query`),
  // wird sie fail-closed suspendiert statt den Sentinel zu vergleichen.
  if (actual === UNRESOLVED_BUDGET) return null;
  const satisfied = limit.kind === ConstraintKind.MIN ? actual >= bound : actual <= bound;
  return {
    limit,
    anchor: node,
    actual,
    bound,
    satisfied,
    delta: bound - actual,
    // Ob dieses Ergebnis **berichtsfaehig** ist, also als Verletzung gemeldet
    // werden darf, oder nur den Faehigkeitsdatensatz seines Slots speist. Diese
    // Schicht stellt die Unterscheidung bereit und deutet sie nicht: sie liest die
    // Ankerart des Knotens ab (`model.js`, {@link isReportableAnchorKind}).
    isReportable: isReportableAnchorKind(node.anchorKind),
    // Die **Messgroesse** der Grenze — ein Rohdatum der Einordnung, abgelesen am
    // gezaehlten Feld (`model.js`, {@link limitMeasureOfCountedField}). Sie steht
    // hier und nicht erst in der Einordnung, weil die roster-weite Budget-Regel
    // (`budget.js`) ihre eigene Messgroesse mitbringt: so liest die Einordnung
    // beide Herkuenfte aus **einem** Feld, statt eine davon zu erraten.
    measure: limitMeasureOfCountedField(limit.field),
    // Die **Herleitung** des Grenzwerts, unveraendert durchgereicht: diese Schicht
    // deutet sie nicht, sie stellt sie nur bereit (die Ursachen nach ADR-0027 sind
    // eine Filterung dieser Kette). Bei einer Prozentgrenze beschreibt sie den
    // Prozentsatz — die Groesse, auf die ein Modifikator wirkt —, nicht den daraus
    // abgeleiteten Grenzwert.
    derivation: effective.limitDerivation(node, limit.id),
  };
}

/**
 * Wertet alle MIN- und MAX-Grenzen des Baums aus.
 *
 * @param {object} root  Wurzel des Evaluationsbaums.
 * @param {{ get: Function }} index
 * @param {import('./effectiveState.js').EffectiveState} effective effektive Grenzwerte je Knoten.
 * @param {Set<string>} categoryIds  bekannte Kategorie-IDs (Ziel-Typ-Regel).
 * @param {object[]} diagnostics  Sammelliste, in die Query- und Null-Nenner-Diagnosen fliessen.
 * @param {import('./rosterBudget.js').RosterBudget} [budget]  die eingestellten
 *   Roster-Kostengrenzen (`RosterBudget`), an den Query-Kontext durchgereicht.
 * @returns {object[]} Constraint-Ergebnisse (je ein Tripel; suspendierte Grenzen ausgenommen).
 */
export function evaluateConstraints(root, index, effective, categoryIds, diagnostics, budget) {
  const results = [];
  for (const node of allNodes(root)) {
    const ctx = createQueryContext({ node, root, index, categoryIds, diagnostics, budget });
    // Die vom Verweis geerbten Grenzen gehoeren dazu (`limitsOf` ist die eine
    // Quelle der Wahrheit) — sonst blieben die Grenzen des Ziels eines
    // `entryLink`/`categoryLink` still unausgewertet.
    for (const limit of limitsOf(node.def)) {
      const result = evaluateLimit(limit, node, effective, ctx);
      if (result !== null) results.push(result);
    }
  }
  return results;
}

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

import { ConstraintKind, SUSPENDED, UNLIMITED, UNRESOLVED_BUDGET, DiagnosticKind, diagnostic, isReportableAnchorKind, isLinkDefinition, limitMeasureOfCountedField } from './model.js';
import { allNodes, evaluableLimitsOf } from './evalTree.js';
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
  // Eine unbegrenzte Grenze (hingeschriebener Sentinel, beim Lesen bzw. im
  // `set`-Handler auf UNLIMITED gedeutet — Issue 079) braucht keinen Nenner:
  // auch als Prozentgrenze ist „unbegrenzt" unbegrenzt, unabhaengig vom
  // Bezugsrahmen. Deshalb vor der Nenner-Ableitung, sonst suspendierte ein
  // leerer Rahmen (Nenner 0) eine Grenze, die gar nichts begrenzt.
  if (raw === UNLIMITED) return UNLIMITED;
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
 * Wertet eine einzelne Grenze am Knoten aus und liefert ihr Ergebnis-Tripel,
 * oder `null`, wenn die Grenze suspendiert ist. Ziel der Zaehlung ist die
 * eigene Definition der Bezugsinstanz — bei einem Verweis dessen Ziel, siehe
 * die Begruendung an der Stelle selbst.
 */
function evaluateLimit(limit, node, effective, ctx) {
  const bound = resolveBound(limit, node, effective, ctx);
  if (bound === SUSPENDED) return null;

  // Eine unbegrenzte Grenze feuert nie und beschraenkt keinen Restspielraum —
  // sie liefert kein Ergebnis. Ob sie unbegrenzt ist, wurde am hingeschriebenen
  // Wert entschieden (Katalog-Leser bzw. `set`-Handler, Issue 079); ein per
  // increment/decrement/multiply **errechneter** negativer Grenzwert ist nie
  // unbegrenzt und wird hier ganz normal verglichen („nichts erlaubt").
  if (bound === UNLIMITED) return null;

  // Gezaehlt wird die **aufgeloeste Ziel-Id**, wenn der Anker ein Verweis ist —
  // fuer `entryLink` genauso wie fuer `categoryLink`. Verschiedene Verweise
  // koennen auf dasselbe Ziel zeigen; zaehlte eine Grenze die Id des Verweises,
  // fiele jede Auswahl, die ueber einen anderen Verweis desselben Ziels
  // hereinkam, aus ihrer Zaehlung heraus (`docs/battlescribe-data-format.md`
  // §"Aufloesung": `scope="parent"` vergleicht aufgeloeste Ziel-IDs, nicht
  // `entryLinkId`s). Der Verweis bleibt trotzdem der Anker: nur an ihm gelten
  // die an ihm selbst deklarierten Grenzen.
  const targetId = isLinkDefinition(node.def) ? node.def.targetId : node.def.id;
  const actual = query(ctx, limit.field, limit.scope, targetId, limit.flags);
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
    // Die **gezaehlte Ziel-Id** (bei einem Verweis das aufgeloeste Ziel, s. o.)
    // reist mit dem Ergebnis: zusammen mit der Grenz-Id ist sie die Identitaet
    // der Pflicht ueber alle Anker hinweg — der Entdopplungsschluessel der
    // Meldungsliste (`report.js`, §9.9 „ueber die Ziel-Id entdoppelt").
    countedTargetId: targetId,
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
    // `entryLink`/`categoryLink` still unausgewertet. Ausgewertet wird die
    // **Knoten**-Sicht (`evaluableLimitsOf`): ein rahmen-zugeschnittener Anker
    // (unverlinkte Kategorie mit Grenzen verschiedener Rahmen) wertet nur die
    // Grenzen seines Rahmens aus, sonst meldete jede Grenze je Anker einmal.
    for (const limit of evaluableLimitsOf(node)) {
      const result = evaluateLimit(limit, node, effective, ctx);
      if (result !== null) results.push(result);
    }
  }
  return results;
}

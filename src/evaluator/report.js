/**
 * Bericht (`docs/evaluator-architecture.md` §3.6/§4.8), Skeleton-Umfang.
 *
 * Der Bericht ist die einzige Quelle der Auswertungsergebnisse. Diese Scheibe
 * projiziert nur die Verletzungen und die Diagnosen; der Faehigkeitsdatensatz
 * je Auswahlpunkt (Capabilities fuer die UI-Steuerung) folgt spaeter.
 */

/** Projiziert ein Constraint-Ergebnis auf eine Verletzungsmeldung. */
function toViolation(result) {
  return {
    limitId: result.limit.id,
    anchor: {
      defId: result.anchor.def.id,
      name: result.anchor.def.name,
    },
    actual: result.actual,
    bound: result.bound,
    delta: result.delta,
  };
}

/**
 * Baut den Bericht aus den Constraint-Ergebnissen und Diagnosen.
 *
 * @param {object[]} results  Ergebnisse von `evaluateConstraints`.
 * @param {object[]} diagnostics
 * @returns {{ violations: object[], diagnostics: object[] }}
 */
export function buildReport(results, diagnostics) {
  return {
    violations: results.filter(result => !result.satisfied).map(toViolation),
    diagnostics,
  };
}

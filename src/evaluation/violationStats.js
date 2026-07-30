/**
 * Blockierungs-Helfer über den Verletzungen des Evaluator-Berichts
 * (Issue 0121, Task 5): die eine Stelle, an der die Oberfläche entscheidet,
 * welche Verletzungen eine Liste „blockieren" (das Spielen sperren).
 *
 * Blockierend ist allein `severity === 'error'` — unabhängig vom `origin`:
 * auch eine Autoren-Meldung des Katalogs mit severity `error` blockiert;
 * `warning`/`info` erscheinen nur informativ (ADR 0034: die Engine ordnet ein,
 * die Oberfläche liest die Einordnung ab, statt selbst zu klassifizieren).
 */

/**
 * True, wenn die Verletzung die Liste blockiert (`severity === 'error'`).
 *
 * @param {{ severity?: string } | null | undefined} violation
 *   eine Verletzung aus dem Bericht der Evaluator-Fassade
 *   (`src/evaluator/evaluator.js`, `violations`).
 * @returns {boolean}
 */
export function isBlockingViolation(violation) {
  return violation?.severity === 'error';
}

/**
 * Zählt die blockierenden Verletzungen einer Liste.
 *
 * @param {ReadonlyArray<object> | null | undefined} violations
 * @returns {number}
 */
export function countBlockingViolations(violations) {
  return (violations ?? []).filter(isBlockingViolation).length;
}

/**
 * True, wenn mindestens eine Verletzung blockiert.
 *
 * @param {ReadonlyArray<object> | null | undefined} violations
 * @returns {boolean}
 */
export function hasBlockingViolations(violations) {
  return (violations ?? []).some(isBlockingViolation);
}

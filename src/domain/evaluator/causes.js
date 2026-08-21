/**
 * **Ursachen einer Verletzung** (ADR-0027) — *warum steht die Grenze auf diesem
 * Wert?*
 *
 * Dieses Modul ist ein **reiner Leser** der Herleitungskette aus der
 * Effektiv-Werte-Schicht (`effectiveState.js`, `limitDerivation`). Es filtert die
 * Kettenschritte, die den Wert tatsaechlich veraendert haben und dabei bedingt
 * waren, und gibt deren **Zeugen** als Ursachen aus. Es wertet **keine Bedingung
 * erneut aus** und rekonstruiert nichts aus dem Endzustand: der Zeuge wurde in dem
 * Moment festgehalten, in dem die Bedingung ausgewertet wurde (`modifiers.js`) —
 * nachtraeglich liesse er sich nur durch eine zweite Rechenstelle gewinnen, genau
 * das, was ADR-0034 ausschliesst.
 *
 * Drei Bedingungen muessen zusammenkommen, damit ein Schritt eine Ursache ist
 * (ADR-0027, „Ehrlichkeit vor Vollstaendigkeit"):
 *
 * 1. **bedingt** — ein unbedingter Modifikator und der blosse Basiswert sind keine
 *    Ursache; sie gelten immer und erklaeren nichts;
 * 2. **wirksam** — der Schritt hat den Wert veraendert. Ein bedingter Modifikator,
 *    der den Wert auf seinen bisherigen Stand setzt, hat die Grenze nicht dorthin
 *    gebracht;
 * 3. **benennbar** — der Schritt traegt einen Zeugen. Loest seine Bedingung auf
 *    keine benennbare Auswahl auf (eine Kostenschwelle, ein Kategorie-Ziel), bleibt
 *    der Schritt in der Kette sichtbar, erzeugt aber keine erfundene Ursache.
 *
 * Bleibt danach keine Ursache uebrig, **entfaellt das Feld ganz** — es steht nicht
 * als leere Liste im Bericht ({@link causesFieldOf}).
 */

/**
 * Der Wert **vor** einem Schritt: der Basiswert beim ersten Schritt, sonst der
 * Zwischenwert des vorangehenden. Die Kette gibt die Dokumentreihenfolge wieder,
 * deshalb ist der Vorgaenger genau der Stand, gegen den dieser Schritt gewirkt hat.
 */
function valueBeforeStep(derivation, stepIndex) {
  return stepIndex === 0 ? derivation.base : derivation.steps[stepIndex - 1].result;
}

/** True, wenn der Schritt bedingt **und** wirksam **und** benennbar war (siehe Modulkopf). */
function isCauseStep(derivation, step, stepIndex) {
  return step.isConditional
    && step.witness !== null
    && step.witness !== undefined
    && step.result !== valueBeforeStep(derivation, stepIndex);
}

/**
 * Die Ursache zu einem Kettenschritt: **wer** sie ausgeloest hat (der Zeuge:
 * Definitions-ID und Katalogname der benennbaren Auswahl), **wie** gewirkt wurde
 * (die Modifikator-Art aus der XSD-SSOT) und **worauf** der Grenzwert dadurch kam.
 * Alles sprachfrei — welchen Satz die Oberflaeche daraus baut, ist ihr Vertrag.
 */
function toCause(step) {
  return Object.freeze({
    witness: step.witness,
    modifierKind: step.kind,
    value: step.result,
  });
}

/**
 * Die Ursachen eines Grenzwerts, gelesen aus seiner Herleitungskette.
 *
 * @param {{ base: number, steps: object[] }|null} derivation  die Kette aus
 *   `effectiveState.limitDerivation`; `null`, wenn der Knoten die Grenze nicht traegt.
 * @returns {object[]} die Ursachen in Dokumentreihenfolge (leer, wenn es keine gibt).
 */
export function causesOf(derivation) {
  if (derivation === null || derivation === undefined) return [];
  return derivation.steps
    .filter((step, stepIndex) => isCauseStep(derivation, step, stepIndex))
    .map(toCause);
}

/**
 * Das **optionale Ursachen-Feld** einer Meldung als Teilobjekt zum Hineinspreizen:
 * `{ causes }`, oder `{}`, wenn keine benennbare Ursache bleibt. ADR-0027 verlangt
 * ausdruecklich, dass das Feld dann *fehlt* statt leer dazustehen — eine leere
 * Liste liese die Oberflaeche einen Ursachen-Block anlegen, den sie nicht fuellen kann.
 *
 * @param {{ base: number, steps: object[] }|null} derivation
 * @returns {{ causes?: object[] }}
 */
export function causesFieldOf(derivation) {
  const causes = causesOf(derivation);
  return causes.length === 0 ? {} : { causes };
}

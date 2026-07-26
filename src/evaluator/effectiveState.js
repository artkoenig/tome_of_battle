/**
 * Effektiv-Werte-Schicht (`docs/evaluator-architecture.md` §3.4/§4.1,
 * `record EffectiveState`).
 *
 * Basisdefinitionen werden nie mutiert (Leitprinzip 5, Immutability). Diese
 * Schicht traegt eine **separate** Ebene effektiver Werte: effektive Kosten,
 * effektive Kategorien, effektive Grenzwerte, die Sichtbarkeits-Menge und die
 * bedingten Hinweistexte — je realem Knoten. Sie entsteht als **frische Kopie**
 * der Basiswerte ({@link createBaseEffectiveState}); die Modifikator-Schicht
 * schreibt in diese Kopie, ohne die Definitionen zu beruehren.
 *
 * Weil jede Anwendung von einer frischen Basiskopie ausgeht, kann die
 * Fixpunktschleife (Slice 05) dieselbe Modifikator-Anwendung ohne Umbau in eine
 * Konvergenzschleife wickeln — `ADD`/`MULTIPLY` kumulieren nie ueber Runden
 * (`docs/evaluator-architecture.md` §4.6, Schlussbemerkung).
 */

import { allNodes, limitsOf } from './evalTree.js';
import { DefinitionKind } from './model.js';

const EMPTY_LIMIT_VALUES = Object.freeze(new Map());

/**
 * Die effektiven Werte eines Auswertungsbaums, je realem Knoten. Nach der
 * Modifikator-Anwendung liest die Index- und Constraint-Schicht sie nur noch;
 * die Schreibmethoden dienen ausschliesslich der Modifikator-Schicht.
 */
export class EffectiveState {
  #costs;
  #categories;
  #limitValues;
  #hidden;
  #notes;

  /**
   * @param {Map<object, Map<string, number>>} costs      effektive Kosten je Kostenart-ID.
   * @param {Map<object, Set<string>>}          categories effektive Kategorie-IDs.
   * @param {Map<object, Map<string, number>>}  limitValues effektive Grenzwerte je Grenzen-ID.
   * @param {Set<object>}                        hidden     versteckte Knoten.
   * @param {Map<object, string[]>}              notes      bedingte Hinweistexte je Knoten.
   */
  constructor(costs, categories, limitValues, hidden, notes) {
    this.#costs = costs;
    this.#categories = categories;
    this.#limitValues = limitValues;
    this.#hidden = hidden;
    this.#notes = notes;
  }

  /** Die effektiven Kostenpaare (Kostenart-ID → Wert je Selektion) eines Knotens. */
  costEntriesOf(node) {
    const costs = this.#costs.get(node);
    return costs === undefined ? [] : [...costs];
  }

  /** Die effektiven Kategorie-IDs eines Knotens (der Zaehl-Zugriffspunkt, §4.4). */
  categoryIdsOf(node) {
    const categories = this.#categories.get(node);
    return categories === undefined ? [] : [...categories];
  }

  /**
   * Der effektive Grenzwert einer Grenze am Knoten, oder `undefined`, wenn der
   * Knoten diese Grenze nicht traegt (dann faellt der Aufrufer auf den Basiswert
   * zurueck).
   */
  limitValue(node, limitId) {
    return (this.#limitValues.get(node) ?? EMPTY_LIMIT_VALUES).get(limitId);
  }

  /** True, wenn der Knoten effektiv versteckt ist. */
  isHidden(node) {
    return this.#hidden.has(node);
  }

  /** Die effektiven Hinweistexte eines Knotens (nie `undefined`). */
  notesOf(node) {
    return this.#notes.get(node) ?? [];
  }

  /** Der aktuelle effektive Kostenwert einer Kostenart (0, falls nicht getragen). */
  currentCost(node, costTypeId) {
    return this.#costs.get(node)?.get(costTypeId) ?? 0;
  }

  /** Der aktuelle effektive Grenzwert einer Grenze (0, falls nicht getragen). */
  currentLimitValue(node, limitId) {
    return this.#limitValues.get(node)?.get(limitId) ?? 0;
  }

  /**
   * Die realen Knoten, fuer die dieser Zustand Werte fuehrt. Zwei Zustaende
   * desselben Baums teilen dieselben Knoten-Objekte; darueber vergleicht die
   * Fixpunktschleife die zaehlrelevanten Teile ({@link countRelevantEqual}).
   */
  nodes() {
    return this.#costs.keys();
  }

  /** Setzt den effektiven Kostenwert einer Kostenart. */
  writeCost(node, costTypeId, value) {
    this.#ensure(this.#costs, node, () => new Map()).set(costTypeId, value);
  }

  /** Setzt den effektiven Grenzwert einer Grenze. */
  writeLimitValue(node, limitId, value) {
    this.#ensure(this.#limitValues, node, () => new Map()).set(limitId, value);
  }

  /** Nimmt den Knoten effektiv in eine Kategorie auf. */
  addCategory(node, categoryId) {
    this.#ensure(this.#categories, node, () => new Set()).add(categoryId);
  }

  /** Entfernt den Knoten effektiv aus einer Kategorie. */
  removeCategory(node, categoryId) {
    this.#categories.get(node)?.delete(categoryId);
  }

  /** Setzt die effektive Sichtbarkeit eines Knotens. */
  setHidden(node, isHidden) {
    if (isHidden) this.#hidden.add(node);
    else this.#hidden.delete(node);
  }

  /** Haengt einen effektiven Hinweistext an einen Knoten an. */
  appendNote(node, text) {
    this.#ensure(this.#notes, node, () => []).push(text);
  }

  #ensure(map, node, factory) {
    let value = map.get(node);
    if (value === undefined) {
      value = factory();
      map.set(node, value);
    }
    return value;
  }
}

/**
 * True, wenn zwei Kostenabbildungen (Kostenart-ID → Wert je Selektion) gleich
 * sind — reihenfolgeunabhaengig ueber Schluessel und Werte verglichen.
 */
function costsEqual(entriesA, entriesB) {
  if (entriesA.length !== entriesB.length) return false;
  const valueById = new Map(entriesB);
  for (const [costTypeId, value] of entriesA) {
    if (valueById.get(costTypeId) !== value) return false;
  }
  return true;
}

/** True, wenn zwei Kategorie-ID-Listen dieselbe Menge sind (reihenfolgeunabhaengig). */
function categoriesEqual(idsA, idsB) {
  if (idsA.length !== idsB.length) return false;
  const setB = new Set(idsB);
  for (const id of idsA) {
    if (!setB.has(id)) return false;
  }
  return true;
}

/**
 * Vergleicht die **zaehlrelevanten** Teile zweier Effektiv-Zustaende: die
 * effektiven Kosten und die effektiven Kategorien je Knoten
 * (`docs/evaluator-architecture.md` §4.2, `countRelevantPartsEqual`). Genau
 * diese beiden aendern, was gezaehlt wird; Grenzwerte, Sichtbarkeit und Hinweise
 * beeinflussen die Zaehlung nicht und bleiben deshalb aussen vor. Ist das Ergebnis
 * `true`, hat die Fixpunktschleife ihren Fixpunkt erreicht — eine weitere Runde
 * wuerde nichts Zaehlrelevantes mehr aendern.
 *
 * Beide Zustaende stammen aus demselben Baum und teilen dieselben Knoten-Objekte;
 * es genuegt, ueber die Knoten des einen zu iterieren.
 *
 * @param {EffectiveState} previous
 * @param {EffectiveState} next
 * @returns {boolean}
 */
export function countRelevantEqual(previous, next) {
  for (const node of previous.nodes()) {
    if (!costsEqual(previous.costEntriesOf(node), next.costEntriesOf(node))) return false;
    if (!categoriesEqual(previous.categoryIdsOf(node), next.categoryIdsOf(node))) return false;
  }
  return true;
}

/**
 * Erzeugt eine frische Effektiv-Werte-Kopie aus den **Basisdefinitionen** aller
 * Knoten — **Phantome eingeschlossen**, damit auch deren Grenzwerte modifizierbar
 * sind (§4.6). Kein Modifikator ist angewendet: effektive Werte gleichen den
 * Basiswerten. Jede Modifikator-Anwendung startet von dieser frischen Kopie,
 * damit sich keine Wirkungen ueber Anwendungen hinweg aufsummieren.
 *
 * @param {object} root Wurzel des Evaluationsbaums.
 * @returns {EffectiveState}
 */
export function createBaseEffectiveState(root) {
  const costs = new Map();
  const categories = new Map();
  const limitValues = new Map();
  const notes = new Map();
  const hidden = new Set();
  for (const node of allNodes(root)) {
    let defCosts = node.def.costs ?? {};
    let defCategories = node.def.categoryIds ?? [];
    // Die Grenzen kommen aus derselben Quelle wie in der Constraint-Schicht
    // (`limitsOf`, inkl. der von einem Verweis geerbten) — sonst traegt ein
    // Knoten einen Grenzwert, den nie jemand auswertet, oder umgekehrt.
    const defLimits = limitsOf(node.def);

    if (node.def.kind === DefinitionKind.ENTRY_LINK && node.def.resolved) {
      defCosts = { ...(node.def.resolved.costs ?? {}), ...defCosts };
      defCategories = [...new Set([...(node.def.resolved.categoryIds ?? []), ...defCategories])];
    }

    costs.set(node, new Map(Object.entries(defCosts)));
    categories.set(node, new Set(defCategories));
    const limits = new Map();
    for (const limit of defLimits) {
      limits.set(limit.id, limit.value);
    }
    limitValues.set(node, limits);
    notes.set(node, []);
  }
  return new EffectiveState(costs, categories, limitValues, hidden, notes);
}

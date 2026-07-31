/**
 * Effektiv-Werte-Schicht (`docs/evaluator-architecture.md` §3.4/§4.1,
 * `record EffectiveState`).
 *
 * Die **Auswertung** mutiert keine Basisdefinition (Leitprinzip 5, Immutability).
 * Geschrieben wird auf die geparsten Definitionen genau einmal, und zwar nicht
 * hier: der Resolver reichert sie waehrend der Aufbereitung an (`modifier.target`,
 * `condition.witnessDefinition`, `info.resolved`, `link.resolved`) und friert den
 * Graphen danach tief ein (`resolver.js`, `freezeResolvedView`). Ab da ist
 * er Lesestoff — ein gewoehnlicher Schreibzugriff darauf scheitert, statt einen
 * spaeteren Bericht still zu verfaelschen. Was diese Durchsetzung leistet und wo
 * ihre Grenzen liegen, steht **an einer Stelle**, im Kopf von `resolver.js`; hier
 * gilt allein: keine Runde und keine Auswertung schreibt zurueck. Diese
 * Schicht traegt eine **separate** Ebene effektiver Werte: effektive Kosten,
 * effektive Kategorien (samt der effektiven **Primaerkategorie**), effektive
 * Grenzwerte samt ihrer **Herleitungskette**, die
 * Sichtbarkeit, die effektiven Namen, die effektiven Charakteristikwerte und die
 * **Autor-Meldungen** des Katalogs. Sie entsteht als **frische Kopie** der
 * Basiswerte ({@link createBaseEffectiveState}); die Modifikator-Schicht schreibt
 * in diese Kopie, ohne die Definitionen zu beruehren.
 *
 * ── Traeger statt nur Knoten ─────────────────────────────────────────────────
 * Sichtbarkeit, Name und Charakteristiken haengen nicht am Knoten allein, sondern
 * an seinem **Traeger**: entweder am Knoten selbst oder an einem seiner
 * Info-Elemente (Profil, Regel, Info-Gruppe, Info-Verweis). Das ist keine
 * Verallgemeinerung auf Vorrat, sondern die Form der Daten: in den
 * Fixture-Katalogen haengt **jeder** Charakteristik-Modifikator an einem Profil
 * oder einem Info-Verweis, und ein Namens-Modifikator am Info-Verweis meint
 * dessen Anzeigenamen, nicht den der Einheit. Der Schluessel ist deshalb das Paar
 * (Knoten, Traeger); dieselbe geteilte Profil-Definition an zwei Knoten fuehrt
 * damit zwei unabhaengige effektive Werte.
 *
 * Diese traeger-bezogenen Werte werden **nur als Ueberschreibung** gespeichert;
 * ohne Modifikator liest der Zugriff den Basiswert direkt aus der Definition. So
 * kostet eine Fixpunktrunde nichts fuer die grosse Mehrheit unveraenderter
 * Merkmale.
 *
 * Der Zustand laesst sich **nachtraeglich um weitere Knoten erweitern**
 * ({@link extendBaseEffectiveState}), damit der Nach-Durchlauf die erst nach der
 * Konvergenz entstandenen Angebots-Anker (Baumphase 2) in denselben Zustand
 * eintraegt, ohne vorhandene Werte zu beruehren.
 *
 * Weil jede Anwendung von einer frischen Basiskopie ausgeht, kann die
 * Fixpunktschleife dieselbe Modifikator-Anwendung ohne Umbau in eine
 * Konvergenzschleife wickeln — `ADD`/`MULTIPLY` und die Kettenschritte kumulieren
 * nie ueber Runden (`docs/evaluator-architecture.md` §4.6, Schlussbemerkung).
 */

import { allNodes, limitsOf } from './evalTree.js';
import { DefinitionKind } from './model.js';

const EMPTY_CHARACTERISTICS = Object.freeze([]);
const NO_AUTHOR_MESSAGES = Object.freeze([]);

/**
 * Die Definition, die die Basiswerte eines Traegers stellt: bei einem Knoten seine
 * eigene Definition, bei einem Info-Element das Element selbst.
 */
function subjectOf(node, carrier) {
  return carrier === node ? node.def : carrier;
}

/**
 * Die beiden Basis-Quellen eines Traegers: seine eigene Definition und — falls er
 * ein Verweis ist — die aufgeloeste Zieldefinition. Eigene Angaben gehen vor den
 * geerbten (dieselbe Erb-Regel wie bei Grenzen, {@link limitsOf}).
 */
function baseSourcesOf(node, carrier) {
  const own = subjectOf(node, carrier) ?? null;
  return { own, target: own?.resolved ?? null };
}

/** Der Basis-Anzeigename eines Traegers (der des Verweisziels, wenn er keinen hat). */
function baseNameOf(node, carrier) {
  const { own, target } = baseSourcesOf(node, carrier);
  return own?.name ?? target?.name ?? null;
}

/**
 * Ob eine Definition **statisch** versteckt ist: sie selbst oder — bei einem
 * Verweis — ihr (transitiv aufgeloestes) Ziel. Gelesen wird der **Rohzustand** des
 * `hidden`-Attributs (`hiddenAttribute`: `true`/`false`/`undefined` = nicht
 * gesetzt, `catalogReader.js`, `readEntryBase`), nicht der zu einem Boolean
 * materialisierte `isHidden`-Wert.
 */
function isBaseHidden(subject) {
  return subject?.hiddenAttribute === true || subject?.resolved?.hiddenAttribute === true;
}

/**
 * Die Basis-Sichtbarkeit eines Traegers (XSD-Vorgabe: sichtbar). Versteckt ist ein
 * Vorkommen, wenn **eine** der Quellen es versteckt:
 *
 * - der Traeger selbst oder sein (transitiv aufgeloestes) Verweisziel;
 * - eine **Sichtbarkeits-Klammer** des Knotens (`visibilityGates`) — die
 *   `selectionEntryGroup`s bzw. Gruppen-Verweise, durch die die Angebots-Schicht
 *   zu dieser Definition abgestiegen ist ({@link ../evaluator/offer.js}). Sie
 *   gelten nur fuer den Knoten selbst, nicht fuer seine Info-Elemente.
 *
 * Die Oder-Verknuepfung ersetzt seit Issue 0135 die fruehere Vorrangregel „eigenes
 * `hidden` vor dem geerbten" (Issue 0099, Kriterium 2). Sie war an echten Daten
 * wirkungslos bis schaedlich: Battlescribe schreibt `hidden` an **jedem**
 * `entryLink` (0 von 2302 in den DE-Fixtures lassen es weg), sodass das
 * `hidden="true"` einer geteilten Definition ein Vorkommen nie erreichte — und
 * damit das gaengigste Gatter-Muster der Kataloge (geteilte Definition
 * `hidden="true"` plus bedingter Aufdeck-Modifikator, 22 von 27 Faellen in den
 * Fixtures) ins Gegenteil verkehrte.
 *
 * Modifikatoren ueberschreiben jeden dieser Basiswerte
 * ({@link EffectiveState#isHidden}) — auch die der Klammern, deren
 * `field="hidden"`-Modifikatoren am Knoten mitlaufen (`modifiers.js`).
 */
function baseHiddenOf(node, carrier) {
  const { own } = baseSourcesOf(node, carrier);
  if (isBaseHidden(own)) return true;
  if (carrier !== node) return false;
  return (node.visibilityGates ?? []).some(isBaseHidden);
}

/** Die Basis-Merkmale eines Traegers (die des Verweisziels, wenn er selbst keine fuehrt). */
function baseCharacteristicsOf(node, carrier) {
  const { own, target } = baseSourcesOf(node, carrier);
  return own?.characteristics ?? target?.characteristics ?? EMPTY_CHARACTERISTICS;
}

/**
 * Die effektiven Werte eines Auswertungsbaums. Nach der Modifikator-Anwendung
 * liest die Index-, Constraint- und Berichtsschicht sie nur noch; die
 * Schreibmethoden dienen ausschliesslich der Modifikator-Schicht.
 */
export class EffectiveState {
  #costs;
  #categories;
  #primaries;
  #limits;
  #hidden;
  #names;
  #characteristics;
  #authorMessages;

  /**
   * Erzeugt einen leeren Zustand. Die Basiswerte traegt
   * {@link createBaseEffectiveState} je Knoten nach ({@link EffectiveState#seedNode});
   * eine Grenze fuehrt dabei ihre **Herleitung** — Basiswert plus die Schritte, die
   * ihn veraendert haben —, denn der effektive Grenzwert ist der Endstand dieser
   * Kette und nicht ein zweiter, danebenlaufender Zahlwert.
   */
  constructor() {
    this.#costs = new Map();
    this.#categories = new Map();
    this.#primaries = new Map();
    this.#limits = new Map();
    this.#hidden = new Map();
    this.#names = new Map();
    this.#characteristics = new Map();
    this.#authorMessages = new Map();
  }

  /**
   * Traegt die **Basiswerte** eines Knotens ein: seine effektiven Kosten und
   * Kategorien starten als Kopie der Definitionswerte, jede Grenze als Herleitung
   * ohne Schritt.
   *
   * Der Zustand schluesselt nach Knoten-**Objekt**; ein nachtraeglich eingetragener
   * Knoten (Baumphase 2) kann deshalb keinen vorhandenen Eintrag ueberschreiben.
   *
   * @param {object} node
   * @param {{ costs: Map<string, number>, categories: Set<string>, primaryCategoryId: string | null, derivations: Map<string, { base: number, steps: object[] }> }} baseValues
   */
  seedNode(node, { costs, categories, primaryCategoryId, derivations }) {
    this.#costs.set(node, costs);
    this.#categories.set(node, categories);
    this.#primaries.set(node, primaryCategoryId);
    this.#limits.set(node, derivations);
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
   * Die **effektive Primaerkategorie** eines Knotens — `null`, wenn keine seiner
   * Kategorien primaer ist. Sie ist reiner Anzeige-Zustand neben der
   * Mitgliedschaft: die Zaehl- und Grenzenschicht liest sie nie (der
   * zaehlrelevante Schluessel {@link countRelevantFingerprint} laesst sie bewusst
   * aussen vor), die Berichtsschicht traegt sie je Slot in den
   * Faehigkeitsdatensatz (`docs/battlescribe-data-format.md` §8).
   *
   * @param {object} node
   * @returns {string | null}
   */
  primaryCategoryIdOf(node) {
    return this.#primaries.get(node) ?? null;
  }

  /**
   * Der effektive Grenzwert einer Grenze am Knoten — der Endstand ihrer
   * Herleitungskette —, oder `undefined`, wenn der Knoten diese Grenze nicht
   * traegt (dann faellt der Aufrufer auf den Basiswert zurueck).
   */
  limitValue(node, limitId) {
    const derivation = this.#limits.get(node)?.get(limitId);
    return derivation === undefined ? undefined : valueOfDerivation(derivation);
  }

  /**
   * Die **Herleitung** eines Grenzwerts: sein Basiswert aus der Katalogdefinition
   * und, in Dokumentreihenfolge, je angewandtem Modifikator ein Schritt (Art,
   * roher Wert, Wiederholungsfaktor, Zwischenwert, ob er bedingt war und — bei
   * einem bedingten Schritt — sein Zeuge). `null`, wenn der Knoten die Grenze
   * nicht traegt.
   *
   * Sie ist die einzige Quelle der Ursachen nach ADR-0027: wer sie liest, filtert
   * die bedingten Schritte, die den Wert tatsaechlich veraendert haben — er wertet
   * keine Bedingung erneut aus.
   */
  limitDerivation(node, limitId) {
    return this.#limits.get(node)?.get(limitId) ?? null;
  }

  /** True, wenn der Traeger effektiv versteckt ist (ohne Traeger: der Knoten selbst). */
  isHidden(node, carrier = node) {
    return this.#hidden.get(node)?.get(carrier) ?? baseHiddenOf(node, carrier);
  }

  /** Der effektive Anzeigename eines Traegers (ohne Traeger: der des Knotens). */
  nameOf(node, carrier = node) {
    return this.#names.get(node)?.get(carrier) ?? baseNameOf(node, carrier);
  }

  /** Der effektive Wert eines Merkmals am Traeger (`undefined`, wenn er es nicht fuehrt). */
  characteristicValue(node, carrier, characteristicTypeId) {
    const override = this.#characteristics.get(node)?.get(carrier)?.get(characteristicTypeId);
    if (override !== undefined) return override;
    return baseCharacteristicsOf(node, carrier)
      .find(characteristic => characteristic.typeId === characteristicTypeId)?.value;
  }

  /**
   * Alle Merkmale eines Traegers mit ihrem **effektiven** Wert, in
   * Dokumentreihenfolge — die Lesesicht der Berichtsschicht.
   */
  characteristicEntriesOf(node, carrier) {
    return baseCharacteristicsOf(node, carrier).map(characteristic => ({
      typeId: characteristic.typeId,
      value: this.characteristicValue(node, carrier, characteristic.typeId),
    }));
  }

  /**
   * Die **Autor-Meldungen** des Katalogs an diesem Knoten, in Anwendungsreihenfolge
   * — je mit ihrem Schweregrad und dem unveraenderten Katalogtext (ADR-0022/0028).
   */
  authorMessagesOf(node) {
    return this.#authorMessages.get(node) ?? NO_AUTHOR_MESSAGES;
  }

  /** Der aktuelle effektive Kostenwert einer Kostenart (0, falls nicht getragen). */
  currentCost(node, costTypeId) {
    return this.#costs.get(node)?.get(costTypeId) ?? 0;
  }

  /** Der aktuelle effektive Grenzwert einer Grenze (0, falls nicht getragen). */
  currentLimitValue(node, limitId) {
    return this.limitValue(node, limitId) ?? 0;
  }

  /** Setzt den effektiven Kostenwert einer Kostenart. */
  writeCost(node, costTypeId, value) {
    ensure(this.#costs, node, newMap).set(costTypeId, value);
  }

  /**
   * Schreibt den effektiven Grenzwert einer Grenze **als Schritt ihrer
   * Herleitungskette** fort: der Zwischenwert wird am Schritt festgehalten, und der
   * letzte Schritt ist zugleich der effektive Wert. Es gibt bewusst keinen Weg, den
   * Wert ohne seinen Schritt zu setzen — sonst entstuenden zwei Zustaende, die
   * auseinanderlaufen koennen.
   *
   * @param {object} node
   * @param {string} limitId
   * @param {number} value  der Zwischenwert nach diesem Schritt.
   * @param {{ kind: string, rawValue: string, times: number, isConditional: boolean, witness: object|null }} step
   */
  writeLimitValue(node, limitId, value, step) {
    const derivation = ensure(ensure(this.#limits, node, newMap), limitId, emptyDerivation);
    derivation.steps.push(Object.freeze({ ...step, result: value }));
  }

  /** Nimmt den Knoten effektiv in eine Kategorie auf. */
  addCategory(node, categoryId) {
    ensure(this.#categories, node, newSet).add(categoryId);
  }

  /**
   * Entfernt den Knoten effektiv aus einer Kategorie. War genau sie die
   * Primaere, erlischt auch das Primaer-Flag — eine Primaerkategorie ohne
   * Mitgliedschaft waere sinnlos (Issue 0100, Default-Entscheidung).
   */
  removeCategory(node, categoryId) {
    this.#categories.get(node)?.delete(categoryId);
    if (this.#primaries.get(node) === categoryId) {
      this.#primaries.set(node, null);
    }
  }

  /**
   * Macht eine Kategorie zur **effektiven Primaeren** des Knotens
   * (`set-primary`, `docs/battlescribe-data-format.md` §7.7/§8): sichert die
   * Mitgliedschaft und setzt das Primaer-Flag — bei mehreren Anwendungen
   * gewinnt schlicht die letzte.
   *
   * @param {object} node
   * @param {string} categoryId
   */
  setPrimaryCategory(node, categoryId) {
    this.addCategory(node, categoryId);
    this.#primaries.set(node, categoryId);
  }

  /**
   * Loescht das Primaer-Flag des Knotens genau dann, wenn `categoryId` aktuell
   * seine Primaere ist (`unset-primary`); die Mitgliedschaft bleibt unberuehrt.
   *
   * @param {object} node
   * @param {string} categoryId
   */
  unsetPrimaryCategory(node, categoryId) {
    if (this.#primaries.get(node) === categoryId) {
      this.#primaries.set(node, null);
    }
  }

  /** Setzt die effektive Sichtbarkeit eines Traegers. */
  setHidden(node, carrier, isHidden) {
    ensure(this.#hidden, node, newMap).set(carrier, isHidden);
  }

  /** Setzt den effektiven Anzeigenamen eines Traegers. */
  writeName(node, carrier, name) {
    ensure(this.#names, node, newMap).set(carrier, name);
  }

  /** Setzt den effektiven Wert eines Merkmals am Traeger. */
  writeCharacteristic(node, carrier, characteristicTypeId, value) {
    ensure(ensure(this.#characteristics, node, newMap), carrier, newMap).set(characteristicTypeId, value);
  }

  /** Haengt eine Autor-Meldung mit ihrem Schweregrad an den Knoten an. */
  appendAuthorMessage(node, severity, text) {
    ensure(this.#authorMessages, node, newArray).push(Object.freeze({ severity, text }));
  }
}

/** Der effektive Wert einer Herleitung: der Endstand ihrer Kette, sonst ihr Basiswert. */
function valueOfDerivation(derivation) {
  return derivation.steps.length === 0
    ? derivation.base
    : derivation.steps[derivation.steps.length - 1].result;
}

const newMap = () => new Map();
const newSet = () => new Set();
const newArray = () => [];
const emptyDerivation = () => ({ base: 0, steps: [] });

/** Liefert den Eintrag eines Schluessels und legt ihn bei Bedarf frisch an. */
function ensure(map, key, factory) {
  let value = map.get(key);
  if (value === undefined) {
    value = factory();
    map.set(key, value);
  }
  return value;
}

/** Trennzeichen zwischen den Knoten-Schluesseln eines Fingerabdrucks. */
const FINGERPRINT_SEPARATOR = '\n';

/** Ordnet Kostenpaare nach ihrer Kostenart-ID (stabil und gebietsschema-unabhaengig). */
function byCostTypeId([leftId], [rightId]) {
  if (leftId < rightId) return -1;
  return leftId > rightId ? 1 : 0;
}

/**
 * Die **zaehlrelevanten** Werte eines Knotens als kanonischer Schluessel: seine
 * effektiven Kosten und seine effektiven Kategorien, beide nach ID sortiert,
 * sodass die Eintragungsreihenfolge den Schluessel nicht veraendert. Genau diese
 * beiden Groessen aendern, was gezaehlt wird (`docs/evaluator-architecture.md`
 * §4.2); Grenzwerte, Sichtbarkeit, Namen, Merkmale und Meldungen beeinflussen die
 * Zaehlung nicht und bleiben deshalb aussen vor.
 *
 * Dieser Schluessel ist die **eine** Wahrheit darueber, was „zaehlrelevant" heisst:
 * Konvergenzvergleich ({@link countRelevantDifferences}), Oszillations-Fingerabdruck
 * ({@link countRelevantFingerprint}) und die Menge der instabilen Knoten lesen alle
 * ihn — kein zweiter Durchgang, keine zweite Auffassung.
 */
function countRelevantKeyOf(state, node) {
  const costs = state.costEntriesOf(node).sort(byCostTypeId);
  const categoryIds = state.categoryIdsOf(node).sort();
  return JSON.stringify([costs, categoryIds]);
}

/**
 * Der Fingerabdruck der zaehlrelevanten Werte einer Knotenmenge: ihre
 * Knoten-Schluessel in Traversierungsreihenfolge aneinandergereiht. Zwei
 * Zustaende desselben Baums tragen genau dann denselben Fingerabdruck, wenn ihre
 * zaehlrelevanten Werte ueber dieser Knotenmenge uebereinstimmen.
 *
 * Die Fixpunktschleife bildet ihn je Runde ueber die **iterierten** Knoten und
 * erkennt daran eine Oszillation: taucht ein Fingerabdruck erneut auf, kehrt ein
 * frueherer Zustand wieder, und der Abstand der beiden Vorkommen ist die
 * Zykluslaenge.
 *
 * @param {EffectiveState} state
 * @param {object[]} nodes  die Knoten, ueber die der Fingerabdruck gebildet wird.
 * @returns {string}
 */
export function countRelevantFingerprint(state, nodes) {
  return nodes.map(node => countRelevantKeyOf(state, node)).join(FINGERPRINT_SEPARATOR);
}

/**
 * Die Knoten, deren zaehlrelevante Werte sich zwischen zwei Effektiv-Zustaenden
 * unterscheiden. Ist die Menge leer, hat die Fixpunktschleife ihren Fixpunkt
 * erreicht — eine weitere Runde wuerde nichts Zaehlrelevantes mehr aendern; ist sie
 * es nicht, sind **genau diese** Knoten die instabilen: ihre Zahlen sind eine
 * Momentaufnahme der letzten Runde und keine gesicherte Aussage.
 *
 * Beide Zustaende stammen aus demselben Baum und teilen dieselben Knoten-Objekte.
 *
 * @param {EffectiveState} previous
 * @param {EffectiveState} next
 * @param {object[]} nodes  die verglichenen Knoten (die iterierten, siehe `fixpoint.js`).
 * @returns {Set<object>}
 */
export function countRelevantDifferences(previous, next, nodes) {
  return new Set(nodes.filter(node => countRelevantKeyOf(previous, node) !== countRelevantKeyOf(next, node)));
}

/**
 * Die **Basiswerte** eines Knotens aus seiner Definition: Kosten, Kategorien und
 * je Grenze eine Herleitung, die nur aus ihrem Basiswert besteht. Ein `entryLink`
 * erbt Kosten und Kategorien seines aufgeloesten Ziels; eigene Angaben gehen vor.
 */
function baseValuesOf(node) {
  let defCosts = node.def.costs ?? {};
  let defCategories = node.def.categoryIds ?? [];
  let defPrimaryCategoryId = node.def.primaryCategoryId ?? null;
  // Die Grenzen kommen aus derselben Quelle wie in der Constraint-Schicht
  // (`limitsOf`, inkl. der von einem Verweis geerbten) — sonst traegt ein
  // Knoten einen Grenzwert, den nie jemand auswertet, oder umgekehrt.
  const defLimits = limitsOf(node.def);

  if (node.def.kind === DefinitionKind.ENTRY_LINK && node.def.resolved) {
    defCosts = { ...(node.def.resolved.costs ?? {}), ...defCosts };
    defCategories = [...new Set([...(node.def.resolved.categoryIds ?? []), ...defCategories])];
    defPrimaryCategoryId ??= node.def.resolved.primaryCategoryId ?? null;
  }

  const derivations = new Map();
  for (const limit of defLimits) {
    derivations.set(limit.id, { base: limit.value, steps: [] });
  }
  return {
    costs: new Map(Object.entries(defCosts)),
    categories: new Set(defCategories),
    primaryCategoryId: defPrimaryCategoryId,
    derivations,
  };
}

/**
 * Erzeugt eine frische Effektiv-Werte-Kopie aus den **Basisdefinitionen** aller
 * Knoten — **Phantome eingeschlossen**, damit auch deren Grenzwerte modifizierbar
 * sind (§4.6). Kein Modifikator ist angewendet: effektive Werte gleichen den
 * Basiswerten, und jede Herleitungskette besteht nur aus ihrem Basiswert. Jede
 * Modifikator-Anwendung startet von dieser frischen Kopie, damit sich keine
 * Wirkungen — und keine Kettenschritte — ueber Anwendungen hinweg aufsummieren.
 *
 * @param {object} root Wurzel des Evaluationsbaums.
 * @returns {EffectiveState}
 */
export function createBaseEffectiveState(root) {
  const state = new EffectiveState();
  for (const node of allNodes(root)) {
    state.seedNode(node, baseValuesOf(node));
  }
  return state;
}

/**
 * Traegt die Basiswerte **nachtraeglich** entstandener Knoten in einen
 * bestehenden Zustand nach — die Angebots-Anker aus Baumphase 2, die es beim
 * Aufbau des Zustands noch nicht gab (ADR-0035).
 *
 * Ohne diesen Schritt haette ein Anker keine Herleitung fuer seine Grenzen: ein
 * `increment` rechnete dann von 0 statt vom Katalogwert. Vorhandene Werte bleiben
 * unberuehrt — der Zustand schluesselt nach Knoten-Objekt, und ein frisch
 * erzeugter Anker kollidiert mit keinem Eintrag.
 *
 * @param {EffectiveState} state  der konvergierte Zustand.
 * @param {Iterable<object>} nodes  die neu entstandenen Knoten.
 */
export function extendBaseEffectiveState(state, nodes) {
  for (const node of nodes) {
    state.seedNode(node, baseValuesOf(node));
  }
}

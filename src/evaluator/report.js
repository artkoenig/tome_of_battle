/**
 * Bericht (`docs/evaluator-architecture.md` §3.6/§4.8).
 *
 * Der Bericht ist die **einzige** Quelle der Auswertungsergebnisse (Leitprinzip
 * 2). Er traegt zwei Sichten auf denselben, genau einmal ausgewerteten Stand:
 *
 * - **Verletzungen** fuer die Validierungsanzeige — **eine** Liste fachlich
 *   eingeordneter Meldungen (`violationClassification.js`) mit einem
 *   Herkunfts-Diskriminator: aus einer Grenze **abgeleitete** Meldungen (das volle
 *   Ergebnis-Tripel je angeschlagener, **berichtsfaehiger** Grenze, samt Art der
 *   Grenze, Bezugsrahmen, Herleitungskette und den daraus gelesenen **Ursachen**,
 *   `causes.js`) und die **Autor-Meldungen** des Katalogs (`authorMessages.js`),
 * - je Slot einen **Faehigkeitsdatensatz** (`SlotCapability`) fuer die
 *   UI-Steuerung: Definitions-ID, **Ankerart**, Rahmen-Bezug und **effektiver**
 *   Anzeigename, effektives min/max, aktueller Stand, Restspielraum, die
 *   Pflicht-/Gesperrt-/Versteckt-Flags, das Merkmal „Wert nicht stabil", die
 *   **Autor-Meldungen** des Katalogs und die **Info-Projektion** — die fuer den
 *   Slot geltenden Profile (mit ihren effektiven Merkmalswerten) und Regeltexte
 *   (`infoProjection.js`),
 * - **Diagnosen** (Aufloesung, Oszillation, erschoepftes Rundenbudget, Null-Nenner).
 *
 * Ein Slot ist seit ADR-0035 **jede Stelle, an der eine Auswahl stehen kann** — ob
 * dort etwas steht oder nicht. Verfuegbarkeit wird daraus **abgelesen** statt
 * errechnet: gesperrt ist, wessen Hoechstmass ausgeschoepft ist; versteckt ist, was
 * ein Modifikator ausgeblendet hat. Deshalb wird Gesperrtes und Verstecktes
 * materialisiert und markiert, nicht weggelassen.
 *
 * Dazu die reinen **UI-Projektions-Lookups**, die ausschliesslich den Bericht
 * lesen und keine Regel erneut auswerten (§4.8, Leitprinzip 3): die UI rechnet
 * nie selbst, sie projiziert nur den einen Bericht.
 */

import { ConstraintKind, isReportableAnchorKind } from './model.js';
import { selectableSlotsOf, pathOf } from './evalTree.js';
import { createProfileTypeRegistry, infoElementsOf } from './infoProjection.js';
import { renderedAuthorMessagesOf } from './authorMessages.js';
import { classifyDerivedViolation, classifyAuthorMessage } from './violationClassification.js';
import { causesFieldOf } from './causes.js';

/** Der Normalfall: die Auswertung ist konvergiert, kein Slot ist instabil. */
const NO_UNSTABLE_NODES = new Set();

/** Ohne Profiltyp-Deklarationen bleiben die Klartext-Namen der Merkmale leer. */
const NO_PROFILE_TYPES = Object.freeze([]);

/** Ohne bekannte Kategorie-IDs ist jeder ID-Bezugsrahmen ein Eintrags-Rahmen. */
const NO_CATEGORY_IDS = new Set();

/**
 * Projiziert ein Constraint-Ergebnis auf eine **abgeleitete** Meldung: die
 * sprachfreie Einordnung (Herkunft, Schweregrad, Anker, Art der Grenze,
 * Bezugsrahmen) plus das Ergebnis-Tripel, die **Herleitung** des Grenzwerts und —
 * sofern benennbar — die daraus gelesenen **Ursachen** (ADR-0027).
 *
 * Die Ursachen entstehen als reine Filterung derselben Kette, nicht aus einer
 * zweiten Herleitung: `causes.js` liest sie, es rechnet nichts nach.
 */
function toDerivedViolation(result, context) {
  return {
    ...classifyDerivedViolation(result, context),
    ...causesFieldOf(result.derivation),
  };
}

/**
 * Die **Autor-Meldungen** aller berichtsfaehigen Slots als Meldungen derselben
 * Liste. Gelesen werden die bereits gebauten Faehigkeitsdatensaetze — dieselben
 * gerenderten Texte, die auch am Slot stehen; zweimal zu rendern hiesse, zwei
 * Texte zu fuehren, die auseinanderlaufen koennen.
 *
 * Ein **Angebots-Anker** faellt heraus (dieselbe Berichtsfaehigkeits-Regel wie bei
 * den Grenzen, ADR-0035/0036): eine Meldung an einer nicht gewaehlten Option
 * spraeche ueber etwas, das gar nicht in der Liste steht — sein Datensatz fuehrt
 * sie weiterhin, damit die Oberflaeche sie am Angebot zeigen kann.
 */
function authorViolationsOf(capabilities, context) {
  const violations = [];
  for (const capability of capabilities.values()) {
    if (!isReportableAnchorKind(capability.anchorKind)) continue;
    for (const message of capability.authorMessages) {
      violations.push(classifyAuthorMessage(capability.node, message, context));
    }
  }
  return violations;
}

/**
 * Das Ergebnis der Grenze gegebener Art (MIN/MAX) am Knoten, oder `null`, wenn
 * der Knoten keine solche (nicht suspendierte) Grenze traegt.
 */
function findResult(results, node, kind) {
  return results.find(result => result.anchor === node && result.limit.kind === kind) ?? null;
}

/**
 * Die **Definition, auf die ein Verweis-Slot zeigt** — `null`, wenn der Slot kein
 * Verweis ist. Ein Kategorie-Anker traegt den `categoryLink`, nicht die Kategorie;
 * ein Angebots-Anker den `entryLink`, nicht den Eintrag (nur so gelten die am
 * Verweis deklarierten Grenzen). Das *Thema* des Slots ist aber das Ziel — und
 * genau darueber zaehlt ihn auch die Constraint-Schicht.
 *
 * Ohne dieses Feld liesse sich ein Kategorie-Abschnitt allein aus dem Bericht
 * nicht seiner Kategorie zuordnen: die Oberflaeche muesste in den Baumknoten
 * greifen, was ADR-0034 gerade ausschliesst. Bevorzugt wird die **aufgeloeste**
 * Ziel-ID (bei einer Verweiskette deren Ende); ein baumelnder Verweis nennt
 * ehrlich das Ziel, das er nicht gefunden hat.
 */
function targetDefIdOf(node) {
  return node.def.resolved?.id ?? node.def.targetId ?? null;
}

/**
 * Der **Rahmen-Bezug** eines Slots: das Kontingent bzw. die Eltern-Auswahl, unter
 * der er haengt — mit deren stabilem Pfad und Definitions-ID. `null` bedeutet: der
 * Slot haengt unmittelbar am Roster, sein Rahmen ist die Armee selbst.
 *
 * Er steht neben dem Pfad im Datensatz, weil ein rein positioneller Schluessel
 * fuer die Oberflaeche zu sproede ist: der Pfad sagt *wo*, der Rahmen-Bezug sagt
 * *worunter* (`design.md`, Risiko „Pfadstabilitaet").
 */
function frameReferenceOf(node) {
  const frame = node.parent;
  if (frame === null || frame.isRoot) return null;
  return { path: pathOf(frame), defId: frame.def.id };
}

/**
 * Der Restspielraum eines Slots: `max(0, Grenzwert − Ist-Wert)`, wenn eine
 * MAX-Grenze besteht. Ohne MAX-Grenze gibt es keine Obergrenze und damit keinen
 * Restspielraum (`null`).
 */
function headroomOf(maxResult) {
  return maxResult === null ? null : Math.max(0, maxResult.bound - maxResult.actual);
}

/**
 * Baut den Faehigkeitsdatensatz eines Slots aus seinen MIN-/MAX-Ergebnissen und
 * dem effektiven Zustand. Der aktuelle Stand kommt bevorzugt aus der MAX-, sonst
 * der MIN-Grenze; traegt der Slot keine (nicht suspendierte) Grenze, ist er 0.
 *
 * `anchorKind` sagt, **woher** der Slot stammt (belegt, Pflicht-Phantom,
 * Gruppen-, Kategorie- oder Angebots-Anker) — die einzige Stelle, an der die
 * Oberflaeche die Herkunft unterscheiden koennen muss; `frame` sagt, unter welchem
 * Kontingent bzw. welcher Eltern-Auswahl er haengt; `targetDefId` sagt bei einem
 * Verweis-Slot, **worauf** er zeigt (die Kategorie eines Kategorie-Ankers, der
 * Eintrag hinter einem `entryLink`).
 * Die Flags sind konsistent zu den ausgewerteten Grenzen: gesperrt am MAX,
 * Pflicht-unerfuellt unter dem MIN, versteckt aus dem effektiven Zustand. Name,
 * Autor-Meldungen und die **Info-Projektion** (`infoElements`: die fuer diesen
 * Slot geltenden Profile und Regeltexte, samt der von seinen belegten
 * Unter-Auswahlen geerbten) kommen ebenfalls aus dem effektiven Zustand — die
 * Oberflaeche liest damit den Stand *nach* allen greifenden Modifikatoren, ohne
 * selbst zu rechnen (§4.8, Leitprinzip 3).
 *
 * `isValueUnstable` sagt: dieser Slot lag in der Menge, deren zaehlrelevante Werte
 * in der Fixpunktschleife nicht zur Ruhe kamen — seine Zahlen sind eine
 * Momentaufnahme der letzten Runde, keine gesicherte Aussage. Das Merkmal ist von
 * den drei anderen unabhaengig und schliesst keines aus; bei konvergierenden Daten
 * ist es an jedem Slot `false`.
 */
function toCapability(node, { results, effective, unstableNodes, profileTypeRegistry }) {
  const minResult = findResult(results, node, ConstraintKind.MIN);
  const maxResult = findResult(results, node, ConstraintKind.MAX);
  return {
    node,
    defId: node.def.id,
    targetDefId: targetDefIdOf(node),
    anchorKind: node.anchorKind,
    frame: frameReferenceOf(node),
    name: effective.nameOf(node),
    effectiveMin: minResult === null ? null : minResult.bound,
    effectiveMax: maxResult === null ? null : maxResult.bound,
    current: maxResult?.actual ?? minResult?.actual ?? 0,
    headroom: headroomOf(maxResult),
    isMandatoryUnmet: minResult !== null && !minResult.satisfied,
    isBlocked: maxResult !== null && maxResult.actual >= maxResult.bound,
    isHidden: effective.isHidden(node),
    isValueUnstable: unstableNodes.has(node),
    authorMessages: renderedAuthorMessagesOf(node, effective),
    infoElements: infoElementsOf(node, effective, profileTypeRegistry),
  };
}

/**
 * Baut den Bericht aus dem Auswertungsbaum, dem effektiven Zustand, den
 * Constraint-Ergebnissen und den gesammelten Diagnosen. Je Slot — jeder Knoten
 * jeder Ankerart — entsteht ein Faehigkeitsdatensatz, abgelegt unter dem stabilen
 * Pfad des Slots ({@link pathOf}).
 *
 * @param {object} root  Wurzel des Evaluationsbaums.
 * @param {import('./effectiveState.js').EffectiveState} effective  effektiver Zustand.
 * @param {object[]} results  Ergebnisse von `evaluateConstraints`.
 * @param {object[]} diagnostics  alle waehrend der Auswertung gesammelten Diagnosen.
 * @param {{ budgetViolations?: object[], unstableNodes?: Set<object>, profileTypes?: object[], categoryIds?: Set<string> }} [extras]
 *   `budgetViolations`: die roster-weiten Budget-Verletzungen (`budget.js`, Regel
 *   „Armee zu teuer") in Constraint-Ergebnis-Form. Sie fliessen in **dieselbe**
 *   `violations`-Liste und durch **dieselbe** Projektion wie die Katalog-Grenzen,
 *   tragen aber einen synthetischen roster-weiten Anker; sie sind keine anwaehlbaren
 *   Slots und erzeugen daher keinen Faehigkeitsdatensatz.
 *   `unstableNodes`: die Knoten, deren zaehlrelevante Werte in der Fixpunktschleife
 *   nicht zur Ruhe kamen (`fixpoint.js`). Ihr Faehigkeitsdatensatz wird als
 *   „Wert nicht stabil" markiert, damit die Unsicherheit am betroffenen Slot steht.
 *   `profileTypes`: die Profiltyp-Deklarationen des Datensatzes (`resolver.js`) —
 *   die Quelle der Klartext-Namen in der Info-Projektion je Slot.
 *   `categoryIds`: die bekannten Kategorie-IDs (`resolver.js`) — sie entscheiden,
 *   ob ein ID-Bezugsrahmen einer Grenze eine Kategorie oder einen Eintrag benennt
 *   (`violationClassification.js`), gelesen aus **derselben** Quelle wie im
 *   Query-Primitiv.
 * @returns {{ violations: object[], capabilities: Map<string, object>, diagnostics: object[] }}
 */
export function buildReport(root, effective, results, diagnostics, extras = {}) {
  const {
    budgetViolations = [],
    unstableNodes = NO_UNSTABLE_NODES,
    profileTypes = NO_PROFILE_TYPES,
    categoryIds = NO_CATEGORY_IDS,
  } = extras;

  // Einmal je Bericht gebaut, von jedem Slot gelesen — nicht je Slot erneut.
  const capabilityContext = {
    results,
    effective,
    unstableNodes,
    profileTypeRegistry: createProfileTypeRegistry(profileTypes),
  };
  const capabilities = new Map();
  for (const node of selectableSlotsOf(root)) {
    capabilities.set(pathOf(node), toCapability(node, capabilityContext));
  }

  // Der geteilte Lesekontext der Einordnung: effektive Namen, die instabile
  // Knotenmenge und die bekannten Kategorie-IDs.
  const classificationContext = { effective, unstableNodes, categoryIds };

  return {
    // **Eine** Meldungsliste fuer beide Herkuenfte, unterschieden durch den
    // Diskriminator `origin` — zwei Listen waeren zwei Wege zur selben Frage
    // (ADR-0034). Gemeldet wird, was **berichtsfaehig** und unerfuellt ist; ein
    // Ergebnis am Angebots-Anker faellt heraus (`constraints.js`, `isReportable`):
    // das Nichtgewaehlte speist Faehigkeitsdatensaetze, aber nie die Meldungsliste.
    violations: [
      ...[...results, ...budgetViolations]
        .filter(result => result.isReportable && !result.satisfied)
        .map(result => toDerivedViolation(result, classificationContext)),
      ...authorViolationsOf(capabilities, classificationContext),
    ],
    capabilities,
    diagnostics,
  };
}

// ── UI-Projektions-Lookups: reine Bericht-Leser, keine Regelauswertung (§4.8) ──

/**
 * True, wenn der Slot am gegebenen Pfad auswaehlbar ist: weder versteckt noch
 * gesperrt. Ein unbekannter Pfad ist kein auswaehlbarer Slot (`false`).
 */
export function isSelectable(report, path) {
  const capability = report.capabilities.get(path);
  return capability !== undefined && !capability.isHidden && !capability.isBlocked;
}

/**
 * Der Restspielraum des Slots am gegebenen Pfad (`headroom`): wie viele weitere
 * Auswahlen die MAX-Grenze noch zulaesst. `null`, wenn der Slot keine MAX-Grenze
 * traegt oder der Pfad unbekannt ist.
 */
export function remainingAllowed(report, path) {
  return report.capabilities.get(path)?.headroom ?? null;
}

/**
 * Die offenen Pflichtslots des Berichts: alle Faehigkeitsdatensaetze, deren
 * MIN-Grenze unerfuellt ist (`isMandatoryUnmet`).
 */
export function mandatoryOpenSlots(report) {
  return [...report.capabilities.values()].filter(capability => capability.isMandatoryUnmet);
}

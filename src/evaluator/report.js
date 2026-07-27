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
 * Was die Oberflaeche daraus liest — „auswaehlbar?", „wie viel passt noch?",
 * „welche Pflicht ist offen?" — sind reine Lookups auf diese Felder und gehoeren
 * deshalb zum Verbraucher, nicht hierher (§4.8, Leitprinzip 3): die UI rechnet nie
 * selbst, sie projiziert nur den einen Bericht.
 *
 * Der Bericht traegt **keinen** Baumknoten. Was die Einordnung an internem Zustand
 * braucht, reist neben dem Datensatz, nicht in ihm — sonst waere der Knoten ueber
 * den Bericht von aussen erreichbar und ADR-0034 nur noch eine Absichtserklaerung.
 */

import { ConstraintKind, LimitMeasure, isReportableAnchorKind } from './model.js';
import { resolvedTargetIdOf } from './identity.js';
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
function authorViolationsOf(slots, context) {
  const violations = [];
  for (const { node, capability } of slots) {
    if (!isReportableAnchorKind(capability.anchorKind)) continue;
    for (const message of capability.authorMessages) {
      violations.push(classifyAuthorMessage(node, message, context));
    }
  }
  return violations;
}

/**
 * Wann ein Grenz-Ergebnis **bindender** ist als ein bereits gefundenes derselben
 * Art am selben Anker — je Grenzenart eine Regel, statt einer Fallunterscheidung
 * im Index. Verglichen wird der Abstand zwischen Grenzwert und Ist-Stand
 * (`delta = bound − actual`), und zwar **nur unter Grenzen derselben Messgroesse**
 * ({@link MEASURE_PRECEDENCE}) — er zaehlt, was die Grenze zaehlt:
 *
 * - **MIN**: die mit dem groessten Fehlbetrag — sie ist die Forderung, die am
 *   weitesten von der Erfuellung entfernt ist.
 * - **MAX**: die mit dem geringsten Restspielraum (kleinstes `delta`) — sie ist die
 *   Schranke, die zuerst greift.
 *
 * Bei Gleichstand gewinnt die zuerst gesehene, also die in Dokumentreihenfolge
 * erste. Ohne diese Regel gewaenne schlicht die zuletzt ausgewertete, und die
 * Zahlen eines Slots haetten von der Auswertungsreihenfolge abgehangen.
 */
const IS_MORE_BINDING_BY_KIND = new Map([
  [ConstraintKind.MIN, (candidate, incumbent) => candidate.delta > incumbent.delta],
  [ConstraintKind.MAX, (candidate, incumbent) => candidate.delta < incumbent.delta],
]);

/**
 * Welche **Messgroesse** ein Slot ausweist, wenn er Grenzen mehrerer traegt —
 * absteigend nach Vorrang. Ein Anker traegt seit dem Verweis-Fix mehr als eine
 * Grenze je Art: ein per `entryLink` belegter Slot fuehrt die am Verweis **und**
 * die am Ziel deklarierten Grenzen zugleich
 * ({@link import('./evalTree.js').limitsOf}), und schon eine einzelne Definition
 * darf eine Auswahl doppelt begrenzen („hoechstens 2 magische Gegenstaende **und**
 * hoechstens 100 Punkte"). Der Faehigkeitsdatensatz fuehrt je Slot aber nur
 * **eine** Unter- und eine Obergrenze.
 *
 * Ueber Messgroessen hinweg ist der Abstand `bound − actual` **kein**
 * Vergleichsmass: 2 Auswahlen sind nicht mehr oder weniger als 100 Punkte. Statt
 * Zahlen verschiedener Einheit gegeneinanderzustellen, entscheidet deshalb ein
 * erklaerter Vorrang, und erst **innerhalb** einer Messgroesse der Abstand
 * ({@link IS_MORE_BINDING_BY_KIND}).
 *
 * Der Vorrang folgt dem, was die Oberflaeche aus dem Datensatz liest (ADR-0035):
 * `current` und `headroom` beantworten „wie viel steht hier, wie viel passt noch"
 * — eine Frage in der Einheit, in der an einem Slot hinzugefuegt und weggenommen
 * wird. Deshalb steht vorn, was den **Bestand des Slots selbst** zaehlt, dahinter,
 * was an ihm nur **summiert** wird:
 *
 * 1. `SELECTION_COUNT` — die Anzahl der Auswahlen: die Einheit jedes Auswahl-Slots.
 * 2. `FORCE_COUNT` — die Anzahl der Kontingente: dieselbe Aussage fuer einen
 *    Kontingent-Slot. Der Vorrang zwischen 1 und 2 ist ein reiner
 *    Gleichstands-Ausschluss — er haelt die Ordnung total, falls ein Anker je
 *    beide Zaehlgrenzen derselben Art traegt, und trifft sonst keine Aussage.
 * 3. `COST_SUM` — die verplanten Kosten: sie begrenzen den Slot, sagen aber nicht,
 *    wie viele Auswahlen noch hineinpassen.
 * 4. `BUDGET_LIMIT` — das eingestellte Budget: am weitesten von dem entfernt, was
 *    an diesem Slot tatsaechlich steht.
 *
 * Traegt ein Slot **nur** Kostengrenzen, weist er sie unveraendert aus — der
 * Vorrang waehlt aus, was da ist, er verschweigt nichts.
 *
 * `LimitMeasure.ROSTER_BUDGET` fehlt bewusst: die roster-weite Regel „Armee zu
 * teuer" (`budget.js`) haengt an keinem Slot und speist keinen
 * Faehigkeitsdatensatz ({@link buildReport} reicht sie getrennt an die
 * Meldungsliste). Erreicht ein so gemessenes Ergebnis dennoch den Index, wird es
 * laut gemeldet, statt still den Vorrang zu entscheiden — die Zusicherung gilt
 * fuer **jedes** indizierte Ergebnis ({@link isMoreBinding}), nicht erst dort, wo
 * zwei Messgroessen aufeinandertreffen.
 */
const MEASURE_PRECEDENCE = Object.freeze([
  LimitMeasure.SELECTION_COUNT,
  LimitMeasure.FORCE_COUNT,
  LimitMeasure.COST_SUM,
  LimitMeasure.BUDGET_LIMIT,
]);

/** Der Rang je Messgroesse — kleiner ist vorrangig. */
const PRECEDENCE_BY_MEASURE = new Map(MEASURE_PRECEDENCE.map((measure, rank) => [measure, rank]));

/**
 * Der Vorrang-Rang eines Grenz-Ergebnisses — und zugleich die Zusicherung, dass
 * seine Messgroesse an einem Slot ueberhaupt ausweisbar ist. Eine Messgroesse ohne
 * Rang ist ein Bruch der Aufzaehlung oben (etwa die roster-weite Budget-Regel, die
 * an keinem Slot haengt) und wird laut gemeldet, statt still zu gewinnen oder zu
 * verlieren.
 */
function precedenceOf(result) {
  const rank = PRECEDENCE_BY_MEASURE.get(result.measure);
  if (rank === undefined) {
    throw new Error(`Messgroesse ohne Vorrang: ${result.measure}`);
  }
  return rank;
}

/**
 * True, wenn `candidate` das bisher gefundene Ergebnis `incumbent` als bindendes
 * ablöst. Ohne Vorgaenger gewinnt der Kandidat; bei **verschiedenen** Messgroessen
 * entscheidet allein deren Vorrang ({@link MEASURE_PRECEDENCE}), bei gleicher der
 * Abstand ({@link IS_MORE_BINDING_BY_KIND}). Verglichen werden dafuer die Raenge,
 * nicht die Messgroessen selbst: der Vorrang ist eine Aufzaehlung ohne Dopplung,
 * gleicher Rang heisst also gleiche Messgroesse. Eine Grenzenart ohne Regel ist
 * ein Bruch der Zweiweg-Vollstaendigkeit und wird laut gemeldet, statt still die
 * zuletzt gesehene Grenze zu zeigen.
 *
 * Der Rang des Kandidaten wird **vor** dem Sonderfall „noch kein Vorgaenger"
 * bestimmt, denn er ist nicht nur Vergleichswert, sondern die Zusicherung aus
 * {@link precedenceOf}. Haengt sie am Zusammentreffen zweier Messgroessen, gilt
 * sie fuer einen Anker mit nur **einer** Messgroesse gar nicht — und genau so
 * sehen die Ergebnisse der Budget-Regel aus: alle am selben roster-weiten Anker,
 * alle MAX, alle `ROSTER_BUDGET`. Sie fielen sonst samt und sonders in den
 * frueh zurueckkehrenden Zweig und wuerden still indiziert.
 *
 * Beides zusammen ist eine totale Ordnung (erst Rang, dann Abstand), die Auswahl
 * also unabhaengig davon, in welcher Reihenfolge die Ergebnisse eintreffen.
 */
function isMoreBinding(candidate, incumbent) {
  const candidateRank = precedenceOf(candidate);
  if (incumbent === undefined) return true;
  const incumbentRank = precedenceOf(incumbent);
  if (candidateRank !== incumbentRank) return candidateRank < incumbentRank;
  const isMoreBindingThan = IS_MORE_BINDING_BY_KIND.get(candidate.limit.kind);
  if (isMoreBindingThan === undefined) {
    throw new Error(`Grenzenart ohne Bindungsregel: ${candidate.limit.kind}`);
  }
  return isMoreBindingThan(candidate, incumbent);
}

/**
 * Die Grenz-Ergebnisse je Knoten und Art (MIN/MAX), **einmal** je Bericht
 * aufgebaut. Ohne diesen Index kostete jeder Slot zwei lineare Suchen ueber alle
 * Ergebnisse — bei einem Baum aus mehreren hundert Slots ein quadratischer Aufwand
 * fuer eine Frage, die eine Zuordnung beantwortet.
 *
 * Traegt ein Anker mehrere Grenzen derselben Art, bleibt die **bindende** stehen
 * ({@link isMoreBinding}) — damit `effectiveMin`/`effectiveMax`, `current`,
 * `headroom` und die Flags eines Slots aus **derselben** Grenze stammen und
 * zueinander passen. Die Meldungsliste bleibt unberuehrt: sie entsteht aus der
 * vollen Ergebnisliste, dort ist jede Grenze weiterhin ihre eigene Meldung.
 */
function indexResultsByAnchor(results) {
  const index = new Map();
  for (const result of results) {
    let byKind = index.get(result.anchor);
    if (byKind === undefined) {
      byKind = new Map();
      index.set(result.anchor, byKind);
    }
    if (isMoreBinding(result, byKind.get(result.limit.kind))) {
      byKind.set(result.limit.kind, result);
    }
  }
  return index;
}

/**
 * Das Ergebnis der Grenze gegebener Art (MIN/MAX) am Knoten, oder `null`, wenn
 * der Knoten keine solche (nicht suspendierte) Grenze traegt.
 */
function findResult(resultsByAnchor, node, kind) {
  return resultsByAnchor.get(node)?.get(kind) ?? null;
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
 * Eintrag hinter einem `entryLink`) — der Slot selbst bleibt der Verweis, denn nur
 * so gelten die an ihm deklarierten Grenzen. Ohne dieses Feld liesse sich ein
 * Kategorie-Abschnitt allein aus dem Bericht nicht seiner Kategorie zuordnen: die
 * Oberflaeche muesste in den Baumknoten greifen, was ADR-0034 gerade ausschliesst.
 * Die Flags sind konsistent zu den ausgewerteten Grenzen: gesperrt am MAX,
 * Pflicht-unerfuellt unter dem MIN, versteckt aus dem effektiven Zustand.
 *
 * `current`, `headroom` und `isBlocked` gelten dabei **in der Messgroesse der
 * ausgewiesenen Grenze** ({@link MEASURE_PRECEDENCE}) und sind keine Zusage ueber
 * Verfuegbarkeit: ein Slot kann „noch 4 frei" melden und trotzdem an einer Grenze
 * anderer Messgroesse haengen — etwa 4 freie Auswahlen bei 98 von 100 Punkten. Was
 * eine weitere Auswahl tatsaechlich verletzte, sagt die Meldungsliste, die **jede**
 * Grenze fuehrt (§4.8). Name,
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
function toCapability(node, { resultsByAnchor, effective, unstableNodes, profileTypeRegistry }) {
  const minResult = findResult(resultsByAnchor, node, ConstraintKind.MIN);
  const maxResult = findResult(resultsByAnchor, node, ConstraintKind.MAX);
  return {
    defId: node.def.id,
    targetDefId: resolvedTargetIdOf(node.def),
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
    resultsByAnchor: indexResultsByAnchor(results),
    effective,
    unstableNodes,
    profileTypeRegistry: createProfileTypeRegistry(profileTypes),
  };
  // Der Knoten bleibt **engine-intern**: die Autor-Meldungen brauchen ihn, der
  // Bericht darf ihn nicht tragen (ADR-0034 — die Oberflaeche liest den Bericht
  // und nichts dahinter). Er reist deshalb neben dem Datensatz, nicht in ihm.
  const capabilities = new Map();
  const slots = [];
  for (const node of selectableSlotsOf(root)) {
    const capability = toCapability(node, capabilityContext);
    capabilities.set(pathOf(node), capability);
    slots.push({ node, capability });
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
      ...authorViolationsOf(slots, classificationContext),
    ],
    capabilities,
    diagnostics,
  };
}

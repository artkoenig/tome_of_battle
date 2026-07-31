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
 *   UI-Steuerung: Definitions-ID, **Ankerart**, Rahmen-Bezug, **Herkunft**
 *   (`sourceId` — das Dokument, das die Definition dieses Slots deklariert;
 *   beim Verweis-Slot das des Verweises, nicht das seines Ziels) und
 *   **effektiver** Anzeigename, die **effektiven Kategorie-IDs** samt der effektiven
 *   **Primaerkategorie** (der Anzeige-Bucket nach `set-primary`/`unset-primary`,
 *   `docs/battlescribe-data-format.md` §8), effektives min/max, aktueller
 *   Stand, Restspielraum, die
 *   Pflicht-/Gesperrt-/Versteckt-Flags, das Merkmal „Wert nicht stabil", die
 *   **Autor-Meldungen** des Katalogs und die **Info-Projektion** — die fuer den
 *   Slot geltenden Profile (mit ihren effektiven Merkmalswerten) und Regeltexte
 *   (`infoProjection.js`) sowie die **Kostenprojektion** je Slot — Eigenkosten
 *   einer Instanz (`costs`) und Gesamtkosten des Teilbaums (`totalCosts`,
 *   `costProjection.js`),
 * - **`costTotals`** — die roster-weite Kostensumme je deklarierter Kostenart
 *   (Kosten je Instanz × absolute Anzahl, Modifikatoren angewandt; deklarierte
 *   Kostenarten ohne Vorkommen mit 0, Issue 0121),
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

import { AnchorKind, ConstraintKind, DefinitionKind, ScopeKeyword, isReportableAnchorKind } from './model.js';
import { selectableSlotsOf, pathOf, frameKeyOf } from './evalTree.js';
import { buildCostProjection } from './costProjection.js';
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

/** Ohne deklarierte Kostenarten traegt `costTotals` nur die belegten Vorkommen. */
const NO_DECLARED_COST_TYPES = Object.freeze([]);

/** Ohne Herkunftsindex bleibt die Herkunft jedes Slots unbekannt (`null`). */
const NO_DEFINITION_SOURCES = new Map();

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
 * True, wenn das Ergebnis an einem **synthetischen Kategorie-Anker** haengt:
 * einem Kategorie-Anker (verlinkt wie unverlinkt) oder dem Pflicht-Phantom
 * einer Kategorie-Definition. Nur diese Anker-Familie faellt unter die
 * Entdopplung der Meldungsliste (unten) — belegte Instanz-Anker und die
 * Phantome von Auswahl-Eintraegen behalten ihre Multiplizitaet (eine Grenze am
 * realen Eintrag meldet je Instanz, eine Kontingent-Pflicht je Kontingent).
 */
function isSyntheticCategoryAnchorResult(result) {
  const node = result.anchor;
  if (node.anchorKind === AnchorKind.CATEGORY_ANCHOR) return true;
  return node.anchorKind === AnchorKind.MANDATORY_PHANTOM
    && node.def.kind === DefinitionKind.CATEGORY;
}

/** True, wenn der Anker unmittelbar an der Wurzel haengt (roster-weiter Standort). */
function isRootLevelAnchor(node) {
  return node.parent !== null && node.parent.isRoot === true;
}

/**
 * True fuer das **Wurzel**-Pflicht-Phantom: ein Pflicht-Phantom, das
 * unmittelbar an der Wurzel haengt. Pflicht-Phantome koennen auch in einem
 * Kontingent haengen (Force-Schleife der Synthese) — die zaehlen hier nicht.
 */
function isRootMandatoryPhantom(node) {
  return node.anchorKind === AnchorKind.MANDATORY_PHANTOM && isRootLevelAnchor(node);
}

/**
 * Entdoppelt **armeeweite Kategorie-Grenzen** in der Meldungsliste
 * (`docs/battlescribe-data-format.md` §9.9: dieselbe Pflicht in mehreren Formen
 * wird „ueber die Ziel-Id entdoppelt — genau ein Verstoss").
 *
 * Hintergrund: eine Kategorie mit armeeweiter Grenze ist mehrfach verankert —
 * als Wurzel-Pflicht-Phantom (bei einer MIN-Grenze) **und** an jedem
 * Kategorie-Anker jedes Kontingents, dessen `categoryLink` die Grenzen der
 * Kategorie erbt. Jeder Anker wertet die Grenze gegen dieselbe armeeweite
 * Zaehlung aus; ohne Entdopplung erschiene eine unerfuellte Pflicht 1 + n-mal.
 * Das Urteil ist an jedem Anker identisch — entdoppelt wird deshalb allein
 * **hier**, in der Meldungsliste: die Ergebnisse (und damit die
 * Faehigkeitsdatensaetze aller Kategorie-Slots) bleiben vollstaendig.
 *
 * Die Regel, beschraenkt auf synthetische Kategorie-Anker
 * ({@link isSyntheticCategoryAnchorResult}):
 *
 * - **ROSTER-Rahmen:** je (Grenz-Id, gezaehlte Ziel-Id) ueberlebt genau eine
 *   Meldung — bevorzugt die am Wurzel-Pflicht-Phantom (die Pflicht ist
 *   armeeweit, das Phantom ist ihr roster-weiter Anker), sonst die am ersten
 *   Anker in Dokumentreihenfolge.
 * - **FORCE-Rahmen:** die Meldung gehoert an die Kontingent-Anker (je
 *   Kontingent eine, keine Ueber-Entdopplung). Die Huckepack-Auswertung
 *   derselben Grenze am **Wurzel**-Phantom entfaellt: an der Wurzel loest der
 *   FORCE-Rahmen nicht auf (`query.js` liefert 0 samt Diagnose) — ihre
 *   „Meldung" spraeche fuer kein Kontingent.
 * - Jeder andere Rahmen bleibt unangetastet.
 */
function dedupeArmyWideCategoryViolations(results) {
  const kept = [];
  const survivorIndexByKey = new Map();
  for (const result of results) {
    if (!isSyntheticCategoryAnchorResult(result)) {
      kept.push(result);
      continue;
    }
    const { scope } = result.limit;
    if (scope === ScopeKeyword.FORCE) {
      if (!isRootLevelAnchor(result.anchor)) kept.push(result);
      continue;
    }
    if (scope !== ScopeKeyword.ROSTER) {
      kept.push(result);
      continue;
    }
    const key = `${result.limit.id}\u0000${result.countedTargetId}`;
    const survivorIndex = survivorIndexByKey.get(key);
    if (survivorIndex === undefined) {
      survivorIndexByKey.set(key, kept.length);
      kept.push(result);
    } else if (isRootMandatoryPhantom(result.anchor)
        && !isRootMandatoryPhantom(kept[survivorIndex].anchor)) {
      // Das WURZEL-Phantom schlaegt die Dokumentreihenfolge: es steht im Baum
      // hinter den Kontingenten, ist aber der roster-weite Anker der Pflicht.
      // Ein Pflicht-Phantom **in** einem Kontingent (Force-Schleife der
      // Synthese) zaehlt nicht — sonst ueberlebte es vor dem Wurzel-Phantom.
      kept[survivorIndex] = result;
    }
  }
  return kept;
}

/**
 * True, wenn das Ergebnis am **Pflicht-Phantom einer Auswahl** haengt: einem
 * Pflicht-Phantom, dessen Definition ein Eintrag oder ein `entryLink` ist. Nur
 * diese Anker-Familie faellt unter die Eintrags-Entdopplung (unten) — die
 * Kategorie-Familie hat ihre eigene ({@link dedupeArmyWideCategoryViolations}),
 * belegte Instanz-Anker behalten ihre Multiplizitaet.
 */
function isMandatoryEntryPhantomResult(result) {
  const node = result.anchor;
  return node.anchorKind === AnchorKind.MANDATORY_PHANTOM
    && (node.def.kind === DefinitionKind.ENTRY || node.def.kind === DefinitionKind.ENTRY_LINK);
}

/**
 * Entdoppelt die **Eintrags-Pflicht in beiden Wurzelformen** in der
 * Meldungsliste (`docs/battlescribe-data-format.md` §9.9: „Fuehrte ein Katalog
 * dieselbe Pflicht in beiden Formen, wird sie ueber die Ziel-Id entdoppelt" —
 * Issue 85): traegt ein Katalog denselben Pflicht-Eintrag als
 * Wurzel-`selectionEntry` **und** als Wurzel-`entryLink` darauf, haengen zwei
 * Pflicht-Phantome mit **verschiedenen** Grenz-Ids, die dieselbe fehlende
 * Einheit im selben Rahmen anmahnen. Die Grenz-Id trennt sie, die **gezaehlte
 * Ziel-Id** (`countedTargetId`, beim Link die rohe `targetId` — Link-Ketten
 * sind Issue 0094) vereint sie.
 *
 * Die Regel, beschraenkt auf Pflicht-Phantome von Eintraegen und Links
 * ({@link isMandatoryEntryPhantomResult}): entdoppelt wird nur die zweite
 * Kodierung DERSELBEN Pflicht. Ein Ergebnis entfaellt genau dann, wenn eine
 * ueberlebende Meldung
 *
 *  1. denselben Schluessel (Grenz-Feld, Grenzart, Rahmen, gezaehlte Ziel-Id)
 *     traegt,
 *  2. denselben **effektiven Grenzwert** (`bound`) hat — dieselbe Pflicht hat
 *     je Auswertung denselben Bound, denn §9.9 entdoppelt zwei Kodierungen,
 *     die dasselbe *meinen*; zwei verschiedenwertige `min`-Grenzen sind zwei
 *     Pflichten und melden beide — und
 *  3. an einem **anderen Anker-Knoten** haengt — zwei Grenzen am selben Anker
 *     sind immer verschiedene Grenzen (zwei `<constraint>`-Elemente eines
 *     Eintrags, nie zwei Wurzelformen) und entdoppeln nie, auch nicht als
 *     wertgleiche Duplikate.
 *
 * Es ueberlebt die erste Kodierung in Dokumentreihenfolge. Das **Feld**
 * gehoert in den Schluessel, weil §9.9 nur DIESELBE Pflicht in zwei
 * Kodierungen entdoppelt — gleiches Feld, gleiche Art, gleicher Rahmen,
 * gleiche Ziel-Id. Zwei verschiedenartige Pflichten am selben Ziel im selben
 * Rahmen (Selektions-Minimum `field="selections"` UND Kostenart-Minimum
 * `field="<costTypeId>"`) sind zwei Pflichten und melden zwei Verstoesse.
 * Rahmen-Identitaet ist fuer `scope="roster"` das Roster, fuer `scope="force"`
 * das **Kontingent des Ankers** (`anchor.forceRoot`): dieselbe Pflicht meldet
 * je Kontingent weiterhin einmal, nie ueber Kontingente hinweg entdoppelt.
 * Jeder andere Rahmen bleibt unangetastet (eine `scope="parent"`-Pflicht gilt
 * je Eigentuemer), ebenso ein FORCE-Ergebnis ohne umschliessendes Kontingent —
 * fuer dieses gaebe es keine Rahmen-Identitaet.
 */
function dedupeMandatoryEntryPhantomViolations(results) {
  const kept = [];
  const survivorAnchorByKey = new Map();
  for (const result of results) {
    if (!isMandatoryEntryPhantomResult(result)) {
      kept.push(result);
      continue;
    }
    const { scope } = result.limit;
    let frameKey = null;
    if (scope === ScopeKeyword.ROSTER) {
      frameKey = ScopeKeyword.ROSTER;
    } else if (scope === ScopeKeyword.FORCE && result.anchor.forceRoot !== null) {
      frameKey = frameKeyOf(result.anchor.forceRoot);
    }
    if (frameKey === null) {
      kept.push(result);
      continue;
    }
    const { field } = result.limit;
    const key = `${field.kind}\u0000${field.costTypeId ?? ''}\u0000${result.limit.kind}\u0000${frameKey}\u0000${result.countedTargetId}\u0000${result.bound}`;
    const survivorAnchor = survivorAnchorByKey.get(key);
    if (survivorAnchor === undefined) {
      survivorAnchorByKey.set(key, result.anchor);
      kept.push(result);
    } else if (survivorAnchor === result.anchor) {
      // Kriterium 3: am selben Anker ist es keine zweite Kodierung,
      // sondern eine weitere Grenze — sie bleibt. Alle Ueberlebenden
      // eines Schluessels haengen damit am selben Anker; ein Anker je
      // Schluessel genuegt.
      kept.push(result);
    }
  }
  return kept;
}

/**
 * Die Grenz-Ergebnisse je Knoten und Art (MIN/MAX), **einmal** je Bericht
 * aufgebaut. Ohne diesen Index kostete jeder Slot zwei lineare Suchen ueber alle
 * Ergebnisse — bei einem Baum aus mehreren hundert Slots ein quadratischer Aufwand
 * fuer eine Frage, die eine Zuordnung beantwortet.
 */
function indexResultsByAnchor(results) {
  const index = new Map();
  for (const result of results) {
    let byKind = index.get(result.anchor);
    if (byKind === undefined) {
      byKind = new Map();
      index.set(result.anchor, byKind);
    }
    byKind.set(result.limit.kind, result);
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
 * Die **Definition, auf die ein Verweis-Slot zeigt** — `null`, wenn der Slot kein
 * Verweis ist. Der Kategorie-Anker eines verlinkenden Kontingents traegt den
 * `categoryLink`, nicht die Kategorie; ein Angebots-Anker den `entryLink`, nicht
 * den Eintrag (nur so gelten die am Verweis deklarierten Grenzen). Das *Thema*
 * des Slots ist aber das Ziel — und genau darueber zaehlt ihn auch die
 * Constraint-Schicht. Der Anker einer **unverlinkten** Kategorie traegt die
 * `categoryEntry` selbst und ist kein Verweis: sein Thema ist seine eigene
 * Definitions-ID, sein Ziel bleibt `null`.
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
 * `sourceId` sagt, **woher** der Slot stammt: die Id des Dokuments (`.gst` oder
 * `.cat`), das die Definition dieses Slots deklariert; `null`, wenn das Dokument
 * keine eigene Wurzel-Id traegt. Nachgeschlagen wird `def.id` — bei einem
 * Verweis-Slot also die Id des **Verweises**, nicht die seines Ziels
 * (Link-vor-Ziel): ein `entryLink` in `Vampire Counts.cat` ist ein
 * Vampire-Counts-Angebot, auch wenn sein Ziel woanders steht. Die Regel gilt
 * **uniform** fuer jede Ankerart, Kategorie- und Gruppen-Anker eingeschlossen.
 * Die Oberflaeche filtert damit ihr Angebot nach dem aktiven Armeebuch, ohne in
 * die Katalogdaten hinter dem Bericht zu greifen (ADR-0034).
 * `sortIndex` ist die vom Katalogautor am Slot selbst deklarierte, rein
 * deskriptive Anzeigereihenfolge unter seinen Geschwistern (`null` = keine
 * deklariert) — nach derselben Link-vor-Ziel-Regel wie `sourceId` (Issue 0131).
 * Die Flags sind konsistent zu den ausgewerteten Grenzen: gesperrt am MAX,
 * Pflicht-unerfuellt unter dem MIN, versteckt aus dem effektiven Zustand.
 * `costs`/`totalCosts` kommen aus der Kostenprojektion (`costProjection.js`):
 * die **effektiven** Eigenkosten EINER Instanz (nach Kosten-Modifikatoren, auch
 * an Angebots-Ankern: was EINE Instanz beim Waehlen kosten wuerde) und die
 * Gesamtkosten des Slots im aktuellen Zustand (Eigenkosten × Anzahl plus die
 * `totalCosts` aller Kind-Slots).
 * `categoryIds`/`primaryCategoryId` sind die **effektiven** Kategorie-IDs des
 * Slots und die effektive Primaerkategorie darunter (`null` = keine) — die
 * UI-Einsortierung liest sie aus dem Bericht, nie aus rohen Katalog-Links
 * (§8). Name, Autor-Meldungen und die **Info-Projektion** (`infoElements`: die fuer diesen
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
function toCapability(node, { resultsByAnchor, effective, unstableNodes, profileTypeRegistry, costProjection, sourceIdByDefId }) {
  const minResult = findResult(resultsByAnchor, node, ConstraintKind.MIN);
  const maxResult = findResult(resultsByAnchor, node, ConstraintKind.MAX);
  return {
    defId: node.def.id,
    targetDefId: targetDefIdOf(node),
    // Rein deskriptiv (Issue 0131): die vom Katalogautor empfohlene
    // Geschwister-Reihenfolge des Slots selbst — bei einem Verweis-Slot die
    // des Verweises, nie die seines Ziels (dasselbe Link-vor-Ziel-Prinzip wie
    // bei `sourceId`). `null`, wenn die Definition kein `sortIndex` traegt.
    sortIndex: node.def.sortIndex ?? null,
    // Herkunft nach der **Link-vor-Ziel-Regel**: nachgeschlagen wird `def.id`,
    // also bei einem Verweis-Slot die Id des Verweises, nicht die seines Ziels.
    sourceId: sourceIdByDefId.get(node.def.id) ?? null,
    anchorKind: node.anchorKind,
    frame: frameReferenceOf(node),
    name: effective.nameOf(node),
    costs: costProjection.costsOf(node),
    totalCosts: costProjection.totalCostsOf(node),
    categoryIds: effective.categoryIdsOf(node),
    primaryCategoryId: effective.primaryCategoryIdOf(node),
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
 * @param {{ budgetViolations?: object[], unstableNodes?: Set<object>, profileTypes?: object[], categoryIds?: Set<string>, declaredCostTypeIds?: string[], sourceIdByDefId?: Map<string, string> }} [extras]
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
 *   `declaredCostTypeIds`: die im Datensatz deklarierten Kostenarten — sie
 *   erscheinen in `costTotals` auch ohne Vorkommen, mit 0 (`costProjection.js`).
 *   `sourceIdByDefId`: der Herkunftsindex der Definitionen
 *   (`catalogSet.js`) — je Slot das Dokument, das seine Definition deklariert
 *   (`sourceId`). Fehlt er, bleibt die Herkunft jedes Slots `null`.
 * @returns {{ violations: object[], capabilities: Map<string, object>, costTotals: Record<string, number>, diagnostics: object[] }}
 */
export function buildReport(root, effective, results, diagnostics, extras = {}) {
  const {
    budgetViolations = [],
    unstableNodes = NO_UNSTABLE_NODES,
    profileTypes = NO_PROFILE_TYPES,
    categoryIds = NO_CATEGORY_IDS,
    declaredCostTypeIds = NO_DECLARED_COST_TYPES,
    sourceIdByDefId = NO_DEFINITION_SOURCES,
  } = extras;

  // Einmal je Bericht gebaut, von jedem Slot gelesen — nicht je Slot erneut.
  const costProjection = buildCostProjection(root, effective, declaredCostTypeIds);
  const capabilityContext = {
    resultsByAnchor: indexResultsByAnchor(results),
    effective,
    unstableNodes,
    profileTypeRegistry: createProfileTypeRegistry(profileTypes),
    costProjection,
    sourceIdByDefId,
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
    // Armeeweite Kategorie-Grenzen melden dabei genau **einmal**
    // ({@link dedupeArmyWideCategoryViolations}, §9.9), und die Eintrags-Pflicht
    // in beiden Wurzelformen ebenso ({@link dedupeMandatoryEntryPhantomViolations},
    // §9.9, Issue 85) — die Ergebnisse selbst bleiben vollstaendig, nur die
    // Meldungsliste entdoppelt.
    violations: [
      ...dedupeMandatoryEntryPhantomViolations(dedupeArmyWideCategoryViolations(
        [...results, ...budgetViolations].filter(result => result.isReportable && !result.satisfied),
      )).map(result => toDerivedViolation(result, classificationContext)),
      ...authorViolationsOf(slots, classificationContext),
    ],
    capabilities,
    // Die roster-weite Kostensumme je Kostenart (Kostenprojektion): jede
    // deklarierte Kostenart erscheint — ohne Vorkommen mit 0; Angebots-Anker
    // zaehlen nicht (Issue 0121, Kriterien 1 und 4).
    costTotals: costProjection.costTotals,
    diagnostics,
  };
}

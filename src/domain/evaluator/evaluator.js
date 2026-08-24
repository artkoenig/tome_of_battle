/**
 * Fassade der Reinraum-Auswertungs-Engine (ADR-0030) — seit Issue 0121 die
 * Engine der Anwendung; die Alt-Engine unter `src/solver/` ist abgerissen.
 *
 * Dies ist die **einzige** legale Aussenschnittstelle des `src/domain/evaluator/`-
 * Moduls. Der Zugriff von aussen nur ueber diese Datei und die harte
 * Import-Trennung zum App-Schreibmodell `src/domain/roster/` (in beide Richtungen)
 * sind maschinell durchgesetzt (`.oxlintrc.json`, dazu `.cast/rules.json`).
 *
 * ── Die Fassade ist zweistufig ───────────────────────────────────────────────
 * Sie fuehrt in zwei Schritten:
 *
 *   1. `prepareDataset(datensatz) → aufbereiteter Datensatz` — der
 *      rosterunabhaengige Katalog-Vorlauf (lesen → zusammenfuehren → aufloesen),
 *      **einmal je Datensatz**;
 *   2. `evaluate(aufbereiteter Datensatz, roster) → Bericht` bzw.
 *      `describeDataset(aufbereiteter Datensatz) → Beschreibung` — beliebig oft
 *      gegen dasselbe Ergebnis des ersten Schritts.
 *
 * Das ist kein Vorgriff, sondern das Ergebnis der Messung an echten Katalogdaten
 * (Main-Issue 75, Baustein 8, `scripts/measure-evaluator.js`): der Vorlauf macht
 * **98,9–99,5 %** einer vollstaendigen Auswertung aus — die vorab festgelegte
 * Schwelle lag bei 50 %. Wer denselben Datensatz zweimal auswertet, spart damit
 * praktisch die gesamte Laufzeit der zweiten Auswertung.
 *
 * Der aufbereitete Datensatz ist ein **undurchsichtiger Griff**: der Aufrufer
 * haelt ihn und gibt ihn zurueck, greift aber nicht in ihn hinein. Die Oberflaeche
 * bekommt so keinerlei Kenntnis vom inneren Aufbau der Engine — allein den
 * Bericht (ADR-0034).
 *
 * Die Auswertung bleibt dabei eine reine Funktion
 * `evaluate(aufbereiteter Datensatz, roster) → Bericht` ohne Seiteneffekte: kein
 * App-Zustand, keine UI, kein IndexedDB (`docs/evaluator-architecture.md` §2,
 * Leitprinzip 1). Auch die Beschreibung ohne Roster (ADR-0034) liest denselben
 * einen Vorlauf — es gibt keine zweite Lesart derselben Katalogdaten.
 *
 * ── Die eine Ausnahme: der Mess-Modus ────────────────────────────────────────
 * Beide Schritte nehmen ein **Opt-in-Flag** `{ measure: true }` entgegen. Nur
 * dann stoppt die Engine ihre eigenen Abschnitte und legt das Ergebnis als
 * zusaetzliches Feld `measurement` ab (`measurement.js`, Issue 0138). Ohne das
 * Flag — und ebenso mit leeren Optionen oder `{ measure: false }` — aendert sich
 * nichts: derselbe Rueckgabewert, kein zusaetzliches Feld, kein Zeitgeber. Die
 * Reinheit gilt fuer den Normalpfad also unveraendert weiter; das Flag ist die
 * ausdrueckliche, benannte Ausnahme, und ihr einziger Nutzer ist die
 * Aufwandsmessung (`scripts/measure-evaluator*.js`).
 *
 * Der Datensatz trennt die **einzelne** Spielsystemdatei (`.gst`) strukturell von
 * der **Liste** der Armee-Kataloge (`.cat`) — `{ gameSystem, catalogues }`
 * (ADR-0032). Die deterministische kataloguebergreifende Verarbeitungsreihenfolge
 * (Spielsystem zuerst, dann die Kataloge in Aufruf-Reihenfolge) leitet die Engine
 * selbst ab; sie ist **keine** positionsabhaengige Aufrufer-Konvention.
 */

import { PreparedDataset } from './datasetPreparation.js';
import { buildDatasetDescription, costTypesOf } from './datasetDescription.js';
import { buildEvalTree, synthesizeOfferedSharedMandatoryPhantoms } from './evalTree.js';
import { attachOfferAnchors } from './offer.js';
import { extendBaseEffectiveState } from './effectiveState.js';
import { buildIndex } from './countIndex.js';
import { evaluateToFixpoint, applyAnchorPostPass } from './fixpoint.js';
import { evaluateConstraints, categoryAnchorOccupancies } from './constraints.js';
import { evaluateRosterBudget } from './budget.js';
import { buildReport } from './report.js';
import { buildRaiseCostProjection } from './costProjection.js';
import { createRosterBudget } from './rosterBudget.js';
import { MeasuredPhase, measurementFor } from './measurement.js';

/**
 * Die Abschnitte, die die Engine unter `{ measure: true }` getrennt ausweist —
 * die Namen, unter denen `measurement.phases` sie fuehrt. Sie gehoeren der
 * Engine, nicht dem Messgeraet: es liest sie von hier, statt sie zu setzen
 * (Issue 0138).
 */
export { MeasuredPhase } from './measurement.js';

/**
 * Die Arten der Diagnosen, die der Bericht in `diagnostics` traegt. Sie zu
 * benennen gehoert zum Ausgabe-Vertrag des Berichts: wer eine Diagnose einordnen
 * will (etwa die Aufwandsmessung die Art einer Nichtkonvergenz), braucht dafuer
 * keinen Blick in die Engine.
 */
export { DiagnosticKind } from './model.js';

/**
 * Der **erste Schritt** der Fassade: bereitet einen Datensatz rosterunabhaengig
 * auf (lesen → zusammenfuehren → aufloesen) und liefert das Ergebnis als
 * undurchsichtigen Griff, den {@link evaluate} und {@link describeDataset}
 * entgegennehmen.
 *
 * Einmal je Datensatz aufrufen und das Ergebnis halten, solange der Datensatz
 * gilt: es haengt nicht vom Roster ab und traegt die weit ueberwiegende Last einer
 * Auswertung (siehe Kopf dieser Datei). Aendert sich der Datensatz — ein Katalog
 * kommt hinzu, ein Update wird eingespielt —, wird neu aufbereitet.
 *
 * Der Schritt wird unveraendert durchgereicht, statt hier noch einmal verpackt zu
 * werden: es gibt genau eine Implementierung des Katalog-Vorlaufs. Signatur und
 * Diagnosen sind an ihr dokumentiert
 * ({@link ./datasetPreparation.js prepareDataset}).
 *
 * Er nimmt dasselbe Opt-in-Flag entgegen wie {@link evaluate}: unter
 * `{ measure: true }` traegt der zurueckgegebene Griff seine eigene Dauer als
 * `measurement` (Issue 0138). Ohne das Flag ist er der heutige Griff — eine Sache
 * ohne jede eigene Eigenschaft.
 */
export { prepareDataset } from './datasetPreparation.js';

/**
 * Wertet ein Roster gegen einen **aufbereiteten** Datensatz aus und liefert den
 * Bericht.
 *
 * @param {import('./datasetPreparation.js').PreparedDataset} prepared
 *   Das Ergebnis von {@link prepareDataset} — derselbe Griff darf beliebig oft und
 *   fuer beliebig viele Roster wiederverwendet werden.
 * @param {{ forces?: Array<{ defId: string, count: number, catalogueId?: string|null, children?: object[] }>, costLimits?: Array<{ costTypeId: string, value: number }> }} roster
 *   Das vollstaendige, aus `.ros` geparste Roster: der Instanzbaum (`forces`)
 *   **und** die eingestellten Kostengrenzen je Kostenart (`costLimits`, die
 *   Zuordnung Kostenart → Grenzwert, analog `<costLimits>`). Fehlt `costLimits`,
 *   ist das Budget leer — verhaltensgleich zu einem Roster ohne Kostengrenzen.
 *
 *   **Das Armeebuch eines Kontingents (`catalogueId`).** Ein Knoten der
 *   obersten Ebene — ein Kontingent — darf das Armeebuch nennen, aus dem er
 *   stammt (`catalogueId`-Attribut am `<force>` einer `.ros`, `catalogueId` am
 *   App-Kontingent). Die Angabe ist **optional** und gilt **je Knoten**: zwei
 *   Kontingente derselben Definition duerfen zu verschiedenen Armeebuechern
 *   gehoeren (Verbuendete). Sie **fuellt die Luecke** der Katalogdaten, sie
 *   ueberschreibt sie nicht: steht die Kontingent-Definition selbst in einem
 *   `.cat`, *ist* das Kontingent aus diesem Armeebuch, und eine
 *   anderslautende Angabe des Rosters bleibt unbeachtet. Gelesen wird sie
 *   deshalb genau dort, wo die Katalogdaten schweigen — in einem Datensatz, der
 *   seine Kontingente in der **Spielsystemdatei** deklariert; dort steht in
 *   keiner `.cat` ein `forceEntry`, aus dem sich das Armeebuch ableiten liesse.
 *   Wo sie greift, halten Pflichten und Wurzel-Angebote eines **fremden**
 *   Armeebuchs sich daran (Issue 0098/0140) und der Bezugsrahmen
 *   `primary-catalogue` loest darueber auf. Ohne Angabe — und ebenso bei einer
 *   Katalog-Id, die dieser Datensatz nicht kennt — bleibt es beim
 *   Herkunftsindex; schweigt auch der, wird nicht gefiltert (der Rahmen faellt
 *   offen aus) und `primary-catalogue` bleibt fail-closed unaufgeloest. Wo die
 *   Angabe des Rosters greift, bleibt ein **Bibliothekskatalog** von der
 *   Filterung ausgenommen — der geteilte Soeldner-Vorrat geht dem Kontingent
 *   also nicht verloren —, sofern sein Armeebuch die Bibliothek nicht selbst
 *   per `catalogueLink` benennt; dann gilt dessen `importRootEntries`.
 *
 *   **Identitaets-Regel fuer `defId`.** Eine Auswahl, die ueber einen
 *   `<entryLink>` gesetzt wurde, wird unter der Id des **Verweises** uebergeben
 *   (`entryLinkId` der `.ros`), nicht unter der Id seines Ziels; eine Auswahl
 *   ohne Verweis unter der Id ihres **Eintrags** (`entryId`). Nur unter der
 *   Link-Id gelten die am Verweis deklarierten Grenzen — unter der Ziel-Id
 *   verschwinden sie **still** (die Auswertung bleibt gruen, ohne die Regel
 *   durchzusetzen); bei verschachtelten Verweisen bleibt zudem der Slot des
 *   Verweises als Pflicht-Phantom neben dem belegten Ziel-Slot stehen.
 *   Dieselbe Wahl haelt der Ankervertrag des Berichts
 *   fest: „ein Angebots-Anker den `entryLink`, nicht den Eintrag (nur so
 *   gelten die am Verweis deklarierten Grenzen)" (`report.js`). Diese Regel ist
 *   eine **Entscheidung dieses Projekts**: die Abschnitte *Roster*, *Force* und
 *   *Selection* des BSData-Wikis stehen als TODO, keine Quelle legt fest,
 *   welche Id eine Auswahl identifiziert (`docs/battlescribe-data-format.md`
 *   §15).
 *
 *   **Nicht aufloesbare `defId`.** Eine `defId`, die kein geladenes Dokument
 *   aufloest, ergibt die Diagnose `{ kind: 'unresolvedDefinition', defId }` —
 *   **bewusst ohne Rueckfall** auf die Ziel-Id des Verweises: das Ziel eines
 *   `entryLink` stammt aus demselben Katalog (bzw. per Grundregelwerk-Import
 *   aus der `.gst`), und die Auswahlen eines Kontingents stammen aus einem
 *   einzigen Katalog — ein Roster, das einen Verweis aus einem nicht geladenen
 *   Katalog benennt, war also nie gueltig (`docs/battlescribe-data-format.md`
 *   §7.2, §15). Ein stiller Rueckfall wuerde diesen Datensatz-Fehler als
 *   gueltige Auswertung tarnen.
 * @param {{ measure?: boolean }} [options]
 *   Der **Mess-Modus** als Opt-in (Issue 0138). Nur `{ measure: true }` schaltet
 *   ihn ein; fehlende Optionen, ein leeres Optionsobjekt und `{ measure: false }`
 *   sind der Normalpfad. Er ist die ausdrueckliche Ausnahme zur Reinheit des
 *   Leitprinzips 1 — und eine, die den Normalpfad nicht beruehrt: dort laeuft
 *   kein Zeitgeber und es entsteht kein zusaetzliches Feld.
 * @returns {{ violations: object[], capabilities: Map<string, object>, costTotals: Record<string, number>, diagnostics: object[], measurement?: import('./measurement.js').EvaluationMeasurement }}
 *   Der Bericht: Verletzungen, Faehigkeitsdatensaetze je Slot, die roster-weite
 *   Kostensumme je deklarierter Kostenart (`costTotals`, Issue 0121) und
 *   Diagnosen. Ein Slot ist **jede Stelle, an der eine Auswahl stehen kann** —
 *   auch eine noch nicht gewaehlte (ADR-0035); die Verletzungsliste bleibt davon
 *   unberuehrt.
 *
 *   **`measurement` — nur unter `{ measure: true }`.** Dann traegt der Bericht
 *   **ein** zusaetzliches Feld: die Dauer der drei Abschnitte, die `evaluate`
 *   ausfuehrt (`phases`, benannt nach {@link MeasuredPhase} — die vierte,
 *   `preparation`, faellt in `prepareDataset` an und haengt an dessen Ergebnis),
 *   den Ausgang der Fixpunktschleife (`fixpoint`) und die Knotenzahlen des
 *   Auswertungsbaums (`tree`). Der Bericht selbst bleibt dabei unveraendert — die
 *   Messung aendert kein Ergebnis. Eine Gesamtdauer steht bewusst nicht darin:
 *   Summieren, Median und Schwellen sind Sache des Messgeraets
 *   (`scripts/lib/evaluator-measurement.js`).
 *
 *   **Herkunft eines Slots (`sourceId`).** Jeder Faehigkeitsdatensatz nennt die
 *   `id` des Dokuments (`.gst` oder `.cat`), das die Definition **dieses Slots**
 *   deklariert — `null`, wenn das Dokument keine eigene Wurzel-`id` traegt.
 *   Nachgeschlagen wird die `defId` des Slots, bei einem Verweis-Slot also die
 *   Id des **Verweises**, nicht die seines Ziels: dieselbe Link-vor-Ziel-Regel
 *   wie oben — ein `entryLink` in einem Armeebuch ist ein Angebot **dieses**
 *   Armeebuchs, auch wenn sein Ziel in einem anderen Dokument steht. Die Regel
 *   gilt uniform fuer jede Ankerart. Bei zwei Dokumenten mit derselben
 *   Definitions-Id gewinnt das erste in der Verarbeitungsreihenfolge
 *   (Spielsystem zuerst, dann die Kataloge in Aufruf-Reihenfolge); die
 *   Kollision selbst ist als Diagnose `duplicateDefinition` sichtbar.
 *
 *   **Pfad-Schema der Slot-Schluessel.** Der Schluessel in `capabilities` ist
 *   der stabile Pfad des Slots: die `/`-verkettete Folge der Kind-Indizes von
 *   der Wurzel bis zum Knoten (z. B. `"0/2/1"`; `pathOf` in `evalTree.js`).
 *   Fuer **belegte** Slots folgen diese Indizes der Eingabe-Reihenfolge des
 *   Rosters — `forces[i]` liegt unter `"i"`, dessen j-tes Kind unter `"i/j"`,
 *   usw. —, weil die Engine alle synthetischen Anker (Phantome, Kategorie-,
 *   Gruppen- und Angebots-Anker) ausschliesslich **hinter** die bestehenden
 *   Kinder haengt. Ein Aufrufer darf den Pfad einer Eingabe-Instanz deshalb im
 *   selben Durchlauf mitrechnen. Die Zuordnung gilt nur, solange jede `defId`
 *   aufloest: eine unaufloesbare Instanz wird nicht in den Baum gehaengt
 *   (Diagnose `unresolvedDefinition`) und verschiebt damit die Indizes ihrer
 *   **nachfolgenden** Geschwister.
 */
export function evaluate(prepared, roster, options) {
  // Identitaets-Cache (Issue 0170): derselbe aufbereitete Datensatz und dasselbe
  // Roster-**Objekt** ergeben denselben Bericht, also wird er genau einmal
  // gerechnet und danach unveraendert zurueckgegeben. Zwei WeakMaps ueber
  // Objektidentitaeten halten ihn: aeussere ueber den Datensatz-Griff, innere
  // ueber das Roster; beide halten nichts am Leben, was der Aufrufer nicht
  // ohnehin haelt. Die Funktion bleibt beobachtbar rein — der Bericht haengt an
  // nichts ausser diesen beiden Eingaben.
  //
  // Der **Mess-Modus** geht daran vorbei: `{ measure: true }` will die Laufzeit
  // dieses Laufs sehen, und ein zurueckgegebener Bericht von vorhin haette
  // keine.
  if (options !== undefined && options !== null) return computeReport(prepared, roster, options);
  if (prepared === null || typeof prepared !== 'object'
    || roster === null || typeof roster !== 'object') {
    return computeReport(prepared, roster, options);
  }
  let byRoster = reportsByDatasetAndRoster.get(prepared);
  if (byRoster === undefined) {
    byRoster = new WeakMap();
    reportsByDatasetAndRoster.set(prepared, byRoster);
  }
  const cached = byRoster.get(roster);
  if (cached !== undefined) return cached;
  const report = computeReport(prepared, roster, options);
  byRoster.set(roster, report);
  return report;
}

/**
 * Der Bericht je Paar (aufbereiteter Datensatz, Roster-Objekt).
 *
 * @type {WeakMap<object, WeakMap<object, object>>}
 */
const reportsByDatasetAndRoster = new WeakMap();

/**
 * Der eigentliche Auswertungslauf — alles, was {@link evaluate} beschreibt,
 * ohne den Cache davor.
 *
 * @param {object} prepared
 * @param {object} roster
 * @param {{ measure?: boolean }} [options]
 * @returns {object} der Bericht.
 */
function computeReport(prepared, roster, options) {
  // Der Messschreiber: ohne `{ measure: true }` ist er der Nicht-Messer, der
  // jeden Abschnitt schlicht ausfuehrt und nichts anhaengt (`measurement.js`).
  const measurement = measurementFor(options);

  // Die eingestellten Kostengrenzen des Rosters einmalig als unveraenderliches
  // Budget-Wert-Objekt (SSOT) buendeln und bis in die Query-Kontexte durchreichen.
  // Ausgewertet wird das Budget erst in den Folge-Slices; hier reicht die Fassade
  // es nur verlustfrei durch (leere Grenzen ⇒ unveraendertes Ergebnis).
  const budget = createRosterBudget(roster.costLimits);

  // Der rosterunabhaengige Katalog-Vorlauf ist bereits gelaufen: die Auswertung
  // liest sein Ergebnis, statt die Kataloge erneut zu lesen. Das ist die
  // Wiederverwendung, um derentwillen die Fassade zweistufig ist.
  // `primaryCatalogueByForceDefId` ist der rosterunabhaengige Herkunftsindex der
  // Kontingente: je Kontingent-Definition das Armeebuch, das sie deklariert. Er
  // beantwortet den Bezugsrahmen `primary-catalogue` (Issue 077) und wird — wie
  // das Budget — bis in die Query-Kontexte durchgereicht.
  const contents = PreparedDataset.contentsOf(prepared);
  const {
    resolved, primaryCatalogueByForceDefId, sourceIdByDefId, catalogueScopeClosureById, rootImportClosureById,
    gameSystemDocument, diagnostics: datasetDiagnostics,
  } = contents;

  // Der Katalog-Bezugsrahmen (Issue 0098, Umfang nach Issue 0159): der
  // Auswertungsumfang eines Kontingents ist genau sein Armeebuch, dessen
  // transitive `catalogueLink`-Huelle und das Spielsystem. Er reicht bis in die
  // Baumphase 1 (Pflicht-Phantome und Umfangs-Diagnose, `evalTree.js`) und die
  // Baumphase 2 (Angebot, `offer.js`) hinein, damit eine Definition eines
  // Katalogs ausserhalb dieses Umfangs weder angeboten noch erzwungen wird.
  const catalogueScope = {
    sourceIdByDefId,
    catalogueScopeClosureById,
    // Die engere Huelle daneben: wessen WURZEL-Eintraege dieses Kontingent als
    // eigenes Angebot fuehrt (`importRootEntries`, Issue 0098 Kriterium 3).
    rootImportClosureById,
    gameSystemId: gameSystemDocument?.id ?? null,
  };

  // Die Bibliothekskataloge, aus dem `library`-Kennzeichen der `.cat`-Wurzel:
  // eine Bibliothek ist ein geteilter Vorrat, kein Armeebuch, und darum nie eine
  // *fremde* Herkunft (`SlotCapability.isForeignCatalogue`, Issue 0156).
  const libraryCatalogueIds = new Set(
    contents.catalogueDocuments
      .filter(document => document.isLibrary === true && document.id !== null && document.id !== undefined)
      .map(document => document.id),
  );

  // ── Abschnitt 1: die iterierte Auswertung ─────────────────────────────────
  // Baumphase 1, Fixpunktrunden ueber die realen Knoten, finaler Zaehlindex.
  const { root, joinDiagnostics, effective, fixpointResult, index } =
    measurement.phase(MeasuredPhase.ITERATED_EVALUATION, () => {
      const { root: builtRoot, diagnostics: builtDiagnostics } =
        buildEvalTree(resolved, roster, catalogueScope, primaryCatalogueByForceDefId);

      // Fixpunktschleife: Weil Zaehlen von effektiven Werten abhaengt und Modifikatoren
      // von Zaehlungen, wird iterativ bis zur Konvergenz ausgewertet — jede Runde von
      // einer frischen Basiskopie, mit harter Rundenobergrenze und getrennten Befunden
      // fuer Oszillation und erschoepftes Rundenbudget (§3.5/§4.2). Iteriert wird nur
      // ueber die **realen** Knoten: nur sie gehen in die Zaehlung ein.
      const fixpoint = evaluateToFixpoint(builtRoot, resolved.categoryIds, budget, primaryCatalogueByForceDefId);

      return {
        root: builtRoot,
        joinDiagnostics: builtDiagnostics,
        effective: fixpoint.effective,
        fixpointResult: fixpoint,
        // Finaler, konsistenter Index aus dem konvergierten (bzw. letzten) Stand.
        index: buildIndex(builtRoot, fixpoint.effective),
      };
    });
  const { diagnostics: fixpointDiagnostics, unstableNodes } = fixpointResult;

  // Der Ausgang der Schleife (Rundenzahl, Konvergenz, Art der Nichtkonvergenz)
  // kennt nur sie selbst — aus dem Endzustand ist er nicht zu rekonstruieren.
  // Ausgewiesen wird er allein im Mess-Modus; der Normalpfad verwirft ihn wie bisher.
  measurement.noteFixpoint(fixpointResult);

  // ── Abschnitt 2: der Nach-Durchlauf ───────────────────────────────────────
  const postPassDiagnostics = measurement.phase(MeasuredPhase.POST_PASS, () => {
    // Baumphase 2: die **Angebots-Anker** fuer jede im Bezugsrahmen waehlbare
    // Definition (ADR-0035), angehaengt als Blaetter hinter allen bestehenden
    // Kindern — die Pfade vorhandener Slots bleiben damit unveraendert. Sie
    // entstehen erst hier, weil sie in keinen Zaehlschluessel eingehen und den
    // ausgewerteten Stand deshalb nicht veraendern koennen. Ihre Basiswerte werden
    // in den konvergierten Zustand nachgetragen, damit ihre Grenzen vom Katalogwert
    // aus fortgeschrieben werden und nicht von 0.
    const offerAnchors = attachOfferAnchors(root, resolved, catalogueScope, primaryCatalogueByForceDefId);
    // Baumphase 2.5 (Issue 0154): die Pflicht-Phantome der **geteilten**
    // Definitionen, die dieser Roster tatsaechlich anbietet. Sie kann erst hier
    // laufen — „wird das hier ueberhaupt angeboten?" beantwortet der Baum erst
    // mit seinen Angebots-Ankern — und ihre Anker gehen denselben Weg wie diese:
    // ohne Instanz, ohne Zaehlbeitrag, mit Basiswerten aus demselben
    // Nach-Durchlauf.
    const sharedMandatoryPhantoms = synthesizeOfferedSharedMandatoryPhantoms(
      root, resolved, catalogueScope, primaryCatalogueByForceDefId,
    );
    extendBaseEffectiveState(effective, [...offerAnchors, ...sharedMandatoryPhantoms]);

    // Nach-Durchlauf: die synthetischen Anker — die aus Phase 1 wie die eben
    // angehaengten — bekommen ihre effektiven Werte in **einem** Durchlauf gegen
    // diesen finalen Index. Sie zaehlen nie mit, koennen also nicht zurueckwirken —
    // der Index wird danach nicht erneut gebaut.
    return applyAnchorPostPass(root, index, effective, resolved.categoryIds, budget, primaryCatalogueByForceDefId);
  });

  // Die Knotenzahlen des fertigen Baums — erst jetzt vollstaendig, weil die
  // Angebots-Anker eben angehaengt wurden. Bewusst **ausserhalb** der gestoppten
  // Abschnitte: das Zaehlen ist Messung, nicht Auswertung, und darf keinen
  // Abschnitt verlaengern, den es ausweist.
  measurement.noteTree(root);

  // ── Abschnitt 3: Grenzen und Bericht ──────────────────────────────────────
  const report = measurement.phase(MeasuredPhase.CONSTRAINTS_AND_REPORT, () => {
    const constraintDiagnostics = [];
    const results = evaluateConstraints(
      root, index, effective, resolved.categoryIds, constraintDiagnostics, budget, primaryCatalogueByForceDefId,
    );

    // Die Belegung je Kategorie-Anker — hier gezaehlt und nicht erst im Bericht,
    // damit ihre Query-Diagnosen in dieselbe Liste fliessen wie die der Grenzen,
    // die unten zusammengestellt wird.
    const anchorOccupancies = categoryAnchorOccupancies(
      root, index, effective, resolved.categoryIds, constraintDiagnostics, budget, primaryCatalogueByForceDefId,
    );

    // Engine-allgemeine Regel „Armee zu teuer": je eingestellter Kostengrenze die am
    // ROSTER-Rahmen verplante Summe (aus dem schon gebauten Zaehlindex) gegen ihre
    // Grenze. Ueberschreitungen fliessen als roster-weite Budget-Verletzungen in
    // dieselbe eine `violations`-Liste des Berichts.
    const budgetViolations = evaluateRosterBudget(index, budget);

    // The raise cost per slot (`SlotCapability.raiseCosts`) and, from the same
    // walk, its mandatory members (`SlotCapability.raiseMembers`): what putting
    // this slot on the table would cost and which children it would have to
    // create with it. Built HERE and not in the report layer,
    // because it needs the count index and the query context that only this
    // facade holds — and AFTER the constraint phase, so the ordering shows on
    // the code that it can feed nothing back into what was already evaluated.
    const raiseCostProjection = buildRaiseCostProjection(root, effective, {
      index,
      categoryIds: resolved.categoryIds,
      budget,
      primaryCatalogueByForceDefId,
    });

    const diagnostics = [
      ...datasetDiagnostics,
      ...joinDiagnostics,
      ...fixpointDiagnostics,
      ...postPassDiagnostics,
      ...constraintDiagnostics,
    ];

    // `profileTypes` liefert die Klartext-Namen von Profiltyp und Charakteristik-Typ
    // fuer die Info-Projektion je Slot — die Deklarationen des Datensatzes sind ihre
    // einzige Quelle (`infoProjection.js`). `publications` liefert ebendort den
    // Klartext-Namen des Buchs hinter einer `publicationId` (Issue 0102).
    // `categoryIds` ist dieselbe Menge, an der
    // das Query-Primitiv einen ID-Bezugsrahmen aufloest; die Einordnung einer
    // Verletzung liest daran ab, ob deren Rahmen eine Kategorie oder ein Eintrag ist.
    // `declaredCostTypeIds` sind die Kostenart-Deklarationen des Datensatzes —
    // dieselbe eine Leseart wie in der Datensatz-Beschreibung (`costTypesOf`). Die
    // Kostenprojektion des Berichts fuehrt jede davon in `costTotals`, auch ohne
    // Vorkommen (Issue 0121). `sourceIdByDefId` ist der Herkunftsindex der
    // Definitionen aus demselben Vorlauf — je Slot das Dokument, das seine
    // Definition deklariert (`SlotCapability.sourceId`).
    return buildReport(root, effective, results, diagnostics, {
      budgetViolations,
      unstableNodes,
      profileTypes: resolved.profileTypes,
      publications: resolved.publications,
      categoryIds: resolved.categoryIds,
      declaredCostTypeIds: costTypesOf(contents).map(costType => costType.id),
      sourceIdByDefId,
      categoryAnchorOccupancies: anchorOccupancies,
      raiseCostProjection,
      // Der Katalog-Bezugsrahmen, so weit der Bericht ihn braucht: aus ihm
      // entscheidet sich je Slot, ob seine Herkunft ein **fremdes** Armeebuch
      // ist (`SlotCapability.isForeignCatalogue`, Issue 0156).
      libraryCatalogueIds,
      gameSystemId: catalogueScope.gameSystemId,
      primaryCatalogueByForceDefId,
      // Die Dokumente des Datensatzes, fuer den einen Rueckfall der
      // Info-Projektion: ein Slot ohne jeden Regeltext nimmt die gleichnamige
      // Regel seines eigenen Katalogs (Issue 0173, `infoProjection.js`).
      documents: gameSystemDocument === null
        ? contents.catalogueDocuments
        : [gameSystemDocument, ...contents.catalogueDocuments],
    });
  });

  // Das eine zusaetzliche Feld `measurement` — nur im Mess-Modus. Ohne das Flag
  // geht der Bericht unveraendert durch, mit genau den heutigen vier Feldern.
  return measurement.attachTo(report);
}

/**
 * Beschreibt einen Datensatz **ohne Roster**: welche Kostenarten er mit welchem
 * Klartext-Namen kennt, welche Kataloge spielbar und welche reine Bibliotheken
 * sind, und welche Kontingente sich anlegen lassen (ADR-0034).
 *
 * Diese Fragen stellen sich, *bevor* ein Roster existiert — es gibt fuer sie also
 * weder Slot noch Faehigkeitsdatensatz. Weil ihre Antwort in den Katalogdaten
 * steht, beantwortet sie die Engine. Sie zaehlt dabei nichts und wertet keine
 * Grenze aus; wer eine Aussage ueber einen konkreten Bestand braucht, wertet mit
 * {@link evaluate} aus.
 *
 * @param {import('./datasetPreparation.js').PreparedDataset} prepared
 *   Derselbe aufbereitete Datensatz wie bei {@link evaluate} — Beschreibung und
 *   Auswertung teilen sich denselben einen Vorlauf.
 * @returns {{ costTypes: object[], catalogues: object[], creatableForces: object[], diagnostics: object[] }}
 *   Die Beschreibung samt der Diagnosen des Katalog-Vorlaufs — ein Katalogfehler
 *   (fehlende Abhaengigkeit, nicht passendes Spielsystem, doppelte oder baumelnde
 *   Verweise) wird auch ohne Roster sichtbar und nie still verschluckt.
 */
export function describeDataset(prepared) {
  return buildDatasetDescription(PreparedDataset.contentsOf(prepared));
}

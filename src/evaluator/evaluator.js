/**
 * Fassade der Reinraum-Auswertungs-Engine (ADR-0030) — seit Issue 0121 die
 * Engine der Anwendung; die Alt-Engine unter `src/solver/` ist abgerissen.
 *
 * Dies ist die **einzige** legale Aussenschnittstelle des `src/evaluator/`-
 * Moduls. Der Zugriff von aussen nur ueber diese Datei und die harte
 * Import-Trennung zum App-Schreibmodell `src/roster/` (in beide Richtungen)
 * sind maschinell durchgesetzt (`.oxlintrc.json`, `.dependency-cruiser.cjs`).
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
 * Der Datensatz trennt die **einzelne** Spielsystemdatei (`.gst`) strukturell von
 * der **Liste** der Armee-Kataloge (`.cat`) — `{ gameSystem, catalogues }`
 * (ADR-0032). Die deterministische kataloguebergreifende Verarbeitungsreihenfolge
 * (Spielsystem zuerst, dann die Kataloge in Aufruf-Reihenfolge) leitet die Engine
 * selbst ab; sie ist **keine** positionsabhaengige Aufrufer-Konvention.
 */

import { PreparedDataset } from './datasetPreparation.js';
import { buildDatasetDescription, costTypesOf } from './datasetDescription.js';
import { buildEvalTree } from './evalTree.js';
import { attachOfferAnchors } from './offer.js';
import { extendBaseEffectiveState } from './effectiveState.js';
import { buildIndex } from './countIndex.js';
import { evaluateToFixpoint, applyAnchorPostPass } from './fixpoint.js';
import { evaluateConstraints } from './constraints.js';
import { evaluateRosterBudget } from './budget.js';
import { buildReport } from './report.js';
import { createRosterBudget } from './rosterBudget.js';

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
 */
export { prepareDataset } from './datasetPreparation.js';

/**
 * Wertet ein Roster gegen einen **aufbereiteten** Datensatz aus und liefert den
 * Bericht.
 *
 * @param {import('./datasetPreparation.js').PreparedDataset} prepared
 *   Das Ergebnis von {@link prepareDataset} — derselbe Griff darf beliebig oft und
 *   fuer beliebig viele Roster wiederverwendet werden.
 * @param {{ forces?: Array<{ defId: string, count: number, children?: object[] }>, costLimits?: Array<{ costTypeId: string, value: number }> }} roster
 *   Das vollstaendige, aus `.ros` geparste Roster: der Instanzbaum (`forces`)
 *   **und** die eingestellten Kostengrenzen je Kostenart (`costLimits`, die
 *   Zuordnung Kostenart → Grenzwert, analog `<costLimits>`). Fehlt `costLimits`,
 *   ist das Budget leer — verhaltensgleich zu einem Roster ohne Kostengrenzen.
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
 * @returns {{ violations: object[], capabilities: Map<string, object>, costTotals: Record<string, number>, diagnostics: object[] }}
 *   Der Bericht: Verletzungen, Faehigkeitsdatensaetze je Slot, die roster-weite
 *   Kostensumme je deklarierter Kostenart (`costTotals`, Issue 0121) und
 *   Diagnosen. Ein Slot ist **jede Stelle, an der eine Auswahl stehen kann** —
 *   auch eine noch nicht gewaehlte (ADR-0035); die Verletzungsliste bleibt davon
 *   unberuehrt.
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
export function evaluate(prepared, roster) {
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
    resolved, primaryCatalogueByForceDefId, sourceIdByDefId, catalogueRootEntryClosureById,
    gameSystemDocument, diagnostics: datasetDiagnostics,
  } = contents;

  // Der Katalog-Bezugsrahmen (Issue 0098): welche Herkunft zu welchem
  // Kontingent-Katalog gehoert. Reicht bis in die Baumphase 1 (Pflicht-Phantome,
  // `evalTree.js`) und die Baumphase 2 (Angebot, `offer.js`) hinein, damit ein
  // Wurzel-Eintrag oder ein roster-skopiertes Pflicht-Minimum eines fremden
  // Katalogs weder angeboten noch erzwungen wird.
  const catalogueScope = {
    sourceIdByDefId,
    catalogueRootEntryClosureById,
    gameSystemId: gameSystemDocument?.id ?? null,
  };

  const { root, diagnostics: joinDiagnostics } = buildEvalTree(resolved, roster, catalogueScope, primaryCatalogueByForceDefId);

  // Fixpunktschleife: Weil Zaehlen von effektiven Werten abhaengt und Modifikatoren
  // von Zaehlungen, wird iterativ bis zur Konvergenz ausgewertet — jede Runde von
  // einer frischen Basiskopie, mit harter Rundenobergrenze und getrennten Befunden
  // fuer Oszillation und erschoepftes Rundenbudget (§3.5/§4.2). Iteriert wird nur
  // ueber die **realen** Knoten: nur sie gehen in die Zaehlung ein.
  const { effective, diagnostics: fixpointDiagnostics, unstableNodes } =
    evaluateToFixpoint(root, resolved.categoryIds, budget, primaryCatalogueByForceDefId);

  // Finaler, konsistenter Index aus dem konvergierten (bzw. letzten) Stand.
  const index = buildIndex(root, effective);

  // Baumphase 2: die **Angebots-Anker** fuer jede im Bezugsrahmen waehlbare
  // Definition (ADR-0035), angehaengt als Blaetter hinter allen bestehenden
  // Kindern — die Pfade vorhandener Slots bleiben damit unveraendert. Sie
  // entstehen erst hier, weil sie in keinen Zaehlschluessel eingehen und den
  // ausgewerteten Stand deshalb nicht veraendern koennen. Ihre Basiswerte werden
  // in den konvergierten Zustand nachgetragen, damit ihre Grenzen vom Katalogwert
  // aus fortgeschrieben werden und nicht von 0.
  const offerAnchors = attachOfferAnchors(root, resolved, catalogueScope, primaryCatalogueByForceDefId);
  extendBaseEffectiveState(effective, offerAnchors);

  // Nach-Durchlauf: die synthetischen Anker — die aus Phase 1 wie die eben
  // angehaengten — bekommen ihre effektiven Werte in **einem** Durchlauf gegen
  // diesen finalen Index. Sie zaehlen nie mit, koennen also nicht zurueckwirken —
  // der Index wird danach nicht erneut gebaut.
  const postPassDiagnostics =
    applyAnchorPostPass(root, index, effective, resolved.categoryIds, budget, primaryCatalogueByForceDefId);

  const constraintDiagnostics = [];
  const results = evaluateConstraints(
    root, index, effective, resolved.categoryIds, constraintDiagnostics, budget, primaryCatalogueByForceDefId,
  );

  // Engine-allgemeine Regel „Armee zu teuer": je eingestellter Kostengrenze die am
  // ROSTER-Rahmen verplante Summe (aus dem schon gebauten Zaehlindex) gegen ihre
  // Grenze. Ueberschreitungen fliessen als roster-weite Budget-Verletzungen in
  // dieselbe eine `violations`-Liste des Berichts.
  const budgetViolations = evaluateRosterBudget(index, budget);

  const diagnostics = [
    ...datasetDiagnostics,
    ...joinDiagnostics,
    ...fixpointDiagnostics,
    ...postPassDiagnostics,
    ...constraintDiagnostics,
  ];

  // `profileTypes` liefert die Klartext-Namen von Profiltyp und Charakteristik-Typ
  // fuer die Info-Projektion je Slot — die Deklarationen des Datensatzes sind ihre
  // einzige Quelle (`infoProjection.js`). `categoryIds` ist dieselbe Menge, an der
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
    categoryIds: resolved.categoryIds,
    declaredCostTypeIds: costTypesOf(contents).map(costType => costType.id),
    sourceIdByDefId,
  });
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

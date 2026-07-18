# BattleScribe-XSD als vendored Konformitätsquelle

- **Status:** Accepted
- **Datum:** 2026-07-18
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** ergänzt ADR-0014 (Laufzeit-Abruf der Kataloge aus dem Fork)

## Kontext und Problemstellung

Parser und Evaluator unterstützen das BattleScribe-Format bislang nur so weit, wie
die zufällig importierten WHFB6-Daten es ausreizen. Eine Gegenüberstellung von
Code und offizieller `Catalogue.xsd` (v2.03, [BSData/schemas](https://github.com/BSData/schemas))
ergab 9 bestätigte Abweichungen (falsch/gar nicht geparste Attribute, verworfene
`modifierGroup`-Bedingungen, unbehandelte Modifier-Typen, ignorierte `infoGroups`).
Da Kataloge seit ADR-0014 **zur Laufzeit** aus einem Community-Fork geladen werden,
kann jede schema-gültige Datei jedes dieser Konstrukte enthalten — die App muss das
Format also **generisch** unterstützen, nicht nur die heute vorliegenden Daten.

Die XSD ist die einzige **offizielle, formale** Beschreibung der Format-Struktur.
Sie beschreibt jedoch nur Grammatik, nicht Semantik (kein `keyref`; `targetId` ist
ein blanker String) — referentielle Integrität und Auswertungssemantik bleiben
Sache des Engine-Verhaltens (`wham`) und der bestehenden Tests.

## Entscheidungsfaktoren (Drivers)

- **Korrektheit** auf beliebigen schema-gültigen Dateien statt nur auf WHFB6.
- **Wartbarkeit:** Die 9 Bugs entstanden durch Drift zwischen handgepflegten
  String-Literalen und dem echten Format. Diese Drift-Klasse soll dauerhaft
  verschwinden.
- **Robustheit beim Import:** Fehlerhafte Daten sollen früh und eindeutig scheitern,
  nicht still fehlverarbeitet werden.
- **Offline-/Reproduzierbarkeit:** Die PWA hat kein Backend; Build und Laufzeit
  dürfen nicht von einem Netz-Abruf der XSD abhängen.

## Betrachtete Optionen

- **XSD-Bezug:** (1) XSD ins Repo vendoren+pinnen · (2) zur Build-/Laufzeit von
  GitHub abrufen.
- **Enums/Attributnamen als SSOT:** (1) Codegen aus der vendored XSD in ein
  committetes Modul + Guard-Check · (2) handgeschrieben + Test-Guard gegen die XSD
  · (3) weiter handgepflegt ohne Absicherung.
- **Import-Validierung:** (1) Hard-Gate (ablehnen) mit `xmllint-wasm` · (2) advisory
  (warnen, weiterparsen) · (3) keine In-App-Validierung, nur auf die Fork-CI
  (`check-datafiles`) vertrauen.

## Entscheidungsergebnis

- **Vendoring:** Die `Catalogue.xsd` (v2.03) wird **versioniert ins Repo gepinnt**.
  Dieselbe Datei bedient — per Namespace-Tausch (`catalogue`/`gameSystem`/`roster`)
  — Codegen **und** Laufzeit-Validierung.
- **SSOT:** **Codegen** — `npm run generate:schema` erzeugt ein **committetes**
  Enum-/Attributnamen-Modul aus der vendored XSD; ein Guard-Check erzwingt
  „committed == aus XSD generiert". Parser/Evaluator konsumieren ausschließlich
  dieses Modul.
- **Import-Validierung:** **Advisory** — jede importierte `.cat`/`.gst` wird vor
  dem Parsen mit **`xmllint-wasm`** (libxml2→WASM) gegen die vendored XSD validiert;
  bei Schemaverstoß wird der Import **nicht abgelehnt, sondern fortgesetzt** und der
  Verstoß als maschinell verortbare **Warnung** (Datei + Element/Zeile) sichtbar
  gemacht. Gilt auch für den Laufzeit-Fork-Abruf.

  **Revision 2026-07-18 (ersetzt die ursprüngliche „Hard-Gate"-Wahl):** Eine
  empirische Prüfung der eingefrorenen Echtdaten ergab, dass 2 von 4 produktiv
  genutzten Katalogen die strikte `xs:sequence`-Ordnung der offiziellen XSD
  verletzen (Element-Reihenfolge, condition-Platzierung), obwohl die App sie heute
  korrekt lädt und rendert. Der reale BSData-Validator ist `wham publish`, nicht
  reine XSD-Prüfung; BattleScribe/newrecruit sind toleranter. Ein striktes
  Hard-Gate ist damit strenger als das reale Ökosystem und würde funktionierende
  Fremdkataloge fälschlich ablehnen — im Widerspruch zum Ziel „Format generisch
  unterstützen". Daher Advisory (melden) statt Ablehnung.

  **Revision 2026-07-18 (Sichtbarkeit der Advisory-Warnung: UI-Box → Konsolen-Log):**
  Die Warnung wird nicht mehr als sichtbare Box im Importer gerendert, sondern nur
  noch per `console.warn` protokolliert (analog zum Muster in
  `updateSystemFromCatalogIndex`). Die verortbare Nachricht (Datei + Zeile) bleibt
  unverändert; nur ihr Ausgabekanal wechselt. Grund: Das Mitschleifen der Warnung im
  React-State über die Sicht-Transition hinweg verursachte beim Erstimport (leerer
  Zustand → Heerlager) einen sichtbaren Zwischen-Frame, in dem der bereits geleerte
  Importer samt Warnungs-/Erfolgsbox aufblitzte, bevor die Heerlager-Ansicht griff.
  Der Import bleibt advisory (schema-abweichende Dateien werden weiterhin importiert,
  nie abgelehnt); ausschließlich die **Sichtbarkeit** der Warnung ändert sich von
  „UI-Box" auf „Konsole".

Die Advisory-Prüfung meldet **strukturelle** Abweichungen; die BSData-Regel
„erlauben schlägt verbieten" betrifft **Roster-Bau-Constraints** (Semantik) —
verschiedene Ebenen, kein Widerspruch.

### Konsequenzen (Auswirkungen)

- **Positiv:** Vollständige, generische Formatunterstützung; die Drift-Klasse hinter
  den 9 Bugs ist strukturell ausgeschlossen; strukturelle Abweichungen werden beim
  Import eindeutig und verortbar gemeldet, ohne funktionierende Daten zu blockieren.
- **Negativ:** Neue Laufzeit-Dependency (`xmllint-wasm`, WASM-Asset) und ein
  Codegen-Build-Schritt. Die Advisory-Prüfung blockiert keinen Import, kann aber bei
  toleranzbedürftigen Echtdaten viele Warnungen erzeugen — bewusst in Kauf genommen,
  da Ablehnung funktionierende Daten bräche. Die Fork-CI (`check-datafiles`) bleibt
  die Stelle, an der Konformität tatsächlich erzwungen wird.
- **Neutral:** Semantische/referentielle Korrektheit bleibt außerhalb der XSD und
  weiter durch `wham`-Verhalten + Tests abgedeckt. Bindung an Formatversion **2.03**;
  ein Versions-Sprung bedeutet bewusstes Nachziehen der vendored XSD.

---
Status: accepted
---

# Der Reinraum-Evaluator löst Mehr-Katalog-Datensätze (`.gst` + Liste von `.cat`) global-by-ID auf

> **Nachtrag (Issue 0205, 2026-08-26).** Die Pfade unter `src/domain/` unten sind historisch: seit [ADR-0042](0042-schnitt-nach-fachlichkeit-bounded-contexts-und-ports.md) gibt es weder `src/domain/` noch `src/data/`, `src/domain/evaluator/` liegt seitdem als `src/contexts/ruleengine/engine/`, `src/domain/roster/` als `src/contexts/armylist/model/`. Die hier festgehaltene Entscheidung bleibt davon unberührt.

ADR-0030 und ADR-0031 haben die katalogübergreifende Auflösung des Evaluators
(`src/domain/evaluator/`) bewusst ausgeklammert: die Fassade `evaluate(catalogXml, roster)`
nahm genau **einen** Katalog-XML-String, und der Resolver löste nur die direkt
unter der Wurzel stehenden Einträge auf. Per Verweis oder Import bezogene
Definitionen — `entryLink`, `infoLink`, `sharedSelectionEntries` und
`catalogueLink` — sowie die Spielsystemdatei (`.gst`) blieben außen vor und
wurden nur als Diagnose gemeldet. Damit war kein echtes, vollständiges Datenset
auswertbar. Diese Grenze war in beiden ADRs als künftige Arbeit vermerkt.

## Kontext (an echten Definitive-Edition-Daten verifiziert)

Ein reales WHFB6-Datenset besteht aus `.gst` plus `.cat`-Katalogen
([BSData-Doku](../battlescribe-data-format.md) §2, §6). In der Definitive Edition
(`artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition`, Upstream Lexicanum
Imperialis) deklariert **jeder** der 17 Armee-Kataloge genau **einen**
`catalogueLink` auf eine gemeinsame `Mercenaries`-`.cat`; Mercenaries selbst hängt
von keinem weiteren Katalog ab (Stern-Struktur). Beispiel Ogre Kingdoms: von 244
eindeutigen `targetId`s lösen **41 ausschließlich** über die Mercenaries-`.cat`
auf. `catalogueLink`/`.cat`→`.cat` ist damit real und für jede Armee zwingend.

Über `.gst` + Ogre + Mercenaries zusammengeführt treten keine ID-Kollisionen auf
(zur ID-Semantik und ihrer Bedingung siehe [BSData-Doku](../battlescribe-data-format.md)
§3.1/§3.2); alle Verweise lösen über eine einzige flache Symboltabelle auf.

## Entscheidung

1. **Fassade nimmt eine `.gst` + eine Liste von `.cat`.** Die öffentliche
   Auswertungsfunktion nimmt ein Datenset entgegen, das die einzelne
   Spielsystemdatei strukturell von der Liste der Armee-Kataloge trennt (eine
   `.gst`, ein oder mehrere `.cat`). Die deterministische katalogübergreifende
   Verarbeitungsreihenfolge (Spielsystem zuerst, dann die Kataloge) leitet die
   Engine selbst ab — sie ist **keine** positionsabhängige Aufrufer-Konvention.
   Die konkrete Signatur-Form ist Implementierungsdetail.

2. **Auflösung ist global-by-ID, nicht der Kontext-Stack.** Alle mitgegebenen
   Quellen werden in eine einzige globale `id→Definition`-Symboltabelle gemischt;
   `entryLink`/`infoLink`/`catalogueLink`-Ziele lösen darüber als gewöhnlicher
   Lookup auf (transitiv, zyklen-sicher). Der in der Architektur (§3.1)
   beschriebene Kontext-Stack (lokal → Importe → Spielsystem) wird **nicht**
   gebaut: er ist nur bei mehrdeutigen IDs über importierende Kataloge nötig, was
   die disjunkten GUIDs ausschließen (YAGNI). `catalogueLink` wird deshalb als
   **Abhängigkeits-Deklaration** behandelt, nicht als eigener
   Auflösungsmechanismus — ~~weil alle benötigten Kataloge gemeinsam als Quellen
   übergeben werden~~. *(Diese Begründung ist mit Issue 0159 widerrufen — siehe
   den [Nachtrag](#nachtrag-issue-0159--der-cataloguelink-ist-die-umfangsgrenze-eines-armeebuchs)
   unten. Die globale Symboltabelle bleibt; was ein Kontingent aus ihr erreicht,
   ist es nicht mehr.)*

3. **Kohärenz wird als Diagnose gemeldet, nie still fehlausgewertet.** Ein
   Katalog, dessen `gameSystemId` nicht zur mitgegebenen `.gst` passt, und ein
   `catalogueLink`, dessen Ziel-Katalog nicht unter den mitgegebenen Quellen ist,
   erzeugen je eine Diagnose (`GAMESYSTEM_MISMATCH` bzw.
   `MISSING_CATALOGUE_DEPENDENCY`) statt einer stillen Teil-Auswertung. Ein trotz
   Auflösung unauflösbarer Verweis bleibt Diagnose, nie Absturz.

Der bestehende disjunktheits-Guard des Resolvers meldet eine echte ID-Kollision
weiterhin als Diagnose — der Sicherheitsnetz für den Fall, dass ein künftiger
Datensatz die GUID-Disjunktheit verletzt.

## Konsequenzen

- **Positiv:** Echte, vollständige Datensätze der Definitive Edition sind
  auswertbar, wie der Nutzer sie beim Import erlebt — inklusive der realen
  Mercenaries-Abhängigkeit. Die eine Fassaden-Naht ist explizit und
  reihenfolge-robust; ein mehrdeutig sortierter Aufruf kann die Modifikator-
  Semantik nicht mehr still kippen. Die katalogübergreifende Auflösung fügt sich
  in das bestehende globale `byId`-Modell des Resolvers ein, ohne dessen
  Ein-Katalog-Signatur zu brechen.
- **Negativ:** Die Fassaden-Signatur ändert sich (~12 Aufrufstellen, überwiegend
  Tests, werden mechanisch angepasst). Global-by-ID ist nur korrekt, solange die
  IDs katalogübergreifend disjunkt sind; bei kollidierenden IDs müsste der
  Kontext-Stack nachgezogen werden (durch die Kollisions-Diagnose sichtbar).
- **Neutral:** Der Evaluator bleibt gemäß ADR-0030 von der zweiten Engine isoliert
  und ist zum Zeitpunkt dieser Entscheidung nicht in die App verdrahtet. Die harte
  Import-Isolation ist unberührt. *(Stand nach Issue 0121, 2026-07-30: verdrahtet
  ist er inzwischen — die Oberfläche liest ausschließlich seinen Bericht. Die
  Import-Isolation läuft seither gegen das Schreibmodell `src/domain/roster/`.)* Der
  vollständige Kontext-Stack-Aufbau bleibt bewusst ungebaut, bis ein realer
  Datensatz ihn erzwingt.

## Nachtrag (Issue 0159) — der `catalogueLink` ist die Umfangsgrenze eines Armeebuchs

**Status des Nachtrags:** akzeptiert, 2026-08-20. Er ändert Entscheidung 2 nicht
in ihrem Kern (die Auflösung bleibt global-by-ID über eine flache
Symboltabelle), widerruft aber ihre Begründung und die daraus gezogene
Folgerung.

**Widerrufen ist:** „`catalogueLink` ist bloß eine Abhängigkeits-Deklaration,
weil alle benötigten Kataloge gemeinsam als Quellen übergeben werden." Der Satz
verwechselt zwei Fragen. Dass ein Katalog als Quelle **mitgegeben** ist, sagt,
dass die Engine ihn lesen kann. Dass ein Armeebuch ihn **verlinkt**, sagt, dass
seine Inhalte zu diesem Armeebuch gehören. Der Datensatz eines Nutzers enthält
alle 18 Bücher einer Edition; ohne die zweite Frage lieferte jedes Buch jedem
anderen Definitionen und Angebote — ein Vampirfürsten-Kontingent bekam
Angebote, die nur die Oger-Kataloge deklarieren.

**Es gilt seither:** Ein `catalogueLink` ist die **Umfangs- und
Auflösungsgrenze** eines Armeebuchs. Der Auswertungsumfang eines Kontingents ist
genau

1. sein Armeebuch (`forceEntry`-Herkunft aus den Katalogdaten, ersatzweise die
   Angabe des Rosters),
2. dessen **transitive** `catalogueLink`-Hülle und
3. das Spielsystem.

Eine Definition aus einem Katalog außerhalb davon erreicht dieses Kontingent
nicht — weder als Angebot noch als Pflicht —, gleich ob der Katalog eine
Bibliothek ist und gleich, woher die Antwort auf „welches Armeebuch?" stammt.
Damit entfällt ersatzlos die frühere Ausnahme, die einen Wurzel-`entryLink`
unabhängig von seinem deklarierenden Katalog als Angebot verankerte: was ein
Buch aus einer geteilten Bibliothek anbieten will, verlinkt es — und dann liegt
sie in seiner Hülle. Ebenso entfällt die pauschale Bibliotheks-Ausnahme aus
Issue 0140.

**Unberührt bleibt `importRootEntries`.** Die Hülle sagt, welche Definitionen
ein Kontingent erreichen; `importRootEntries` sagt, wessen **Wurzel**-Einträge es
als eigenes Angebot führt (XSD-Vorgabe `false`). Ein ohne dieses Attribut
verlinkter Bibliothekskatalog liegt also im Umfang — seine geteilten Einträge
sind über `entryLink`s erreichbar —, sein Wurzel-Angebot bleibt aber sein
eigenes. Beide Hüllen stehen nebeneinander in `src/domain/evaluator/catalogSet.js`
(`buildCatalogueScopeClosure` / `buildRootImportClosure`).

**Unberührt bleibt auch Entscheidung 3:** ein `catalogueLink` ohne mitgegebenen
Ziel-Katalog ist weiterhin die Diagnose `MISSING_CATALOGUE_DEPENDENCY`, keine
stille Teil-Auswertung.

## Bekannte Verhaltens-Charakteristiken der Engine (B1/B2)

Bei der Umstellung der E2E-Tests auf echte Definitive-Edition-Daten (Issue 67)
wurden zwei bewusste Verhaltensunterschiede des Reinraum-Evaluators zur alten
Engine (Solver) festgehalten. Sie sind **keine** Bugs, sondern Folgen des
Phantom-Anker-Modells (Architektur §7.7, ADR-0029); sie sind hier dauerhaft
dokumentiert, damit ein künftiger Leser sie nicht für einen Fehler hält. Sie
werden **nicht** als Test geführt, der die Lücke als erwartetes Verhalten
festschreibt.

**B1 ist seit Issue 0092 überholt** — der Nachtrag unten sagt, was die Engine heute
tut; nur B2 gilt unverändert.

- **B1 — ~~Eine reine MAX-Kategorie ohne MIN wird nicht erzwungen.~~ Überholt
  durch Issue 0092.**

  > **Nachtrag (Issue 0206, 2026-08-26).** Diese Entscheidung wurde von
  > **Issue 0092** aufgehoben; die Aufhebung war bis hierher nirgends festgehalten.
  > Der Anker einer `categoryEntry` hängt **nicht** an einer MIN-Grenze: die
  > Join-Schicht hängt an **jeden** `categoryLink` einer Force einen Phantom-Anker,
  > bedingungslos; im ungelinkten Fall genügt **irgendeine** Grenze im Rahmen
  > (`ROSTER`/`FORCE`/`PARENT`), nicht eigens eine MIN. Eine MIN-Grenze bekäme ihren
  > Anker ohnehin schon über die Synthese der Pflicht-Phantome — eine Kategorie mit
  > ausschließlich MAX-Grenzen bliebe ohne diesen Schritt ankerlos und ihre Grenze
  > still unausgewertet, und genau das war der Defekt, den 0092 behoben hat. Eine
  > reine MAX-Kategoriegrenze wird also **geprüft**, wie in der alten Engine.
  > Verifiziert wurde für diesen Nachtrag die Engine, nicht der alte Text: der Code
  > gilt, B1 ist Historie.
  >
  > Festgenagelt ist das Verhalten end-to-end vom Szenario
  > [`docs/testing/army-standard-bearer/`](../testing/army-standard-bearer/) — die
  > `categoryEntry "Battle standard bearer"` (`2ef7-3efe-a448-423f`) trägt
  > ausschließlich MAX-Grenzen, und deren Verletzung (`2a1d-03a1-b48c-64ad`,
  > Ist 2 / Grenze 1) wird dort gemeldet. Für B1 gilt der Satz oben, dass die
  > Charakteristik nicht als Test geführt wird, damit nicht mehr.

  *Ursprünglicher Wortlaut (Stand Issue 67), als Beleg dafür, dass die Entscheidung
  so getroffen und später umgekehrt wurde:*

  > Eine Grenze der Join-Schicht wird nur ausgewertet, wenn ein Anker existiert. Für eine
  > `categoryEntry` synthetisiert die Join-Schicht einen Phantom-Anker **nur**, wenn
  > die Kategorie eine MIN-Grenze trägt (Kategorien sind selbst nie Roster-Instanzen).
  > Eine `categoryEntry` mit ausschließlich einer MAX-Grenze (ohne MIN) erhält daher
  > keinen Anker und bleibt effektiv **unbegrenzt** — eine endliche reine MAX-Kategorie
  > wird also nicht geprüft. (Der reale Fall des Unbegrenzt-Sentinels,
  > [BSData-Doku](../battlescribe-data-format.md) §7.6, fällt ohnehin damit
  > zusammen.) Die alte Engine erzwang die Kategoriegrenze unabhängig von einer MIN.
- **B2 — `forceEntry`-eigenes Punktelimit.** Das Format drückt „dieses
  (Sonder-)Heer muss ≥ N Punkte bauen" über das `limit::`-Muster aus
  ([BSData-Doku](../battlescribe-data-format.md) §5.6). Eine als Kosten-Summe
  direkt am `forceEntry` verankerte Grenze kennt die Anker-Logik der Join-Schicht
  dagegen nicht: ein Kontingent trägt keine Kosten, seine eigene Kostengrenze läse
  immer 0. Dieselbe Semantik ist auch über eine **Kategorie-MIN-Kostengrenze**
  erreichbar: alle Einheiten des Heeres teilen die Armee-Kategorie, deren
  MIN-Kostengrenze den Punkte-Boden setzt.

## Zugehörige ADRs

- Schließt die in **ADR-0030** und **ADR-0031** als künftige Arbeit vermerkte
  katalogübergreifende Auflösungs-Grenze.

<!--
Referenz-Entwurf für die eigenständige Auswertungs-Engine unter `src/evaluator/`.
Diese Datei ist die dauerhaft im Repo gesicherte Grundlage („auf Grundlage dieser
Architektur") für die zweite, räumlich getrennte Engine. Der Bau-Entscheid und
seine Abgrenzung zu ADR-0023 (Solver-Fassade) und ADR-0029 (In-Solver-Query-Engine,
Fixpunkt bewusst weggelassen) stehen in ADR-0030. Die Pseudocode-Typen und
Funktionssignaturen unten sind Entwurf/Leitbild, nicht der finale Vertrag: die
Umsetzung darf Details schärfen, solange das beschriebene Verhalten erhalten bleibt.

Begriffs-Brücke zum Glossar (CONTEXT.md, Abschnitt „Regelauswertung"):
Limit → Grenze (Constraint), Condition → Bedingung, Repeat → Wiederholung,
Scope → Bezugsrahmen, target/childId → Ziel, report/violations → Validierungsmeldungen,
diagnostics → Diagnosen. „Phantomknoten", „Gruppen-Anker", „Fixpunkt" und
„capabilities" sind engine-interne Begriffe dieses Entwurfs, kein Bestandteil des
Domänen-Glossars.
-->

# Auswertungs-Architektur für eine deklarative Armeelisten-Regelengine

Reinraum-Entwurf. Grundlage sind ausschließlich das beschriebene Problem und die Datenform (Definitionsbaum, Instanzbaum, Limit/Condition/Repeat, Modifikatoren, Scopes).

## 1. Annahmen

- **A1:** Rosters umfassen Hunderte bis wenige Tausend Instanzknoten; vollständige Neuauswertung pro Änderung ist als Startpunkt vertretbar.
- **A2:** Modifikatoren können zählrelevante Werte verändern (Kosten, Kategorien, Sichtbarkeit) — es existieren potenzielle Zyklen zwischen Zählen und Modifizieren.
- **A3:** Die Semantik bei solchen Zyklen ist nicht extern vorgegeben und wird hier definiert (Fixpunkt mit Obergrenze).
- **A4:** Prozent-Grenzen mit Nenner 0 (leere Liste) gelten als suspendiert, nicht als verletzt.
- **A5:** Die UI läuft synchron im selben Client-Prozess wie die Auswertung.

## 2. Leitprinzipien

1. **Eine reine Funktion.** Die gesamte Auswertung ist `evaluate(Katalog, Roster) → Bericht`. Keine Seiteneffekte, kein verteilter Zustand. Damit ist die Logik ohne UI und ohne Framework testbar. Der rosterunabhängige Katalog-Vorlauf ist dabei als eigener erster Schritt herausgezogen (`prepareDataset`, siehe §3.1) — das ändert nichts an der Reinheit: sein Ergebnis ist unveränderlich, und der Aufrufer reicht es wieder herein, statt dass die Engine es hinter seinem Rücken hielte.
2. **Single Source of Truth.** Der Bericht ist der einzige Ort, an dem Regel-Ergebnisse existieren. Validierung und UI-Steuerung sind zwei Projektionen desselben Berichts — die Regeln werden nie zweimal ausgewertet.
3. **Unidirektionaler Datenfluss.** Roster-Änderung → `evaluate` → neuer Bericht → Rendering. Die UI liest nur, sie rechnet nie.
4. **Ein Query-Primitiv.** Limit, Condition und Repeat sind drei Verpackungen derselben Frage: *„Zähle `field` im Rahmen `scope`, gefiltert auf `target`, unter `flags`."* Es gibt genau eine Implementierung dieser Frage.
5. **Immutability.** Die Auswertung mutiert Basisdefinitionen nie; Modifikatoren erzeugen eine separate Ebene „effektiver Werte". Der Resolver reichert die gelesenen Definitionen einmalig **während der Aufbereitung** an (aufgelöste Ziele, Zeugen, Verweisziele) und friert den aufgelösten Graphen danach ein. Die Zusicherung gilt damit nicht durch Disziplin, sondern fällt bei Verletzung auf: ein gewöhnlicher Schreibzugriff wirft an der verursachenden Stelle — Felder über den strict mode, Mengen und Abbildungen über ersetzte Mutatoren. Die Durchsetzung zielt auf unabsichtliches Abdriften; wer sie absichtlich umgehen will, kommt über vom Prototyp geliehene Mutatoren (`Set.prototype.add.call(…)`) weiterhin an die inneren Slots. Das ist tragend, seit `prepareDataset` denselben Graphen in beliebig viele Auswertungen reicht.

## 3. Bausteine und Datenfluss

```
Kataloge ──► [1 Resolver] ──► aufgelöste Definitionen (rosterunabhängig, einmal je Datensatz)
                                      │
Roster ───────────────────────► [2 Join-Schicht] ──► Evaluationsbaum (inkl. Phantomknoten)
                                      │
                     ┌────────────────┴───────────────────┐
                     ▼                                    │
              [3 Index-Schicht]  ◄── Fixpunktschleife ──  │
                     │                                    │
                     ▼                                    │
              [4 Modifikator-Schicht] ── effektive Werte ─┘
                     │
                     ▼
              [5 Constraint-Schicht] ──► [6 Bericht] ──► UI-Projektionen / Validierungsanzeige
```

### 3.1 Resolver (rosterunabhängig)

Löst alle ID-Verweise auf, auch über Katalog-Grenzen, und materialisiert pro Definitionsknoten eine **geschlossene Sicht**: eigener Eintrag plus hereinverlinkte Kinder, Regeln und Modifikatoren, in deterministischer Dokumentreihenfolge. Mehrdeutige IDs werden über einen Kontextstapel aufgelöst: lokaler Katalog des verweisenden Knotens → dessen Importe → Spielsystem. Jede Auflösungsentscheidung wird protokolliert (Diagnose bei Katalogfehlern). Das Ergebnis ist unveränderlich und wird **einmal je Datensatz gebildet und über beliebig viele Auswertungen wiederverwendet**, da es nicht vom Roster abhängt.

> **Umsetzungshinweis (Main-Issue 75, Baustein 8):** Die Wiederverwendung liegt beim **Aufrufer**, nicht in einem versteckten Zwischenspeicher der Engine. Die Fassade ist dafür zweistufig: `prepareDataset(datensatz)` liefert den aufbereiteten Datensatz als **undurchsichtigen Griff**, den `evaluate(aufbereiteter Datensatz, roster)` und `describeDataset(aufbereiteter Datensatz)` entgegennehmen. Beide bleiben damit reine Funktionen (Leitprinzip 1) — ein Cache im Inneren wäre genau der verteilte Zustand, den dieser Entwurf ausschließt. Gemessen an echten Katalogdaten trägt dieser Vorlauf 97–99,5 % einer vollständigen Auswertung (`scripts/measure-evaluator.js`, `scripts/measure-evaluator-browser.js`); die vorab festgelegte Schwelle für die zweistufige Form lag bei 50 %.

> **Umsetzungshinweis (ADR-0032):** Die reale Implementierung baut diesen Kontextstapel **bewusst nicht**. Da BattleScribe-IDs global-eindeutige GUIDs sind, lösen alle Quellen (`.gst` + Liste von `.cat`) über **eine** flache globale `id→Definition`-Tabelle auf (global-by-ID); `catalogueLink` ist reine Abhängigkeits-Deklaration. Ein Disjunktheits-Guard meldet eine echte ID-Kollision als Diagnose — erst sie würde den vollen Kontextstapel erzwingen. Siehe [ADR-0032](adr/0032-evaluator-loest-mehr-katalog-datensaetze-global-by-id-auf.md).

### 3.2 Join-Schicht: Evaluationsbaum mit Phantomknoten

Verheiratet Instanz- und Definitionsbaum: Jeder Instanzknoten erhält seine aufgelöste Definition. Zusätzlich werden **Phantomknoten** synthetisiert für Definitionen, die Grenzen tragen, aber keine Instanz haben:

- Kategorie-Definitionen (je Kontingent und für die Gesamtliste),
- Kontingent-Definitionen selbst (Grenzen am Force-Typ),
- Pflichteinträge mit `min > 0`, die im jeweiligen Rahmen nicht gewählt wurden.

Ein Phantomknoten zählt 0 und ist der Auswertungsanker, an dem eine Min-Grenze *gerade beim Fehlen* anschlagen kann. Ohne Phantomknoten hätten diese Regeln keinen Ort im Instanzbaum.

**Unverlinkte Kategorien.** Grenzen können direkt an der `categoryEntry` hängen und gelten auch ohne wiederholenden `categoryLink` (Datenformat §5.5/§5.6). Führt ein Kontingent die Kategorie per `categoryLink`, hängt ihr Anker dort; führt sie **kein** Kontingent, bekommt sie **je Bezugsrahmen mit Grenzen, die dort noch kein Anker abdeckt**, einen eigenen Kategorie-Anker: armeeweit skopierte Grenzen ankern an der Wurzel, kontingent-skopierte **einmal** am ersten Kontingent (die Ziel-Typ-Regel — Datenformat §7.7, ADR-0029 — zählt sie ohnehin armeeweit; je ein Anker pro Kontingent meldete dieselbe Verletzung mehrfach). Trägt die Kategorie eine MIN-Grenze, stellt schon das Pflicht-Phantom einen Anker und wertet — ungefiltert — auch ihre MAX-Grenzen huckepack mit aus; der eigene Anker entfällt dann für jeden Rahmen, den das Phantom von seinem Standort aus auflöst: für den **armeeweiten** Rahmen zählt jedes Phantom im Baum (eine roster-skopierte Grenze löst von jedem Standort aus auf, auch von einem Phantom unter einem Kontingent), für den **Kontingent**-Rahmen nur ein Phantom unter einem Kontingent (an der Wurzel lieferte eine kontingent-skopierte Grenze `unresolvedScope`, keine Auswertung). Die 0–1-Kodierung — MAX ohne MIN — ist der Fall ganz ohne Phantom. Jeder dieser Kategorie-Anker ist auf seinen Rahmen **zugeschnitten** und wertet nur dessen Grenzen aus: bei Grenzen verschiedener Rahmen an einer Definition meldete sonst jeder Anker jede Grenze, und der rahmenfremde Anker hinterließe eine unechte `unresolvedScope`-Diagnose.

**Gruppen-Anker.** Eine `selectionEntryGroup` ist selbst keine Auswahl, kann aber gruppen-skopierte Zähl-Grenzen (`field=selections`, `scope=parent`) tragen — „genau eine Bloodline je Charakter". Für jede solche Gruppe im Definitionsteilbaum einer realen Eigentümer-Auswahl wird ein **Gruppen-Anker** unter dieser Auswahl synthetisiert: wie ein Phantom synthetisch und nicht mitzählend, aber Träger der Gruppendefinition, sodass die Constraint-Schicht ihre min/max gegen den Eigentümer-Rahmen (`scope=parent`) auswertet. Er ist **immer** präsent, damit `min` (leere Pflichtgruppe → Ist 0) *und* `max` (zu viele Member) anschlagen. Die **Gruppen-Zugehörigkeit** der Member stammt aus dem Definitionsbaum (die Member-IDs einer Gruppe, inkl. Link-Ketten/Untergruppen), nicht aus der Instanz — das `entryGroupId`-Tag der `.ros` wird beim Import verworfen; Member-Knoten werden entsprechend annotiert (§3.3).

**Zwei Bauphasen und die Ankerart.** Alles bisher Genannte entsteht in **Phase 1** — dem Baum, über den die Fixpunktschleife läuft. **Phase 2** (`offer.js`) läuft *nach* der Konvergenz und hängt die **Angebots-Anker** an: einen je Definition, die im jeweiligen Rahmen wählbar ist, aber dort (noch) nicht steht (ADR-0035). Jeder Knoten trägt seine **Ankerart** — *belegt*, *Pflicht-Phantom*, *Gruppen-Anker*, *Kategorie-Anker* oder *Angebots-Anker* —, sodass die Herkunft eines Slots abgelesen und nicht aus Pfadform oder Definitionsart geraten wird.

**Wählbar im Bezugsrahmen.** Ein Angebots-Anker entsteht für ein Paar (Rahmen R, Definition D) genau dann, wenn R ein *realer* Knoten ist und eine der beiden Regeln greift:

1. **R ist eine Kontingent-Instanz.** D ist eine Auswahl-Definition unmittelbar unter einer Katalog- oder Spielsystem-Wurzel (die *Kandidatenmenge auf Armee-Ebene*, die der Resolver als eigene Sicht liefert), **und** mindestens eine ihrer **Basis**-Kategorien steht unter den `categoryLink`s der Kontingent-Definition von R. Trägt D gar keine Basis-Kategorie, kann keine Kategorie sie ausschließen — sie gilt als wählbar.
2. **R ist eine belegte Auswahl.** D liegt in ihrem Definitionsteilbaum: durch `selectionEntryGroup`s hindurch und über einen `entryLink` auf sein aufgelöstes Ziel beliebig tief absteigend, **aber anhaltend beim ersten Eintrag** — die Optionen einer geschachtelten Auswahl gehören dieser, nicht dem äußeren Rahmen.

Ausnahmslos gilt: der Anker ist **ein Blatt** (er ist kein realer Rahmen, erzeugt also selbst kein Angebot — das begrenzt den Zuwachs auf *(Kontingente × Wurzeldefinitionen) + (belegte Auswahlen × direkte Optionen)*); **Gesperrtes und Verstecktes wird materialisiert und markiert, nicht weggelassen** (ein fehlender Eintrag wäre von einem vergessenen nicht zu unterscheiden); und es entsteht **kein zweiter Anker**, wo im selben Rahmen schon ein Knoten derselben Definition hängt. Die Zuordnung nach Regel 1 nutzt bewusst die **Basis**-Kategorien — der Anker muss existieren, bevor seine effektiven Werte bestimmt werden können —, während der Fähigkeitsdatensatz die **effektiven** führt.

Phase 2 hängt ausschließlich **hinter** alle bestehenden Kinder an. Damit bleiben Reihenfolge, Elternschaft und die Pfade aller vorhandenen Slots unverändert; die Rahmen-Identitäten zieht sie aus derselben Quelle wie Phase 1, sodass ein Anker nie die Identität eines vorhandenen Knotens wiederverwendet.

### 3.3 Index-Schicht: Scope-Schlüssel statt Baumtraversalen

Ein Durchlauf über den Evaluationsbaum baut Zählindizes. Jeder reale Knoten trägt zu einer Menge von **Scope-Schlüsseln** bei: Wurzel (roster), sein Kontingent (force), jeder Vorfahre (für parent-Scopes), jede effektive Kategorie-ID, seine Definitions-ID (inklusive Link-Kette) sowie — ist er Member einer `selectionEntryGroup` — jede zugehörige Gruppen-ID (aus dem Definitionsbaum abgeleitet, §3.2). Pro Schlüssel werden geführt: Anzahl Auswahlen und Summe je Kostenart, jeweils als *direkte* und *tiefe* Variante (für `includeChildSelections` / `includeChildForces`). Damit sind roster- und force-Bezüge O(1)-Lookups, und eine gruppen-skopierte Grenze liest die Zahl ihrer Member über dasselbe Query-Primitiv (Ziel = Gruppen-ID im Eigentümer-Rahmen). Prozent-Nenner sind derselbe Lookup im Referenzrahmen.

### 3.4 Modifikator-Schicht

Pro Knoten: Conditions (bool) und Repeats (Anzahl) über das Query-Primitiv auswerten, dann Modifikatoren **strikt in Dokumentreihenfolge** auf eine Kopie der Basiseigenschaften anwenden. Ergebnis: effektive Kosten, effektive Kategorien, effektive Grenzwerte, Sichtbarkeit, effektive Namen, effektive Merkmalswerte und die Autor-Meldungen des Katalogs.

**Träger.** Ein Modifikator wirkt auf das Element, an dem er hängt — den Knoten selbst *oder* eines seiner Info-Elemente (Profil, Regel, Info-Gruppe, Info-Verweis), denn die `EntryBase` der XSD gibt allen dieselben `modifiers`. Das ist der Normalfall, nicht die Ausnahme: in den Fixture-Katalogen der 6th Definitive Edition hängen **alle 101** Charakteristik-Modifikatoren an einem `<profile>` (30) oder an einem `<infoLink>` (71) — **keiner** an einer `selectionEntry`, einem `entryLink`, einer Gruppe, einer Kategorie oder einem Kontingent. Damit ist die Frage, ob ein Merkmals-Modifikator *alle* Profile eines Knotens mit diesem Charakteristik-Typ trifft oder nur eines, aus den Daten beantwortet: er trifft **genau das Profil, an dem er steht** — der Knoten ist nie sein Träger. Führt ein Knoten mehrere Profile mit demselben Charakteristik-Typ, bleiben die anderen unberührt. Sichtbarkeit, Name und Merkmale schlüsseln entsprechend nach dem Paar (Knoten, Träger); Kosten, Kategorien, Grenzen und Meldungen bleiben am Knoten. Bedingungen werden immer im Query-Kontext des tragenden **Knotens** ausgewertet — nur er hat eine Position im Baum.

**Grenzwerte entstehen als Kette.** Ein Modifikator auf eine Grenze schreibt nicht bloß eine Zahl, sondern einen Schritt der **Herleitungskette** dieses Grenzwerts (Art, roher Wert, Wiederholungsfaktor, Zwischenwert, ob bedingt, und bei einem bedingten Schritt der **Zeuge** — die benennbare Auswahl, deren Vorhandensein die Bedingung hat halten lassen, ADR-0027). Der Zeuge wird dort festgehalten, wo die Bedingung ausgewertet wird; nachträglich wäre er nur über eine zweite Rechenstelle zu rekonstruieren (ADR-0034). Die Kette ist die **einzige** Quelle des Endwerts — es gibt keinen zweiten Zahlwert daneben.

### 3.5 Fixpunktschleife (Kernentscheidung)

Modifikatoren hängen von Zählungen ab; Zählungen hängen von effektiven Kosten/Kategorien ab. Entscheidung: **Iteration bis zur Konvergenz mit harter Rundenobergrenze.** Ändert eine Runde keine zählrelevanten effektiven Werte mehr, ist der Fixpunkt erreicht. Wird die Obergrenze erreicht, gilt der Stand der letzten Runde und der Bericht erhält eine Nichtkonvergenz-Diagnose — stilles Falschrechnen ist ausgeschlossen.

**Iteriert wird nur über die realen Knoten.** Ein synthetischer Anker (Pflicht-Phantom, Kategorie-Anker, Gruppen-Anker, Angebots-Anker) trägt keine Instanz und geht in keinen Zählschlüssel ein, kann den ausgewerteten Zustand also nicht verändern; ihn mitzuiterieren berechnete jede Runde dasselbe Ergebnis neu. Seine effektiven Werte bestimmt deshalb **ein** Durchlauf nach der Konvergenz (`applyAnchorPostPass`), gegen den finalen Zählindex. Genau das trägt den Zuwachs des Angebots: die Angebots-Anker entstehen erst *nach* der Schleife (Baumphase 2) und laufen nie durch sie hindurch. Weil sie es beim Aufbau des Zustands noch nicht gab, werden ihre **Basiswerte** vor dem Nach-Durchlauf nachgetragen (`extendBaseEffectiveState`) — sonst schriebe ein `increment` ihren Grenzwert von 0 statt vom Katalogwert fort. Das ist exakt und keine Näherung: konvergiert die Schleife, ist der finale Index inhaltsgleich mit dem der letzten Runde. Die tragende Invariante — *ein synthetischer Anker geht nie in den Zählindex ein* — ist als Modultest der Index-Schicht festgehalten (`countIndex.syntheticAnchors.test.js`).

**Zwei getrennte Befunde statt einer Meldung.** Bleibt die Konvergenz aus, unterscheidet die Schleife über einen Fingerabdruck der zählrelevanten Werte je Runde: kehrt ein Zustand wieder, ist es eine **Oszillation** (die Diagnose trägt die Zykluslänge — den Abstand der beiden Vorkommen); wird die Obergrenze erreicht, ohne dass sich ein Zustand wiederholt hat, ist das **erschöpftes Rundenbudget** — fachlich etwas anderes, denn dieser Katalog könnte mit mehr Runden noch konvergieren. Eine erkannte Oszillation bricht die Schleife nicht vorzeitig ab; es gilt weiterhin der Stand der letzten Runde. Zusätzlich liefert die Schleife die Knoten, deren zählrelevante Werte nicht zur Ruhe kamen — ihr Fähigkeitsdatensatz trägt „Wert nicht stabil", sodass die Unsicherheit **am betroffenen Slot** steht und nicht nur in einer globalen Liste.

*Verworfen:* „genau zwei Pässe" (einfacher, aber stille Fehler bei mehrstufigen Abhängigkeiten); Dependency-Graph mit topologischer Sortierung (roster-Scopes machen fast alles von fast allem abhängig, der Graph degeneriert).

### 3.6 Constraint-Schicht und Bericht

Jede effektive Grenze wird ausgewertet und liefert nie nur „verletzt ja/nein", sondern immer das volle Tripel **Ist-Wert / effektiver Grenzwert / Delta** plus Bezugsinstanz. Der Bericht enthält:

- **Verletzungen** (für die Validierungsanzeige) — **eine** Liste fachlich eingeordneter Meldungen, siehe unten,
- pro **Slot** einen **Fähigkeitsdatensatz**: Definitions-ID, **Ankerart**, **Rahmen-Bezug** und effektiver Anzeigename, effektives min/max, aktueller Stand, Restspielraum, Pflicht-Flag, Gesperrt-Flag, Versteckt-Flag, das Merkmal „Wert nicht stabil", die Autor-Meldungen des Katalogs und die **Info-Projektion** — die für ihn geltenden Profile und Regeltexte (für die UI-Steuerung, siehe unten),
- **Diagnosen** (unlesbare Quelldatei — nicht wohlgeformtes XML oder falsche Wurzel —, Auflösungsprobleme, Oszillation, erschöpftes Rundenbudget, Null-Nenner, unauflösbare Budgetgrenze).

Ein **Slot** ist seit ADR-0035 **jede Stelle, an der eine Auswahl stehen kann** — ob dort etwas steht oder nicht: jeder Knoten jeder Ankerart, also auch ein Kategorie-Knoten und jede wählbare, nicht gewählte Definition. Verfügbarkeit wird daraus **abgelesen** statt errechnet.

**Die Meldungsliste ist fachlich eingeordnet und sprachfrei** (`violationClassification.js`, ADR-0034). Die Engine ordnet ein, die Oberfläche formuliert: im Bericht steht kein i18n-Schlüssel und kein übersetzter Satz. Jede Meldung trägt:

- **Herkunft** (`origin`) — der Diskriminator, der bestimmt, welche übrigen Felder besetzt sind: *aus einer Grenze abgeleitet* (eine Katalog-Grenze **oder** die engine-eigene Budget-Regel) oder *Autor-Meldung* des Katalogs. Es gibt bewusst **eine** Liste für beide: zwei Listen wären zwei Wege zur selben Frage („was stimmt an dieser Liste nicht?").
- **Schweregrad** — bei einer abgeleiteten Meldung immer *Fehler* (eine gerissene Grenze macht die Liste regelwidrig; eine unerfüllte Pflicht als bloße Warnung auszuweisen wäre eine Anzeige-Entscheidung und liegt außerhalb der Engine); bei einer Autor-Meldung der aus dem Katalog übernommene (`field="error"`/`"warning"`/`"info"`).
- **Anker** — Definitions-ID, **effektiver** Name, stabiler Slot-Pfad, **Ankerart** und das Merkmal „Wert nicht stabil". Die Ankerart ist die Aufzählung der Fähigkeitsdatensätze, erweitert um genau einen Wert: den `ROSTER` der Budget-Regel, die an keinem Slot hängt und deshalb `path: null` trägt.
- **Nur abgeleitet:** Grenz-ID, **Art der Grenze** (Mindest-/Höchstmaß × *was gemessen wird*: Auswahlanzahl, Kontingentanzahl, Kostensumme, eingestellte Kostengrenze oder die Roster-Budget-Regel; dazu die Kostenart und das Prozent-Kennzeichen), **Bezugsrahmen** (dessen *Art* — Schlüsselwort oder Eintrags- bzw. Kategorie-ID —, die Ziel-ID und die drei Zähl-Flags), Ist-Wert, Grenze, Differenz und die **Herleitungskette**.
- **Nur Autor-Meldung:** der Katalogtext mit aufgelösten Text-Tokens (siehe unten).
- **Ursachen** (optional, nur abgeleitet, ADR-0027, `causes.js`) — siehe unten.

**Jedes Feld der Einordnung ist ein geschlossener Wertevorrat**, keine freie Zeichenkette. Das ist der Punkt: eine Fallunterscheidung in der Oberfläche wird dadurch erschöpfend und ein fehlender Fall auffindbar. Der rohe `scope` einer Grenze etwa ist im XML ein Schlüsselwort *oder* eine ID — ihm sieht man nicht an, welches von beidem; die Einordnung nimmt der Oberfläche genau diesen Rateschritt ab, und zwar an derselben Quelle, an der auch das Query-Primitiv den Rahmen auflöst.

**Ursachen werden aus der Herleitungskette *gelesen*, nicht rekonstruiert** (`causes.js`). Eine Ursache ist ein Kettenschritt, der drei Dinge zugleich war: **bedingt** (ein unbedingter Modifikator gilt immer und erklärt nichts), **wirksam** (er hat den Wert tatsächlich verändert — gemessen gegen seinen Vorgängerschritt, nicht gegen den Basiswert) und **benennbar** (er trägt einen Zeugen). Ausgegeben werden dessen Zeuge, die Modifikator-Art und der Zwischenwert. Löst eine Bedingung auf keine benennbare Auswahl auf, bleibt der Schritt in der Kette sichtbar, erzeugt aber keine erfundene Ursache; bleibt danach keine übrig, **fehlt das Feld ganz** statt leer dazustehen. Nachträglich ließe sich der Zeuge nur gewinnen, indem alle Bedingungen gegen einen womöglich anderen Index erneut ausgewertet würden — eine zweite Rechenstelle, genau das, was ADR-0034 ausschließt.

**Eine Autor-Meldung wird gerendert, nicht übersetzt** (`authorMessages.js`, ADR-0028). Der Text bleibt in Katalogsprache; aufgelöst wird allein, was BattleScribe selbst auflöst: das Token `{this}` → der **effektive** Name des tragenden Knotens. Die Zuordnung ist eine Tabelle, kein Sonderfall-`if`; ein unbelegtes Token bleibt verbatim stehen, denn eine vollständige Token-Spezifikation existiert nicht. In den Fixture-Katalogen ist `{this}` das einzige vorkommende Token (7 Fundstellen, alle in `modifier/@value` von Meldungs-Modifikatoren). Gerendert wird **einmal**, und dieselben Meldungen speisen den Fähigkeitsdatensatz des Slots *und* die Meldungsliste — zwei Renderstellen könnten zwei Texte führen, die auseinanderlaufen.

**Ein Angebots-Anker erzeugt auch keine Autor-Meldung.** Dieselbe Berichtsfähigkeits-Regel wie bei den Grenzen: sein Fähigkeitsdatensatz führt sie weiterhin, damit die Oberfläche sie am Angebot zeigen kann, aber die Meldungsliste spräche sonst über etwas, das gar nicht in der Liste steht.

**Ein Angebots-Anker erzeugt keine Verletzung.** Seine Grenzen werden voll ausgewertet — daraus liest der Fähigkeitsdatensatz Höchstmaß, Belegung und Restspielraum —, aber das Ergebnis ist **nicht berichtsfähig** (`isReportable`). Andernfalls läse eine armee- oder kontingentweit skopierte Grenze am Anker denselben Wert wie am realen Knoten und meldete dieselbe Verletzung ein zweites Mal, und jede nicht gewählte Option mit einer Mindestgrenze flutete die Meldungsliste. Die Verletzungsliste bleibt vom gewachsenen Baum damit unberührt — eine prüfbare Invariante der bestehenden E2E-Suite. Die roster-weite Budget-Regel ist immer berichtsfähig.

Der **Rahmen-Bezug** (Pfad und Definitions-ID des umschließenden Kontingents bzw. der Eltern-Auswahl; `null` am Roster selbst) steht neben dem Pfad, weil ein rein positioneller Schlüssel für die Oberfläche zu spröde ist. Ein **Verweis-Slot** — der Kategorie-Anker eines verlinkenden Kontingents trägt den `categoryLink`, ein Angebots-Anker den `entryLink`; der Anker einer unverlinkten Kategorie trägt dagegen die `categoryEntry` selbst und ist keiner — nennt zusätzlich sein **Ziel** (`targetDefId`): das ist das *Thema* des Slots, und dieselbe ID, über die die Constraint-Schicht ihn zählt. Ohne sie ließe sich ein Kategorie-Abschnitt allein aus dem Bericht nicht seiner Kategorie zuordnen.

**Die Info-Projektion je Slot** (`infoProjection.js`) beantwortet die Frage *welche Profile und Regeltexte gelten für diesen Slot?* — eine geordnete Liste, deren Einträge je Art (Profil oder Regel), die **ID des Vorkommens**, den **effektiven** Namen und, je nach Art, Profiltyp samt Merkmalen *(Charakteristik-Typ mit Namen, effektiver Wert)* oder den Regeltext tragen. Vier Regeln bestimmen ihren Inhalt:

- **Eigenes und Geerbtes.** Enthalten sind die Info-Elemente des Slots selbst **und die seiner belegten Unter-Auswahlen**, in Dokumentreihenfolge (eigene zuerst, dann die Unter-Auswahlen in Baumreihenfolge). Ein Anker ist keine belegte Auswahl und vererbt nichts nach oben; seine eigenen Elemente trägt sein eigener Datensatz. **Ohne Entdopplung**: derselbe Träger unter zwei Unter-Auswahlen kann *verschiedene* effektive Werte tragen, weil die Effektiv-Werte-Schicht nach dem Paar (Knoten, Träger) schlüsselt — eine Entdopplung nach ID würfe genau diese Unterscheidung still weg.
- **Verstecktes bleibt draußen.** Ausgeschlossen ist, was **selbst** versteckt ist, und alles, was an einem **versteckten Knoten** hängt. „Versteckt" ist die **effektive** Sichtbarkeit: das Basis-`hidden` der Katalogdaten, überschrieben von einem `hidden`-Modifikator am selben Träger. Beide Wege kommen real vor — in den Fixture-Katalogen tragen neun Info-Elemente `hidden="true"` und dreizehn `hidden`-Modifikatoren hängen an einem Profil oder Info-Verweis, darunter ein basis-versteckter Verweis, den ein bedingter `set hidden=false` wieder einblendet.
- **Ein Verweis erscheint an seiner eigenen Stelle.** Ein `infoLink` auf ein Profil oder eine Regel liefert **einen** Eintrag unter der ID und dem effektiven Namen des *Verweises*, mit Merkmalen bzw. Text des Ziels — die geteilte Definition erscheint nicht zusätzlich. Ein `infoLink` auf eine **Info-Gruppe** trägt selbst keinen Eintrag; an seiner Stelle stehen die **Mitglieder** der Gruppe, denn nur sie tragen Werte.
- **Die Klartext-Namen stammen aus den `<profileType>`-Deklarationen**, und nur aus ihnen: `profileType/@name` und `characteristicType/@name` sind XSD-Pflicht, die am Profil bzw. an der Charakteristik mitgeführten Kopien (`profile/@typeName`, `characteristic/@name`) dagegen optional bzw. redundant. Ein nicht deklarierter Typ nennt seine ID und einen leeren Namen, statt einen zu erfinden.

Zusätzlich prüft die Engine eine **roster-weite Budget-Regel** (keine Katalog-Grenze, sondern eine Regel der Engine): je eingestellter Kostenart wird die am ROSTER-Rahmen verplante Summe gegen die eingestellte Grenze dieser Kostenart geprüft; eine Überschreitung erzeugt eine Budget-Verletzung, die über einen **synthetischen** roster-weiten Anker in dieselbe Verletzungsliste wie die übrigen Verletzungen fließt.

## 4. Pseudocode

Sprachneutral, typisiert notiert. Fehlerpfade sind explizit; nichts wird still verschluckt.

### 4.1 Typen

```
// Die geschlossenen Format-Enums (ConstraintKind/ConditionKind/ModifierKind/
// ConditionGroupKind) kommen aus der **einen** Quelle der Wahrheit: der aus der
// vendored BattleScribe-XSD generierten SSOT (ADR-0031), nicht aus einer eigenen,
// driftgefährdeten Kopie.
enum ConstraintKind { min, max }                                  // XSD-SSOT
enum CountedField   { SELECTION_COUNT, FORCE_COUNT, COST_SUM(costTypeId),
                      LIMIT_VALUE(costTypeId) }   // FORCE_COUNT: Kontingentanzahl, XML-`field="forces"`; LIMIT_VALUE: eingestellte Budgetgrenze (aus dem Roster), keine Baum-Zählung; XML-`field="limit::<costTypeId>"`
enum ConditionKind  { lessThan, greaterThan, equalTo, notEqualTo,  // XSD-SSOT
                      atLeast, atMost, instanceOf, notInstanceOf }
enum ModifierKind   { set, increment, decrement, add, remove,      // XSD-SSOT (10 Werte)
                      append, prepend, multiply, set-primary, unset-primary }
enum ConditionGroupKind { and, or }                               // XSD-SSOT
enum ScopeKeyword   { ROSTER, FORCE, PARENT, SELF }
type ScopeRef       = ScopeKeyword | EntryId | CategoryId

record CountFlags {
  shared: bool                    // über alle Instanzen der Ziel-Definition aggregieren
  includeChildSelections: bool
  includeChildForces: bool
}

record LimitDef       { id, kind: ConstraintKind, field: CountedField, scope: ScopeRef,
                        value: number, isPercent: bool, flags: CountFlags }
record ConditionDef   { type: ConditionKind, field: CountedField, scope: ScopeRef,
                        targetChildId: Id, value: number, flags: CountFlags,
                        witnessDefinition: ResolvedDef? }  // im Resolver aufgelöst: die
                        // benennbare Auswahl hinter targetChildId (sonst null)
record RepeatDef      { field: CountedField, scope: ScopeRef,
                        targetChildId: Id, perValue: number,   // XSD-`value`: die Schrittweite
                        repeats: number, roundUp: bool,        // Anwendungen je Schritt; Rundung
                        flags: CountFlags }
record ModifierDef    { field: string,                    // roher XSD-`field`, im Resolver aufgelöst
                        target: TargetDescriptor,          // aufgelöstes Ziel (Kosten/Grenze/Kategorie/
                                                           // Sichtbarkeit/Merkmal/Name/Autor-Meldung);
                                                           // null, wenn `field` nicht deutbar ist (Diagnose)
                        kind: ModifierKind, value,
                        join: string?,                     // Trennzeichen für append/prepend (vendored)
                        conditions: ConditionDef[], conditionGroups: ConditionGroupDef[],
                        repeats: RepeatDef[] }
                        // Reihenfolge im Array == Dokumentreihenfolge

// Gruppen (rekursiv, `and`/`or`): eine Bedingungsgruppe verknüpft Bedingungen und
// weitere Untergruppen zu einem Wahrheitswert; eine Modifikatorgruppe bündelt
// Modifikatoren unter einer gemeinsamen Gruppen-Bedingung und ist beliebig
// verschachtelbar.
record ConditionGroupDef { type: ConditionGroupKind, conditions: ConditionDef[],
                          groups: ConditionGroupDef[] }
record ModifierGroupDef  { modifiers: ModifierDef[], modifierGroups: ModifierGroupDef[],
                          conditions: ConditionDef[], conditionGroups: ConditionGroupDef[] }

// Info-Elemente: sie teilen die `EntryBase` der XSD und tragen deshalb eigene
// Modifikatoren und ein `hidden`-Kennzeichen — sie sind Modifikator-Träger.
// Neben dem materialisierten Boolean `isHidden` (Default false) führt jede
// EntryBase das Tri-State-Rohattribut `hiddenAttribute` (true | false |
// nicht gesetzt): nur so kann ein Vorkommen über einen Verweis das
// Basis-`hidden` seines Ziels erben, ohne dass ein explizites `false` am
// Verweis verloren geht (Issue 0099, `baseHiddenOf` in effectiveState.js).
record InfoElement    { kind: profile | rule | infoGroup | infoLink, id, name, isHidden: bool,
                        hiddenAttribute: bool?,
                        modifiers: ModifierDef[], modifierGroups: ModifierGroupDef[],
                        characteristics: Characteristic[],  // nur profile
                        typeId: ProfileTypeId,              // nur profile
                        text: string?,                      // nur rule (XSD-`description`, optional)
                        infos: InfoElement[] }    // infoLink verweist per targetId

record ProfileType    { id, name, characteristicTypes: { id, name }[] }   // die EINE Quelle der
                        // Klartext-Namen von Profiltyp und Charakteristik-Typ (XSD: beide
                        // Pflicht; die Kopien am Profil/an der Charakteristik sind optional)

record InfoEntry      { kind: profile | rule, id, name,     // id/name des VORKOMMENS (bei einem
                        // Verweis der Verweis selbst), name effektiv
                        profileTypeId, profileTypeName,     // nur profile
                        characteristics: { typeId, name, value }[],   // nur profile, value effektiv
                        text: string? }                     // nur rule

record ResolvedDef  { id, kind: ENTRY | GROUP | FORCE_DEF | CATEGORY_DEF,
                      baseCosts: Map<CostTypeId, number>, baseCategoryIds: Set<CategoryId>,
                      limits: LimitDef[], modifiers: ModifierDef[],
                      children: ResolvedDef[], resolutionLog: Diagnostic[] }

record InstanceNode { defId: Id, count: number, children: InstanceNode[] }
record CostLimit    { costTypeId: Id, value: number }                    // eine eingestellte Grenze je Kostenart
record Roster       { forces: InstanceNode[], costLimits: CostLimit[] }  // costLimits: das eingestellte Budget je Kostenart (vollständige Liste)

enum AnchorKind { OCCUPIED, MANDATORY_PHANTOM, GROUP_ANCHOR,      // Herkunft eines Slots;
                  CATEGORY_ANCHOR, OFFER_ANCHOR }                 // genau eine je Knoten

// ── Sprachfreie Einordnung einer Meldung (§3.6, ADR-0034) ────────────────────
enum MessageAnchorKind { ...AnchorKind, ROSTER }   // Obermenge, kein zweiter Vorrat:
                       // ROSTER trägt allein die Budget-Regel (kein Slot ⇒ path = null)
enum MessageOrigin  { DERIVED_LIMIT, AUTHOR_MESSAGE }   // der Diskriminator: er bestimmt,
                       // welche Felder einer Meldung besetzt sind
enum MessageSeverity { ERROR, WARNING, INFO }
enum LimitMeasure   { SELECTION_COUNT, FORCE_COUNT, COST_SUM,   // WAS die Grenze misst;
                      BUDGET_LIMIT, ROSTER_BUDGET }             // die ersten vier je genau
                      // ein CountedFieldKind (limitMeasureOfCountedField), ROSTER_BUDGET
                      // ist die engine-eigene Regel „Armee zu teuer"
enum ScopeKind      { ROSTER, FORCE, PARENT, SELF,   // die vier Werte aus ScopeKeyword …
                      ENTRY_ID, CATEGORY_ID }        // … plus die beiden ID-Rahmen: dem rohen
                      // `scope` sieht man nicht an, welches von beidem er ist

record EvalNode {
  def: ResolvedDef
  instance: InstanceNode?          // null bei Phantomknoten
  parent: EvalNode?
  children: EvalNode[]
  isPhantom: bool
  anchorKind: AnchorKind           // abgelesen, nicht aus Pfadform geraten
  forceRoot: EvalNode              // das umschließende Kontingent
}

// Träger = der Knoten selbst oder eines seiner Info-Elemente (§3.4).
type Carrier = EvalNode | InfoElement

record DerivationStep  { kind: ModifierKind, rawValue: string, times: number,
                         result: number, isConditional: bool,
                         witness: { defId, name }? }     // nur bei bedingtem Schritt
record LimitDerivation { base: number, steps: DerivationStep[] }  // Endwert == letzter Schritt

record EffectiveState {            // Ergebnis der Modifikator-Schicht, unveränderlich
  costs: Map<EvalNode, Map<CostTypeId, number>>
  categories: Map<EvalNode, Set<CategoryId>>
  limits: Map<(EvalNode, LimitId), LimitDerivation>   // Wert *als* Kette, kein zweiter Zustand
  hidden: Map<(EvalNode, Carrier), bool>              // nur Überschreibungen; Basis: XSD-`hidden`
  names: Map<(EvalNode, Carrier), string>             // nur Überschreibungen; Basis: Katalogname
  characteristics: Map<(EvalNode, Carrier, CharacteristicTypeId), string>   // nur Überschreibungen
  authorMessages: Map<EvalNode, { severity, text }[]>
}

record ConstraintResult { limit: LimitDef, anchor: EvalNode,
                          actual: number, bound: number, satisfied: bool, delta: number,
                          isReportable: bool,           // false am Angebots-Anker: speist nur
                                                        // den Fähigkeitsdatensatz, nie die Meldung
                          measure: LimitMeasure,        // Rohdatum der Einordnung: abgelesen am
                                                        // Feld — die Budget-Regel bringt ihr
                                                        // eigenes mit, statt es raten zu lassen
                          derivation: LimitDerivation? }

// Die eine Meldungsliste des Berichts. `origin` sagt, welche Felder besetzt sind.
record MessageAnchor  { defId, name: string?,        // name: der **effektive**
                        path: NodePath?,             // null nur am ROSTER-Anker
                        anchorKind: MessageAnchorKind, isValueUnstable: bool }
record LimitFacts     { kind: ConstraintKind, measure: LimitMeasure,
                        costTypeId: Id?, isPercent: bool,   // isPercent: `bound` ist der
                                                     // abgeleitete Wert, die Kette der Prozentsatz
                        scope: { kind: ScopeKind, targetId: Id?, flags: CountFlags } }
record Cause          { witness: { defId, name },    // die auslösende, benennbare Auswahl
                        modifierKind: ModifierKind, value: number }   // wie sie wirkte, worauf
record Message        { origin: MessageOrigin, severity: MessageSeverity, anchor: MessageAnchor,
                        // nur origin == DERIVED_LIMIT:
                        limitId: Id, limit: LimitFacts,
                        actual: number, bound: number, delta: number,
                        derivation: LimitDerivation?, causes: Cause[]?,   // causes FEHLT, wenn leer
                        // nur origin == AUTHOR_MESSAGE:
                        text: string }               // Katalogtext, Text-Tokens aufgelöst

record SlotCapability   { node: EvalNode, defId: Id, name: string?,   // name: der **effektive**
                          targetDefId: Id?,             // worauf ein Verweis-Slot zeigt: die
                                                        // Kategorie eines Kategorie-Ankers, der
                                                        // Eintrag hinter einem entryLink; sonst null
                          anchorKind: AnchorKind,       // Herkunft des Slots
                          frame: { path: NodePath, defId: Id }?,  // Kontingent bzw. Eltern-Auswahl;
                                                        // null = der Slot hängt am Roster selbst
                          effectiveMin: number?, effectiveMax: number?,
                          current: number, headroom: number?,
                          isMandatoryUnmet: bool, isBlocked: bool, isHidden: bool,
                          isValueUnstable: bool,        // lag in der instabilen Knotenmenge
                          authorMessages: { severity, text }[],
                          infoElements: InfoEntry[] }   // die Info-Projektion: eigene UND aus den
                                                        // belegten Unter-Auswahlen geerbte Profile
                                                        // und Regeltexte, Verstecktes ausgenommen

record Report { violations: Message[], capabilities: Map<NodePath, SlotCapability>,
                diagnostics: Diagnostic[] }
```

### 4.2 Hauptfunktion

```
const MAX_FIXPOINT_ROUNDS = 5

function prepareDataset(catalogs): PreparedDataset     // Schritt 1, einmal je Datensatz
  return opaque(resolveCatalogs(catalogs))             // rosterunabhängig, unveränderlich

function evaluate(prepared, roster): Report            // Schritt 2, beliebig oft
  resolved    = contentsOf(prepared)                   // wiederverwendet, nicht neu gelesen
  tree        = buildEvalTree(resolved, roster)
  effective   = effectiveStateFromBaseDefinitions(tree)
  diagnostics = collect(resolved.allResolutionLogs)

  iterated  = realNodesOf(tree)                        // nur zählende Knoten iterieren
  converged = false
  cycleLength = null
  seenAtRound = { fingerprint(effective, iterated): 0 }

  for round in 1 .. MAX_FIXPOINT_ROUNDS:
    index        = buildIndex(tree, effective)
    newEffective = applyModifiersOfNodes(iterated, baseStateCopy(tree), index)
    unstable     = countRelevantDifferences(effective, newEffective, iterated)
    print        = fingerprint(newEffective, iterated)
    effective    = newEffective                        // bei Nichtkonvergenz gilt die letzte Runde
    if unstable.isEmpty:
      converged = true
      break
    if seenAtRound.has(print):                         // ein früherer Zustand kehrt wieder
      cycleLength = cycleLength ?? round - seenAtRound[print]
    else:
      seenAtRound[print] = round                       // Abstand immer zum ERSTEN Vorkommen

  if not converged:
    diagnostics.add(cycleLength != null
      ? Diagnostic.OSCILLATION(round, cycleLength)
      : Diagnostic.ROUND_BUDGET_EXHAUSTED(round))

  index = buildIndex(tree, effective)                  // finaler, konsistenter Index

  // Baumphase 2: die Angebots-Anker für alles im Rahmen Wählbare, als Blätter
  // HINTER allen bestehenden Kindern — die Pfade vorhandener Slots bleiben stabil.
  offerAnchors = attachOfferAnchors(tree, resolved)
  extendBaseEffectiveState(effective, offerAnchors)    // Basiswerte nachtragen

  // Nach-Durchlauf: die synthetischen Anker EINMAL gegen den finalen Index. Sie
  // zählen nie mit, können also nicht zurückwirken; der Index wird nicht neu gebaut.
  diagnostics += applyModifiersOfNodes(syntheticNodesOf(tree), effective, index)
  results = evaluateAllConstraints(tree, effective, index, diagnostics)
  return buildReport(tree, effective, results, diagnostics, unstable)
```

### 4.3 Join-Schicht

```
function buildEvalTree(resolved, roster): EvalNode
  root = EvalNode(def = resolved.gameSystemRoot, instance = null, isPhantom = false)
  for forceInstance in roster.forces:
    forceDef  = resolved.lookup(forceInstance.defId)   // Fehler → Diagnose + Knoten überspringen
    forceNode = attachChild(root, forceDef, forceInstance)
    joinChildrenRecursively(forceNode, resolved)
    synthesizePhantoms(forceNode, resolved)
  synthesizeRosterPhantoms(root, resolved)             // rosterweite Kategorie-/Eintragsgrenzen
  return root

function synthesizePhantoms(forceNode, resolved)
  // Anker für Grenzen an Knoten, die keine Instanz haben
  for categoryLink in categoryLinksOf(forceNode.def):   // IMMER, nicht nur bei Absenz:
    attachPhantom(forceNode, categoryLink)              // eine Kategorie ist ein Zählrahmen,
                                                        // kein Auswahlpunkt. Der Anker trägt den
                                                        // Link (eigene + geerbte Grenzen).
  for entryDef in resolved.selectableEntriesOf(forceNode.def):
    if hasMinLimit(entryDef) and countInstances(forceNode, entryDef.id) == 0:
      attachPhantom(forceNode, entryDef)

// ── Baumphase 2: das Angebot (offer.js), NACH der Fixpunktschleife ─────────────
function attachOfferAnchors(tree, resolved): EvalNode[]
  anchors = []
  for frame in realNodesOf(tree):                       // nur reale Knoten sind Rahmen
    occupied = identityIdsOf(child.def) for child in frame.children   // Entdopplungsbasis
    candidates = frame.isForce
      // Regel 1: das Armee-Angebot, gefiltert über die BASIS-Kategorien
      ? resolved.armyLevelCandidates.filter(d → carriedBy(d, categoryLinksOf(frame.def)))
      // Regel 2: die direkten Optionen — durch Gruppen und Link-auf-Gruppe hindurch,
      //          anhaltend beim ersten Eintrag
      : optionDefinitionsUnder(ownerDefinitionOf(frame))
    for d in candidates:
      if identityIdsOf(d) ∩ occupied ≠ ∅: continue      // kein zweiter Anker
      anchors.add(attachOfferAnchor(frame, d))          // Blatt, HINTER allen Kindern
      occupied += identityIdsOf(d)
  return anchors
```

### 4.4 Index-Schicht

```
record ScopeKey(frame: ROSTER | ForceNode | EvalNode, targetId: Id?)

record Index {
  direct: Map<ScopeKey, Tally>      // ohne Kindauswahlen
  deep:   Map<ScopeKey, Tally>      // mit Kindauswahlen (und ggf. Kind-Forces)
}
record Tally { selectionCount: number, costSums: Map<CostTypeId, number> }

function buildIndex(tree, effective): Index
  index = emptyIndex()
  for node in realNodesOf(tree):                        // Phantome zählen nie mit
    contribution = Tally(
      selectionCount = node.instance.count,
      costSums       = scale(effective.costs[node], node.instance.count))
    for key in scopeKeysOf(node, effective):
      index.addTo(key, contribution)
  return index

function scopeKeysOf(node, effective): ScopeKey[]
  keys = []
  for frame in [ROSTER, node.forceRoot] + ancestorsOf(node):
    keys.add(ScopeKey(frame, targetId = null))          // „alles in diesem Rahmen"
    keys.add(ScopeKey(frame, node.def.id))              // gefiltert auf Eintrag
    for linkedId in linkChainOf(node.def):              // Verweis-Kette mitzählen
      keys.add(ScopeKey(frame, linkedId))
    for categoryId in effective.categories[node]:       // effektive, nicht Basis-Kategorien!
      keys.add(ScopeKey(frame, categoryId))
  return keys
```

Direkte vs. tiefe Zählung: beim Eintragen wird die Beitragskette entlang der Vorfahren geführt — der unmittelbare Elternrahmen erhält den Beitrag in `direct` und `deep`, weiter entfernte Rahmen nur in `deep`.

### 4.5 Das Query-Primitiv

Die eine Stelle, die Scopes, Flags und Felder versteht. Limit, Condition und Repeat rufen ausschließlich diese Funktion.

```
function query(ctx: QueryContext, field, scope, targetId, flags): number | UNRESOLVED_BUDGET
  // LIMIT_VALUE liest die eingestellte Budgetgrenze aus dem Roster (ctx.budget),
  // nicht aus dem Zählindex. Nur Bezugsrahmen ROSTER ist sinnvoll; bei anderem
  // Scope oder fehlender Grenze: Diagnose + Sentinel (nie still 0). Die Konsumenten
  // (Grenze/Bedingung/Repeat) behandeln den Sentinel fail-closed — die Regel feuert nicht.
  if field == LIMIT_VALUE:
    if scope != ROSTER or not ctx.budget.has(field.costTypeId):
      ctx.diagnostics.add(Diagnostic.UNRESOLVED_BUDGET_LIMIT(field.costTypeId, reason))
      return UNRESOLVED_BUDGET
    return ctx.budget.get(field.costTypeId)

  frame = resolveScopeFrame(ctx.node, scope)
  // ROSTER → Wurzel | FORCE → ctx.node.forceRoot | PARENT → ctx.node.parent
  // SELF → ctx.node | EntryId/CategoryId → nächster Vorfahre bzw. Kategorierahmen mit dieser ID
  if frame == null:
    ctx.diagnostics.add(Diagnostic.UNRESOLVED_SCOPE(scope, ctx.node))
    return 0

  effectiveTarget = flags.shared ? targetId : narrowToOwnInstance(ctx.node, targetId)
  table = flags.includeChildSelections ? ctx.index.deep : ctx.index.direct
  tally = table.get(ScopeKey(frame, effectiveTarget)) ?? Tally.ZERO

  return field == SELECTION_COUNT
       ? tally.selectionCount
       : tally.costSums[field.costTypeId] ?? 0
```

### 4.6 Condition, Repeat, Modifikatoren

```
function conditionHolds(ctx, c: ConditionDef): bool
  actual = query(ctx, c.field, c.scope, c.targetChildId, c.flags)
  return compare(c.type, actual, c.value)   // COMPARATORS-Registry: ConditionKind → Vergleichsprädikat

function repeatCount(ctx, r: RepeatDef): number
  actual = query(ctx, r.field, r.scope, r.targetChildId, r.flags)
  steps  = r.roundUp ? ceil(actual / r.perValue) : floor(actual / r.perValue)
  return steps * r.repeats                  // 0 = Modifikator inaktiv

// Ein Durchlauf, zwei Aufrufer: die Fixpunktschleife ruft ihn je Runde mit den
// ITERIERTEN (realen) Knoten und einer frischen Basiskopie, der Nach-Durchlauf
// einmal mit den SYNTHETISCHEN Ankern und dem konvergierten Zustand. Auch die
// Grenzen eines Ankers sind modifizierbar — nur eben nicht in jeder Runde neu.
function applyModifiersOfNodes(nodes, state, index)
  // schreibt ausschließlich unter den übergebenen Knoten (der Zustand schlüsselt
  // nach Knoten-Objekt) — der zweite Aufruf berührt keinen Wert des ersten
  for node in nodes:
    ctx = QueryContext(node, index, diagnostics)
    for modifier in node.def.modifiers:     // Dokumentreihenfolge — Reihenfolge ist Semantik
      applyModifier(ctx, state, node, modifier)
    for group in node.def.modifierGroups:   // Modifikatorgruppen nach den freien Modifikatoren
      applyModifierGroup(ctx, state, node, group)

function applyModifier(ctx, state, node, modifier)
  // feuert nur, wenn ALLE direkten Bedingungen UND alle Bedingungsgruppen halten
  if not conditionsAndGroupsHold(ctx, modifier.conditions, modifier.conditionGroups): return
  times = modifier.repeats.isEmpty ? 1
                                   : product(repeatCount(ctx, r) for r in modifier.repeats)
  applyOperation(state, node, modifier, times)

function applyModifierGroup(ctx, state, node, group)
  // hält die gemeinsame Gruppen-Bedingung, greifen alle enthaltenen Modifikatoren
  // gemeinsam (jeder weiterhin unter seinen eigenen Bedingungen), sonst gemeinsam keiner
  if not conditionsAndGroupsHold(ctx, group.conditions, group.conditionGroups): return
  for modifier in group.modifiers:
    applyModifier(ctx, state, node, modifier)

// Eine `and`-Gruppe hält, wenn ALLE ihre Bedingungen und Untergruppen halten; eine
// `or`-Gruppe, wenn MINDESTENS EINE hält — rekursiv über beliebige Tiefe.
function conditionGroupHolds(ctx, group): bool
  members = [conditionHolds(ctx, c) for c in group.conditions]
          + [conditionGroupHolds(ctx, g) for g in group.groups]
  return group.type == and ? all(members) : any(members)

// Je Knoten laufen erst seine eigenen Modifikatoren, dann die seiner Info-Elemente —
// jeder mit seinem Träger, alle im Query-Kontext des Knotens.
function applyModifiersOfNode(state, node, ctx)
  applyCarrier(state, node, carrier = node, subject = node.def, ctx)
  for carrier in infoCarriersOf(node.def):             // Profile, Regeln, Info-Gruppen, Info-Verweise
    applyCarrier(state, node, carrier, subject = carrier, ctx)
  // Ein Verweis (entryLink/categoryLink/infoLink) wirkt mit den Modifikatoren seines
  // Ziels ZUERST, dann seinen eigenen — dieselbe Erb-Regel wie bei den Grenzen.

function applyOperation(state, node, carrier, modifier, times, isConditional, witness)
  if times == 0 or modifier.target == null: return   // nicht deutbares Ziel: im Resolver gemeldet
  handler = MODIFIER_HANDLERS[modifier.kind][modifier.target.kind]   // Registry Art → Ziel → Effekt
  if handler == null: diagnostics.add(UNSUPPORTED_MODIFIER); return  // ungültige Paarung
  handler(...)
  // set → setzt (Zahl bei Kosten/Grenze, Text bei Name/Merkmal); increment/decrement/multiply
  // → numerisch × times; add/remove/set-primary/unset-primary → Kategorie-Mitgliedschaft;
  // add auf error/warning/info → Autor-Meldung; append/prepend → Text, getrennt durch `join`.
  // Ein Schreibzugriff auf eine GRENZE legt zugleich ihren Kettenschritt an (§3.4).
```

Info-Elemente (`profile`/`rule`/`infoGroup`/`infoLink`) tragen dieselbe `EntryBase` wie eine Definition und damit **eigene Modifikatoren**; ein `infoLink` verweist per `targetId` auf sein Ziel und erbt dessen Merkmale und Modifikatoren als *sein* Vorkommen. Zeigt er auf eine **Info-Gruppe**, kommen deren Mitglieder als eigene Träger hinzu — die Gruppe bündelt nur, ihre Mitglieder tragen die Werte und ihre eigenen Modifikatoren.

Wichtig: Jede Fixpunktrunde wendet Modifikatoren auf eine frische Kopie der **Basiswerte** an — sonst würde `ADD` über Runden hinweg kumulieren.

### 4.7 Constraint-Auswertung

```
function evaluateAllConstraints(tree, effective, index, diagnostics): ConstraintResult[]
  results = []
  for node in allNodesOf(tree):                          // Phantome eingeschlossen
    ctx = QueryContext(node, index, diagnostics)
    for limit in node.def.limits:
      actual = query(ctx, limit.field, limit.scope, targetIdFor(limit, node), limit.flags)
      bound  = resolveBound(ctx, limit, effective)
      if bound == SUSPENDED: continue                    // A4: Null-Nenner
      satisfied = limit.kind == MIN ? actual >= bound : actual <= bound
      results.add(ConstraintResult(limit, node, actual, bound, satisfied,
                                   delta = bound - actual,
                                   // Am Angebots-Anker ausgewertet, aber nie gemeldet:
                                   isReportable = node.anchorKind != OFFER_ANCHOR))
  return results

function resolveBound(ctx, limit, effective): number | SUSPENDED
  raw = effective.limitValues[(ctx.node, limit.id)]      // ggf. durch Modifikatoren verändert
  if not limit.isPercent: return raw
  denominator = query(ctx, limit.field, limit.scope, targetId = null, limit.flags)
  if denominator == 0:
    ctx.diagnostics.add(Diagnostic.ZERO_DENOMINATOR(limit))
    return SUSPENDED
  return roundHalfUp(denominator * raw / 100)            // Rundung: eine zentrale Konvention
```

### 4.8 Bericht und UI-Projektion

```
function buildReport(tree, effective, results, diagnostics, unstableNodes): Report
  capabilities = {}
  for node in selectableSlotsOf(tree):                   // JEDER Knoten: belegt wie Anker
    minResult = findResult(results, node, MIN)
    maxResult = findResult(results, node, MAX)
    capabilities[pathOf(node)] = SlotCapability(
      node          = node,
      anchorKind    = node.anchorKind,                 // Herkunft des Slots
      frame         = frameReferenceOf(node),          // Kontingent bzw. Eltern-Auswahl
      effectiveMin  = minResult?.bound,
      effectiveMax  = maxResult?.bound,
      current       = maxResult?.actual ?? minResult?.actual ?? 0,
      headroom      = maxResult != null ? max(0, maxResult.bound - maxResult.actual) : null,
      isMandatoryUnmet = minResult != null and not minResult.satisfied,
      isBlocked     = maxResult != null and maxResult.actual >= maxResult.bound,
      isHidden      = effective.isHidden(node),
      isValueUnstable = node in unstableNodes,         // kam in der Schleife nicht zur Ruhe
      defId         = node.def.id,
      name          = effective.nameOf(node),          // nach allen Namens-Modifikatoren
      authorMessages  = renderedAuthorMessagesOf(node, effective),   // §3.6, ADR-0028
      infoElements    = infoElementsOf(node, effective, profileTypes))  // §3.6, infoProjection.js

  // EINE Liste, zwei Herkünfte, ein Diskriminator (§3.6). Die Autor-Meldungen kommen
  // aus den eben gebauten Fähigkeitsdatensätzen — dieselben gerenderten Texte, nicht
  // ein zweites Mal gerendert.
  derived = results.filter(r → r.isReportable and not r.satisfied)
                   .map(r → classifyDerivedViolation(r, ctx) + causesFieldOf(r.derivation))
  authored = capabilities.values
                   .filter(c → isReportableAnchorKind(c.anchorKind))   // nie am Angebots-Anker
                   .flatMap(c → c.authorMessages.map(m → classifyAuthorMessage(c.node, m, ctx)))
  return Report(
    violations   = derived + authored,
    capabilities = capabilities,
    diagnostics  = diagnostics)

// UI-Seite: reine Lookups, keine Regelauswertung. Sie gehoeren zum Verbraucher
// und stehen bewusst NICHT in der Engine — der Bericht traegt die Aussage schon.
function isSelectable(report, path):  cap = report.capabilities[path]
                                      return not cap.isHidden and not cap.isBlocked
function remainingAllowed(report, path): return report.capabilities[path].headroom
function mandatoryOpenSlots(report):  return report.capabilities.values
                                            .filter(c → c.isMandatoryUnmet)
```

### 4.9 Inkrementalisierung (nur falls A1 kippt)

Hinter derselben `evaluate`-Schnittstelle, für die Aufrufer unsichtbar: Eine Roster-Änderung invalidiert nur die Scope-Schlüssel ihrer Rahmenkette (Eltern-Kette, eigenes Kontingent, roster, betroffene Kategorien und Definitions-IDs). Nur Knoten, deren Queries invalidierte Schlüssel berühren, werden neu ausgewertet. Erst messen, dann bauen (YAGNI).

## 5. Trade-offs, Risiken, verworfene Alternativen

**Interpretieren statt Kompilieren.** Regeln zu Closures zu kompilieren wäre schneller, aber intransparent für Diagnosen und schwerer zu debuggen. Der Interpreter über dem Query-Primitiv bleibt; Kompilierung wäre eine spätere Optimierung hinter derselben Schnittstelle.

**Zentrale Indizes statt lokalem Hochreichen.** Grenzen lokal am Teilbaum auszuwerten und Ergebnisse nach oben zu propagieren scheitert strukturell an roster-, force- und Kategorie-Scopes, die quer zum Baum liegen.

**Keine separate UI-Regelschicht.** Eine zweite, UI-nahe Auswertung driftet garantiert. Der Fähigkeitsdatensatz im Bericht ist die einzige Quelle.

**Kein Rete-Netz.** Inkrementelle Regelnetze sind für Listen dieser Größe Überengineering; die Scope-Schlüssel-Invalidierung (4.9) ist die einfachere Reserve.

**Risiken.**
1. *Dokumentreihenfolge über Katalog-Grenzen:* Der Resolver muss beim Hereinverlinken eine deterministische Gesamtordnung festlegen — sonst ist Modifikator-Semantik plattformabhängig.
2. *Flag-Interaktionen:* `shared` × `includeChildSelections` × `includeChildForces` × Scope-Arten ergeben eine Matrix feiner Fälle. Das Query-Primitiv braucht eine Matrix-Testsuite als ausführbare Spezifikation (FIRST-Tests, ein Fall pro Zelle).
3. *Fixpunkt:* Pathologische Kataloge (Modifikator A aktiviert B, B deaktiviert A) oszillieren. Die Rundenobergrenze plus Diagnose macht das sichtbar statt still falsch.
4. *ID-Mehrdeutigkeit:* Ohne protokollierte Auflösungsentscheidungen sind Katalogfehler praktisch unauffindbar; das `resolutionLog` gehört in den Bericht.
5. *Rundungskonventionen:* Prozentgrenzen und Repeats brauchen je genau eine zentrale, dokumentierte Rundungsregel — verstreute `floor`/`round`-Aufrufe wären ein klassischer Driftfehler.

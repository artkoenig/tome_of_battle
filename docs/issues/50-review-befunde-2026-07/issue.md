Status: ready-for-agent
Type: fix
Blocked by: None

## Description

Ergebnis eines Reviews gegen die Architektur- und Code-Prinzipien sowie gegen
die offiziellen BSData-Richtlinien (BSData/catalogue-development Wiki, vendorte
`Catalogue.xsd` v2.03). Architektur und Codequalität sind insgesamt tragfähig;
die Befunde liegen fast ausschließlich in der Umsetzung der BSData-Semantik.

Erfasst sind acht Befunde. Für keinen davon existiert eine ADR-Ausnahme — die
ADR-gedeckten Lücken (`catalogueLink/@importRootEntries`, `collective` als reine
Anzeige-Gruppierung) sind bewusst nicht Teil dieses Issues.

### Befunde

**K1 — Ausheben hängt die Einheit an jedes Kontingent.**
Beim Ausheben wird ein Einheiten-Objekt gebaut und über alle Kontingente hinweg
angehängt — dasselbe Objekt mit derselben Id. Bei einem Roster mit mehreren
Kontingenten (entsteht beim `.ros`-Import) zählt die Einheit mehrfach in Punkten
und Kategoriezählern, und die doppelte Id bricht jede Suche und Ersetzung über
die Selektions-Id.

**K2 — `shared` wird geparst, aber nie ausgewertet.**
Der Parser liest das Attribut an Constraints und Conditions; kein Konsument
greift darauf zu. Faktisch verhält sich die App durchgehend wie `shared="true"`,
zählt also immer über alle Instanzen im Roster aggregiert. Jede
`shared="false"`-Beschränkung wird dadurch systematisch überzählt: der Validator
meldet Verletzungen, die es nicht gibt, und weil die Aushebe-Verfügbarkeit laut
ADR 0022 aus demselben Validator abgeleitet wird, sind Einträge gesperrt, die
wählbar sein müssten.

**W1 — Verschachtelte Kontingente gehen beim Import verloren.**
Der Import liest nur Kontingente direkt unter dem Wurzel-`forces`. Das Schema
erlaubt Kontingente innerhalb eines Kontingents; diese werden samt Inhalt
kommentarlos verworfen. ADR 0011 beschreibt die Serialisierung ausdrücklich als
verlustfreien Adapter. Zusätzlich begründen zwei Solver-Kommentare ihre
`includeChildForces`-Auswertung damit, Kind-Kontingente seien als
Roster-Geschwister flachgelegt — das trifft nicht zu, sie existieren im Modell
gar nicht.

**W2 — Modifier-Reihenfolge zieht `set` vor.**
Vor dem Anwenden werden alle `set`-Modifier nach vorn sortiert. BattleScribe
wendet Modifier in Dokumentreihenfolge an. Ein Katalog, der bewusst
`increment` → `set` schreibt, liefert damit das umgekehrte Ergebnis. Die
Namensauswertung im selben Modul macht es bereits richtig — dieselbe Frage wird
an zwei Stellen verschieden beantwortet.

**W4 — Katalog-Kontext geht bei der Auflösung verloren.**
An mehreren Aufrufstellen wird die `catalogueId` nicht durchgereicht. Der
Resolver fällt dann auf einen Scan über alle Katalog-Indizes zurück und liefert
den ersten Treffer. Unter ADR 0018 (zwei Kataloge parallel geladen) kann das den
Eintrag des falschen Katalogs zurückgeben. Der Fallback ist ein
Implementierungsdetail, auf das sich Aufrufer stillschweigend verlassen.

**W5 — `library`-Kataloge werden nicht erkannt.**
Das Schema kennt `library` am Katalog-Wurzelelement, der Codegen führt die
Konstante, der Parser liest sie nicht. Die Armeeauswahl bietet deshalb auch
reine Bibliothekskataloge als spielbare Armee an.

**W6 — Pflichtgruppen-Kosten nehmen die erste Option statt der Vorgabe.**
Die Kostenschätzung einer Pflicht-Auswahlgruppe nimmt die erste Option, während
die Fabrik beim tatsächlichen Ausheben korrekt `defaultSelectionEntryId`
respektiert. Angezeigte und tatsächlich anfallende Punkte können auseinander
laufen.

**N1 — Schema-Konstanten nur zur Hälfte genutzt.**
`ConstraintKind` wird generiert, aber in keinem Produktivmodul verwendet;
stattdessen stehen `'min'`/`'max'` als Literale in gut einem Dutzend Dateien,
zwei davon mit einer eigenen lokalen Konstanten-Kopie. Das unterläuft genau die
Drift-Klasse, zu deren Beseitigung ADR 0016 den Codegen eingeführt hat.

### Quellen

- BSData/catalogue-development Wiki — Data structure overview (`shared`, Scopes,
  `includeChildSelections`/`includeChildForces`, Repeats, Links)
- BSData/catalogue-development Wiki — Collective Entries
- Vendorte `src/parser/schema/Catalogue.xsd` v2.03 (Herkunft BSData/schemas)

## Acceptance Criteria
- [ ] Alle acht Befunde sind über die Unter-Issues behoben
- [ ] Die Testsuite ist grün und Lint sauber
- [ ] Betroffene ADRs (0003, 0011, 0016) spiegeln den erreichten Stand

## Comments

Status: ready-for-agent
Type: feature
Blocked by: None

## Description

# PRD: Verständliche Fehlermeldungen

## Problem Statement / Bug Description

Validierungsmeldungen sind heute sehr technisch formuliert und uneinheitlich
dargestellt. Beispiel aus der App:

> `Kategorie "Weapons" erlaubt maximal 0 Auswahlen (aktuell: 1 für Commander).`

Zwei Probleme:

1. **Sprache/Fachjargon.** Begriffe wie „Kategorie", „Auswahlen",
   „Limitüberschreitung" und die roh eingeblendeten internen Zahlen sind für
   Anwender schwer verständlich.
2. **Uneinheitliche Darstellung.** Es gibt keine gemeinsame Anzeige-Komponente:
   drei Stellen rendern denselben Meldungstext je eigenem Markup und ad-hoc
   gestylten roten/gelben Klassen. Schweregrade (error/warning/info) sind nirgends
   einheitlich als Kontrakt festgelegt.

Ursache ist die Datenform: Jede Meldung entsteht als **fertig zusammengebauter
deutscher Textstring**. Die Zahlen (min/max/aktuell) und die betroffene Entität
werden einmal in den Satz interpoliert und existieren danach nur noch im String —
es gibt kein strukturiertes Fehlerobjekt, aus dem eine Komponente einen
verständlichen Satz neu zusammensetzen könnte.

## Solution

Zwei zusammengehörige Bausteine, **rein auf Darstellung/Wortlaut begrenzt** —
die Validierungslogik (welche Verstöße entstehen und ob sie stimmen) bleibt
unverändert:

1. **Strukturierte Validierungsmeldung.** Der Validator liefert zusätzlich zu
   (oder statt) dem fertigen Text die Werte, die er intern ohnehin schon
   berechnet, als benannte Felder mit: Typ, betroffene Entität/Katalogname,
   Grenze (min/max), aktueller Wert und Einheit (Auswahlen/Punkte/Prozent).
   Das ist eine **Datenform-Änderung, keine Logikänderung** — es werden dieselben
   Verstöße mit denselben Zahlen gemeldet wie bisher.
2. **Gemeinsame Anzeige-Komponente.** Eine einzige Komponente ersetzt die drei
   ad-hoc-Renderstellen. Sie baut aus den strukturierten Feldern einen
   verständlichen deutschen Klartext-Satz in Alltagssprache und stellt ihn je
   Schweregrad einheitlich dar (Farbe + Icon + Ton).

Der deutsche Text wird an **einer einzigen zentralen Stelle** komponiert (nicht
wieder über Views verstreut), damit später eine Sprachschicht andocken kann,
ohne dass Meldungstexte erneut auseinanderlaufen (i18n ist heute nicht Teil
dieses Vorhabens, siehe Out of Scope).

**Grenzen der Umformulierung:**
- **App-Meldungen** (vom Validator selbst erzeugt) werden in verständliche
  Alltagssprache gebracht; Fachjargon raus.
- **Autor-Meldungen** (`modifier-error/-warning/-info`, wortgetreuer Text des
  Katalog-Autors) bleiben im **Wortlaut unangetastet** und werden nur einheitlich
  gestylt (ADR 0022).
- **Katalognamen** (`"Weapons"`, `"Commander"` …) bleiben unverändert und
  unübersetzt; nur das Satzgerüst darum herum ist frei formulierbar (ADR 0003).

Beispiel der Zielwirkung (App-Meldung): statt der obigen Meldung
`Commander darf keine Auswahl aus „Weapons" treffen.` — gleiche Aussage, als
natürlicher Satz, ohne interne Struktur­begriffe.

## Formulierung / Ton (verbindlich)

Diese Regeln gelten für **App-Meldungen** und sind die maßgebliche Vorgabe für
die zentrale Klartext-Komposition (Autor-Meldungen bleiben wortgetreu, siehe
oben):

- Ein ganzer, natürlicher deutscher Satz. Keine internen Struktur­begriffe
  („Kategorie", „Option", „Limitüberschreitung"), kein angehängtes
  „(aktuell: N)".
- Der Name der betroffenen Einheit/Auswahl steht **ohne Possessiv** am
  Satzanfang (`Commander darf …`), nicht „dein Commander" — kein Duz-Ton, und
  so entfällt die Artikel-/Beugungsfrage bei (oft englischen) Eigennamen.
- Armee-/listenweite Meldungen bekommen einen Artikel: „Die Armee …",
  „Die Liste …", sonst klängen sie abgehackt.
- Katalognamen bleiben wortgetreu in Anführungszeichen (ADR 0003), auch
  englische.
- Allgemeines Zählwort ist **„Auswahl"/„Auswahlen"**, wenn es um Picks aus einer
  Gruppe/Kategorie geht (`… höchstens eine Auswahl aus „Arcane Items" treffen`).
- Geht es um die **Häufigkeit eines einzelnen Eintrags**, wird um den
  Eintragsnamen herum formuliert (`„Hand Weapon" höchstens einmal wählen`), da
  „Auswahl" dort nicht passt.
- Kleine Zahlen als Wort („eine", „zwei", „einmal"). Kein Handlungshinweis.

Verbindliche Beispiele je Familie (werden zur Testvorgabe der Komposition):

| Familie | Meldung |
| --- | --- |
| Gruppe max = 0 (Screenshot) | `Commander darf keine Auswahl aus „Weapons" treffen.` |
| Gruppe max ≥ 1 | `Butcher darf höchstens eine Auswahl aus „Arcane Items" treffen.` (bzw. „zwei Auswahlen") |
| Gruppe min | `Butcher braucht mindestens eine Auswahl aus „Arcane Items".` |
| Kategorie max (Armee) | `Die Armee darf höchstens eine Auswahl aus „Special" treffen.` |
| Kategorie min (Armee) | `Die Armee braucht mindestens zwei Auswahlen aus „Core".` |
| Pflichteintrag fehlt | `Die Armee braucht noch einen „General".` |
| Eintrag max | `Commander darf „Hand Weapon" höchstens einmal wählen.` (max = 0: `… darf „Shield" nicht wählen.`) |
| Eintrag min | `Commander braucht mindestens eine „Hand Weapon".` |
| Punkte gesamt | `Die Liste hat 111 Punkte – erlaubt sind 100.` |
| Punkte Gruppe | `General darf für „Magic Items" höchstens 100 Punkte ausgeben.` |
| Prozent | `„Handlanger" dürfen höchstens 50 % der Punkte ausmachen.` |
| Eintrag nicht mehr im Katalog | `„Old Model" gibt es im Katalog nicht mehr.` |

## User Stories / Requirements

1. Als Listenbauer möchte ich Fehlermeldungen in verständlicher Alltagssprache
   lesen, damit ich sofort verstehe, was an meiner Liste nicht stimmt, ohne die
   internen Regelbegriffe zu kennen.
2. Als Listenbauer möchte ich, dass Fehler, Warnungen und Hinweise überall in der
   App gleich aussehen (Farbe/Icon je Schweregrad), damit ich ihre Dringlichkeit
   auf einen Blick einordnen kann.
3. Als Listenbauer möchte ich, dass die von Katalog-Autoren geschriebenen Texte
   im Wortlaut erhalten bleiben, damit ihre Aussage nicht durch Umformulierung
   verfälscht wird.
4. Als Maintainer möchte ich Meldungstexte an einer einzigen Stelle formuliert
   haben, damit sie konsistent bleiben und später um weitere Sprachen ergänzbar
   sind.

## Technical Decisions

- **Betroffene Bereiche (Verhalten, nicht Dateipfade):**
  - Der Roster-Validator (heute die alleinige Quelle aller App-Meldungen) trägt
    künftig die strukturierten Felder je Verstoß.
  - Eine neue, gemeinsame Anzeige-Komponente ersetzt die drei heutigen
    Renderstellen (Lagerbericht/Validierungspanel, Einheitenkarte, ggf.
    Kategorie-Abschnitt).
  - Die Klartext-Komposition (strukturierte Felder → deutscher Satz) lebt an
    genau einer zentralen Stelle.
- **Architektur-Entscheidungen / Klarstellungen:**
  - **Reine Darstellungsänderung.** Keine Änderung an der Validierungslogik: keine
    andere Menge an Verstößen, keine anderen Limits, keine Bug-Fixes an falschen
    Meldungen. Bekannte Logik-Bugs (die inhaltlich falsche Meldungen erzeugen)
    bleiben Sache ihrer eigenen Issues; dieses Vorhaben verschönert ausdrücklich
    nur die Darstellung und darf eine falsche Meldung nicht „vertrauenswürdiger"
    aussehen lassen als sie ist.
  - **Neuer Schweregrad-Kontrakt.** error/warning/info bekommen einen verbindlichen,
    an allen Renderstellen gleichen Darstellungs-Kontrakt (Farb-/Icon-Token). Da
    ADR 0004 dafür heute keine Konvention definiert und die Entscheidung schwer
    reversibel ist, sobald Komponenten darauf bauen, wird sie als **neue ADR
    (voraussichtlich 0026)** festgehalten — die konkreten Token-Werte werden bei
    der Umsetzung fixiert.
  - **Bestehender Anzeige-Transform.** `stripHypotheticalCount` (ADR 0022) matcht
    heute per Regex auf den alten Wortlaut „(aktuell: N)". Sobald Meldungen aus
    strukturierten Feldern entstehen, wird dieser String-Regex überflüssig bzw.
    durch die strukturierten Felder abgelöst; sein Verhalten (Kappen des
    hypothetischen Zählwerts auf dem Aushebe-Dialogpfad) muss erhalten bleiben.
  - **i18n-fähige, aber einsprachige Ablage.** Genau eine zentrale Textquelle,
    heute nur Deutsch; eine echte Übersetzungsschicht wird nicht eingeführt.
- **API-Kontrakte / Datenmodelle:**
  - Die Validierungsmeldung erhält strukturierte Felder (mindestens: Typ,
    Schweregrad, betroffene Entität + Katalogname, Grenze min/max, aktueller Wert,
    Einheit). Bestehende Korrelations-IDs und der maschinelle `type` bleiben
    stabil (Diff-/Blocking-Logik keyt darauf, nicht auf den Text).
  - Autor-Meldungen tragen keinen umformulierbaren Satz, sondern nur den
    wortgetreuen Autortext + Schweregrad.

## Testing Decisions

- **Zu testende Bereiche:**
  - Klartext-Komposition: strukturierte Meldung → erwarteter deutscher Satz
    (inkl. unveränderter Katalognamen, Alltagssprache, kein Handlungshinweis).
  - Gemeinsame Anzeige-Komponente: je Schweregrad korrekte Darstellung; App- vs.
    Autor-Meldung (Autortext wortgetreu durchgereicht).
  - Erhalt des `stripHypotheticalCount`-Verhaltens auf dem Aushebe-Dialogpfad.
- **Test-Interfaces (Seams):**
  - Die reine Kompositionsfunktion (strukturierte Felder → Satz) als bevorzugter,
    framework-freier Seam.
  - Die Anzeige-Komponente über ihre Props (Meldungsobjekt) — Rendering pro
    Schweregrad und pro Meldungsart.
  - Der Validator über sein bestehendes öffentliches Interface (`validateRoster`):
    prüft, dass die strukturierten Felder korrekt gefüllt sind, ohne dass sich die
    Menge/Wahrheit der Verstöße ändert.

## Out of Scope

- Änderungen an der Validierungslogik jeglicher Art (keine neuen/entfernten
  Verstöße, keine korrigierten Limits).
- Beheben bekannter Logik-Bugs, die inhaltlich falsche Meldungen erzeugen (bleiben
  eigene Issues).
- Umformulieren oder Übersetzen von Autor-Meldungen (`modifier-*`) und von
  Katalognamen.
- Handlungshinweise / Remediation („entferne 1 Waffe") — bewusst nicht Teil dieses
  Wurfs.
- Einführen einer echten i18n-/Mehrsprachigkeits-Infrastruktur (kommt später).

## Acceptance Criteria
- [ ]

## Comments

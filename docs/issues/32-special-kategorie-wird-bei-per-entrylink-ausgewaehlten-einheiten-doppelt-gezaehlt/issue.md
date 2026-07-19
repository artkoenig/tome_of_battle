Status: resolved
Type: fix
Blocked by: None

## Description
Im Lagerbericht (Roster-Editor) wird die Anzahl der Auswahlen pro
Force-Org-Kategorie (z.B. "Special") für manche Armeelisten zu hoch
angezeigt, was fälschlich Validierungsfehler auslöst ("Maximal N Auswahlen
... erlaubt (aktuell: zu hoch)"), obwohl die Liste regelkonform ist.

Reproduziert mit dem Ogre-Kingdoms-Katalog der "Lexicanum"-Quelle: eine
Liste mit 2x Gnoblar Scraplauncher und 2x Leadbelchers (alle vier "Special")
zeigt "Special: 6 / MAX: 4" statt korrekt "Special: 4 / MAX: 4".

Root Cause: Die Kategorie-Zählung einer Top-Level-Auswahl läuft über zwei
Pfade. Der erste zählt anhand der *effektiven* Kategorie-Verknüpfungen
(inklusive Kategorie-Modifikatoren wie "setze Primärkategorie" oder "füge
Kategorie hinzu", wie sie z.B. für bedingte Kategorie-Zuweisungen genutzt
werden). Der zweite ist ein Fallback für Auswahlen, deren Katalogeintrag gar
nicht mehr auflösbar ist, und zählt in diesem Fall anhand der auf der
Auswahl selbst gespeicherten Kategorie nach. Sein Schutz vor Doppelzählung
prüft dabei nur die *statischen, unaufgelösten* Kategorie-Verknüpfungen des
Katalogeintrags – nicht, ob die Kategorie bereits über den ersten Pfad
gezählt wurde.

Das führt zur Doppelzählung genau dann, wenn eine Einheit (a) über einen
Entry-Link ausgewählt wird (üblich, wenn eine Einheit aus einem geteilten
Katalogbereich eingebunden wird) UND (b) ihre Force-Org-Kategorie über einen
Modifikator statt über eine statische Kategorie-Verknüpfung erhält – denn
der Entry-Link selbst trägt dann keine eigenen Kategorie-Verknüpfungen,
sodass der Fallback-Schutz fälschlich "noch nicht gezählt" annimmt.

## Acceptance Criteria
- [x] Eine Top-Level-Auswahl wird pro Kategorie höchstens einmal gezählt,
      unabhängig davon, ob ihr Katalogeintrag direkt oder über einen
      Entry-Link referenziert wird und ob die Kategorie statisch oder über
      einen Modifikator zugewiesen ist.
- [x] Der Fallback für Auswahlen mit nicht mehr auflösbarem Katalogeintrag
      bleibt erhalten (weiterhin korrekte Zählung anhand der gespeicherten
      Kategorie, wenn der Eintrag wirklich fehlt).
- [x] Neuer/angepasster Unit-Test in `src/solver/rosterCounter.test.js` (oder
      passender Testdatei) deckt genau dieses Szenario ab: eine Einheit,
      referenziert über einen Entry-Link, deren Kategorie über einen
      Modifikator (nicht statisch) gesetzt wird.
- [x] Bestehende Tests (`npm test`) bleiben grün.

## Comments
- Fix in src/solver/rosterCounter.js: computeRosterCounts zaehlte eine per entryLink ausgewaehlte Einheit doppelt in ihre Force-Org-Kategorie, wenn diese per Modifikator (set-primary/add) statt statisch zugewiesen wurde. Ein gemeinsames seenCategories-Set ueber den katalog-basierten Zaehlpfad und den Fallback fuer nicht mehr aufloesbare Katalogeintraege behebt das. Regressionstest in src/solver/modifierGating.test.js ('does not double-count a category on a unit selected via an entryLink whose category comes from a modifier'). Vier-Achsen-Verifikation (testing skill) durchgelaufen: Standards (oxlint sauber, 0 blockierend), Spezifikation (0 Befunde, alle Acceptance Criteria erfuellt), Tests (666/666 vitest gruen), Docs (0 echtes Drift). E2E gegen echten Katalog (Lexicanum-Quelle) bestaetigt: Special zeigt jetzt 4 statt 6, Core 4 statt 6, Rare 1 statt 2 fuer die urspruenglich gemeldete Armeeliste.

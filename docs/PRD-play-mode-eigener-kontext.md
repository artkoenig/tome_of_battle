# PRD: Play-Mode wird ein eigener Kontext

> **Kontext:** Finding F5 aus [`ddd-assessment-and-refactoring-plan.md`](ddd-assessment-and-refactoring-plan.md),
> umgesetzt von Issue [`0190`](issues/0190-play-mode-becomes-its-own-context.md).
> Vorgänger: Issues 0186 (Kontextbaum) und 0188 (Anwendungsschicht).
>
> **Status:** Entscheidungen getroffen, dem Owner zur Freigabe vorgelegt. Erst nach der
> Freigabe bewegt sich Code — die drei offenen Produktfragen aus dem Issue sind unten in
> [Produktentscheidungen](#produktentscheidungen) beantwortet.

## Problem Statement

`Roster.gameState` (`src/shared/rostermodel/types.js:39`) trägt den Zustand einer **laufenden
Partie** — Runde, Siegpunkte, Kommandopunkte und Wunden je Auswahl — innerhalb des
Armeelisten-Aggregats. Verstanden wird er ausschließlich von `src/ui/viewmodels/usePlayState.js`.
Zwei fachlich verschiedene Gegenstandsbereiche teilen sich damit ein Aggregat, einen
IndexedDB-Datensatz und eine Undo-Historie:

- **„Was darf ich aufstellen?"** — eine Liste wird gegen einen Katalog gebaut, validiert, als
  `.ros` exportiert und lebt, solange der Nutzer sie behält.
- **„Was ist in dieser Partie passiert?"** — Wunden werden genommen, Einheiten fallen, und es ist
  vorbei, wenn die Partie vorbei ist. Das hat im `.ros`-Export keine Bedeutung und in einer
  Undo-Historie neben Listenänderungen nichts verloren.

Daraus folgen heute drei konkrete Fehlverhalten:

1. **Jede Wunde schreibt den ganzen Listendatensatz neu.** `usePlayState` ruft `setRoster` mit
   `{ ...prevRoster, gameState }` und reicht das Ergebnis an den Roster-Autosave weiter
   (`usePlayState.js:37-42`). Eine Zahl ändert sich, ein komplettes Roster geht auf die Platte.
2. **Eine Wunde landet in der Undo-Historie der Liste.** `setRoster` ist der Setter des
   undoable State (`src/ui/viewmodels/useUndoableState.js`). Ein Undo nach drei Wunden nimmt eine
   Wunde zurück statt der letzten Listenänderung — und ein Undo einer Listenänderung setzt
   nebenbei Wunden zurück.
3. **Eine Partie hat keine eigene Lebensdauer.** Sie beginnt implizit mit dem Anlegen der Liste
   (`createRoster.js:41` und `rosterSerialization.js:271` setzen `createInitialGameState()`) und
   endet nie. „Neue Partie" ist als Begriff nicht vorhanden.

## Solution

Ein eigener Kontext `src/contexts/play/` mit eigenem Aggregat (`Game`), eigenem Store und eigener
Lebensdauer. Das Aggregat referenziert die Liste über `rosterId` statt in ihr zu wohnen. Die
Oberfläche erreicht ihn über **eine** Fassade; kein Kontext importiert einen anderen (die
Kopplung zwischen Liste und Partie ist die Id, nicht ein Import).

Der Nutzer bekommt damit erstmals eine Partie als eigenes Ding: er startet sie, sie überlebt den
Reload, und er beendet sie — unabhängig davon, was mit der Liste passiert.

## Produktentscheidungen

Die drei Fragen, die das Issue ausdrücklich nicht einseitig entscheiden lässt:

### 1. Macht eine Listenänderung eine laufende Partie ungültig? — **Nein, sie koexistieren.**

Eine Partie zu verwerfen, weil der Nutzer in der Liste einen Tippfehler im Namen korrigiert,
zerstört Daten, die er nicht wiederherstellen kann. Genau die Entkopplung, um die es hier geht,
erlaubt es, beides nebeneinander stehen zu lassen.

Regel für die Kanten:

- Wunden sind nach `selectionId` abgelegt. Verschwindet eine Auswahl aus der Liste, ist
  ihr Wundeneintrag verwaist: er wird beim **Lesen ignoriert** und beim **nächsten Schreiben der
  Partie entfernt**. Kein Eintrag einer noch vorhandenen Auswahl geht dabei verloren.
- Kommt eine Auswahl neu hinzu, hat sie keinen Eintrag und gilt damit als unverwundet — das ist
  dasselbe Verhalten wie heute für jede Auswahl ohne Eintrag (`usePlayState.js:55-63`).
- Runde, VP und CP sind listenunabhängig und bleiben in jedem Fall stehen.
- Es gibt **keine** Warnung, keinen Dialog und keine Sperre beim Bearbeiten einer Liste mit
  laufender Partie. Das wäre eine neue Funktion; das Issue ist eine Verschiebung.

### 2. Bleibt eine Partie erhalten, wenn sie endet? — **Nein, sie wird verworfen.**

„Partie beenden" löscht den `Game`-Datensatz. Je Liste gibt es zu einem Zeitpunkt **höchstens
eine** Partie; eine neue zu starten, während eine läuft, beendet die alte. Eine Historie
aufzuheben, ohne Ansicht, in der man sie liest, produziert nur Daten, die niemand sieht —
Mehrfachpartien, Historie und Statistik sind im Issue ausdrücklich außerhalb des Umfangs. Der
Verzicht ist reversibel: das Aggregat liegt danach getrennt, also ist Historie später eine
Erweiterung und keine zweite Trennung.

Ein Löschen der Liste löscht die zugehörige Partie mit; eine Partie ohne Liste hat keinen
Gegenstand.

### 3. Ändert sich der `.ros`-Export? — **Nein, unter keinen Umständen.**

Der Export ist Nutzerdatenformat. `exportRosterToXml` schreibt `gameState` heute schon nicht, und
`importRosterFromXml` erzeugt beim Einlesen lediglich einen leeren Anfangszustand
(`rosterSerialization.js:271`) — nach der Trennung entfällt diese Zeile ersatzlos. Für eine Liste
ohne laufende Partie ist die Ausgabe **byteidentisch** zu vorher; das ist als Kriterium
festgenagelt (AC5) und nicht verhandelbar.

## User Stories / Requirements

1. **Als Spieler** möchte ich **eine Partie zu einer Liste starten**, damit Wunden, Runde, VP und
   CP an einem Ort gezählt werden, der nicht meine Liste ist.
2. **Als Spieler** möchte ich, dass **eine genommene Wunde den Reload überlebt**, damit ich das
   Handy zwischendurch weglegen kann.
3. **Als Spieler** möchte ich, dass **Undo im Listeneditor meine Listenänderung zurücknimmt und
   nicht meine letzte Wunde**.
4. **Als Spieler** möchte ich **meine Liste während einer laufenden Partie bearbeiten können**,
   ohne die Partie zu verlieren.
5. **Als Spieler** möchte ich **eine Partie beenden können**, damit die nächste bei null anfängt.
6. **Als Spieler** möchte ich, dass **eine exportierte `.ros`-Datei exakt so aussieht wie bisher**,
   damit sie in Battlescribe und bei meinen Mitspielern unverändert funktioniert.
7. **Als Nutzer mit bestehenden Listen** möchte ich, dass **eine bereits gezählte Partie beim
   Update erhalten bleibt**, statt beim ersten Start verloren zu gehen.

## Technical Decisions

### Aggregat

```
Game {
  id            – Schlüssel des Datensatzes
  rosterId      – Referenz auf die Liste; die einzige Kopplung
  round, vp, cp – Zähler
  wounds        – { [selectionId]: number | number[] }
}
```

`wounds` behält die heutige Form (Zahl oder Array je Modell, `usePlayState.js:55-63`) — die
Migration soll Daten verschieben, nicht umschreiben.

### Speicherung

Ein eigener Object Store `games` in derselben IndexedDB-Datenbank (`TomeOfBattleDB`,
`src/platform/persistence/database.js`), angelegt über eine Erhöhung von `DB_VERSION`. Eigener
Store heißt: ein Wundenschreiben rührt den `rosters`-Store nicht an.

### Migration

Beim Start wandert der `gameState` **jedes** gespeicherten Rosters in einen `Game`-Datensatz mit
`rosterId = roster.id`, und das Feld verschwindet aus dem Roster-Datensatz. Ein `gameState`, der
dem Anfangszustand entspricht (Runde 1, VP 0, CP 0, keine Wunden), erzeugt keinen Datensatz —
das ist keine Partie, sondern das Fehlen einer. Die Migration läuft neben den bestehenden in
`src/platform/persistence/migrations.js`, ist idempotent und wird gegen eine Fixture in der
**alten** Form getestet (AC4).

### Grenze zur Oberfläche

`usePlayState` verliert `setRoster` und `saveRosterCallback` und spricht stattdessen mit der
Fassade des Play-Kontexts. Damit fällt Punkt 1 und 2 aus dem Problem Statement weg, ohne dass die
Komponenten des Play-Modus sich ändern müssen.

### Versionierung

Sichtbarer Nutzereffekt (Partie starten/beenden, Undo-Verhalten) ⇒ **Minor-Bump** über
`node scripts/release.js minor`, auf dem Issue-Branch vor dem PR (AC12).

## Out of Scope

- Mehrere Partien je Liste, Partie-Historie, Statistik.
- Neue Play-Mode-Funktionen. Was der Nutzer im Play-Modus tun kann, bleibt gleich, außer wo diese
  Trennung selbst es ändert (Partie starten/beenden).
- Jede Änderung am `.ros`-Format.
- Warn- oder Sperrdialoge beim Bearbeiten einer Liste mit laufender Partie.

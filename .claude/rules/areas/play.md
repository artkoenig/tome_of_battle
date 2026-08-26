---
paths:
  - "src/contexts/play/**"
---

# play — die laufende Partie

Der fünfte Bounded Context (Issue 0190, PRD `docs/PRD-play-mode-eigener-kontext.md`): Runde,
Siegpunkte, Kommandopunkte und Wunden je Auswahl. Vorher war das `Roster.gameState` — jede
Wunde schrieb den Listendatensatz neu und landete in der Undo-Historie der Liste.

- **Die Kopplung an die Liste ist die `rosterId`, nie ein Import.** `contexts/play` darf
  `contexts/armylist` nicht importieren (`kontext-kein-fremder-kontext`, Regel N1). Was der
  Kontext über die Liste wissen muss, liest er aus der geteilten Form
  `src/shared/rostermodel/types.js` — deshalb läuft der Auswahl-Walk (`selectionIdsOf`) hier
  noch einmal, statt einen Baumhelfer der Liste zu benutzen.
- **Eine Tür**: `src/contexts/play/index.js`. Die Oberfläche importiert
  `'../../contexts/play'`, nie `model/`, `application/` oder `ports/`. Ein fehlender Name
  bekommt dort eine Re-Export-Zeile.
- **`ports/storagePort.js` ist die einzige Stelle, die `src/platform/` nennen darf**
  (`kontext-nicht-auf-plattform`, Ausnahme `nur-die-ports-erreichen-die-plattform`). Er
  re-exportiert auch `runGameStateMigration` — die Oberfläche erreicht die Persistenz nur über
  eine `application`-Schicht, die Start-Migration eingeschlossen.
- `.cast/rules.json` braucht je Kontext eine `allowed`-Zeile, damit seine Module sich
  untereinander importieren dürfen: `kontext-intern-play`. Ohne sie schlägt `npm run cast`
  (in `forge-lint`) auf der ersten kontextinternen Kante fehl.
- **Kein `dataEvents`-Signal beim Schreiben einer Partie.** Der Kanal trägt Listen- und
  Systemstände, an denen die Roster-Liste hängt; eine Wunde geht sie nichts an — genau darum
  liegt sie jetzt hier. (Der Rest der Schreibwege meldet sich dort sehr wohl an, ADR-0037.)
- Die Ablage ist der eigene Object Store `games` (`src/platform/persistence/database.js`,
  `DB_VERSION`). Es gibt **höchstens eine** Partie je Liste; gelesen wird per Scan über
  `rosterId`, nicht über einen Index. Wer den Store ändert, ändert `DB_VERSION` mit — Nutzer
  tragen ihre IndexedDB über Releases (ADR 0002).
- Der Anfangszustand (Runde 1, keine Punkte, keine Wunden) wird **nicht** gespeichert:
  `saveGame` verwirft ihn und löscht einen vorhandenen Datensatz. Ein Betreten des Spielmodus
  ohne Zug darf keinen Datensatz erzeugen.
- Verwaiste Wundeneinträge (Auswahl aus der Liste verschwunden) werden beim **Lesen ignoriert**
  und beim **nächsten Schreiben entfernt** — Produktentscheidung 1 des PRD. Ohne übergebene
  Liste wird nichts entfernt: lieber ein verwaister Eintrag als eine gelöschte Wunde.
- **Ein Löschen der Liste löscht ihre Partie, und das entscheidet dieser Kontext** (Issue 0193):
  `application/rosterDeletionPolicy.js` abonniert `roster-deleted` auf dem Änderungskanal
  `src/shared/events/dataEvents.js` und ruft `endGame`. Kein Kontext ruft den anderen — die
  Kopplung bleibt die `rosterId` über ein veröffentlichtes Ereignis, und `kontexte -> shared` ist
  eine erlaubte Kante. Das Modul meldet sich beim Laden selbst an; scharf wird es über
  `index.js`, das `useAppData` beim Start importiert. `endGame` steht deshalb **nicht** mehr in der
  Tür `index.js` und hat keinen Aufrufer unter `src/ui/`.
  Die Zustellung ist synchron und wartet auf niemanden: der Abonnent ist bewusst "feuern und
  vergessen" mit eigenem `.catch` (ein zurückgegebenes Promise entkäme als unbehandelte
  Ablehnung), die frühere Reihenfolge-Zusage entfällt. `endGame` ist idempotent, eine nie gespielte
  Liste also ein leerer Lauf. Ein Test, der `platform/persistence/database` mockt und Listen
  löscht, braucht weiterhin `deleteGamesOfRoster` im Mock, sonst schlägt der Löschpfad still fehl;
  gepinnt ist die Regel rendererlos in
  `src/tests/contexts/play/application/rosterDeletionPolicy.test.js`.
- Die Start-Migration hängt in `useAppData.runStartupLoad` **vor** dem ersten Lesen. Jeder Test,
  der `platform/persistence/migrations` mockt, muss `runGameStateMigration` mitmocken.
- Lauf: `forge-test --run src/tests/contexts/play`; die Migration: `forge-test --run migrations`.
  Tests liegen gespiegelt unter `src/tests/contexts/play/…`, Testtitel deutsch wie in den
  übrigen Kontexten.

Status: resolved
Type: refactor
Blocked by: None

## Description

**Geruch:** God Component, SSOT-Verstoß, Magic Values, SRP-Verstoß.

Die Wurzelkomponente hält fünfzehn Zustandsvariablen auf rund 600 Zeilen und
vermengt vier unabhängige Belange.

### Teil A — Redundanter Zustand mit beobachtbarem Fehler

Die Roster-Liste und das ausgewählte Roster halten dasselbe Datum doppelt: die
Liste und eine Objektkopie daraus. Dass die ID der eigentliche Schlüssel ist,
beweist der Popstate-Handler selbst — er leitet Roster und System aus der ID
wieder ab.

**Konkreter Fehler:** Beim Umbenennen wird in die Datenbank geschrieben und die
Liste neu geladen, die Objektkopie bleibt aber auf dem alten Stand stehen. Wer
ein geöffnetes Roster umbenennt und zurücknavigiert, sieht den alten Namen bis
zum nächsten vollständigen Neuladen.

### Teil B — PWA-Belange gehören nicht in die Wurzelkomponente

Fünf Zustandsvariablen betreffen ausschließlich den Lebenszyklus der
Progressive Web App (Installationsaufforderung, Installierbarkeit, verfügbares
Update, wartender Service Worker, Release-Information). Sie hängen weder am
Roster noch an der Navigation.

### Teil C — Ansichtszustand als blanker String

Der Ansichtszustand ist ein einfacher String, dessen erlaubte Werte nur als
Kommentar existieren. Ein Tippfehler fällt erst zur Laufzeit auf.

### Teil D — Fachlogik im App-Shell

Die Berechnung der Release-Unterschiede liegt in der Wurzelkomponente und wird
nur zu Testzwecken exportiert. Die darin verwendete Obergrenze steht viermal
als nacktes Literal, und der begleitende Kommentar nennt eine Zahl, die im Code
nirgends vorkommt.

## Acceptance Criteria
- [ ] Nur die ID des ausgewählten Rosters wird im Zustand gehalten; Roster und
      System werden daraus abgeleitet
- [ ] Ein Test belegt, dass ein Umbenennen sich unmittelbar auf die geöffnete
      Ansicht auswirkt
- [ ] Die fünf PWA-Belange liegen in einem eigenen Hook, der ohne die
      Wurzelkomponente testbar ist
- [ ] Die erlaubten Ansichtswerte sind benannte Konstanten; der erläuternde
      Kommentar entfällt dadurch
- [ ] Die Release-Diff-Logik liegt in einem eigenen Modul; die Obergrenze ist
      eine benannte Konstante, der irreführende Kommentar ist korrigiert
- [ ] `npm run lint` und `npm test` bleiben grün

## Comments

Berührt dieselben Dateien wie der offene Pull Request zur
UI-Internationalisierung — erst nach dessen Merge bearbeiten.
- App.jsx entflochten: Auswahl nur noch als selectedRosterId (Roster/System abgeleitet), PWA-Lebenszyklus in src/hooks/usePwaLifecycle.js, Ansichtswerte als VIEWS-Konstanten in src/constants/views.js, Release-Diff in src/utils/releaseDiff.js mit benannter Obergrenze MAX_DIFF_ENTRIES. App.jsx von 600 auf 470 Zeilen.

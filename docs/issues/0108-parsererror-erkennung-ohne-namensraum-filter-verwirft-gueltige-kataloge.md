---
status: done
branch: claude/issues-90-abarbeiten-7ymutc
pr:
---

# parsererror-Erkennung ohne Namensraum-Filter verwirft gültige Kataloge

## Intent

Die in Issue 0097 eingeführte Erkennung kaputten Katalog-XMLs scannt das
ganze Dokument mit `document.getElementsByTagName('parsererror')`
(`src/evaluator/catalogReader.js:935`) — ohne Namensraum-Filter. Echte
Parser-Fehler liegen aber in einem eigenen Namensraum (Mozilla-NS in
jsdom/Firefox, XHTML-NS in Chrome). Ein **wohlgeformter** Katalog, der ein
Element buchstäblich namens `parsererror` enthält, wird deshalb fälschlich
als `MALFORMED_XML` verworfen (laut, aber falsch).

Repro (Review-Runde 1 von Issue 0097, jsdom):

```js
parseCatalogue('<?xml version="1.0"?><catalogue id="cat-x" name="X"><parsererror>not an error</parsererror></catalogue>')
// → { id: null, …, diagnostics: [{ kind: 'unreadableCatalogue', reason: 'malformedXml', … }] }
```

Erwartet: geparster Katalog, keine Diagnose. Schweregrad niedrig: das
BattleScribe-Schema kennt kein `parsererror`-Element, reale `.cat`/`.gst`
können den Fall nicht auslösen. Zu beachten: Chrome bettet den
`parsererror` unterhalb der Original-Wurzel ein, jsdom macht ihn zur
Wurzel — ein Fix muss beide Formen weiter erkennen (die Puppeteer-Probe aus
der Review dokumentiert beide).

Acceptance criteria:

1. Ein wohlgeformter Katalog mit einem Element namens `parsererror` im
   Katalog-Namensraum wird normal geparst (Repro oben liefert `id: "cat-x"`
   und keine Diagnose).
2. Echte Parser-Fehler werden weiterhin in jsdom **und** Chrome erkannt
   (beide Einbettungsformen; die bestehenden malformed-XML-Tests bleiben
   grün).
3. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

Ein Ein-Modul-Fix in `src/evaluator/catalogReader.js`: die Suche nach dem
Fehlerdokument bekommt einen Namensraum-Filter. Statt
`document.getElementsByTagName('parsererror')` (jeder Namensraum, auch der
Katalog-Namensraum) wird über `getElementsByTagNameNS` nur in den beiden
Namensräumen gesucht, in denen `DOMParser` seine Fehlerdokumente ablegt:
Mozilla-NS (jsdom/Firefox) und XHTML-NS (Chrome/WebKit). Beide
Einbettungsformen bleiben abgedeckt, weil `getElementsByTagNameNS` auf dem
Dokument den ganzen Baum inklusive Wurzel absucht.

## Tasks

- [x] Fehlschlagenden Test aus dem Intent schreiben (Repro + beide
      Einbettungsformen).
- [x] Namensraum-Filter in `parseCatalogue` einziehen.
- [x] Evaluator-Suite grün (Kommando, Umfang, Exit-Code).

## Decisions

- **Herkunft:** Blast-Radius-Befund F1 der Review-Runde 1 von Issue 0097
  (2026-07-28); dort bewusst nicht gefixt (außerhalb des Intents, Regel:
  geht an den Menschen bzw. ins Backlog).
- **Chrome-Form deterministisch statt per Browser geprüft:** die
  Chrome-Einbettung (`parsererror` im XHTML-Namensraum *unterhalb* der
  Original-Wurzel) wird im Test als wohlgeformtes XML nachgebaut, das genau
  diese DOM-Form erzeugt. Damit prüft die Suite die Chrome-Form ohne
  Puppeteer-Lauf; ein echter Browser-Lauf war in dieser Session
  ausgeschlossen.
- **Zwei Namensräume, keine Heuristik:** gefiltert wird auf die zwei
  bekannten Fehler-Namensräume. Ein Element `parsererror` in *irgendeinem*
  anderen Namensraum (insbesondere im Katalog-Namensraum oder ohne
  Namensraum) gilt ausdrücklich als gewöhnlicher Katalog-Inhalt.

## Log

- 2026-07-29: In jsdom nachgemessen: nicht wohlgeformtes XML (unverschlossener
  Tag *und* leere Eingabe) liefert eine `parsererror`-**Wurzel** im
  Mozilla-Namensraum `http://www.mozilla.org/newlayout/xml/parsererror.xml`.
- 2026-07-29: Test zuerst geschrieben
  (`src/evaluator/catalogReader.parserErrorNamespace.test.js`) und rot gesehen:
  `npx vitest run src/evaluator/catalogReader.parserErrorNamespace.test.js`,
  5 Fälle, 2 fehlgeschlagen (beide Kriterium-1-Fälle: `id` war `null` statt
  `"cat-x"`), Exit-Code 1. Die drei Kriterium-2-Fälle waren schon vorher grün
  und pinnen damit fest, dass der Fix die Erkennung nicht aufweicht.
- 2026-07-29: Fix in `src/evaluator/catalogReader.js`: `hasParserError(document)`
  sucht über `getElementsByTagNameNS` in den zwei Fehler-Namensräumen statt über
  `getElementsByTagName` in allen. Danach grün:
  `npx vitest run src/evaluator`, 53 Dateien / 709 Fälle, Exit-Code 0
  (Basis vorher 52 / 704). Zusätzlich `npm run lint` (oxlint) Exit-Code 0 und
  `npm run typecheck` (tsc --noEmit) Exit-Code 0. Der Puppeteer-E2E-Teil von
  `npm test` wurde auf Anweisung dieser Session nicht ausgeführt.

- **Kein PR geöffnet:** Arbeit gepusht auf dem Sammel-Branch
  `claude/issues-90-abarbeiten-7ymutc` (Abweichung in Issue 0109 begründet);
  PR und Merge sind Sache des Menschen („stop nach diesem Issue“,
  2026-07-29), das `pr:`-Feld bleibt leer.

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja: ein eng begrenzter Fix an einer
  Zeile Erkennungslogik in `src/evaluator/catalogReader.js`, plus Tests für
  die drei Akzeptanzkriterien. Kein Verhalten außerhalb des Lesers wird
  angefasst.
- **What surprised me?** jsdom macht den `parsererror` auch bei *leerer*
  Eingabe zur Dokumentwurzel — die jsdom-Form fiele damit selbst ohne
  NS-Scan noch in die `UNEXPECTED_ROOT`-Prüfung (andere Diagnose-Ursache,
  aber immer noch eine Diagnose). Der NS-Scan trägt also vor allem die
  Chrome-Form, bei der die Original-Wurzel `catalogue` erhalten bleibt.
- **What am I assuming without having verified it?** Dass Chrome/WebKit ihr
  Fehlerdokument im XHTML-Namensraum ablegen und unter der Original-Wurzel
  einbetten — übernommen aus der Puppeteer-Probe der Review-Runde 1 von
  Issue 0097, in dieser Session nicht selbst im Browser nachgemessen (kein
  Puppeteer-Lauf erlaubt), sondern als DOM-Form nachgebaut.

### Before the PR

- **Does this match what was asked?** Ja. Kriterium 1: das Repro liefert
  jetzt `id: "cat-x"` und `diagnostics: []` (Test). Kriterium 2: beide
  Einbettungsformen werden weiter erkannt, die bestehenden
  malformed-XML-Tests aus Issue 0097 bleiben unverändert und grün.
  Kriterium 3: `npx vitest run src/evaluator`, 53 Dateien / 709 Fälle,
  Exit-Code 0.
- **What surprised me?** Dass der Filter für die *jsdom*-Form gar nicht
  nötig gewesen wäre — dort ist der `parsererror` die Wurzel und wäre auch
  über die Wurzel-Prüfung aufgefallen. Der Wert des Fixes liegt ganz auf der
  Chrome-Form, wo die Original-Wurzel stehen bleibt und nur der NS-Scan den
  Fehler sieht.
- **What am I assuming without having verified it?** Weiterhin, dass
  Chrome/WebKit den XHTML-Namensraum benutzen — die Chrome-Form ist im Test
  als DOM-Form nachgebaut, nicht in einem echten Chrome gemessen. Wäre die
  Annahme falsch, bliebe der Fehler in Chrome unerkannt (stille Rückkehr
  zum Verhalten *vor* Issue 0097), gültige Kataloge kämen aber trotzdem
  durch. Zweite Annahme: kein realer Katalog deklariert einen dieser beiden
  Namensräume — das BattleScribe-Schema kennt keinen davon.

## Retro

- Glatter Lauf: Tests zuerst (2 rot), Fix, Review ohne Befund. Einzige
  offene Flanke: die Chrome-Einbettungsform ist in jsdom nachgebaut, nicht
  im echten Browser gemessen — eine spätere Puppeteer-fähige Session kann
  das nachziehen (im Issue als Annahme festgehalten).

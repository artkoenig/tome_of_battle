---
status: backlog
branch:
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

## Tasks

## Decisions

- **Herkunft:** Blast-Radius-Befund F1 der Review-Runde 1 von Issue 0097
  (2026-07-28); dort bewusst nicht gefixt (außerhalb des Intents, Regel:
  geht an den Menschen bzw. ins Backlog).

## Log

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro

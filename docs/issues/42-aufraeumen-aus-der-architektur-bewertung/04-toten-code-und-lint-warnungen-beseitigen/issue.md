Status: needs-triage
Type: refactor
Blocked by: [01, 02, 03]

## Description

**Geruch:** Toter Code und abgestumpftes Werkzeug. `npm run lint` meldet
**0 Fehler, aber 57 Warnungen**. Warnungen, die niemand mehr liest, verlieren
ihre Funktion als Signal: die 58. Warnung — die echte — fällt dann nicht mehr
auf. Entweder die Befunde werden behoben, oder die jeweilige Regel wird für
ihren Geltungsbereich bewusst und begründet abgeschaltet; ein Dauerzustand
dazwischen ist die schlechteste Variante.

### Nachweislich toter Code

- **Unerreichbarer Toast im Roster-Editor.** Ein Zustandspaar wird angelegt,
  dessen Setter nie aufgerufen wird — der zugehörige Toast-Block im JSX kann
  daher nie rendern. App-weite Toasts laufen längst über die Wurzelkomponente
  (ADR 0010). Zustand und Block gehören ersatzlos entfernt.
- **`if`-Block mit ausschließlich Kommentaren im Rumpf** im Roster-Editor:
  eine Bedingung wird ausgewertet, deren Zweig nichts tut. Der Kommentar
  beschreibt eine Absicht, die der Code nicht umsetzt — beides klären und
  entfernen.
- **Ungenutzte Props am Heerlager-Dashboard.** Zwei Installations-Props werden
  von der Wurzelkomponente übergeben, aber nicht verwendet; die Installation
  wird tatsächlich in der Kopfleiste angeboten. Prop und Übergabe entfallen.
- **Ungenutzter Keyword-Import** in der Regel-Auswertung.

### Warnungs-Aufkommen

Rund 35 der 57 Warnungen liegen in Testdateien (ungenutzte Importe und
Parameter aus Mock-Signaturen). Sie sind harmlos, aber genau deshalb das
eigentliche Rauschen. Für Mock-Parameter, die eine Signatur erfüllen müssen und
absichtlich ungenutzt bleiben, ist die vom Linter selbst vorgeschlagene
Unterstrich-Konvention der richtige Weg.

Zusätzlich unterdrückt ein Modal-Dialog die Abhängigkeitsprüfung eines Effekts
**ohne Begründungskommentar**. Eine Unterdrückung ohne Begründung ist nicht
nachprüfbar: entweder die Abhängigkeit ergänzen oder in einem Satz festhalten,
warum sie hier falsch wäre.

**Abgrenzung:** Die überlangen Funktionen in der Regel-Auswertung sind **nicht**
Teil dieses Issues. Kind-Issue 01 löscht sie ersatzlos mitsamt den zugehörigen
Schlüsselwort-Listen und dem ungenutzten Import — deshalb ist dieses Issue durch
`Blocked by: [01, 02, 03]` ans Ende gestellt: es kehrt auf, was die drei
vorangehenden Scheiben übrig lassen, statt Warnungen zu beheben, die mit ihnen
ohnehin verschwinden.

## Acceptance Criteria
- [ ] `npm run lint` meldet 0 Fehler **und** 0 Warnungen.
- [ ] Jede Regel, die statt einer Behebung abgeschaltet wurde, ist in der
      Lint-Konfiguration auf ihren Geltungsbereich begrenzt und mit einer
      Begründung versehen.
- [ ] Jede verbleibende Inline-Unterdrückung trägt einen Kommentar, der sie
      begründet.
- [ ] Der unerreichbare Toast, der leere `if`-Zweig, die ungenutzten
      Dashboard-Props und der ungenutzte Import sind entfernt.
- [ ] `npm test` ist grün; die Testanzahl ist nicht gesunken.

## Comments

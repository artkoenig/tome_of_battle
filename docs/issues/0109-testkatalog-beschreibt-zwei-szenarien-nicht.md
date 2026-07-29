---
status: done
branch: claude/issues-90-abarbeiten-7ymutc
pr:
---

# Testkatalog beschreibt zwei Szenarien nicht

## Intent

`docs/testkatalog-evaluator-e2e.md` beansprucht in seinem Kopf, **jeden**
End-to-End-Test der Reinraum-Engine „in nicht-technischer Sprache" zu
beschreiben, „damit ein fachlicher Leser jeden geprüften Fall nachvollziehen
kann — ohne den Testcode zu lesen". Seine eigene Pflege-Regel verlangt
zusätzlich Deckungsgleichheit mit dem Bestand unter `docs/testing/`.

Zwei Szenarien stehen aber nur als Tabellenzeile da, ohne den beschreibenden
`##`-Abschnitt, den alle übrigen haben:

- `violation-classification` (7 Roster)
- `author-message-tokens` (3 Roster)

Damit ist für zehn Roster-Fälle genau das nicht eingelöst, was das Dokument
verspricht: ein fachlicher Leser erfährt, *dass* sie existieren, aber nicht,
*was* sie prüfen.

Vorbestehend, nicht durch einen laufenden Lauf entstanden — auf `main` mit
`git show origin/main:docs/testkatalog-evaluator-e2e.md | grep '^## '`
nachweisbar dieselbe Lücke.

Acceptance criteria:

1. `violation-classification` und `author-message-tokens` haben je einen
   `##`-Abschnitt im Muster der übrigen Szenarien: was geprüft wird, und je
   Roster eine Zeile in nicht-technischer Sprache.
2. Die Abschnitte sind aus dem jeweiligen `scenario.json` und der
   Szenario-`README.md` abgeleitet und stimmen mit ihnen überein (Roster-Zahl,
   Datengrundlage, geprüfte Aussage).
3. Es gibt danach keine Tabellenzeile mehr ohne zugehörigen Abschnitt — geprüft
   über alle Szenarien, nicht nur über diese zwei.

## Plan

## Tasks

## Decisions

- **Herkunft:** Nebenbefund der Review-Runde 2 von Issue 077 (2026-07-29). Dort
  außerhalb der Absicht und deshalb nicht mitbehoben; derselbe Lauf hat nur das
  korrigiert, was er selbst schrieb (die Summe und das ganz fehlende Szenario
  `unlimited-modifier-toggle`).
- **Erwägenswert für diesen Lauf:** Das Dokument sagt selbst, die Pflege
  erfolge „von Hand — es gibt bewusst **keinen** Generator und **kein**
  CI-Gate". Genau deshalb driftet es. Ob ein billiger Test „jede Tabellenzeile
  hat einen Abschnitt, jedes `scenario.json` hat eine Zeile" die bewusste
  Entscheidung gegen ein Gate verletzt oder sie nur absichert, ist im Lauf zu
  entscheiden.
- **Kein Gate eingeführt (Default, unbeantwortet, 2026-07-29):** Das Dokument
  deklariert den Verzicht auf Generator und CI-Gate als bewusste Entscheidung;
  sie umzustoßen ist eine Frage an den Menschen, kein Nebeneffekt dieses Laufs.
  Kriterium 3 ist stattdessen einmalig mechanisch belegt (siehe Log).
- **Sammel-Branch (Abweichung, 2026-07-29):** Diese Cloud-Session ist auf den
  Branch `claude/issues-90-abarbeiten-7ymutc` festgelegt; alle Issues ab 90
  laufen abweichend von „ein Issue = ein Branch = ein PR" gemeinsam auf diesem
  Branch. Vom Menschen implizit gedeckt („arbeite die Issues ab 90 selbständig
  ab … pushe selbständig").
- **Tabellen-Zelle mitkorrigiert:** Die Übersichtszeile von
  `violation-classification` nannte nur „Definitive Ogre + Mercenaries";
  die Roster 04–07 laufen aber per Dataset-Override gegen O&G bzw. VC. Die
  Zelle sagt jetzt „Definitive Ogre / O&G / VC + Mercenaries" — Kriterium 2
  (Übereinstimmung mit den Szenariodaten) deckt das.

## Log

- 2026-07-29: Beide Abschnitte geschrieben (`## violation-classification`,
  `## author-message-tokens`), eingeordnet an der Tabellenposition nach
  `info-projection`. Inhalt aus `scenario.json` + Szenario-`README.md`
  abgeleitet (7 bzw. 3 Roster, Dataset-Overrides benannt).
- 2026-07-29: Kriterium 3 mechanisch belegt:
  `diff <(Tabellenzeilen) <(Abschnitte)` leer und
  `diff <(Verzeichnisse unter docs/testing/) <(Tabellenzeilen)` leer —
  alle 32 Szenarien haben Zeile und Abschnitt, Exit 0.
- 2026-07-29: Review-Runde 1 (frischer Kontext): 1 Befund — der Log-Eintrag
  oben nannte „30" statt der belegten 32 Szenarien; alles Übrige (beide
  Abschnitte, Tabellen-Zelle, Kriterium 3) feldgenau gegen `scenario.json`/
  README bestätigt. Fix nur im Tracker-Dokument → Wiederholungs-Review
  per Regel-Waiver übersprungen.

- **Kein PR geöffnet:** Arbeit gepusht auf dem Sammel-Branch
  `claude/issues-90-abarbeiten-7ymutc` (Abweichung in Issue 0109 begründet);
  PR und Merge sind Sache des Menschen („stop nach diesem Issue“,
  2026-07-29), das `pr:`-Feld bleibt leer.

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja — zwei fehlende `##`-Abschnitte im
  Muster der übrigen, abgeleitet aus den Szenariodaten; keine Code-Änderung.
- **What surprised me?** Die Übersichtstabelle nennt für
  `violation-classification` nur den Ogre-Datensatz, obwohl vier der sieben
  Roster per Override gegen O&G/VC laufen.
- **What am I assuming without having verified it?** Dass die Abschnitts-
  Reihenfolge im Dokument keiner strengen Regel folgt (sie weicht schon vorher
  von der Tabellenordnung ab) — Einordnung an der Tabellenposition genügt.

### Before the PR

- **Does this match what was asked?** Ja — beide Abschnitte stehen, stimmen mit
  `scenario.json`/README überein, und die Vollständigkeit ist über alle
  Szenarien mechanisch geprüft (siehe Log).
- **What surprised me?** Nichts weiter; die Drift-Ursache (Handpflege ohne
  Gate) bleibt bestehen — bewusst, siehe Decisions.
- **What am I assuming without having verified it?** Dass die nicht-technischen
  Formulierungen den fachlichen Gehalt der Manifest-Assertions treffen; der
  Frisch-Kontext-Review prüft das gegen.

## Retro

- Reine Doku-Änderung, Review als einziges Gate hat funktioniert (1 Befund:
  Zahlendreher im eigenen Log — behoben per Tracker-Waiver). Die
  Drift-Ursache (Handpflege ohne Gate) bleibt bewusst bestehen; ob ein
  billiges Vollständigkeits-Gate gewollt ist, wäre eine Frage an den
  Menschen für einen eigenen Lauf.

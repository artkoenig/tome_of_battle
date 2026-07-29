---
status: active
branch: claude/new-session-jnwa1m-0093
pr:
---

# Armeeweite Kategorie-Min-Grenze wird mehrfach gemeldet

## Intent

Eine `categoryEntry` mit `min`-Grenze (`scope="roster"`) wird doppelt
verankert: als roster-weites Pflicht-Phantom
(`synthesizeMandatoryPhantoms`, `src/evaluator/evalTree.js:259` — für eine
Kategorie-Definition ist `countInstances` immer 0) **und** an jedem
Kategorie-Anker jeder Force, deren `categoryLink` die Grenzen der Kategorie
erbt (`resolver.js:641`, Vererbung per `link.resolved`). Die
Constraint-Schicht wertet alle Grenzen an allen Ankern aus, ohne Entdopplung.

Folge: eine unerfüllte armeeweite Kategorie-Pflicht („genau ein General",
§5.5) erscheint 1 + n-mal in der Meldungsliste (Wurzel-Phantom plus je
Force). `docs/battlescribe-data-format.md` §9.9 verlangt für dieselbe Pflicht
in mehreren Formen ausdrücklich Entdopplung über die Ziel-Id („genau ein
Verstoß"); das Urteil selbst ist korrekt, die Mehrfachmeldung ein
Berichtsfehler.

Acceptance criteria:

1. Eine unerfüllte armeeweite Kategorie-Grenze erzeugt genau **eine**
   Verletzung, unabhängig davon, wie viele Forces die Kategorie verlinken.
2. Force-weite Kategorie-Grenzen (echtes `scope="force"`-Zählen je
   Kontingent) bleiben je Kontingent gemeldet — keine Über-Entdopplung.
3. Der Fähigkeitsdatensatz jedes Kategorie-Slots bleibt vollständig (die
   Entdopplung betrifft nur die Meldungsliste).
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

Entdopplung in der **Berichtsschicht**, nicht am Anker: Kriterium 3 verlangt,
dass jeder Kategorie-Slot seinen vollständigen Fähigkeitsdatensatz behält —
ein Anker-Schnitt (0092-Stil, `limitScopeFilter` auf den Force-Ankern) würde
den Force-Slots die roster-weite Min-Information nehmen. Also: alle Anker
werten weiter alle Grenzen aus (Results unverändert ⇒ Capabilities
unverändert), und allein die Meldungsliste des Berichts entdoppelt
armeeweite Kategorie-Grenzen über (Grenz-Id, gezählte Ziel-Id).

Eingrenzung (damit gewollte Mehrfachmeldungen überleben): die Entdopplung
greift nur an **synthetischen Kategorie-Ankern** (`CATEGORY_ANCHOR`,
`MANDATORY_PHANTOM`). Belegte Instanz-Anker (z. B. Tyrant-Max je Instanz,
gepinnt mit count: 2) bleiben unberührt. Präzisierung nach der
Test-Autor-Runde: Force-Rahmen-Grenzen bleiben **je Kontingent-Anker**
gemeldet (ogre-kingdoms Roster 08, count: 2) — die Huckepack-Meldung
derselben Force-Grenze am Wurzel-Phantom (das alle geerbten Grenzen
auswertet) entfällt dabei mit; sonst meldete der gemischte Fall 3 statt 2
Force-Verletzungen.

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28); Mechanismus am Code verifiziert, Auftreten hängt davon
  ab, ob Forces die betroffene Kategorie verlinken.
- **Default (Mensch nicht gefragt, Kriterien entscheiden es nicht): der
  überlebende Vertreter** der entdoppelten Meldung ist der
  Roster-Rahmen-Anker (das Wurzel-Pflicht-Phantom), wenn einer existiert;
  sonst der erste Anker in Dokumentreihenfolge. Begründung: die Pflicht ist
  armeeweit, das Wurzel-Phantom ist ihr roster-weiter Anker.
- **Abgrenzung:** §9.9 verlangt die Ziel-Id-Entdopplung wörtlich für die
  Doppel-Kodierung eines Wurzeleintrags (selectionEntry vs. entryLink) —
  dieses Issue wendet sie analog auf Kategorie-Anker an und lässt die
  Wurzeleintrag-Familie bewusst unangetastet (eigenes Thema, falls je
  beobachtet).

## Log

- 2026-07-29 Researcher (frischer Stand nach den Merges #152–#161): 1+n
  empirisch bestätigt (Repro-Skript gegen die echte Fassade: n=1 → 2, n=2 →
  3 identische Verletzungen derselben `limitId`). Mechanismus: die
  Roster-Schleife von `synthesizeMandatoryPhantoms` kennt — anders als die
  Force-Schleife — keine Ausnahme für verlinkte Kategorien (Docstring
  behauptet es fälschlich für beide); dazu erbt jeder Force-Kategorie-Anker
  dieselben Grenzen per `limitsOf`-Merge über die Grenz-Id. Keinerlei
  Verletzungs-Entdopplung in constraints.js/report.js. Die gezählte Ziel-Id
  wird in `constraints.js` berechnet, aber nicht auf Result/Verletzung
  getragen — für den Entdopplungsschlüssel muss sie durchgereicht werden.
  Force-Rahmen-Familie (je Force gemeldet, armeeweite Summe per
  Zieltyp-Regel §7.7) ist als Erwartung gepinnt (ogre-kingdoms Roster 08,
  count: 2); die Roster-Rahmen-1+n-Familie ist nirgends gepinnt.
- 2026-07-29 test-author:
  `src/evaluator/report.armyWideCategoryDedup.test.js`, 9 Tests — 5 ROT
  (n=2 → 1 am Phantom; n=1 → 1; MAX-only verlinkt → 1 am ersten Anker;
  MIN+MAX → 1 MAX-Meldung; gemischt roster-MIN+force-MIN → 1+2), 4 grüne
  Kontrollen (erfüllte Pflicht still; force-MIN je Kontingent = 2;
  Capabilities aller Kategorie-Slots vollständig; Eintrags-MAX je belegter
  Instanz = 2). Belegt: Zielfile 5 failed/4 passed; Vitest gesamt 221
  Dateien / 2250 Tests, nur das neue File rot; Puppeteer-E2E separat
  Exit 0. Beobachtung des Autors: das Wurzel-Phantom meldet auch die
  geerbte Force-Grenze (dritte Meldung im gemischten Fall) — die
  Plan-Präzisierung oben stammt aus dieser Runde.

## Checkpoints

### Before implementation

- Does this match what was asked? Yes — genau eine Meldung je armeeweiter
  Kategorie-Grenze, Force-Rahmen-Meldungen je Kontingent unverändert,
  Capabilities unangetastet: die Entdopplung lebt allein in der
  Meldungsliste des Berichts.
- What surprised me? Die Force-Schleife der Phantom-Synthese nimmt verlinkte
  Kategorien längst aus — nur die Roster-Schleife nicht; und selbst deren
  Korrektur würde nicht reichen (n Force-Anker melden weiterhin n-fach).
  Kriterium 3 erzwingt damit die Berichtsschicht als Schnittstelle, nicht
  den 0092-Anker-Schnitt.
- What am I assuming without having verified it? Dass (Grenz-Id, gezählte
  Ziel-Id) als Schlüssel reicht (die Vererbung merged über die Grenz-Id);
  dass die Tyrant-count:2-Pins außerhalb des Guards liegen (belegte
  Instanz-Anker sind keine synthetischen Kategorie-Anker); dass kein
  E2E-Szenario die 1+n-Familie pinnt (Researcher: nirgends gepinnt).

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro

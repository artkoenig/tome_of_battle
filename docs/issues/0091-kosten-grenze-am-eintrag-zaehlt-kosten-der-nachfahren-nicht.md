---
status: backlog
branch:
pr:
---

# Kosten-Grenze am Eintrag zählt die Kosten der Nachfahren nicht

## Intent

`docs/battlescribe-data-format.md` §7.6/§9.4: eine Grenze, deren `field` eine
Kostenart ist, begrenzt die **Summe** dieser Kosten; gezählt werden die
Auswahlen unterhalb des Trägers, und `includeChildSelections="true"` nimmt
verschachtelte Auswahlen ausdrücklich hinein.

Die Zählschicht aggregiert Beiträge aber nur unter den **eigenen** Ziel-Ids
des beitragenden Knotens (`targetsOf`, `src/evaluator/countIndex.js:107`) —
nie unter der Definitions-Id eines Vorfahren. Eine ziel-gefilterte Query
`(Rahmen, Eintrags-Id)` sieht deshalb ausschließlich die Kosten des Trägers
selbst; die Kosten seiner Kinder fehlen, egal wie die Flags stehen.

Repro (Audit 2026-07-28, gegen die echte Fassade): Held 50 pts + gewähltes
Item 60 pts; Grenze am Helden `max 100 field=<pts> scope="roster"
includeChildSelections="true"` → Ist liest 50, **kein Verstoß** — erwartet
Ist 110 gegen 100. Gruppen-verankerte Budgets treffen ihre Member zwar über
die Member-Ids, aber deren **verschachtelte** Kosten fehlen aus demselben
Grund.

Verwandt mit Issue 083 (dort: Selektions-Zählung unterhalb des Trägers), aber
eigenständig: hier geht es um die Kostensummen-Aggregation unter der
Träger-Id.

Acceptance criteria:

1. Eine Kostenart-Grenze an einem Eintrag mit `includeChildSelections="true"`
   summiert die effektiven Kosten des Trägers **und aller seiner
   Nachfahren-Auswahlen** (mal Stückzahl).
2. Das Repro aus dem Intent meldet Ist 110 gegen Grenze 100.
3. Mit `includeChildSelections="false"` gilt die dokumentierte engere Lesart
   („just `scope`'s `field`") — belegt durch einen Testfall je Flagstellung.
4. Gruppen-verankerte Kosten-Budgets (Magic-Items-Muster, §9.4) erfassen auch
   verschachtelte Kosten ihrer Member.
5. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro gegen die echte Fassade.

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

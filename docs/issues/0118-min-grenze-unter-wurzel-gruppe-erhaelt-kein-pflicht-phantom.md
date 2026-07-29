---
status: backlog
branch:
pr:
---

# `min`-Grenze unter einer Wurzel-Gruppe erhält kein Pflicht-Phantom

## Intent

`PHANTOM_DEFINITION_KINDS` (`src/evaluator/resolver.js`) schneidet beim
Einsammeln der Wurzel-Definitionsliste nicht nur Verweise ab, sondern auch
**Wurzel-Gruppen** (`GROUP` fehlt): `collectRootDefinitions` bricht an einer
`selectionEntryGroup` unmittelbar unter der Katalogwurzel ab — samt ihrer
Kinder. Ein Wurzeleintrag mit `min`-Grenze (`scope="roster"`/`"force"`), der
in einer solchen Gruppe steckt, bekommt deshalb kein Pflicht-Phantom: eine
Liste ohne die Pflichteinheit meldet keinen Verstoß. Ob der Abbruch für
Gruppen Absicht ist, sagt kein Kommentar; §9.9 der BSData-Doku spricht nur
von Einträgen und Links. (Nebenbefund aus dem Lauf zu Issue 0085,
Log-Eintrag 2026-07-29.)

Zuerst ist zu klären, ob reale Kataloge das Muster überhaupt führen; danach
entweder die Traversierung öffnen oder den Abbruch begründet dokumentieren.

Acceptance criteria:

1. Es ist entschieden und im Issue belegt, ob eine Wurzel-Gruppe
   Pflicht-Kandidaten liefern soll (Datenlage aus den Fixture-Katalogen und
   §9.9).
2. Je nach Entscheidung: Entweder erzeugt ein Pflicht-Eintrag unter einer
   Wurzel-Gruppe bei Absenz einen blockierenden Verstoß, oder der bewusste
   Abbruch ist am Code dokumentiert und durch einen Test festgeschrieben.
3. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

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

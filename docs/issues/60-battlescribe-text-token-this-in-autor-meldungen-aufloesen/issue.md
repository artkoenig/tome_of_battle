Status: needs-triage
Type: fix
Blocked by: None

## Description

# PRD: BattleScribe-Text-Token `{this}` in Autor-Meldungen auflösen

## Problem Statement / Bug Description

**Ist:** Autor-Meldungen aus dem Katalog werden wortgetreu durchgereicht. Enthält
der Autorentext das BattleScribe-Token `{this}`, erscheint es literal. Belegt im
Aushebe-Dialog bei „Gnoblars":

> `You cannot have more units of {this} than you have units of Ogre Bulls`

**Soll:** `{this}` steht für den Namen des Eintrags, an dem die Meldung hängt.
Erwartet:

> `You cannot have more units of Gnoblars than you have units of Ogre Bulls`

**Ursache:** `collectTriggeredMessages` (`src/solver/modifierEvaluator.js`) gibt
den `value` eines `error/warning/info`-Modifiers **wortgetreu** als Meldungstext
zurück; `formatValidationError` reicht Autor-Meldungen unverändert aus
(`error.message ?? ''`). Es gibt heute keinerlei Token-Auflösung für Katalogtext.

## Solution

Beim Zusammenbauen einer Autor-Meldung im Solver das Token `{this}` durch den
**effektiven Namen des betroffenen Eintrags** ersetzen. Der Text bleibt sonst
unverändert und in Katalogsprache.

Kernprinzipien:

- **Nur `{this}`.** Es ist das einzige belegte Token; ein dokumentierter
  BattleScribe-Token-Satz existiert nicht (keine offizielle Quelle auffindbar).
  Keine erfundenen Tokens.
- **`{this}` → `getEffectiveName(source)`** — der effektive (ggf. per Namens-
  Modifier veränderte) Name des Eintrags, an dem die Meldung hängt.
- **Unbekannte Tokens bleiben unverändert** durchgereicht (wie heute); kein
  Fehler-/Qualitäts-Signal an den Nutzer.
- **Nur Autor-Meldungen** (`modifier-error/-warning/-info`). Namen, Regel- und
  Profiltexte bleiben außen vor (kein Beleg für `{this}` dort; YAGNI). Die
  Auflöse-Funktion wird aber wiederverwendbar gehalten.
- **Ort: im Solver**, beim Erzeugen der Meldung (`collectTriggeredMessages`, das
  den Eintrag `source` kennt). Die Meldung trägt danach schon den aufgelösten
  Text; `formatValidationError` bleibt reiner Pass-through. Kein App-Sprach-
  template im Spiel — der Solver bleibt sprachfrei (ADR 0026 unberührt).
- **Erweiterbar:** Die Ersetzung erfolgt über eine kleine Token→Wert-Zuordnung,
  kein Sonderfall-`if` — ein künftig belegtes Token ist trivial ergänzbar.

## User Stories / Requirements

1. Als Listenbauer möchte ich in einer Autor-Meldung den echten Einheitennamen
   lesen statt `{this}`, damit die Meldung verständlich ist.
2. Als Maintainer möchte ich, dass die Auflösung generisch über eine Token-
   Zuordnung läuft (kein Sonderfall) und unbekannte Tokens unverändert bleiben,
   damit die Lösung robust und erweiterbar ist.

## Technical Decisions

- **Affected Modules (Verhalten, nicht Pfade):**
  - Token-Auflösung: eine reine Funktion `Autortext + Eintragsname → aufgelöster
    Text` (ersetzt `{this}`, lässt unbekannte Tokens stehen).
  - Meldungs-Erzeugung: `collectTriggeredMessages` löst den Text mit
    `getEffectiveName(source, ctx)` auf, bevor die Meldung zurückgegeben wird.
  - Anzeige (`formatValidationError`) bleibt unverändert — weiterhin Pass-through.
- **Architectural Decisions:**
  - **ADR 0028** (neu): Verfeinert ADR 0022. Autor-Meldungen bleiben in
    Katalogsprache und ohne Übersetzung, aber **BattleScribe-Text-Tokens wie
    `{this}` werden aufgelöst** — das ist Rendering (was BattleScribe selbst tut),
    keine Übersetzung. Grenzt Token-Rendering sauber von der i18n-Interpolation
    (ADR 0026, nur App-Vorlagen) ab.
  - CONTEXT.md-Glossar („Autor-Meldung", „Katalogsprache") wird nachgezogen:
    „unangetastet" = keine Übersetzung, Token-Rendering ausgenommen.
- **API Contracts / Data Models:** Keine Änderung am `ValidationError`-Schema.
  `collectTriggeredMessages` liefert weiterhin `{ severity, message }` — nur der
  `message`-Text ist token-aufgelöst.

## Testing Decisions

- **Modules to Test:**
  - Token-Auflösung (reine Funktion): `{this}` → Name; mehrere `{this}` im Satz;
    unbekanntes Token bleibt stehen; Text ohne Token unverändert.
  - `collectTriggeredMessages`: Meldung eines `error`-Modifiers mit `{this}` trägt
    den effektiven Eintragsnamen; Reproduktion des Gnoblars-Falls.
- **Test Interfaces (Seams):**
  1. Reine Token-Auflöse-Funktion (framework-frei, Daten → Daten).
  2. `collectTriggeredMessages(source, ctx)` gegen eine Fixture mit einem
     `field="error"`-Modifier, dessen `value` `{this}` enthält (neue Fixture nach
     bestehender Konvention, z. B. `special-characters-hint.cat.xml`).

## Out of Scope

- Andere Tokens als `{this}` (kein Beleg/keine offizielle Quelle).
- Token-Auflösung in Namen, Beschreibungen, Profil-/Regeltexten.
- Sichtbares Fehler-/Qualitäts-Signal für unbekannte oder fehlerhafte Tokens
  (weder Laufzeit noch Katalog-Lint).
- Änderung an `formatValidationError`, am `ValidationError`-Schema oder an der
  i18n-Mechanik (ADR 0026).
- Übersetzung von Katalogtext (bleibt ausgeschlossen).

## Acceptance Criteria
- [ ] Eine Autor-Meldung (`modifier-error/-warning/-info`), deren Text `{this}`
      enthält, zeigt statt `{this}` den effektiven Namen des betroffenen Eintrags;
      der Gnoblars-Fall erscheint als „… more units of Gnoblars than …".
- [ ] Mehrere `{this}` im selben Text werden alle ersetzt.
- [ ] Unbekannte Tokens bleiben unverändert; Text ohne Token bleibt unverändert.
- [ ] Nur Autor-Meldungen betroffen; `formatValidationError` und das
      `ValidationError`-Schema unverändert; Solver bleibt sprachfrei.
- [ ] Auflösung über eine Token→Wert-Zuordnung (kein Sonderfall-`if`).
- [ ] Neue Fixture mit `{this}` im `field="error"`-Modifier; Unit-Tests an beiden
      Seams grün; volle Suite grün.
- [ ] ADR 0028 angelegt (verfeinert ADR 0022) und CONTEXT.md-Glossar nachgezogen.

## Comments

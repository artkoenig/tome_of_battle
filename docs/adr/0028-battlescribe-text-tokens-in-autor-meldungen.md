# BattleScribe-Text-Tokens in Autor-Meldungen werden gerendert, nicht übersetzt

- **Status:** Accepted
- **Datum:** 2026-07-23
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** Verfeinert ADR-0022 (App- vs.
  Autor-Meldung, wortgetreuer Pass-through); grenzt gegen ADR-0026 (i18n nur für
  App-Vorlagen) ab.

## Kontext und Problemstellung

Autor-Meldungen (`modifier-error/-warning/-info`) werden wortgetreu aus dem
Katalog durchgereicht (ADR-0022, CONTEXT.md „Autor-Meldung": „bleibt … in seiner
Katalogsprache unangetastet"). Reale Katalogtexte enthalten jedoch das
BattleScribe-Text-Token `{this}`, das für den Namen des Eintrags steht, an dem
die Meldung hängt. Beispiel (Aushebe-Dialog, „Gnoblars"):

> `You cannot have more units of {this} than you have units of Ogre Bulls`

BattleScribe selbst rendert `{this}` zum Eintragsnamen; unsere App zeigte es
literal, weil sie den Text ungeprüft durchreicht. „Unangetastet" war formuliert,
um **Übersetzung** zu verbieten — nicht die native Token-Darstellung.

## Entscheidungsfaktoren (Drivers)

- **Verständlichkeit:** `{this}` ist für Nutzer sinnlos; der Eintragsname ist die
  intendierte Aussage.
- **Katalogsprache bewahren:** keine Übersetzung, kein Umformulieren.
- **Keine offizielle Token-Spezifikation auffindbar:** ein vollständiger,
  dokumentierter BattleScribe-Token-Satz existiert nicht (recherchiert in
  BSData-Wiki und offiziellen Quellen). Wir dürfen keine Tokens erfinden.
- **ADR-0022-Konformität:** keine zweite Regel-/Übersetzungslogik einführen.

## Betrachtete Optionen

- **Option 1 — strikt byte-identisch lassen.** `{this}` bleibt literal stehen;
  ggf. ein Daten-Qualitäts-Hinweis.
- **Option 2 — belegte Tokens rendern.** `{this}` → effektiver Eintragsname beim
  Erzeugen der Meldung im Solver; unbekannte Tokens unverändert; keine
  Übersetzung.
- **Option 3 — generischer Token-Parser für alle Katalogtexte** (Namen,
  Beschreibungen, Regeltexte) und einen breiten, spekulativen Token-Satz.

## Entscheidungsergebnis

Gewählte Option: **Option 2**. „Pass-through / unangetastet" bedeutet **keine
Übersetzung**, nicht „byte-identisch". Das Rendern belegter BattleScribe-Tokens
ist Darstellung (das, was BattleScribe selbst tut), keine Übersetzung — der Text
bleibt in Katalogsprache.

Konkret:

- **Nur `{this}`** wird aufgelöst (einziges belegtes Token) → der **effektive
  Name** (`getEffectiveName`) des Eintrags, an dem die Meldung hängt.
- **Unbekannte Tokens bleiben verbatim**; kein Fehler-/Qualitäts-Signal.
- **Nur Autor-Meldungen.** Namen, Beschreibungen und Regeltexte bleiben
  unverändert (kein Beleg für `{this}` dort; YAGNI).
- **Ort: im Solver** beim Zusammenbauen der Meldung (`collectTriggeredMessages`),
  über eine generische Token→Wert-Zuordnung (kein Sonderfall-`if`). Die
  Anzeige-Schicht (`formatValidationError`) bleibt reiner Pass-through; das
  `ValidationError`-Schema ändert sich nicht.
- Abgrenzung zu ADR-0026: Dies ist **kein** i18n-Interpolation über App-Vorlagen
  (`de.json`/`en.json`), sondern Katalog-eigenes Token-Rendering. Der Solver
  bleibt sprachfrei (er ersetzt nur Katalogtext durch Katalogtext).

Option 1 lässt eine für Nutzer unverständliche Meldung stehen. Option 3 baut
einen breiten Parser für unbelegte Tokens/Textflächen — Spekulation gegen
ADR-0003/YAGNI und ohne offizielle Grundlage.

### Konsequenzen (Auswirkungen)

- **Positiv:** verständliche Autor-Meldungen; Katalogsprache bleibt erhalten;
  additive, eng begrenzte Änderung; an einem framework-freien Seam testbar.
- **Positiv:** erweiterbar — ein künftig belegtes Token ist ein weiterer
  Map-Eintrag.
- **Negativ:** erstmals wird Autortext programmatisch verändert — die
  „unangetastet"-Aussage aus ADR-0022/CONTEXT.md wird bewusst auf „keine
  Übersetzung" präzisiert.
- **Neutral:** solange kein Katalog `{this}` nutzt, ändert sich nichts.

## Vor- und Nachteile der Optionen

### Option 1 — byte-identisch

- **Gut, weil** die Pass-through-Regel wörtlich unberührt bleibt.
- **Schlecht, weil** die Meldung für Nutzer unverständlich bleibt (`{this}`).

### Option 2 — belegte Tokens rendern

- **Gut, weil** verständlich, katalogsprachtreu, eng begrenzt, testbar,
  erweiterbar.
- **Schlecht, weil** die „unangetastet"-Formulierung präzisiert werden muss.

### Option 3 — generischer Parser über alle Textflächen

- **Gut, weil** vermeintlich vollständig.
- **Schlecht, weil** ohne offizielle Token-Spezifikation spekulativ, breite
  Angriffsfläche, gegen YAGNI/ADR-0003.

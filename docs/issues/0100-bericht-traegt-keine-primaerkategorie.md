---
status: active
branch: claude/evaluator-blocker-issues-uvmdn4
pr:
---

# Bericht trägt keine Primärkategorie

## Intent

`docs/battlescribe-data-format.md` §7.2/§8: `primary="true"` bestimmt den
Anzeige-Bucket eines Eintrags; `set-primary`/`unset-primary` schalten das
Flag zur Laufzeit um, und „**sämtliche** kategorie-abhängige Logik muss die
effektiven Kategorie-Links auswerten … auch die UI-Einsortierung." Unter
ADR-0034/0035 ist der Bericht die **einzige** Quelle der UI.

Die Engine wirft die Primär-Information komplett weg: `readCategoryLink`
(`src/evaluator/catalogReader.js:748`) liest `primary` nicht,
`readCategoryIds` flacht Links zu Ziel-Ids ab, `set-primary` wirkt als reines
Mitgliedschafts-Add und `unset-primary` als No-op (`modifiers.js:351`, dort
als „reine Anzeige" begründet — als Code-Kommentar, in keinem ADR). Der
`SlotCapability`-Datensatz (`report.js:185`) führt weder Kategorien noch
Primärkategorie.

Fürs Zählen ist die Mitgliedschafts-Näherung korrekt (im Audit geprüft). Aber
eine UI, die nur den Bericht liest, kann Einträge nicht einsortieren — das
§8-Beispiel (per `set-primary` in eine katalogeigene Kategorie umgegliederte
Bibliothekseinheit) ist aus dem Bericht nicht ableitbar. Entweder der Bericht
trägt die effektive Primärkategorie, oder der Verzicht wird als
Architektur-Entscheidung dokumentiert — der stille Zustand dazwischen ist der
Fehler.

Acceptance criteria:

1. Der Fähigkeitsdatensatz eines Slots nennt seine **effektiven** Kategorien
   und darunter die effektive Primärkategorie (nach `set-primary`/
   `unset-primary`-Modifikatoren).
2. Das §8-Beispiel ist aus dem Bericht ableitbar: eine per `set-primary`
   umgegliederte Einheit nennt die neue Primärkategorie.
3. `unset-primary` ist kein No-op mehr, sondern wirkt auf das Primär-Flag.
4. Zählen und Grenzen bleiben unverändert (Mitgliedschaft wie bisher) —
   belegt durch die bestehende Suite, grün mit Kommando, Umfang und
   Exit-Code.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28). Alternativ-Ausgang: der Verzicht wird als ADR
  dokumentiert und dieses Issue mit dieser Begründung geschlossen — der
  jetzige nur-Code-Kommentar genügt nicht.
- **Ausgang gewählt: Bericht trägt die Information** (nicht der
  Verzicht-als-ADR-Weg). Quelle: Einstufung als Einsatz-Blocker durch den
  Menschen (2026-07-29, „100 beheben"); unter ADR-0034/0035 ist der Bericht
  die einzige UI-Quelle, ohne Kategorien kann keine UI einsortieren.
- **Vertrag der neuen Felder** (Default, entlang §7.2/§8 der BSData-Doku):
  `SlotCapability` erhält `categoryIds: string[]` (die **effektiven**
  Kategorie-IDs des Slots, nach `add`/`remove`/`set-primary`) und
  `primaryCategoryId: string | null` (die effektive Primärkategorie; `null`
  = keine). Semantik: Basis-Primär ist das Ziel des `categoryLink` mit
  `primary="true"` (bei mehreren: erster in Dokumentreihenfolge — §7.2 sagt
  „genau eine", mehr ist Datenfehler und wird tolerant gelesen);
  `set-primary <catId>` sichert Mitgliedschaft **und** setzt die
  Primärkategorie auf `<catId>` (letzter gewinnt); `unset-primary <catId>`
  nimmt das Primär-Flag genau dann weg, wenn `<catId>` gerade primär ist —
  Mitgliedschaft bleibt (Kriterium 4: Zählen unverändert).
- **Kein Versionssprung** (Default): reine Engine-/Berichtserweiterung, die
  Reinraum-Engine ist noch nicht in die UI eingebunden — nichts, was ein
  Nutzer heute sieht, ändert sich.

## Log

## Checkpoints

### Before implementation

- Does this match what was asked? — Ja. Der Mensch hat „100 beheben" gewählt;
  die Kriterien verlangen effektive Kategorien + Primärkategorie im Bericht,
  und der Lauf setzt genau das um (nicht den Verzicht-als-ADR-Ausgang).
- What surprised me? — Die effektiven Kategorien existieren bereits als
  Menge in `EffectiveState` (geseedet aus den Basiswerten, gepflegt von
  `add`/`remove`/`set-primary`) — der Bericht liest sie nur nie. Wirklich
  fehlend sind nur das Primär-Flag (Leser + Zustand + `unset-primary`) und
  die beiden Berichtsfelder.
- What am I assuming without having verified it? — (a) Dass jeder
  berichtsfähige Slot-Knoten (auch Phantome/Anker) einen geseedeten
  Kategorie-Zustand hat; (b) dass „letzter `set-primary` gewinnt" dem
  Referenzverhalten entspricht — upstream unbelegt, als Default festgehalten;
  (c) dass Kategorie-Links an `entryLink`s in die Basis-Kategorien des
  Vorkommens einfließen (Resolver-Verhalten, nicht nachgeprüft).

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro

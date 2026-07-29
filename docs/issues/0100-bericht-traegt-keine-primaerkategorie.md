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
- **Zwei Ränder, vom test-author als Frage zurückgegeben, als Default
  entschieden (ungetestet, unverbindlich für die Tests):**
  (a) `remove` auf die aktuelle Primärkategorie nimmt auch das Primär-Flag
  (`primaryCategoryId` fällt auf `null`) — eine Primärkategorie ohne
  Mitgliedschaft wäre sinnlos, §7.2 macht `primary` zum Flag eines
  Mitgliedschafts-Links. (b) `set-primary` und `unset-primary` wirken in
  Anwendungsreihenfolge aufeinander — der später feuernde gewinnt, ohne
  Sonderregel.

## Log

- 2026-07-29 — test-author: 10 fehlschlagende Tests in
  `src/evaluator/report.effectiveCategories.test.js`, schwarz gegen die
  Fassade (`prepareDataset`/`evaluate`), je Kriterium mindestens ein Test
  (Basis-Primär, mehrere `primary="true"`, `add`-Modifier, §8-Beispiel mit
  bedingtem `set-primary` inkl. Gegenprobe, letzter `set-primary` gewinnt,
  `unset-primary` auf primär/nicht-primär, Mitgliedschaft bleibt). Beleg:
  `npx vitest run src/evaluator/report.effectiveCategories.test.js` →
  Exit 1, 10/10 rot, alle auf den fehlenden Feldern. Zwei offene Ränder als
  Default in Decisions entschieden.
- 2026-07-29 — implementer: `primary` wird gelesen (`catalogReader.js`:
  `readPrimaryCategoryId`, erster `primary="true"`-Link gewinnt),
  `EffectiveState` führt eine parallele `#primaries`-Map (Seed je Runde,
  `set-primary` = Mitgliedschaft + Flag, `unset-primary` löscht das Flag nur
  bei Treffer, `removeCategory` der Primären löscht es mit — Default (a));
  Bericht trägt `categoryIds`/`primaryCategoryId`; Architektur-Doku §4.1/
  §4.2/§4.6/§4.8 nachgezogen. Primär bewusst NICHT im zählrelevanten
  Fingerabdruck. Annahme des Implementers: Link-eigener Basis-Primär schlägt
  den des aufgelösten Ziels, ohne eigenen erbt der Link (gleiche Erb-Regel
  wie Kosten/hidden). Belege: `npx vitest run
  src/evaluator/report.effectiveCategories.test.js` Exit 0 (10 Tests);
  `npx vitest run src/evaluator` Exit 0 (65 Dateien, 819 Tests);
  `npm run lint` Exit 0; `npm run typecheck` Exit 0.

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

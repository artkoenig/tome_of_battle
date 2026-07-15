Status: resolved
Blocked by: [02]

## Description

**Ergebnis für den Nutzer:** Einzelne Zaubersprüche erhalten im Editor einen
Regel-Link — „1. Fire Ball", „2. Flaming Sword of Rhuin". **+6** Namen; der
kleinste der drei Slices.

**Aufsetzend auf Issue 02:** Wieder dasselbe Muster, aber mit einer eigenen
Quelle. `/spell-lists` (Plural) liefert die Lore-Seiten; die Einzelseiten liegen
unter `/spell/<slug>` (Singular) und stehen erst im HTML der Lore-Seiten:

```html
<!-- auf /spell-lists/the-lore-of-fire -->
<a href="/spell/fire-ball">1. Fire Ball</a>
<a href="/spell/flaming-sword-of-rhuin">2. Flaming Sword of Rhuin</a>
```

**Zweite Quelle:** `/spell/`-Links stehen zusätzlich auf einigen
Magic-Item-Kategorieseiten (Gegenstände, die Zauber wirken — `daemonic-gifts`,
`sorcerous-items`, `von-carstein`, `vauls-forge` u. a.). Beide Quellen liefern
zusammen 24 Labels. Wenn der Mechanismus aus Issue 02 mehrere Quellsections für
eine Zielsection erlaubt, ist das ohne Sonderlogik abgedeckt; andernfalls genügt
zunächst die Lore-Quelle — der Gewinn liegt dort.

**Zu den Nummern-Präfixen:** Die Labels tragen die Nummer des Zaubers
(„1. Fire Ball"). Das ist kein Störfaktor, sondern der Grund, warum sie passen:
die Katalognamen sind ebenso nummeriert (`6. The Wolf Hunts`, `1.Mork Save Us`).
Die Labels dürfen daher **nicht** um das Präfix bereinigt werden — sonst gehen
die Treffer verloren. Die im Katalog vorkommende Variante ohne Leerzeichen nach
dem Punkt (`1.Mork Save Us`) trifft entsprechend nicht und ist hier nicht in
Umfang; sie gehört zu den Katalog-Datenfehlern.

**Kollisionen:** keine mit bestehenden Index-Einträgen geprüft; die Präzedenz-
regel aus Issue 02 gilt unverändert.

## Acceptance Criteria
- [ ] Ein Crawl erntet die Einzelseiten unter `/spell/` aus den Lore-Seiten
      unterhalb `/spell-lists/`.
- [ ] Nach dem Crawl liefert die Regel-Suche für „1. Fire Ball" und
      „2. Flaming Sword of Rhuin" je eine URL unterhalb `/spell/`.
- [ ] Im Editor zeigt ein Zauber-Chip das Regel-Link-Symbol und öffnet die Seite
      (E2E in der laufenden App).
- [ ] Die Nummern-Präfixe der Labels bleiben erhalten; ein Test hält fest, dass
      „1. Fire Ball" als solcher im Index steht.
- [ ] Kein bestehender Index-Eintrag ändert seine Ziel-URL.
- [ ] Volle Suite grün.

## Comments
- Issue 10/04 implementiert: Spell-Seiten via /spell-lists -> Lore-Seiten -> /spell/<slug>.

Aenderungen:
- rules-crawler.js: DERIVATIONS um { sourceSection: "spell-lists", targetSection: "spell" } erweitert.
- rules-crawler.test.js: Test fuer Spell-Derivation mit nummerierten Labels (z.B. "1. Fire Ball").
- rules-index.json: Neu gecrawlt. Index von 2500 auf 2662 Eintraege (+162 spell).

Ergebnisse:
- 1. Fire Ball -> /spell/fire-ball
- 2. Flaming Sword of Rhuin -> /spell/flaming-sword-of-rhuin
- Nummern-Praefixe bleiben erhalten.
- 301 Tests gruen, Lint sauber.

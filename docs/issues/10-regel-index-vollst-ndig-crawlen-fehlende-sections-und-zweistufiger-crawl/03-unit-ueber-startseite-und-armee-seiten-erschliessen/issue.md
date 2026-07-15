Status: resolved
Blocked by: [02]

## Description

**Ergebnis für den Nutzer:** Reittiere, Streitwagen, Crew und Champions erhalten
im Editor einen Regel-Link — `Chaos Steed`, `Carnosaur`, `Bretonnian Warhorse`,
`Chariot of Khorne`. Das sind genau die Chips, die heute ohne Link bleiben.
**+97** Namen, plus +1 über `/army`.

**Aufsetzend auf Issue 02:** Nutzt denselben Mechanismus (Ziel-Section aus den
Seiten einer anderen Section ernten), hier aber über **drei** Ebenen:

```
Startseite  →  20 Armeeseiten /army/<armee>  →  789 Einzelseiten /unit/<slug>
```

**Zwei Besonderheiten, die Zeit kosten, wenn man sie nicht kennt:**

1. **Es gibt keine `/unit`-Übersichtsseite.** `/unit` liefert HTTP 200 mit dem
   Titel „Loading…" und **null Links** (clientseitig gerendert). Die 789
   Unit-Links sind ausschließlich über die 20 Armeeseiten erreichbar.
2. **Es gibt auch keine `/army`-Übersichtsseite.** `/army` leitet auf die
   Startseite um. Die 20 Armee-Links stehen im serverseitig gelieferten HTML der
   **Startseite** (`<a href="/army/vampire-counts">Vampire Counts</a>`) und sind
   dort mit dem bestehenden Extraktor greifbar. Die Armeeseiten selbst
   (`/army/vampire-counts`, 149 KB) sind serverseitig gerendert — ein
   Headless-Browser ist trotz des „Loading…"-Verhaltens von `/unit` nicht nötig.

**Kollisionen:** 40 Unit-Labels kollidieren mit bestehenden
`special-rules`-Einträgen — Einheiten, die zusätzlich eine Regelseite haben:
`Steam Tank`, `Screaming Bell`, `Helblaster Volley Gun`, `Earthshaker Cannon`,
`Organ Gun`, `Gotrek` u. a. Für sie ist die Regelseite die richtige Antwort. Die
Präzedenzregel aus Issue 02 (`special-rules` gewinnt) deckt das ab; dieses Issue
darf sie nicht umgehen. Gemessen: die 97 Zugewinne sind kollisionsfrei, die Regel
kostet also nichts.

**Abgrenzung:** Die Namen der Einheiten selbst werden **nicht** verlinkt — die
App schlägt sie nicht nach (sie verlinkt `<rule>`-Namen und Upgrade-Chips). Der
Gewinn entsteht dort, wo eine Einheit als *Upgrade* auftritt, etwa als Reittier.
Von den 789 Labels sind entsprechend nur 97 für die App relevant; der Rest darf
im Index landen, ohne dass daraus eine Anforderung entsteht.

## Acceptance Criteria
- [ ] Ein Crawl erschließt die Armeeseiten über die Startseite und erntet daraus
      die Einzelseiten unter `/unit/`.
- [ ] Nach dem Crawl liefert die Regel-Suche für „Chaos Steed", „Carnosaur",
      „Bretonnian Warhorse" und „Chariot of Khorne" je eine URL unterhalb
      `/unit/`.
- [ ] Im Editor zeigt ein Reittier-Chip (z. B. „Chaos Steed" an einem berittenen
      Charakter) das Regel-Link-Symbol und öffnet die Seite (E2E in der
      laufenden App).
- [ ] Alle 40 kollidierenden Namen (`Steam Tank`, `Screaming Bell`, …) zeigen
      unverändert auf ihre `special-rules`-URL.
- [ ] Fällt eine einzelne Armeeseite aus, wird das gemeldet und der Lauf fährt
      mit den übrigen fort; die Einträge der erfolgreichen Armeen bleiben.
- [ ] Ein Test hält fest, dass die Armee-Links von der Startseite geerntet werden
      (nicht von `/army`), und deckt eine ausgefallene Armeeseite ab.
- [ ] Volle Suite grün.

## Comments
- Issue 10/03 implementiert: Unit-Seiten via Startseite (/) -> Armeeseiten (/army/<armee>) -> /unit/<slug>.

Aenderungen:
- rules-crawler.js: DERIVATIONS um { sourceSection: "", targetSection: "unit", subPageSection: "army" } erweitert. subPageSection ermoeglicht abweichenden Pfad fuer Sub-Seiten (z.B. /army/ statt //). sectionUrl() behandelt leeren sourceSection als Root.
- rules-crawler.test.js: 3 neue Testfaelle (root->army->unit, Kollision mit special-rules, ausgefallene Armeeseite).
- rules-index.json: Neu gecrawlt. Index von 1756 auf 2500 Eintraege gewachsen (+749 unit, -5 magic-item durch Kollisionen).

Ergebnisse:
- Chaos Steed, Carnosaur, Bretonnian Warhorse, Chariot of Khorne -> /unit/
- Steam Tank, Screaming Bell, Helblaster Volley Gun -> /special-rules/ (Praezendenz bestaetigt)
- 300 Tests gruen, Lint sauber.

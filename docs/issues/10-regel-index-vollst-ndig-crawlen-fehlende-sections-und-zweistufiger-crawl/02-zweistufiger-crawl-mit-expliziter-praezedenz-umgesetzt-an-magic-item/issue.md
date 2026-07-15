Status: resolved
Blocked by: None

## Description

**Ergebnis für den Nutzer:** Armeespezifische magische Gegenstände, Banner, Runen
und Tugenden erhalten im Editor einen Regel-Link — „Runefang", „The Awakening",
„Bad Moon Banner", „Sword of Might". Das ist mit **+638** Namen der mit Abstand
größte Einzelgewinn (Abdeckung 15 % → 55 %).

**Warum das heute nicht geht:** Der Crawler kennt nur *eine* Ebene: hole
`/{section}`, nimm `/{section}/<slug>`. Für Gegenstände liefert `/magic-items`
(**Plural**) aber nur die 67 **Kategorieseiten** (`common-magic-items`, `banners`,
`bloodlines`, `heirlooms-of-athel-loren`, …). Die 776 Einzelseiten liegen unter
`/magic-item/<slug>` (**Singular**) und stehen erst im HTML der Kategorieseiten:

```html
<!-- auf /magic-items/common-magic-items -->
<a href="/magic-item/sword-of-might">Sword of Might</a>
```

Die Einzelseiten existieren nachweislich: `/magic-item/runefang`,
`/magic-item/the-awakening`, `/magic-item/bad-moon-banner` liefern echte Titel.

**Dieser Slice führt den Mechanismus ein** (Tracer Bullet): Der Crawler muss eine
Ziel-Section aus den *Seiten* einer anderen Section ernten können, statt nur aus
deren Übersichtsseite. Für `/magic-item` heißt das: Übersichtsseite
`/magic-items` → 67 Kategorieseiten → Links der Form `/magic-item/<slug>`.
Die Geschwister-Issues 03 und 04 setzen auf diesem Mechanismus auf; er sollte
daher so gefasst sein, dass eine weitere abgeleitete Section ohne Sonderlogik
hinzukommen kann.

**Zweiter Teil: Präzedenz explizit machen.** Der Index ist ein Name→Pfad-Mapping
und der zuletzt geschriebene Eintrag gewinnt — die Ziel-URL hinge damit an der
Reihenfolge der Section-Liste, was ein stiller Fallstrick ist. Bei `/magic-item`
kollidieren **4** Namen mit bestehenden `special-rules`-Einträgen: `Red Fury`,
`Cloud of Flies`, `Aura of Slaanesh`, `Stream of Corruption`. Für diese ist die
Regelseite die richtige Antwort, nicht die Gegenstandsseite. Die Präzedenz muss
deshalb **ausdrücklich** festgelegt sein (`special-rules` gewinnt bei
Gleichstand) statt sich aus der Listenposition zu ergeben.

Gemessen ist das gefahrlos: Alle 638 neuen Treffer sind kollisionsfrei — die
Präzedenzregel kostet keinen einzigen Zugewinn.

**Rahmen:** Alle Seiten sind serverseitig gerendert und folgen dem Markup, das
der bestehende Extraktor versteht; kein Headless-Browser nötig. Das
`__NEXT_DATA__`-JSON der Seiten wird bewusst nicht genutzt (internes Next.js-
Detail ohne Stabilitätsgarantie). Der Lauf holt künftig ~70 statt 5 Seiten —
die Laufzeit steigt entsprechend, was die Fortschrittsanzeige aus Issue 09
sichtbar machen muss.

## Acceptance Criteria
- [ ] Der Crawler kann eine Ziel-Section aus den Seiten einer anderen Section
      ernten; eine weitere solche Section lässt sich ohne Sonderlogik ergänzen.
- [ ] Ein Crawl erfasst die 776 Einzelseiten unter `/magic-item/` und trägt sie
      in den Index ein.
- [ ] Nach dem Crawl liefert die Regel-Suche für „Runefang", „The Awakening",
      „Bad Moon Banner" und „Sword of Might" je eine URL unterhalb
      `/magic-item/`.
- [ ] Im Editor zeigt ein Gegenstands-Chip (z. B. „Runefang" am Empire-General)
      das Regel-Link-Symbol und öffnet die Seite (E2E in der laufenden App).
- [ ] `Red Fury`, `Cloud of Flies`, `Aura of Slaanesh` und `Stream of Corruption`
      zeigen unverändert auf ihre `special-rules`-URL.
- [ ] Die Präzedenz ist explizit festgelegt und nicht von der Reihenfolge der
      Section-Liste abhängig; ein Test hält das fest.
- [ ] Fortschritt und Live-Log bilden den mehrstufigen Lauf ab: der Balken läuft
      über den gesamten Lauf, das Log weist die geernteten Einzelseiten aus.
- [ ] Fehlertoleranz bleibt: eine fehlgeschlagene Kategorieseite bricht den Lauf
      nicht ab, wird gemeldet, und die übrigen Einträge bleiben erhalten.
- [ ] Tests decken ab: Ernten aus mehreren Quellseiten, Kollision mit
      Präzedenzregel, fehlgeschlagene Quellseite. Ohne Netzwerk (Fetch injiziert).
- [ ] Volle Suite grün.

## Comments
- Implementiert den zweistufigen Crawl-Mechanismus (DERIVATIONS) und die explizite Praezedenz (special-rules gewinnt bei Gleichstand).

Was geaendert wurde:
- rules-crawler.js: Neue DERIVATIONS-Konstante, addEntry(), crawlDerivedSection(), neue CrawlEvent-Typen (HarvestStarted/Completed/Page-Ergebnisse). mergeRetainingFailedSections() beruecksichtigt Derivationen.
- generate-rules-index.js: Formatiert harvest-Events, uebergibt DERIVATIONS an merge.
- tools/rules-editor/index.html: Neue Event-Handler fuer harvest-Events.
- rules-crawler.test.js: 6 neue Testfaelle (Praezendenz, Derivation, Kollision, fehlschlagende Sub-Seite, merge).
- rules-index.json: Neu gecrawlt. Index von 983 auf 1756 Eintraege (+773 magic-item).

Ergebnisse:
- Runefang, The Awakening, Bad Moon Banner, Sword of Might -> /magic-item/
- Red Fury, Cloud of Flies -> /special-rules/ (Praezendenz bestaetigt)
- 297 Tests gruen, Lint sauber.

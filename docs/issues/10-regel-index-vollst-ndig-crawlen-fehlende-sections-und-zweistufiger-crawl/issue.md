Status: resolved
Blocked by: None

## Description

**Typ:** Feature (Crawler-Abdeckung). Dieses Issue ist die Spezifikation; die
Umsetzung erfolgt über die Kind-Issues.

**Auslöser:** Kernregeln wie „Fear" erhalten im Editor keinen Regel-Link, obwohl
6th.whfb.app eine Seite dafür hat.

**Ausgangslage:** Der Crawler kennt fünf Sections (`special-rules`, `weapons`,
`magic-items`, `spell-lists`, `characteristics`) und folgt dabei einem einzigen
Muster: *hole die Übersichtsseite `/{section}` und übernimm alle Links der Form
`/{section}/<slug>`*. Gemessen deckt das **243 von 1589** Namen ab, die die App
tatsächlich nachschlägt (**15 %**). Nachgeschlagen werden `<rule>`-Namen und
Upgrade-Einträge (die Chips im Editor), nicht die Namen der Einheiten selbst.

**Zwei unabhängige Ursachen:**

1. **Fehlende einstufige Sections.** Die Psychologie-Regeln liegen unter
   `/psychology/…` und sind von `/special-rules` gar nicht verlinkt. Betroffen:
   Fear, Terror, Hatred, Frenzy, Stupidity, Stubborn. Analog fehlen `units`,
   `chariots`, `movement`, `close-combat`. Zusammen **+12** Namen.

2. **Die Inhalte liegen unter Singular-Pfaden eine Ebene tiefer.** Die
   Übersichtsseiten listen nur Kategorien; die Einzelseiten hängen darunter und
   sind über das heutige Muster prinzipiell unerreichbar:

   | Ziel-Section | erreichbar über | Einzelseiten | Gewinn |
   |---|---|---|---|
   | `/magic-item/<slug>` (Singular!) | die 67 Kategorieseiten unter `/magic-items/<kategorie>` | 776 | **+638** |
   | `/unit/<slug>` | Startseite → die 20 Armeeseiten `/army/<armee>` | 789 | +97 |
   | `/spell/<slug>` | die Lore-Seiten unter `/spell-lists/<lore>` sowie Magic-Item-Kategorien | 24 | +6 |

   Beispiel: `/magic-items` (Plural) liefert die Kategorie `common-magic-items`;
   erst dort steht `<a href="/magic-item/sword-of-might">`. Verifiziert, dass die
   Einzelseiten existieren: `/magic-item/runefang`, `/magic-item/the-awakening`,
   `/magic-item/bad-moon-banner` liefern alle echte Titel.

**Zielbild:** Abdeckung steigt von 243 (15 %) auf **996 von 1589 (63 %)**.
Die verbleibenden ~593 sind überwiegend katalog-interne Optionslabels, die keine
Regeln sind (`Spears and Bows`, `Wizard Level 1`, `Unit Size`, `Champion`,
`2 Skeletal Steeds`) — dafür kann es keine Seite geben. Ein kleiner Rest sind
Armeebuch-Einträge mit Schreibfehlern in BSData (`Sporofic Musk`, `GAZE OF MORK`),
die allenfalls über Synonyme oder Katalog-Korrekturen erreichbar wären.

**Kollisionen (wichtig):** Der Index ist ein Name→Pfad-Mapping; beim Aufbau
gewinnt der zuletzt gecrawlte Eintrag. Die neuen Sections kollidieren mit
bestehenden Einträgen: **40** bei `/unit` (`Steam Tank`, `Screaming Bell`,
`Helblaster Volley Gun` — existieren auch als `special-rules`-Seite) und **4** bei
`/magic-item` (`Red Fury`, `Cloud of Flies`, `Aura of Slaanesh`,
`Stream of Corruption`). Ohne Vorkehrung würden 44 heute funktionierende
Regel-Links still auf die Einheiten-/Gegenstandsseite umschwenken. Die
Präzedenz muss deshalb **explizit** sein statt aus der Listenreihenfolge zu
folgen. Gemessen: alle Zugewinne sind kollisionsfrei, d. h. `special-rules` darf
bei Gleichstand gewinnen, ohne dass ein einziger neuer Treffer verloren geht.

**Soft-404-Falle:** Die Quelle liefert für erfundene URLs unterhalb einer Section
**HTTP 200** mit einer 404-Seite (`/special-rules/fear` → Titel
„404 - Page Not Found"). Ein Statuscode-Check kann falsche Pfade daher nicht
erkennen. Ein von Hand gepflegter Eintrag `Fear → /special-rules/fear` sähe
gesund aus und führte den Nutzer auf eine Fehlerseite. Die bestehende Prüfung
„Section ohne Treffer = Fehler" (Issue 09) fängt diesen Fall auf Section-Ebene ab.

**Technischer Rahmen:** Alle betroffenen Seiten sind serverseitig gerendert und
folgen dem Markup `<a href="/<section>/<slug>">Label</a>`, das der bestehende
Extraktor bereits versteht — ein Headless-Browser ist nicht nötig. Die Seiten
enthalten zusätzlich ein `__NEXT_DATA__`-JSON mit Strukturdaten; das ist ein
internes Next.js-Detail ohne Stabilitätsgarantie und wird bewusst **nicht**
genutzt.

**Abgrenzung:** Keine Anker-Links auf Kategorieseiten — die Seiten tragen nur
Kategorie-Anker (`#magic-weapons`, `#talismans`), keine pro Gegenstand; sie werden
durch die Einzelseiten ohnehin überflüssig. Keine Aufnahme von Anhängen, FAQ oder
Glossar: gemessen null Gewinn bei tausenden Einträgen. Keine Verlinkung von
Einheitennamen (die App schlägt sie nicht nach).

## Acceptance Criteria
- [ ] Alle Kind-Issues sind resolved.
- [ ] Die Abdeckung der von der App nachgeschlagenen Namen steigt von 243 auf
      ~996; „Fear", „Runefang" und Reittier-Chips sind im Editor verlinkt.
- [ ] Keiner der 44 kollidierenden Namen wechselt seine Ziel-URL gegenüber heute.
- [ ] Das PRD des Editors spiegelt das erweiterte Crawl-Modell wider.

## Comments
- Analyse-Grundlage: Messung der Katalognamen (`<rule>` + Upgrade-Einträge aus
  public/catalogs/whfb6/) gegen die real gecrawlten Labels der Quelle.

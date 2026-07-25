# Testkatalog — E2E-Tests der Reinraum-Engine (Evaluator)

Dieser Katalog beschreibt **jeden** End-to-End-Test der neuen Reinraum-Engine
(`src/evaluator/`) in nicht-technischer Sprache, damit ein fachlicher Leser jeden
geprüften Fall nachvollziehen kann — ohne den Testcode zu lesen. Er deckt
**ausschließlich** die E2E-Tests der neuen Engine ab: keine Unit-/Komponenten-
tests und keine Tests der alten Solver-Engine.

Alle hier gelisteten Tests werten Roster gegen die **echten** Definitive-Edition-
Katalogdaten aus (ADR-[0032](adr/0032-evaluator-loest-mehr-katalog-datensaetze-global-by-id-auf.md)) —
genau die Dateien, die ein Nutzer beim Import erlebt. Die Datensätze und die
verifizierten Kennungen/Grenzwerte liefert die gemeinsame Testnaht
[`realCatalogs.js`](../src/evaluator/__fixtures__/realCatalogs.js); die Fixture-
Herkunft steht in [`whfb6-definitive/README.md`](../src/evaluator/__fixtures__/whfb6-definitive/README.md).

## Pflege-Regel (verbindlich, manuell)

> **Sobald ein neues Problem der Engine erkannt und behoben wird, werden dafür
> zwei Dinge zusammen angelegt: (1) ein E2E-Test in `src/evaluator/`, der das
> Problem an echten Daten absichert, **und** (2) ein zugehöriger Eintrag in
> diesem Katalog.**

Die Pflege erfolgt **von Hand** — es gibt bewusst **keinen** Generator und
**kein** CI-Gate, das den Katalog gegen die Suite erzwingt. Der Katalog muss
darum bei jeder Änderung an der E2E-Suite deckungsgleich gehalten werden: jeder
gelistete Test existiert in der Suite, und jeder E2E-Test/jedes Szenario der
neuen Engine steht im Katalog. Wer eine E2E-Testdatei hinzufügt, umbenennt,
löscht oder ein `describe`/`it` ändert, aktualisiert im selben Schritt diesen
Katalog.

## Abgedeckte Testdateien

| Datei | Szenarien | Einzeltests |
| :--- | :---: | :---: |
| [`e2e.ogreKingdoms.test.js`](../src/evaluator/e2e.ogreKingdoms.test.js) | 6 | 11 |
| [`e2e.orcsAndGoblins.test.js`](../src/evaluator/e2e.orcsAndGoblins.test.js) | 2 | 4 |
| [`e2e.vampireCounts.test.js`](../src/evaluator/e2e.vampireCounts.test.js) | 2 | 4 |
| [`e2e.realCatalog.smoke.test.js`](../src/evaluator/e2e.realCatalog.smoke.test.js) | 1 | 4 |
| **Summe** | **11** | **23** |

### Kurzform der Katalogdateien

Zur besseren Lesbarkeit werden die realen Dateinamen in der Spalte *Betroffene
Katalogdateien* abgekürzt:

- **gst** = `Warhammer Fantasy Battles (6th definitive edition).gst`
- **Mercenaries** = `Mercenaries (6th definitive edition).cat`
- **Ogre Kingdoms** = `Ogre Kingdoms (6th definitive edition).cat`
- **Orcs and Goblins** = `Orcs and goblins (6th definitive edition).cat`
- **Vampire Counts** = `Vampire Counts (6th definitive edition).cat`

Jede Armee-`.cat` wird zusammen mit ihrer gemeinsamen **Mercenaries**-
Abhängigkeit ausgewertet (Stern-Struktur). Einige Tests prüfen bewusst den
**unvollständigen** Satz *ohne* Mercenaries — dort fehlt die Mercenaries-Datei in
der Spalte, und genau das ist der geprüfte Fall.

---

## `e2e.ogreKingdoms.test.js`

Reale Domänen-Regeln der **Ogre-Kingdoms**-Armee an verifizierten Kennungen und
Grenzwerten.

### Szenario: Armeeweite Pflichtregeln „General" und „Core"
[→ describe-Block](../src/evaluator/e2e.ogreKingdoms.test.js#L70)

| Titel | Betroffene Katalogdateien | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Testdatei |
| :--- | :--- | :--- | :--- | :--- |
| Schlägt bei leerem Kontingent für General (min 1) und Core (min 2) an | gst + Ogre Kingdoms + Mercenaries | Ein Ogre-Kontingent ganz ohne Einheiten | Der Auswerter beanstandet die Armee: der Pflicht-General (mindestens 1) und die Pflicht-Kerneinheiten (mindestens 2) fehlen — gezählt 0 gegen die geforderte Zahl | [#L71](../src/evaluator/e2e.ogreKingdoms.test.js#L71) |
| Ist erfüllt, sobald die geforderten Einheiten vorhanden sind | gst + Ogre Kingdoms + Mercenaries | Dasselbe Kontingent mit einem General und zwei Kerneinheiten | Keine General- oder Kern-Beanstandung mehr — beide Pflichten sind erfüllt | [#L86](../src/evaluator/e2e.ogreKingdoms.test.js#L86) |

### Szenario: Bedingter Modifikator senkt die Core-Untergrenze
[→ describe-Block](../src/evaluator/e2e.ogreKingdoms.test.js#L94)

| Titel | Betroffene Katalogdateien | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Testdatei |
| :--- | :--- | :--- | :--- | :--- |
| Hält die Core-Untergrenze bei 2, solange „Border Patrols rules" fehlt | gst + Ogre Kingdoms + Mercenaries | General + genau eine Kerneinheit, ohne die Sonderregel „Border Patrols rules" | Eine Kerneinheit reicht nicht: die geforderte Mindestzahl bleibt 2, also eine Beanstandung (1 von 2) | [#L101](../src/evaluator/e2e.ogreKingdoms.test.js#L101) |
| Setzt die Core-Untergrenze auf 1, sobald „Border Patrols rules" im Roster liegt | gst + Ogre Kingdoms + Mercenaries | General + eine Kerneinheit + die Auswahl „Border Patrols rules" | Die Sonderregel senkt die geforderte Mindestzahl auf 1; dieselbe eine Kerneinheit genügt jetzt — keine Beanstandung | [#L110](../src/evaluator/e2e.ogreKingdoms.test.js#L110) |
| Senkt die Core-Untergrenze im leeren Kontingent sichtbar von 2 auf 1 | gst + Ogre Kingdoms + Mercenaries | Einmal ein leeres Kontingent, einmal ein Kontingent, das nur „Border Patrols rules" enthält | Die geforderte Kern-Mindestzahl ist ohne die Sonderregel 2, mit ihr 1 — die Bedingung verändert die Grenze sichtbar | [#L120](../src/evaluator/e2e.ogreKingdoms.test.js#L120) |

### Szenario: Unbedingte Tyrant-Obergrenze (höchstens 1)
[→ describe-Block](../src/evaluator/e2e.ogreKingdoms.test.js#L132)

| Titel | Betroffene Katalogdateien | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Testdatei |
| :--- | :--- | :--- | :--- | :--- |
| Erzeugt für zwei Tyrants eine Verletzung (Ist 2, Grenze 1) | gst + Ogre Kingdoms + Mercenaries | Zwei „Tyrant"-Auswahlen im Kontingent | Zwei Tyrants überschreiten die Obergrenze von höchstens 1 — Beanstandung (2 statt max. 1) | [#L133](../src/evaluator/e2e.ogreKingdoms.test.js#L133) |
| Lässt genau einen Tyrant unbeanstandet | gst + Ogre Kingdoms + Mercenaries | Genau ein „Tyrant" im Kontingent | Ein Tyrant hält die Obergrenze ein — keine Beanstandung | [#L144](../src/evaluator/e2e.ogreKingdoms.test.js#L144) |

### Szenario: Katalogübergreifende Auflösung über Mercenaries
[→ describe-Block](../src/evaluator/e2e.ogreKingdoms.test.js#L151)

| Titel | Betroffene Katalogdateien | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Testdatei |
| :--- | :--- | :--- | :--- | :--- |
| Löst alle per Verweis importierten Definitionen auf | gst + Ogre Kingdoms + Mercenaries | Leeres Ogre-Kontingent, ausgewertet mit vollständiger Quelle | Alle katalogübergreifenden Verweise werden aufgelöst — kein Verweis bleibt fälschlich offen, keine Meldung über eine fehlende Abhängigkeit | [#L152](../src/evaluator/e2e.ogreKingdoms.test.js#L152) |

### Szenario: §7.7 — Kategorie-Ziel zählt armeeweit über Kontingente
[→ describe-Block](../src/evaluator/e2e.ogreKingdoms.test.js#L161)

| Titel | Betroffene Katalogdateien | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Testdatei |
| :--- | :--- | :--- | :--- | :--- |
| Schlägt an jedem leeren Kontingent an | gst + Ogre Kingdoms + Mercenaries | Zwei leere Ogre-Kontingente | Jedes leere Kontingent bekommt seine eigene General- und Kern-Beanstandung (zwei je Regel), jeweils gegen die armeeweite Summe 0 | [#L177](../src/evaluator/e2e.ogreKingdoms.test.js#L177) |
| Ist armeeweit erfüllt, sobald irgendein Kontingent die Pflicht trägt | gst + Ogre Kingdoms + Mercenaries | Ein Kontingent voll bestückt (General + zwei Kerneinheiten), ein zweites leer | Weil die Kategorie armeeweit zählt, erfüllt das bestückte Kontingent die Pflicht für die ganze Armee — auch das leere Geschwister-Kontingent wird nicht beanstandet | [#L189](../src/evaluator/e2e.ogreKingdoms.test.js#L189) |

### Szenario: Unauflösbare Roster-Auswahl — Hinweis statt Absturz
[→ describe-Block](../src/evaluator/e2e.ogreKingdoms.test.js#L199)

| Titel | Betroffene Katalogdateien | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Testdatei |
| :--- | :--- | :--- | :--- | :--- |
| Meldet eine Roster-Auswahl ohne Definition als Hinweis und stürzt nicht | gst + Ogre Kingdoms + Mercenaries | Eine Auswahl mit einer Kennung, die es im echten Katalog nicht gibt | Der Auswerter meldet die unbekannte Auswahl als Hinweis („nicht auflösbar") und liefert trotzdem einen strukturell vollständigen Bericht — kein Absturz | [#L207](../src/evaluator/e2e.ogreKingdoms.test.js#L207) |

---

## `e2e.orcsAndGoblins.test.js`

Prüft an der **Orcs-and-Goblins**-Armee die im **Spielsystem** definierten
Pflichtregeln (für jede Armee gleich) sowie die katalogübergreifende Auflösung.

### Szenario: Armeeweite Pflichtregeln „General" und „Core"
[→ describe-Block](../src/evaluator/e2e.orcsAndGoblins.test.js#L51)

| Titel | Betroffene Katalogdateien | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Testdatei |
| :--- | :--- | :--- | :--- | :--- |
| Schlägt bei leerem Kontingent für General (min 1) und Core (min 2) an | gst + Orcs and Goblins + Mercenaries | Ein leeres Orcs-and-Goblins-Kontingent | Der Auswerter beanstandet den fehlenden Pflicht-General und die fehlenden Pflicht-Kerneinheiten (0 gegen die geforderte Zahl) | [#L52](../src/evaluator/e2e.orcsAndGoblins.test.js#L52) |
| Erzeugt für eine regelkonforme Liste keine falsche Beanstandung | gst + Orcs and Goblins + Mercenaries | General + zwei Kerneinheiten | Keine falsche General- oder Kern-Beanstandung für die bekannt-regelkonforme Liste | [#L67](../src/evaluator/e2e.orcsAndGoblins.test.js#L67) |

### Szenario: Katalogübergreifende Auflösung über Mercenaries
[→ describe-Block](../src/evaluator/e2e.orcsAndGoblins.test.js#L75)

| Titel | Betroffene Katalogdateien | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Testdatei |
| :--- | :--- | :--- | :--- | :--- |
| Löst mit vollständiger Quelle alle importierten Definitionen auf | gst + Orcs and Goblins + Mercenaries | Leeres Kontingent, vollständige Quelle | Kein Verweis bleibt offen, keine Meldung über eine fehlende Abhängigkeit | [#L76](../src/evaluator/e2e.orcsAndGoblins.test.js#L76) |
| Meldet die fehlende Mercenaries-Abhängigkeit und lässt ihren Verweis offen | gst + Orcs and Goblins *(ohne Mercenaries)* | Leeres Kontingent, Quelle **ohne** die Mercenaries-Datei | Der Auswerter meldet, dass die deklarierte Mercenaries-Abhängigkeit fehlt; der nur darüber erreichbare Verweis („Pikemen") bleibt offen — als Hinweis, kein Absturz | [#L84](../src/evaluator/e2e.orcsAndGoblins.test.js#L84) |

---

## `e2e.vampireCounts.test.js`

Prüft an der **Vampire-Counts**-Armee dieselben spielsystemweiten Pflichtregeln
und die katalogübergreifende Auflösung.

### Szenario: Armeeweite Pflichtregeln „General" und „Core"
[→ describe-Block](../src/evaluator/e2e.vampireCounts.test.js#L51)

| Titel | Betroffene Katalogdateien | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Testdatei |
| :--- | :--- | :--- | :--- | :--- |
| Schlägt bei leerem Kontingent für General (min 1) und Core (min 2) an | gst + Vampire Counts + Mercenaries | Ein leeres Vampire-Counts-Kontingent | Der Auswerter beanstandet den fehlenden Pflicht-General und die fehlenden Pflicht-Kerneinheiten (0 gegen die geforderte Zahl) | [#L52](../src/evaluator/e2e.vampireCounts.test.js#L52) |
| Erzeugt für eine regelkonforme Liste keine falsche Beanstandung | gst + Vampire Counts + Mercenaries | General + zwei Kerneinheiten | Keine falsche General- oder Kern-Beanstandung für die bekannt-regelkonforme Liste | [#L67](../src/evaluator/e2e.vampireCounts.test.js#L67) |

### Szenario: Katalogübergreifende Auflösung über Mercenaries
[→ describe-Block](../src/evaluator/e2e.vampireCounts.test.js#L75)

| Titel | Betroffene Katalogdateien | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Testdatei |
| :--- | :--- | :--- | :--- | :--- |
| Löst mit vollständiger Quelle alle importierten Definitionen auf | gst + Vampire Counts + Mercenaries | Leeres Kontingent, vollständige Quelle | Kein Verweis bleibt offen, keine Meldung über eine fehlende Abhängigkeit | [#L76](../src/evaluator/e2e.vampireCounts.test.js#L76) |
| Meldet die fehlende Mercenaries-Abhängigkeit und lässt ihren Verweis offen | gst + Vampire Counts *(ohne Mercenaries)* | Leeres Kontingent, Quelle **ohne** die Mercenaries-Datei | Der Auswerter meldet, dass die deklarierte Mercenaries-Abhängigkeit fehlt; der nur darüber erreichbare Verweis („Pikemen") bleibt offen — als Hinweis, kein Absturz | [#L84](../src/evaluator/e2e.vampireCounts.test.js#L84) |

---

## `e2e.realCatalog.smoke.test.js`

Rauchtest der Fassade `evaluate({ gameSystem, catalogues }, roster)` an den
vollständigen echten DE-Daten. Belegt die **Auflösungs-Fähigkeit** der Engine
(nicht die Regel-Semantik einzelner Armeen).

### Szenario: Echte DE-Daten, katalogübergreifende Auflösung (Ogre + gst + Mercenaries)
[→ describe-Block](../src/evaluator/e2e.realCatalog.smoke.test.js#L46)

| Titel | Betroffene Katalogdateien | Geprüfter Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Testdatei |
| :--- | :--- | :--- | :--- | :--- |
| Liefert für eine leere Armee einen vollständigen Bericht, ohne zu stürzen | gst + Ogre Kingdoms + Mercenaries | Eine leere Armee (keine Kontingente) | Der Auswerter liefert einen strukturell vollständigen Bericht und stürzt nicht | [#L47](../src/evaluator/e2e.realCatalog.smoke.test.js#L47) |
| Löst alle per Verweis importierten Definitionen auf | gst + Ogre Kingdoms + Mercenaries | Leere Armee, vollständige Quelle | Kein Verweis bleibt fälschlich offen, keine Meldung über eine fehlende Abhängigkeit | [#L55](../src/evaluator/e2e.realCatalog.smoke.test.js#L55) |
| Löst eine nur über Mercenaries erreichbare Definition auf | gst + Ogre Kingdoms + Mercenaries — **verglichen mit** gst + Ogre Kingdoms *(ohne Mercenaries)* | Leere Armee, einmal mit und einmal ohne die Mercenaries-Datei | Der reale Verweis „Pikemen" bleibt ohne Mercenaries offen und löst mit Mercenaries auf — nur die katalogübergreifende Auflösung schließt ihn | [#L65](../src/evaluator/e2e.realCatalog.smoke.test.js#L65) |
| Meldet die fehlende Mercenaries-Abhängigkeit statt eines Absturzes | gst + Ogre Kingdoms *(ohne Mercenaries)* | Leere Armee, Quelle **ohne** die Mercenaries-Datei | Der Auswerter meldet die fehlende Abhängigkeit als Hinweis; der Bericht bleibt strukturell vollständig, kein Absturz | [#L75](../src/evaluator/e2e.realCatalog.smoke.test.js#L75) |

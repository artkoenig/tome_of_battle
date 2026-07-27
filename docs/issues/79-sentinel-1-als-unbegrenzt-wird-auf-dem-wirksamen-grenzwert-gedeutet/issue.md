Status: needs-triage
Type: fix
Blocked by: None

## Description

> **Neu gefasst am 2026-07-27.** Die ursprüngliche Fassung unterstellte, das
> Deuten des Sentinels auf dem *wirksamen* Grenzwert sei der Fehler. Eine
> Recherche an den Katalogdaten hat das widerlegt: es ist für den häufigsten
> realen Fall gerade das richtige Verhalten. Zwei der fünf Akzeptanzkriterien
> hätten reale Daten kaputtgemacht. Die Herleitung steht im `## Decisions`-Log;
> was von dem Befund trägt, steht hier.

Der Wert `-1` bedeutet an einer Grenze „unbegrenzt". Das Format-Dokument dieses
Projekts hält es fest (`docs/battlescribe-data-format.md`, Zeile 614: für das
Attribut `value` eines `<constraint>` — „Der Grenzwert (-1.0 = unbegrenzt)"), und
die Katalogautoren nutzen es tragend, auf **zwei** Wegen:

| Weg | Vorkommen in den Fixture-Katalogen |
|---|---|
| als Basiswert im XML (`<constraint … value="-1">`) | 122 |
| als **Ergebnis** eines `<modifier type="set" value="-1" field="<grenz-id>">` | 10 belegte Fälle |

Der zweite Weg ist ein bewusstes Idiom: die Grenze steht im XML auf `0` oder `1`
und wird unter einer Bedingung per Modifikator entsperrt. Belegt unter anderem an
`Mercenaries (6th definitive edition).cat:4272` (Basis `max=1`),
`Ogre Kingdoms (6th definitive edition).cat:481` (Basis `max=0`) und
`Orcs and goblins (6th definitive edition).cat:4059` (Basis `max=1`).

**Daraus folgt, dass der Sentinel auf dem wirksamen Wert gedeutet werden muss.**
Würde er nur auf dem Rohwert gelten, verlören alle zehn dieser Grenzen ihre
Entsperrung und erzwängen ein wörtliches `max = -1`, das keine Anzahl je erfüllt —
sie würden also genau die Auswahl verbieten, die sie freischalten sollen. Das war
der Denkfehler der ursprünglichen Fassung.

Was von dem Befund bleibt, sind drei echte Mängel:

1. **Es gibt keine Regel für Werte unterhalb von `-1`.** Die Subtraktion in der
   Modifikator-Schicht rechnet ohne Untergrenze; ein `decrement` kann einen
   Grenzwert grundsätzlich auf `-2` oder tiefer ziehen. Das Format-Dokument belegt
   nur `-1.0` mit einer Bedeutung und sagt über `-2` nichts. Heute fällt ein
   solcher Wert stillschweigend durch: er ist nicht `-1`, wird also als gewöhnliche
   Zahl weitergerechnet, und eine Grenze `max = -2` verhält sich wie „nichts
   erlaubt" — ohne dass irgendwo festgehalten wäre, dass das gemeint ist.
   In den Fixture-Katalogen gibt es dafür **keinen** Fall: alle `decrement`-Ziele
   sind entweder Charakteristiken statt Grenzen, oder ihr Ergebnis bodet bei `0`.
   Die Lücke ist also eine im Code, keine in den Daten — und genau deshalb still.

2. **Das harte Literal statt des benannten Sentinels.** Die auswertende Schicht
   vergleicht an genau einer Stelle gegen ein eingebautes `-1`, während der
   Katalog-Leser denselben Sentinel benannt führt und ihn beim Lesen wegbildet,
   damit ihn niemand als Zahl weiterrechnet. Zwei Deutungen desselben Wertes an
   zwei Stellen, eine davon namenlos.

3. **Das Glossar schweigt.** `CONTEXT.md` hat keinen Eintrag für den Sentinel und
   keinen für die Unterscheidung zwischen dem *rohen* und dem *wirksamen* Wert
   einer Grenze — obwohl genau diese Unterscheidung nötig ist, um über das Thema
   überhaupt richtig zu reden. Die ursprüngliche Fehlfassung dieses Issues ist der
   Beleg dafür, dass die fehlende Begriffsklärung Schaden anrichtet.

Der Sentinel an `defaultCostLimit` ist **nicht** betroffen: er wird beim Lesen
korrekt weggebildet, ist durch einen eigenen Test abgesichert, und kein
Modifikator kann ihn erreichen.

## Acceptance Criteria
- [ ] Ein Grenzwert von genau `-1` gilt als „unbegrenzt", gleich ob er im Katalog steht oder erst durch einen Modifikator entsteht; die zehn belegten Entsperr-Fälle bleiben entsperrt.
- [ ] Für einen wirksamen Grenzwert unterhalb von `-1` gibt es eine festgelegte, begründete Behandlung, und sie ist nicht „stillschweigend als Zahl weiterrechnen".
- [ ] Kein hartes `-1`-Literal mehr in der auswertenden Schicht; der benannte Sentinel ist die eine Quelle für beide Schichten.
- [ ] `CONTEXT.md` erklärt den Sentinel und die Unterscheidung zwischen rohem und wirksamem Grenzwert.
- [ ] Ein Szenario an echten Katalogdaten hält den Entsperr-Fall fest — eine Grenze, die ein Modifikator auf `-1` setzt, wird als unbegrenzt gelesen (ADR-0033, verfasst vom Black-Box-Autor).
- [ ] Ein Modultest hält die Behandlung unterhalb von `-1` fest, da die Katalogdaten dafür keinen Fall hergeben.
- [ ] Die übrige Testsuite bleibt grün.

## Decisions
- `[po]` Beschreibung und Akzeptanzkriterien neu gefasst, weil eine Katalogdaten-Recherche die urspruengliche Praemisse widerlegt hat. Das alte Kriterium 'Der Sentinel wird dort gedeutet, wo er als Rohwert steht, nicht auf dem wirksamen Wert' haette reale Daten zerstoert: in 10 belegten Faellen steht die Grenze im XML auf 0 oder 1 und wird bedingt per modifier type=set value=-1 entsperrt, u. a. Mercenaries:4272 (Basis max=1), Ogre Kingdoms:481 (Basis max=0), Orcs and goblins:4059 (Basis max=1). Nur auf dem Rohwert gedeutet, wuerden alle zehn ein woertliches max=-1 erzwingen, das keine Anzahl erfuellt — sie verboten also genau die Auswahl, die sie freischalten sollen. Ebenso widerlegt: das befuerchtete decrement-Szenario ist datenseitig nicht belegbar (alle decrement-Ziele sind Charakteristiken oder boden bei 0). Quelle fuer die Neufassung: docs/battlescribe-data-format.md:614 belegt -1.0 = unbegrenzt fuer das value-Attribut eines constraint, ohne nach Herkunft zu unterscheiden; die 122 Roh- und 10 Modifikator-Vorkommen in den Fixture-Katalogen; Catalogue.xsd:427 laesst negative Werte syntaktisch unbeschraenkt und enthaelt keine Semantik. Erhalten bleiben drei echte Maengel: keine Regel unterhalb -1 (Subtraktion ohne Untergrenze), das harte Literal neben dem benannten Sentinel, und die fehlende Begriffsklaerung roh/wirksam in CONTEXT.md. Die Fehlfassung dieses Issues ist selbst der Beleg fuer den dritten Punkt.
- `[po]` Behandlung unterhalb von -1 als po entschieden, damit der Schnitt nicht daran haengt: genau -1 bedeutet unbegrenzt, ein Wert darunter nicht. Herleitung: docs/battlescribe-data-format.md belegt ausschliesslich -1.0 mit einer Bedeutung und sagt ueber -2 nichts; die Engine behandelt Unaufloesbares nach ihrer bestehenden Konvention fail-closed mit Diagnose statt still (belegt an der Diagnose unresolvedScope). Ein wirksamer Wert unterhalb -1 ist damit kein zweiter Sentinel, sondern ein diagnosewuerdiger Zustand. Das aendert an den 122 Roh- und 10 Modifikator-Faellen nichts. Immateriell im Sinne der Regel: keine sichtbare Verhaltensaenderung, kein oeffentlicher Vertrag, kein Datenmodell, keine Abhaengigkeit — die Engine haengt an keinem Produktivpfad. Die genaue Form der Diagnose bleibt dem Umsetzungsschnitt.

## Comments

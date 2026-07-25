Status: ready-for-agent
Type: refactor
Blocked by: [01]

## Description

Nachdem Slice 01 die dateiübergreifende Auflösung an Ogre Kingdoms belegt hat,
weitet diese Slice die E2E-Abdeckung auf die **beiden übrigen** realen
Definitive-Edition-Kataloge aus: Orcs and Goblins und Vampire Counts, jeweils
zusammen mit derselben Spielsystemdatei. Damit ist belegt, dass die Auflösung
nicht auf einen Katalog zugeschnitten ist, sondern katalogübergreifend trägt.

Je Katalog werden aussagekräftige Szenarien geprüft (z. B. eine armeeweite
Pflicht- oder Obergrenzenregel, ein realer bedingter Modifikator, eine
regelkonforme Liste), mit Assertions auf **bekannte, im jeweiligen Katalog
verifizierte** Definitions-IDs, Namen und Grenzwerte.

## Acceptance Criteria
- [ ] Die echten Orcs-and-Goblins-Daten werden zusammen mit ihrer
      Spielsystemdatei end-to-end ausgewertet; mindestens eine reale
      Regel (Pflicht-/Obergrenze oder bedingter Modifikator) wird an bekannten
      realen IDs/Werten geprüft, und eine bekannt-regelkonforme Liste erzeugt
      keine falsche Verletzung.
- [ ] Die echten Vampire-Counts-Daten werden ebenso end-to-end ausgewertet und
      an mindestens einer bekannten realen Regel geprüft.
- [ ] Für beide Kataloge werden per Verweis importierte Definitionen
      berücksichtigt und erscheinen nicht fälschlich als unaufgelöst.
- [ ] Alle Tests (`npm test`) sind grün.

## Comments

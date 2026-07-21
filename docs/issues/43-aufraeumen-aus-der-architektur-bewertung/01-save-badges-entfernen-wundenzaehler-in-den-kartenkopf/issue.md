Status: resolved
Type: feature
Blocked by: None

## Description

### Problem

Die Einheitenkarte im Spielmodus zeigt im Kopfbereich zwei Badges — „AS:" für
den Rüstungswurf und „WS:" für den Rettungswurf. Beide Werte werden **nicht aus
Katalogdaten gelesen, sondern aus Regeltext geraten**: Schlüsselwort-Listen
prüfen deutsche und englische Substrings in Einheitennamen, Regelbeschreibungen,
Charakteristik-Werten und sogar im **Katalognamen** und leiten daraus einen
Zahlenwert her.

Die Recherche für diese Spezifikation ergab drei Befunde:

1. **Die Verlässlichkeit ist nicht belegbar.** Reittiere werden über eine Liste
   von 19 Artnamen erkannt, mit einer zweiten Liste von sechs Ausnahmen dazu;
   ein Streitwagen daran, dass der Name die Zeichenkette „chariot" enthält. Für
   den Rettungswurf existiert in **keinem** geprüften Katalog eine strukturelle
   Entsprechung — alle Fundstellen sind Prosa in `<description>`-Feldern. Ein
   Katalog-Fix wäre nur um den Preis dauerhafter Handpflege in zwei unabhängigen
   Fork-Repos zu haben, ohne Upstream-Standard, an dem er sich ausrichten
   könnte.
2. **Der Nutzen ist gering.** Die Werte sind reine Anzeige. Sie fließen weder in
   Validierung noch in Kosten, Konstruktion oder Serialisierung ein; die
   Solver-Fassade re-exportiert sie, ruft sie aber nirgends auf. Einziger
   Konsument ist die Einheitenkarte im Spielmodus.
3. **Die Kosten sind hoch.** Rund 350 Zeilen Herleitungslogik, ein eigener Satz
   Schlüsselwort-Listen, ein zweiter — flacherer und fehleranfälliger —
   Sammelpfad neben dem kanonischen, und eine ausdrückliche Ausnahme in ADR 0003.

Das Verhältnis trägt nicht. Der Platz im Kartenkopf ist im Spiel besser für den
Wundenzähler genutzt — das am häufigsten bediente Element, das heute an den
rechten Rand derselben Zeile gedrängt ist.

### Lösung

Die Rüstungs- und Rettungswurf-Anzeige entfällt **ersatzlos**. Der Wundenzähler
rückt an die frei werdende Position im Kartenkopf — **unverändert in Darstellung
und Bedienung**, lediglich an anderer Stelle in derselben Zeile.

Mit dem Feature entfallen:

- die beiden Badges samt Hover-Tooltip, Klick-Popup und der darin gezeigten
  Herleitungs-Aufschlüsselung
- die Herleitungsfunktionen für Rüstungswurf, Rettungswurf und Segen
- die Schlüsselwort-Listen für Rüstung, Reittiere, Schuppenhaut und Segen samt
  ihrer Re-Exporte über die Solver-Fassade
- der zweite, flache Sammelpfad, der eigens für die Saves neben dem kanonischen
  Profil-Sammler existiert
- die zugehörigen Tests und CSS-Klassen

### Architektonischer Gewinn

ADR 0003 §3 führt die Rüstungs- und Rettungswurf-Berechnung als **einzige
zugelassene Ausnahme** von der Regel „keine sprachabhängigen Strings als
Schlüssel". Fällt das Feature, fällt die Ausnahme: die Regel gilt danach
ausnahmslos. Zusätzlich wird der Absatz zu den Rüstungs- und
Rettungswurf-Modifikatoren in §4 gegenstandslos. Beide Stellen sind zu streichen
— ebenso die Dublette in `docs/battlescribe-data-format.md`.

Das ist die eigentliche Wirkung dieser Änderung und wiegt schwerer als die
gelöschten Zeilen.

### Mitzunehmende Bereinigung

Die Wundenberechnung existiert doppelt: einmal im Spielzustands-Hook und noch
einmal, wirkungsgleich, lokal in der Einheitenkarte. Deshalb meldet der Linter
die Hook-Variante an ihrer Übergabestelle als ungenutzt. Da der Zähler ohnehin
angefasst wird, ist die lokale Kopie zugunsten der Hook-Variante zu entfernen —
**eine** Quelle der Wahrheit für den Wundenstand.

### Nicht Teil dieser Änderung

- Keine Änderung an Wund-Logik, Spielzustand oder dessen Persistenz. Der Zähler
  wird verschoben, nicht umgebaut.
- Keine neue Gestaltung des Zählers. Ausdrücklich die kleinste Variante:
  dieselben Bedienelemente, dieselbe Darstellung, andere Position.
- Kein Ersatz für die entfallenden Werte an anderer Stelle der Oberfläche.

### Test-Nahtstellen (Seams)

Getestet wird an bestehenden Schnittstellen; neue werden nicht eingeführt:

- **Einheitenkarte im Spielmodus** (Komponententest, vorhandene Testdatei): die
  Karte rendert keine AS/WS-Badges mehr; der Wundenzähler ist vorhanden,
  bedienbar und zeigt denselben Stand wie zuvor.
- **Spielzustands-Hook** (vorhandener Unit-Test): unverändert grün — Beweis,
  dass die Wund-Logik nicht angetastet wurde.
- **Solver-Fassade**: die entfernten Namen sind nicht mehr exportiert.
- **Gesamtsuite**: keine verwaisten Importe, keine neuen Lint-Warnungen.

Die Tests der entfallenden Herleitungsfunktionen werden mit ihnen gelöscht — sie
haben ohne ihr Prüfobjekt keinen Gegenstand.

## Acceptance Criteria
- [ ] Die Einheitenkarte im Spielmodus zeigt keine AS/WS-Badges mehr — weder
      Wert noch Tooltip noch Klick-Popup.
- [ ] Der Wundenzähler steht an der Position, an der zuvor die Badges standen,
      mit unveränderter Darstellung und Bedienung.
- [ ] Herleitungsfunktionen, Schlüsselwort-Listen, Fassaden-Re-Exporte, der
      zweite Sammelpfad, die zugehörigen Tests und die CSS-Klassen sind
      entfernt; die Codebasis enthält keine toten Verweise darauf.
- [ ] Der Wundenstand wird nur noch an einer Stelle berechnet; die lokale Kopie
      in der Einheitenkarte ist entfernt.
- [ ] ADR 0003 ist angepasst: die Ausnahme in §3 und der Modifikator-Absatz in
      §4 sind gestrichen, die Regel „keine sprachabhängigen Strings" gilt
      ausnahmslos. Die Dublette in `docs/battlescribe-data-format.md` ist
      ebenfalls bereinigt.
- [ ] `npm test` ist grün.
- [ ] Ein Screenshot der Spielansicht (Desktop und mobil) belegt den neuen
      Kartenkopf.
- [ ] Haupt-Issue 28, Punkt 3 ist als gegenstandslos vermerkt.

## Comments
- AS/WS-Badges samt Herleitungslogik (getArmourSave, getWardSave, hasBlessing), Keyword-Listen, Fassaden-Re-Exporten, zweitem Sammelpfad und CSS-Klassen ersatzlos entfernt; der Wundenzaehler steht nun links im Kartenkopf und liest seinen Stand ausschliesslich ueber getUnitCurrentWounds aus usePlayState. ADR 0003 (Ausnahme in 3, Modifikator-Absatz in 4) und die Dublette in docs/battlescribe-data-format.md bereinigt. Kein Screenshot moeglich: generate_screenshots.js benoetigt public/catalogs/whfb6, das lokal nicht vorliegt.

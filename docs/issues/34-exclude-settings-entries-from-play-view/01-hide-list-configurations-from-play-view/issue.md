Status: resolved
Type: fix
Blocked by: None

## Description
Battlescribe-Kataloge modellieren listenweite Regel-Schalter (z. B. „Allow
experimental rules?", „Allow special characters?" in der WHFB6 Definitive
Edition) als `selectionEntry` vom Typ `upgrade` — keine spielbaren Einheiten.
Die Spieleansicht (`PlayMode.jsx`) gruppiert Selections aber rein nach
Kategorie-Zugehörigkeit und rendert solche Schalter dadurch fälschlich als
(leere) Einheitenkarten.

Führe ein datengetriebenes, generisches Klassifikationsmerkmal für den in
`CONTEXT.md` definierten Begriff „Listenkonfiguration" ein: eine Selection ist
eine Listenkonfiguration, wenn ihr aufgelöster Typ `upgrade` ist, ihr gesamter
Teilbaum (Eintrag + alle `selectionEntries`-Kinder) durchgehend profil- und
kostenlos ist, und sie direkt an der Armeeliste hängt (Top-Level-Selection
einer Force, nicht verschachtelt unter einer Einheit). Das Kriterium darf
keine Kategorie-ID/-Namen oder Katalog-/Fraktions-Spezifika hartkodieren
(ADR-0003) — es muss für jede Battlescribe-Datenquelle gültig sein, auch für
Kataloge ohne solche Einträge (z. B. Ergofarg).

Die Spieleansicht filtert erkannte Listenkonfigurationen vollständig aus ihren
Gruppen heraus — keine ersatzweise Sichtbarkeit (z. B. eine "aktive Regeln"-
Leiste).

## Acceptance Criteria
- [ ] Ein neues, reines Klassifikationsmerkmal erkennt eine Selection anhand
      der drei genannten Bedingungen (Typ `upgrade`, profil-/kostenloser
      Teilbaum, Top-Level-Force-Selection) als Listenkonfiguration.
- [ ] Das Merkmal ist gegen echte Fixture-Daten verifiziert: erkennt „Allow
      experimental rules?" und „Allow special characters?" (WHFB6 Definitive
      Edition) korrekt, und liefert für eine echte Einheiten-Selection sowie
      für eine reguläre Ausrüstungs-Option innerhalb einer Einheit `false`.
- [ ] In einer Spieleansicht mit einer Roster-Selection, die als
      Listenkonfiguration erkannt wird, erscheint dafür keine Einheitenkarte
      mehr — weder in ihrer eigentlichen Kategorie-Gruppe noch anderswo in der
      Spieleansicht.
- [ ] Echte Einheiten derselben Roster-Liste (inklusive solcher mit
      `type="upgrade"`-Ausrüstungsoptionen) erscheinen unverändert wie zuvor.
- [ ] Ein Roster der Ergofarg-Datenquelle (die keine Listenkonfigurationen
      kennt) zeigt in der Spieleansicht keinerlei Verhaltensänderung.

## Comments
- Neues datengetriebenes Merkmal isListConfiguration (src/solver/listConfiguration.js): erkennt roster-weite Upgrade-Schalter mit profil-/kostenlosem Teilbaum als Top-Level-Force-Selection. PlayMode filtert sie aus allen Gruppen. Verankert an echten Definitive-Edition-Schaltern (neue Fixture) und Ergofarg-Gegenbeispielen.

Status: ready-for-agent
Type: refactor
Blocked by: [01]

## Description

Eine Katalog-Regel, die die eingestellte Punktgrenze der Armee liest — in den
BattleScribe-Daten das Feld `limit::<costTypeId>` mit Bezugsrahmen `roster` —
erhält als Wert die **eingestellte Grenze** dieser Kostenart, nicht die verplante
Summe. Damit werten budget-gesteuerte Bedingungen und Modifikatoren korrekt: die
Sichtbarkeit einer Auswahl, ihre Mindest- und Höchstzahlen und ihre
Verfügbarkeit ändern sich mit der gewählten Punktzahl, genau wie es die
Katalogdaten hinterlegen.

Belegte Beispiele aus den Definitive-Edition-Daten: die Kategorie „Lord" ist
unter einer bestimmten Punktzahl ausgeblendet und ihre erlaubte Zahl steigt je
Punkte-Stufe; „Core" und „Special" skalieren analog; einzelne Sonderheere werden
erst ab einem Mindestbudget wählbar.

Nennt eine Regel eine Kostengrenze, die im Datensatz bzw. in den übergebenen
Grenzen nicht deklariert ist, entsteht eine Diagnose statt eines still
angenommenen Werts von 0 — dieselbe Auflösungslogik, sichtbarer Fehlerfall.

Hintergrund: Bisher behandelt die Engine `limit::<costTypeId>` wie eine
gewöhnliche Kostenart und schlägt deren verplante Summe nach, die es nie gibt;
die Bedingung wertet dadurch still zu 0 (z. B. bleibt der Lord bei jeder
Punktzahl ausgeblendet).

## Acceptance Criteria
- [ ] Auf echten Definitive-Edition-Katalogdaten ändert die gewählte Punktzahl
      (z. B. 1000 vs. 2000 vs. 3000) die Sichtbarkeit und die erlaubten Mindest-/
      Höchstzahlen budget-gesteuerter Auswahlen so, wie es die Katalogdaten
      vorgeben.
- [ ] Ein Sonderheer mit Mindestbudget ist unterhalb seines Budgets nicht
      wählbar und ab seinem Budget wählbar.
- [ ] Eine Regel, die eine nicht deklarierte Kostengrenze nennt, erzeugt eine
      Diagnose statt still den Wert 0 anzunehmen.

## Comments

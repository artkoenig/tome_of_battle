Status: ready-for-agent
Type: fix
Blocked by: None

## Description

Befund W2. Beim Auswerten der Modifier auf einen Beschränkungswert werden
zunächst alle setzenden Modifier nach vorn sortiert und erst danach die
rechnenden angewandt.

BattleScribe wertet Modifier in Dokumentreihenfolge aus — in der Reihenfolge,
in der sie im Katalog stehen. Schreibt ein Katalog bewusst erst „erhöhen um 2"
und danach „setze auf 5", ist 5 gemeint; die Vorsortierung liefert 7.

Auffällig ist, dass die Namensauswertung im selben Modul bereits korrekt in
Dokumentreihenfolge arbeitet. Dieselbe Frage wird also an zwei Stellen
unterschiedlich beantwortet — ein Verstoß gegen die einzige Quelle der Wahrheit.

Sollte sich die Vorsortierung als Rettung für einen konkreten Katalogfall
erweisen, gehört dieser Fall als begründete Ausnahme in ADR 0003 statt
kommentarlos in den Code.

## Acceptance Criteria
- [ ] Modifier auf Beschränkungswerte werden in Dokumentreihenfolge angewandt; die Sonderbehandlung setzender Modifier entfällt
- [ ] Die Auswertung von Beschränkungswerten und die Namensauswertung folgen derselben Reihenfolgeregel
- [ ] Ein Test belegt die Abfolge „erhöhen, dann setzen" und schlägt gegen den alten Stand fehl
- [ ] Die bestehende Testsuite bleibt grün; kippt ein Test, ist der zugrunde liegende Katalogfall benannt und in ADR 0003 festgehalten

## Comments

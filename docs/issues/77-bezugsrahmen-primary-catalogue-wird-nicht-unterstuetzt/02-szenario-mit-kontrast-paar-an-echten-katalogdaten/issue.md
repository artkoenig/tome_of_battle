Status: ready-for-agent
Type: fix
Blocked by: [01]

## Description

Ein Testfall, der festhaelt, dass eine Regel mit dem Bezugsrahmen "primaerer
Katalog" ueberhaupt wirkt — und zwar in **beide** Richtungen.

**Warum ein einzelnes Roster hier nichts belegt.** Die Regel, um die es geht,
sagt sinngemaess "gilt nur, wenn dies **nicht** die Armee X ist". Sie wirkt
heute schon nicht — der Bezugsrahmen laesst sich nicht aufloesen, und ein nicht
aufloesbarer Rahmen wird derzeit still als "Bedingung erfuellt" gelesen. Ein
Roster, das zeigt "die Regel feuert nicht", beweist deshalb gar nichts: es
feuert vorher wie nachher nicht, aus verschiedenen Gruenden.

**Der Nachweis ist das Paar.** Dieselbe Auswahl aus der gemeinsamen
Soeldner-Bibliothek, einmal in einer Armee, die das Ausschlusskriterium erfuellt,
und einmal in einer, die es nicht erfuellt — mit **gegenlaeufigem** Ergebnis. Nur
so ist gezeigt, dass der Bezugsrahmen tatsaechlich gelesen wird und nicht bloss
zufaellig dasselbe herauskommt.

Zusaetzlich gehoert dazu, dass in **keinem** der beiden Faelle noch eine Diagnose
"Bezugsrahmen nicht aufloesbar" gemeldet wird.

**Zur Vorsicht bei den vorhandenen Rostern:** ein Teil der bestehenden
Test-Roster traegt heute keine oder falsche Katalog-Angaben je Kontingent — teils
einen Platzhalter, teils die Id einer Veroeffentlichung statt der eines Katalogs.
Die Roster dieses Szenarios muessen die echte Angabe tragen, sonst prueft das
Szenario ins Leere.

Dieses Szenario entsteht **vor** der Engine-Aenderung und wird bis dahin
erwartbar rot sein. Das ist gewollt.

## Acceptance Criteria
- [ ] Ein Szenario unter `docs/testing/` stellt dieselbe Auswahl in zwei verschiedenen Armeen gegenueber und erwartet gegenlaeufige Ergebnisse.
- [ ] In beiden Faellen wird keine Diagnose "Bezugsrahmen nicht aufloesbar" mehr erwartet.
- [ ] Die Roster tragen je Kontingent die echte Katalog-Angabe.
- [ ] Alle Erwartungen sind allein aus den Katalogdaten hergeleitet, nicht aus dem Verhalten der Engine abgelesen.
- [ ] Das Szenario ist ueber das vorhandene Manifest-Format ausfuehrbar und im Testkatalog eingetragen.

## Comments
- Wird vom Black-Box-Autor verfasst (ADR-0033), allein aus den .cat/.gst-Daten und der in Scheibe 01 festgeschriebenen Bedeutung — ohne Blick in src/evaluator/.
- Die Reihenfolge weicht bewusst vom Architektur-Plan ab, der das Szenario NACH der Engine-Aenderung vorsah. Grund: in dieser Sitzung war ein Szenario, das nach der Aenderung entstand, bereits vor ihr gruen und belegte den Fix damit nicht. Ein vor der Aenderung geschriebenes Szenario treibt sie stattdessen.

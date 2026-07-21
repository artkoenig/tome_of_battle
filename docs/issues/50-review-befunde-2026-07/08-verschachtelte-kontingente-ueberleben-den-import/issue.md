Status: ready-for-agent
Type: fix
Blocked by: [01]

## Description

Befund W1. Der `.ros`-Import liest ausschließlich Kontingente, die direkt unter
dem Wurzel-Element hängen. Das Schema erlaubt jedoch Kontingente innerhalb
eines Kontingents — Unter-Kontingente. Diese werden samt allen darin
enthaltenen Auswahlen kommentarlos verworfen: der Nutzer importiert eine Liste
und ein Teil davon fehlt, ohne Hinweis.

Das widerspricht ADR 0011, der die Serialisierung ausdrücklich als verlustfreien
Adapter beschreibt.

Verschärfend kommt hinzu: zwei Solver-Kommentare begründen ihre Auswertung der
Kind-Kontingent-Option damit, Kind-Kontingente seien als Geschwister auf
Roster-Ebene flachgelegt. Das trifft nicht zu — sie existieren im Modell
überhaupt nicht. Der Code rechnet damit gegen eine Zusage, die nirgends
eingelöst wird.

Vorzugsweise werden Unter-Kontingente rekursiv eingelesen und flachgelegt; dann
stimmen die Kommentare und ADR 0011 wieder. Ist das nicht umsetzbar, muss der
Verlust dem Nutzer zumindest gemeldet und die beiden Kommentare sowie ADR 0011
korrigiert werden.

## Acceptance Criteria
- [ ] Eine importierte Liste mit Unter-Kontingenten verliert keine Auswahlen mehr
- [ ] Die Auswertung der Kind-Kontingent-Option arbeitet auf einem Modell, das dem entspricht, was ihre Kommentare beschreiben
- [ ] Ein Test importiert eine Liste mit verschachtelten Kontingenten und belegt die Vollständigkeit; er schlägt gegen den alten Stand fehl
- [ ] Der Rundlauf Import → Export bleibt für flache Listen unverändert
- [ ] ADR 0011 beschreibt den erreichten Stand zutreffend
- [ ] Wird der Verlust stattdessen nur gemeldet: der Nutzer sieht einen Hinweis, und die beiden irreführenden Kommentare sind korrigiert

## Comments

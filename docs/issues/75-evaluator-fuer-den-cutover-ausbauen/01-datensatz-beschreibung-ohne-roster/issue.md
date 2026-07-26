Status: resolved
Type: refactor
Blocked by: None

## Description

Die Anwendung braucht Angaben aus dem Regelsatz, fuer die es kein Roster und
damit keinen Slot gibt: welche Kostenarten es mit welchem Klartext-Namen gibt,
welche Kataloge spielbar und welche reine Bibliotheken sind, und welche
Kontingente sich anlegen lassen. Heute liefert der Bericht davon nichts.

Nach ADR-0034 gehoert das in die Engine: es sind schlichte Katalog-Angaben,
keine Anzeige-Entscheidungen. Der Slice schaelt dabei den Vorbereitungsschritt
des Datensatzes als benannten Schritt heraus — Slice 02 misst genau ihn.

## Acceptance Criteria
- [ ] Aus einem Datensatz laesst sich **ohne** Roster ermitteln, welche Kostenarten er kennt und wie sie im Katalog heissen.
- [ ] Aus einem Datensatz laesst sich ermitteln, welche Kataloge spielbar sind und welche reine Bibliotheken — abgeleitet aus den Katalogdaten, nicht aus einer Namensliste.
- [ ] Aus einem Datensatz laesst sich ermitteln, welche Kontingente anlegbar sind.
- [ ] Die Beschreibung meldet dieselben Diagnosen sichtbar, die auch eine Auswertung melden wuerde (fehlende Abhaengigkeit, nicht passendes Spielsystem) — nichts wird still verschluckt.
- [ ] Die Auswertung selbst verhaelt sich unveraendert; die bestehende E2E-Suite bleibt gruen.

## Comments

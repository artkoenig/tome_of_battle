# E2E-Regeln & Testkatalog: Rauchtest an den vollen Definitive-Daten

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Belegt die
**katalogeübergreifende Auflösungs-Fähigkeit** der Reinraum-Engine an genau den
Daten, die ein Nutzer beim Import erlebt — **nicht** die Regel-Semantik einzelner
Armeen (die decken die Domänen-Szenarien Ogre/O&G/VC ab). Alle Erwartungen sind
**aus den Katalogdaten abgeleitet**, nicht aus einem Engine-Lauf.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (id `0d13-7737-ea86-4662`, rev 1)
- Armee-Katalog: `Ogre Kingdoms (6th definitive edition).cat` (id `731d-5b13-2a92-5427`, `library="false"`)
- Bibliotheks-Abhängigkeit: `Mercenaries (6th definitive edition).cat`
  (id `fc47-8392-a6c8-452a`, `library="true"`)

Manifest-getriebene Neufassung der programmatischen Smoke-Suite. Ausgewertet wird
eine **leere Armee** (keine Kontingente) — der Roster ohne `<force>`-Inhalt.

## Warum eine leere Armee genügt

Die hier gepinnten Punkte sind **strukturelle Eigenschaften der Quelle** (der
geladene Kombinationssatz `.gst` + `.cat`s), nicht Folgen einzelner
Roster-Selektionen: ob eine deklarierte Abhängigkeit fehlt und ob ein
katalogeübergreifender `entryLink` sein Ziel findet, entscheidet sich beim
**Laden/Auflösen** der Kataloge, unabhängig davon, was der Roster wählt. Genau
deshalb reicht die minimalste denkbare Eingabe — die leere Armee — und dieselbe
Datei wird **zweimal** gegen unterschiedliche Datensätze ausgewertet (mit und
ohne Mercenaries, per Roster-`dataset`-Override).

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **RCS-R1** | Auch ohne Kontingente liefert `evaluate` einen strukturell vollständigen Bericht (Verletzungen + Diagnosen), **ohne** zu stürzen. | Roster `01-empty-army.ros` mit leerem `<forces>`; der Runner filtert `report.violations`/`report.diagnostics` — ein unvollständiger Bericht ließe ihn werfen. |
| **RCS-R2** | Bei **vollständiger** Quelle löst jede per `catalogueLink` importierte Definition auf: **keine** `DANGLING_*`-Diagnose, **keine** `MISSING_CATALOGUE_DEPENDENCY`. | Ogre `catalogueLink id="a067-78d5-50a2-affe" targetId="fc47-8392-a6c8-452a"` (Ogre `.cat` Z. 3087) auf den geladenen Mercenaries-Katalog `fc47-8392-a6c8-452a`. |
| **RCS-R3** | Die Dogs-of-War-Einheit **„Pikemen"** ist **ausschließlich** über die Mercenaries-`.cat` erreichbar: der Ogre-`entryLink` baumelt **ohne** Mercenaries und löst **mit** ihr auf. | Ogre `entryLink id="d0b9-e033-6253-8bbf" type="selectionEntry" targetId="f7d8-66b4-21ee-00dd"` (Ogre `.cat` Z. 3333) → Ziel `selectionEntry id="f7d8-66b4-21ee-00dd" name="Pikemen"` ist **nur** in Mercenaries `.cat` (Z. 8260) definiert; in Ogre existiert keine Definition dieser Id. |
| **RCS-R4** | Fehlt die per `catalogueLink` deklarierte Mercenaries-`.cat`, ist das eine **Diagnose** (`MISSING_CATALOGUE_DEPENDENCY` auf `fc47-8392-a6c8-452a`), **kein** Absturz; der Bericht bleibt strukturell vollständig. | Derselbe `catalogueLink` wie RCS-R2; der Zielkatalog `fc47-8392-a6c8-452a` ist im Override-Datensatz nicht enthalten. |

**Konvention (aus dem Pilot-README, nicht aus Engine-Code):** Der Bericht kodiert
**zählende Constraints** und **strukturelle Diagnosen** (fehlende Abhängigkeit,
unaufgelöste/baumelnde Verweise) — **nicht** `hidden`/Sichtbarkeit oder
Profilwerte. Dieses Szenario prüft ausschließlich strukturelle Diagnosen; es
erwartet **keine** feuernde Grenze (`firing`/`absent` sind leer).

**Diagnose-Arten** (Schlüssel der SSOT-Aufzählung `DiagnosticKind`, aus dem
Runner-Kopf `e2e.testcatalog.test.js` übernommen, nicht aus dem Engine-Quellcode
abgeleitet): `MISSING_CATALOGUE_DEPENDENCY`, `DANGLING_ENTRY_LINK`,
`DANGLING_INFO_LINK`.

**Hinweis zu `DANGLING_INFO_LINK`:** Die `infoLink`-Verweise auf Pikemen-Profile
(z. B. `targetId="99bb-98f4-cd6d-7689"`) liegen **innerhalb** der Mercenaries-`.cat`
selbst. Fehlt Mercenaries, wird auch der sie enthaltende Teil nicht geladen — sie
können daher gar nicht baumeln. Der **einzige** katalogeübergreifende Verweis von
Ogre nach Mercenaries ist der Pikemen-`entryLink` `d0b9-e033-6253-8bbf`. Deshalb
tritt ohne Mercenaries **nur** `DANGLING_ENTRY_LINK` (auf `f7d8-…`) neben
`MISSING_CATALOGUE_DEPENDENCY` auf, **kein** `DANGLING_INFO_LINK`.

---

## Testkatalog (E2E-Szenarien)

> **Assertion-Fokus:** nur die genannten Diagnose-Arten/-Ids. Das Manifest
> [`scenario.json`](scenario.json) ist die Quelle der Wahrheit. Dieselbe leere
> Armee `01-empty-army.ros` wird **zweimal** ausgewertet — einmal mit
> vollständiger Quelle, einmal (per Roster-`dataset`-Override) **ohne**
> Mercenaries.

| # | Roster-Zustand | Datensatz | Erwartetes Ergebnis (aus Katalogdaten abgeleitet) | Fixture |
|---|----------------|-----------|---------------------------------------------------|---------|
| 01 | Leere Armee (keine Kontingente) | gst + Ogre + Mercenaries | Strukturell vollständiger Bericht, kein Absturz; alle Verweise lösen auf (RCS-R1/R2/R3): **absent** `MISSING_CATALOGUE_DEPENDENCY`, `DANGLING_ENTRY_LINK`, `DANGLING_INFO_LINK`. | [`01-empty-army.ros`](rosters/01-empty-army.ros) |
| 02 | Dieselbe leere Armee | gst + Ogre *(ohne Mercenaries)* | **present** `MISSING_CATALOGUE_DEPENDENCY` auf `fc47-8392-a6c8-452a` (RCS-R4) **und** `DANGLING_ENTRY_LINK` auf die Pikemen-Ziel-Id `f7d8-66b4-21ee-00dd` (RCS-R3) — Hinweis, kein Absturz. | [`01-empty-army.ros`](rosters/01-empty-army.ros) |

**Kontrast (RCS-R3):** Fall 01 fordert die **Abwesenheit** von
`DANGLING_ENTRY_LINK`, Fall 02 dessen **Anwesenheit** auf genau `f7d8-…` — beides
mit derselben Roster-Datei, allein der Datensatz wechselt. Das pinnt exakt die
katalogeübergreifende Auflösung fest.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem (Definitive Edition) | `0d13-7737-ea86-4662` |
| Ogre-Kingdoms-Katalog (`library="false"`) | `731d-5b13-2a92-5427` |
| Mercenaries-Katalog (Abhängigkeit, `library="true"`) | `fc47-8392-a6c8-452a` |
| Ogre-`catalogueLink` → Mercenaries | `a067-78d5-50a2-affe` (targetId `fc47-8392-a6c8-452a`) |
| Ogre-`entryLink` „Pikemen" (baumelt ohne Mercenaries) | `d0b9-e033-6253-8bbf` (targetId `f7d8-66b4-21ee-00dd`) |
| „Pikemen"-Einheit (nur in Mercenaries definiert) | `f7d8-66b4-21ee-00dd` |

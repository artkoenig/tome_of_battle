# E2E-Regeln & Testkatalog: Explorer Nested Constraints (Orcs and Goblins)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den
Katalogdaten der *6th Definitive Edition* abgeleitet; das Eingabeformat der
Roster ist an bestehenden E2E-Szenarien verifiziert.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (id `0d13-7737-ea86-4662`, rev 1)
- Armee: `Orcs and goblins (6th definitive edition).cat`
  (id `4049-c46d-7f80-44fb`, rev 1) — Force **„Standard (OG-AB)"** `2bfa-e64a-7123-895f`

---

## Verschachtelte Magische-Gegenstände-Struktur

In den Katalogen der 6. Edition werden magische Gegenstände über verschachtelte Gruppen und Links modelliert:

```
selectionEntry "Savage Orc Warboss" (ca27-a5f4-4a3e-7aeb)
  └ selectionEntryGroup "Magic Items" (5a4a-5944-51b3-2334)  max 100 pts (scope=parent) [e008-75cc-80f3-59a7]
       └ entryLink "Magic Weapons" (d458-68af-f8d1-fd84) → target selectionEntryGroup (6d5f-aed3-1c41-d305)
            ├ entryLink "Battleaxe of the last Waaagh" (cc2d-39ed-a9f3-31d3) → target (ad25-b6b2-7eb8-4181) [75 pts]
            └ entryLink "Basha's Big Axe of Bashin'" (deaf-7f7e-b244-8190) → target (cb89-b525-88ef-79d3) [50 pts]
```

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **ENC-R1** | Ein **Savage Orc Warboss** (`ca27-a5f4-4a3e-7aeb`) darf magische Gegenstände im Wert von **maximal 100 Punkten** erhalten. | `.cat` `selectionEntry` „Savage Orc Warboss" `ca27…` → `selectionEntryGroup` „Magic Items" **`5a4a-5944-51b3-2334`** → constraint **`e008-75cc-80f3-59a7`** `type=max value=100 field=ecfa-8486-4f6c-c249 (pts) scope=parent`. |
| **ENC-R2** | Wird der Savage Orc Warboss mit magischen Waffen für insgesamt **125 Punkte** ausgestattet (Battleaxe of the last Waaagh 75 pts + Basha's Big Axe of Bashin' 50 pts), überschreitet die Summe das Gruppenlimit von 100 pts. | Ausrüstung im Roster: Battleaxe (`ad25-b6b2-7eb8-4181`, 75 pts) + Basha's Big Axe (`cb89-b525-88ef-79d3`, 50 pts) = 125 pts total cost. Constraint `e008-75cc-80f3-59a7` feuert mit `actual=125` und `bound=100`. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Referenziert `.gst` + O&G-`.cat`.

> **Assertion-Fokus:** Nur die genannte Punkte-Limit-Constraint-ID `e008-75cc-80f3-59a7`. Andere Armeeaufbau-Diagnosen (General/Core-Pflicht, Punktekosten der Armee) können zusätzlich auftreten und bleiben ohne Belang.

| # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|---------------------------|----------------|------------------------------------|---------|
| 01 | Magische Gegenstände über Limit (unzulässig) | `.gst` + O&G-`.cat` | Valid Force `2bfa-e64a-7123-895f` mit Savage Orc Warboss `ca27-a5f4-4a3e-7aeb`, ausgerüstet mit Battleaxe of the last Waaagh (75 pts) + Basha's Big Axe of Bashin' (50 pts). | **Verletzung von ENC-R1/R2:** Constraint `e008-75cc-80f3-59a7` feuert mit `actual=125` und `bound=100`. | [`01-magic-items-over-limit-illegal.ros`](rosters/01-magic-items-over-limit-illegal.ros) |

---

## Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem (gst) | `0d13-7737-ea86-4662` |
| Orcs and Goblins Katalog (cat) | `4049-c46d-7f80-44fb` |
| Force „Standard (OG-AB)" | `2bfa-e64a-7123-895f` |
| `selectionEntry` Savage Orc Warboss | `ca27-a5f4-4a3e-7aeb` |
| `selectionEntryGroup` Magic Items | `5a4a-5944-51b3-2334` |
| Constraint 100 pts max (scope=parent, field=pts) | `e008-75cc-80f3-59a7` |
| `entryLink` Magic Weapons | `d458-68af-f8d1-fd84` (target: `6d5f-aed3-1c41-d305`) |
| `entryLink` / target Battleaxe of the last Waaagh (75 pts) | `cc2d-39ed-a9f3-31d3` / `ad25-b6b2-7eb8-4181` |
| `entryLink` / target Basha's Big Axe of Bashin' (50 pts) | `deaf-7f7e-b244-8190` / `cb89-b525-88ef-79d3` |

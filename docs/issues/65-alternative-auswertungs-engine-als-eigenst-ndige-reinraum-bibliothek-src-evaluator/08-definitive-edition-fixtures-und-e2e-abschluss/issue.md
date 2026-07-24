Status: ready-for-agent
Type: chore
Blocked by: [05, 07]

## Description

Stellt die **eigenen minimalen** `.cat`/`.gst`-Fixtures der Engine bereit,
modelliert an realen WHFB6-/Definitive-Edition-Fällen (inkl. der
Ogerbullen-Pflichteinheit), unabhängig von den Fixtures der bestehenden Engine.
Bündelt End-to-End-`evaluate()`-Tests über die realen Domänenfälle; optional ein
Smoke-Test über einen realen WHFB6-Katalog.

## Acceptance Criteria
- [ ] Die Engine hat eigene minimale `.cat`/`.gst`-Fixtures, modelliert an realen
      Definitive-Edition-/WHFB6-Fällen, nicht aus der bestehenden Engine übernommen.
- [ ] End-to-End-`evaluate()`-Tests decken die realistischen Fälle ab, inklusive
      einer armeeweiten Pflichteinheit (Ogerbullen), die bei Fehlen angeschlagen und
      bei Vorhandensein erfüllt ist.
- [ ] Die vollständige Suite (beide Nahtstellen) läuft grün.

## Comments

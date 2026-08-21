---
status: done
branch: claude/issue-160-lp1a7m
pr: 250
---

# Angebots-Anker-Erwartung auf Toxote's Hellmounts umstellen

## Goal
Die beiden Vampirfürsten-Szenarien nageln den Angebots-Anker wieder fest — an
einer Einheit, die das Vampirfürsten-Buch selbst verlinkt.

## Acceptance criteria
- AC1 `docs/testing/violation-classification`, Fall `rosters/07-phantom-and-offer.ros` pinnt wieder einen Angebots-Anker im Kontingent "Clan Blood Dragons (VC-AB)", jetzt auf `1a52-2060-f39b-38ee` ("Toxote's Hellmounts"). Der Anker trägt seine Autor-Meldung im Fähigkeitsdatensatz und steuert **nichts** zur Meldungsliste bei — das ist die Aussage, die der Fall festhält. | verify: forge-test --run src/evaluator
- AC2 `docs/testing/offer-and-category-slots`, Fall `rosters/01-blood-dragon-bretonnia-hidden-categories.ros` pinnt wieder den Fähigkeitsdatensatz desselben Angebots-Ankers. | verify: forge-test --run src/evaluator
- AC3 Jeder Soll-Wert beider Erwartungen — Meldungstext und -schwere, `current`, `effectiveMin`, `effectiveMax`, `headroom`, `isMandatoryUnmet` — ist aus den Katalogdaten abgeleitet, nicht aus einem Lauf abgeschrieben. Die Herleitung steht im README des jeweiligen Szenarios.
- AC4 Die `.ros`-Roster beider Szenarien bleiben unverändert, ebenso jede übrige gepinnte Aussage beider Szenarien.
- AC5 Beide READMEs erklären, warum Manbiters hier nicht mehr steht: kein Vampirfürsten-Katalog deklariert einen Wurzel-`entryLink` darauf, Toxote's Hellmounts dagegen schon.
- AC6 Alle Checks grün. | verify: forge-test && forge-lint && forge-typecheck && forge-build

## Out of scope
- Der Evaluator selbst: keine Verhaltensänderung, nur Erwartungen.
- Die Katalogdaten: kein `.cat` oder `.gst` wird geändert.

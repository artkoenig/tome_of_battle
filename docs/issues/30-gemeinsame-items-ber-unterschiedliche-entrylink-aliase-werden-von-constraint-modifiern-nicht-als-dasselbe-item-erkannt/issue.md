Status: resolved
Type: fix
Blocked by: None

## Description
Anschlussfund an Issue 29 (mehrere Bannrollen): Beim Ogre-Kingdoms-Fleischer
("Butcher") bleibt der Validierungsfehler bei mehreren Bannrollen auch nach
dessen Fix bestehen — mit einer anderen, eigenständigen Ursache.

Reproduziert mit den echten Ogre-Kingdoms-"Definitive Edition"-Katalogdaten:
Der Fleischer wählt seine Bannrolle über die Gruppe "Arcane Items" (armee-
eigener `entryLink`, id `1954-4ffd-5be0-eac7`). Diese Gruppe liegt selbst
innerhalb der Gruppe "Arcane Items (OK-AB + Common)" (Basis-Limit max=1), die
zusätzlich die gemeinsame Gruppe "Arcane Items (Common)" umfasst. Die äußere
Gruppe hat eigene Erhöhungs-Modifier, die ihr Limit für wiederholt genommene
Items anheben — referenzieren die Bannrolle dabei aber über deren
`entryLink`-Alias aus der **gemeinsamen** Katalogdatei (id `989e-9d22-…`),
nicht über den **armee-eigenen** Alias, den der Fleischer tatsächlich wählt.
Beide Aliase zeigen auf dasselbe zugrundeliegende Item (`targetId`
`b76c-6bad-4650-dbb0`), werden aber vom Abgleich in
`getModifiedConstraintValue`/`evaluateCondition` (`src/solver/modifierEvaluator.js`)
nicht als dasselbe Item erkannt: die Zähllogik löst die gewählte Auswahl nur
eine Ebene tief auf (`resolveEntry` einmal) und vergleicht deren `id`/`targetId`
direkt gegen den rohen `childId` des Modifiers — ohne auch den `childId` selbst
bis zu seinem letztlichen Ziel aufzulösen. Zwei entryLinks, die auf dasselbe
Ziel zeigen, aber selbst unterschiedliche IDs tragen, gelten deshalb als
verschiedene Items.

Das ist ein generisches Muster in Battlescribe-Daten (ein gemeinsames Item,
einmal in der Regelwerksdatei definiert, aber über mehrere armee-spezifische
`entryLinks` referenziert) und vermutlich nicht auf Bannrollen oder Ogre
Kingdoms beschränkt.

Reproduktion (mit dem bereits gemergten Fix aus Issue 29):
- Fleischer + 1 Bannrolle → keine Fehlermeldung
- Fleischer + 2 oder 3 Bannrollen → `group-count-max`: "Kategorie 'Arcane
  Items (OK-AB + Common)' erlaubt maximal 1 Auswahlen"

## Acceptance Criteria
- [ ] Ein Ogre-Kingdoms-Fleischer kann mehrere Bannrollen wählen, ohne dass
      der Roster-Validator einen Gruppen-Limit-Fehler auf "Arcane Items
      (OK-AB + Common)" meldet.
- [ ] Der Item-Abgleich in `evaluateCondition`/`getModifiedConstraintValue`
      erkennt zwei unterschiedliche `entryLink`s, die auf dasselbe
      `targetId` (bzw. transitiv auf dieselbe letztliche Auswahl) zeigen, als
      dasselbe Item — nicht nur, wenn eine Seite direkt der `childId`
      entspricht.
- [ ] Der bereits behobene Empire-Fall (Issue 29, Test 21/21b/21d) bleibt
      unverändert grün.
- [ ] Ein neuer, automatisierter Test deckt den Alias-Fall ab (zwei
      verschiedene entryLinks auf dasselbe Ziel-Item, Modifier referenziert
      nur einen der beiden Aliase).
- [ ] Die volle Testsuite (`npm test`) bleibt grün.

## Comments
- Fix umgesetzt: neuer Helper resolveCanonicalTargetId in src/solver/modifierEvaluator.js, eingesetzt in evaluateCondition und getModifiedConstraintValue. Mit echten Ogre-Kingdoms-Katalogdaten (Fleischer + 2 Bannrollen) reproduziert und verifiziert. Neuer Regressionstest 21e (vor Fix rot, danach grün). Volle Testsuite (660 Tests) grün, keine neuen Lint-Funde. Empire-Fall (Issue 29) bleibt unverändert grün.

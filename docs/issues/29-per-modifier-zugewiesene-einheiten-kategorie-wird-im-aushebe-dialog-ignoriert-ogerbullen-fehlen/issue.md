Status: resolved
Type: fix
Blocked by: None

## Description
**Symptom (Nutzersicht):** In der „Definitive Edition" fehlen bei den Ogern die
Ogerbullen in der Auswahl. Betroffen sind alle Kern-Einheiten des Oger-Heeres,
die aus dem verlinkten *Mercenaries*-Bibliothekskatalog stammen (Ogre Bulls,
Leadbelchers, Maneaters, Ironguts, Rhinox Riders u. a.). Der Fehler tritt auch
dann auf, wenn *Mercenaries* bereits mitimportiert ist — es liegt also **nicht**
an einem fehlenden Katalog.

**Verifizierte Ursache:** Der Aushebe-Dialog bestimmt die Kategoriezugehörigkeit
einer Einheit **rein statisch** aus deren `categoryLinks` (primäres
`categoryLink`) und **ignoriert die BattleScribe-`field="category"`-Modifier**
(`set-primary` / `add` / `remove`), die eine Einheit im konkreten Heer dynamisch
umkategorisieren.

Konkret am Beispiel der Ogerbullen: Das Ziel-`selectionEntry` (im
*Mercenaries*-Katalog) trägt statisch die Primärkategorie **„Regiment of
Renown"**. Der `entryLink` im Ogre-Kingdoms-Katalog verschiebt es per Modifier
(`set-primary` → **„Core"**, `remove` Rare/Regiment of Renown) ins Kern-Kontingent.
Das Oger-Heer führt aber die Kategorie „Regiment of Renown" gar nicht, sondern
„Core". Da die statische Prüfung die effektive Kategorie „Core" nicht erkennt,
erscheint die Einheit unter **keiner** Kategorie und verschwindet aus der Auswahl.

**Erwartetes Verhalten:** Einheiten, deren Heereskategorie per Modifier zugewiesen
wird, erscheinen im jeweils korrekten Kategorie-Aushebe-Dialog (Ogerbullen unter
„Core"). Die Kategoriezugehörigkeit muss anhand der **effektiven** Kategorie
(nach Auswertung der `field="category"`-Modifier im aktuellen Force-/Roster-
Kontext) bestimmt werden, nicht anhand der statischen `categoryLinks`.

**Berührte Domänenregel:** ADR 0003 (BattleScribe Domain Rules). Die
Modifier-Auswertungs-Maschinerie existiert bereits im Solver
(`getEffectiveModifiers`, `modifierEvaluator.js`, `entryVisibility.js`); die
UI-seitige Kategorieprüfung nutzt sie bislang nur nicht.

**Bekannte Fundstellen derselben statischen Annahme** (mit zu berücksichtigen,
nicht als Pfad-Vorgabe, sondern als Verhaltensbereich): der Kategorie-Aushebe-
Dialog, die „hat dieses Heer überhaupt aushebbare Einheiten?"-Prüfung im
Roster-Editor sowie die Armee-weiten Selektoren.

## Acceptance Criteria
- [x] Eine Einheit, deren primäre Kategorie im aktuellen Kontingent per
      `set-primary` (`field="category"`) auf eine andere Kategorie gesetzt wird,
      erscheint im Aushebe-Dialog dieser **effektiven** Kategorie und nicht mehr
      unter (oder verborgen wegen) ihrer statischen Kategorie.
- [x] Reproduktions-Regressionstest mit realdatennahem Fixture (Oger + per
      Modifier auf „Core" gesetzte Einheit): Ohne Fix erscheint die Einheit nicht
      unter „Core", mit Fix erscheint sie dort.
- [x] `add`/`remove` auf `field="category"` werden ebenfalls berücksichtigt
      (eine per `add` hinzugefügte Kategorie macht die Einheit dort aushebbar;
      eine per `remove` entfernte Kategorie blendet sie dort aus), inklusive der
      an die Modifier gebundenen `conditions` (kontextabhängig, z. B. je Force).
- [x] Die effektive Kategorie wird an einer Stelle im Solver zentral bestimmt und
      von allen bisher statisch prüfenden Stellen (Aushebe-Dialog, Roster-Editor-
      Verfügbarkeitsprüfung, Armee-weite Selektoren) konsistent genutzt.
- [x] Keine Regression: Einheiten mit ausschließlich statischer Kategorie
      erscheinen weiterhin unverändert unter ihrer Kategorie; die bestehende
      Test-Suite bleibt grün.

## Comments
- Ursache: Der Aushebe-Dialog (CategoryUnitAdder), die Sektions-Verfuegbarkeitspruefung (RosterEditor.hasPrimaryCatalogItems) und die armeeweite-Selektoren-Erreichbarkeit (armyWideSelectors.isReachableViaForceCategories) bestimmten die Kategorie rein statisch aus categoryLinks und ignorierten die field=category-Modifier. In der Definitive Edition sind die Oger-Kerneinheiten im Mercenaries-Bibliothekskatalog definiert (primaer 'Regiment of Renown') und werden per set-primary-Modifier ins Oger-'Core' umgegliedert; da die statische Pruefung das ignorierte, verschwanden Ogerbullen u.a. aus jeder Sektion. Fix: zentrale Solver-Helfer getEffectiveEntryCategoryLinks/isEntryPrimaryInCategory (entryVisibility.js) werten die effektive Kategorie aus; alle drei Stellen nutzen sie. Verifiziert gegen echte Definitive-Edition-Daten (Ogre Bulls -> Core=true). Reviews: Standards/Spec/Tests/Docs gruen (658 Tests), Doku (ADR 0003 S4, ui-renderer-audit, data-format) nachgezogen. Kein Versions-Bump (Nutzerentscheidung).

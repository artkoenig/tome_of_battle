Status: resolved
Type: feature
Blocked by: None

## Description
Der neue Datensatz führt erstmals Library-Kataloge ein (`library="true"`, z. B. „Mercenaries"), auf die andere Kataloge per `catalogueLink` verweisen, um gemeinsam genutzte Einträge einzubinden. Die Import-Auswahl erlaubt, jeden Katalog einzeln abzuwählen — auch einen Library-Katalog, während ein von ihm abhängiger Katalog ausgewählt bleibt. Das kann zu einem still unvollständigen Import führen: Einträge, die auf den abgewählten Library-Katalog verweisen, lösen sich beim späteren Rostern nicht auf.

Diese Situation konnte mit dem alten Datensatz nicht auftreten, da er keine Library-Kataloge enthielt.

**Revidierter Ansatz (nach Rückmeldung aus der ersten Umsetzung):** `catalogueLinks` steht ausschließlich im vollen `.cat`-XML, das die Import-UI erst beim tatsächlichen Import lädt (`handleImportBundle`) — nicht schon beim Öffnen der Auswahl, wo nur `id`/`name`/`type`/`revision` aus `catpkg.json` bekannt sind. Eine Sperre schon beim Abwählen würde deshalb ein eifriges Vorab-Laden aller `.cat`-Dateien des Systems erfordern (bis zu 18 Fetches + volle XML-Parses allein beim Öffnen des Import-Bildschirms) — unverhältnismäßiger Mehraufwand für eine Offline-first-PWA. Die Prüfung verschiebt sich stattdessen auf den Import selbst: `handleImportBundle` hat die vollständigen `.cat`-Daten der ausgewählten Kataloge ohnehin bereits geladen, bevor `processImportedData` läuft.

**Operationale Definition von „Library-Katalog":** Das `library="true"`-Attribut lebt im `.cat`-XML des jeweiligen Katalogs. Für den **fehlenden** (= abgewählten) Katalog wird dieses XML aber bewusst nicht geladen (genau der Grund für den Import-Zeit-Ansatz). Das Flag des Ziels ist damit nicht verfügbar. Der Guard identifiziert eine fehlende Abhängigkeit deshalb operational: ein `catalogueLink`-Ziel eines ausgewählten Katalogs, das ein bekannter (auswählbarer), aber nicht ausgewählter Katalog ist. Da `catalogueLink` im Datensatz konventionell nur auf Library-Kataloge zeigt, deckt sich das mit „fehlender Library-Katalog"; die operationale Fassung ist zudem robuster (sie schützt auch, falls je ein Nicht-Library-Ziel referenziert würde), ohne einen Zusatz-Fetch nur zum Lesen des `library`-Flags zu erzwingen.

## Acceptance Criteria
- [ ] `handleImportBundle` prüft vor dem Speichern, ob ein ausgewählter Katalog per `catalogueLink` auf einen bekannten, aber **nicht** in der Auswahl enthaltenen Katalog verweist (operationale Library-Definition, siehe oben).
- [ ] Wird eine solche fehlende Abhängigkeit erkannt, wird der Import abgebrochen und dem Nutzer eine unmissverständliche Fehlermeldung angezeigt, die den fehlenden Library-Katalog benennt — kein stiller, unvollständiger Import.
- [ ] Wird der Library-Katalog mit ausgewählt, läuft der Import wie bisher durch (kein falsch-positiver Abbruch).
- [ ] Wird stattdessen nur der abhängige Katalog (z. B. „Dogs of War") ohne den Library-Katalog gewählt und **beide** würden importiert werden, ist das weiterhin die reguläre Standardauswahl (alle Kataloge sind default vorausgewählt) — die Prüfung greift nur bei tatsächlich manuell reduzierter Auswahl.
- [ ] Test in `Importer.test.jsx` (bzw. äquivalenter Testdatei für `handleImportBundle`) deckt: Import mit fehlendem, referenziertem Library-Katalog wird abgebrochen und meldet den fehlenden Katalog; Import mit vollständiger Auswahl läuft unverändert durch.

## Comments
- handleImportBundle prueft nach dem Parsen und vor dem Speichern per findMissingLibraryDependencies, ob ein ausgewaehlter Katalog via catalogueLink auf einen abgewaehlten (aber verfuegbaren) Bibliothekskatalog verweist; falls ja, wird der Import abgebrochen und der fehlende Katalog samt abhaengigem Katalog benannt. Tests in Importer.test.jsx decken Abbruch-mit-Benennung und vollstaendige-Auswahl-laeuft-durch ab, plus Unit-Tests der reinen Guard-Funktion.

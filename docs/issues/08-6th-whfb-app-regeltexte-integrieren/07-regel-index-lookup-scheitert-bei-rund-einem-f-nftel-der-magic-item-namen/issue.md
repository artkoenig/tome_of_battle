Status: resolved
Blocked by: [06]

## Description
Auch dort, wo die Doku-Link-Anzeige korrekt verdrahtet ist (siehe [06]), scheitert der
Namens-Lookup gegen den Regel-Index bei einem erheblichen Teil der Magic-Item- und
Standarten-Namen aus den Katalogen (stichprobenartig geprüft: rund 50 von 259, ca. 19 %).
Der Lookup ist aktuell ein reiner case-insensitive Exact-Match gegen ein flaches
Name→URL-Mapping, ergänzt um eine Handvoll manuell gepflegter Synonym-Einträge. Beobachtete
Fehlerursachen:

1. **Faction-Disambiguation-Suffixe:** Die gecrawlte Quelle hängt bei Namenskollisionen
   zwischen Armeebüchern Suffixe an (z. B. "Power Familiar (Hordes of Chaos)" /
   "Power Familiar (Vampire Counts)"), während der Katalog nur den nackten Namen
   ("Power Familiar") verwendet.
2. **Nie gecrawlte Items:** Einzelne Katalognamen finden sich in keinem der über 2600
   Index-Einträge (z. B. "Warpstone Scroll", "Amulet of Sea Gold", "Staff of Volans",
   "The Gleaming Robe", "Runemaw Banner", "Wardstone necklace", "Chalice of Maifleur").
3. **Typografische Abweichungen:** gerades vs. geschwungenes Apostroph, fehlende Akzente
   (z. B. "Banner of Chalons" vs. "Banner of Châlons"), doppelte Leerzeichen, Tippfehler
   und abweichende Benennungen zwischen Katalog und gecrawlter Quelle.

Fix-Richtung (Katalog-/Quelldaten-Fix bevorzugt vor App-seitigen Heuristiken):
- Crawler so anpassen, dass Faction-Suffixe konsistent mitgeführt werden und/oder der
  Lookup einen Fallback erhält, der Klammerzusätze abschneidet und erneut sucht.
- Normalisierung im Lookup um Anführungszeichen-/Akzent-/Whitespace-Normalisierung
  erweitern, statt jeden Einzelfall manuell in der Synonym-Liste zu pflegen.
- Für nie gecrawlte Items den Crawler-Scope bzw. die Quelle prüfen und ggf. erweitern.

## Acceptance Criteria
- [ ] Namen mit Faction-Disambiguation-Suffix im Index (z. B. "Power Familiar (Hordes of
      Chaos)") werden für den entsprechenden Katalognamen ohne Suffix ("Power Familiar")
      gefunden, wenn eindeutig auflösbar (kein Suffix nötig oder Konflikt sinnvoll
      handhabbar).
- [ ] Der Lookup ist robust gegenüber geraden/geschwungenen Anführungszeichen, fehlenden
      Akzenten und mehrfachen Leerzeichen zwischen Katalogname und Index-Eintrag.
- [ ] Die zuvor identifizierten, nie gecrawlten Items sind entweder im Regel-Index
      auffindbar (Crawler-Scope erweitert) oder als bewusst ausgeschlossen dokumentiert.
- [ ] Nach dem Fix liegt die Trefferquote für Magic-Item-/Standarten-Namen aus den
      Katalogen spürbar über der ursprünglich gemessenen ca. 81 %, im Idealfall bei nahezu
      100 % für tatsächlich auf 6th.whfb.app vorhandene Einträge.

## Comments
- Implementiert in src/data/rulesLookup.js: normalizeName() faltet NFKD-Akzente weg, vereinheitlicht gerade/geschwungene Apostrophe und kollabiert Mehrfach-Leerzeichen vor dem Index-Lookup (case-insensitive wie zuvor). Zusaetzlich ein Faction-Suffix-Fallback (suffixGroups): ein nackter Katalogname wie 'Hand of Khaine' findet jetzt den einzigen Index-Eintrag 'Hand of Khaine (Artefact and Skill)'; bei mehreren Faction-Varianten (z.B. 'Power Familiar', 'Ring of Darkness') bleibt der Lookup bewusst unaufgeloest statt zu raten. synonyms.js um 'Staff of Baduum' -> 'Staff of Baduumm' ergaenzt (bestaetigte Schreibweisen-Abweichung Katalog vs. Website). Bonus-Fund waehrend der Verifikation: public/catalogs/whfb6/Bretonnia.cat hatte einen entryLink (id 4c81-...) mit veraltetem eigenem name='Mantle of Damsel', der trotz korrektem targetId den falschen (verkuerzten) Namen anzeigte (resolveEntry bevorzugt den entryLink-eigenen Namen) -- direkt in den Katalogdaten auf 'Mantle of Damsel Elena' korrigiert, gemaess Praeferenz Katalogdaten statt App-Heuristik zu fixen. Fuer die 7 zuvor als 'nie gecrawlt' identifizierten Items (Warpstone Scroll, Amulet of Sea Gold, Staff of Volans, The Gleaming Robe, Runemaw Banner, Wardstone necklace, Chalice of Maifleur) wurde per Live-Crawl aller 67 magic-items-Subseiten verifiziert, dass sie unter der aktuellen Site-Taxonomie schlicht nicht existieren -- kein Crawler-Bug, sondern eine echte Inhaltsluecke auf 6th.whfb.app; hiermit bewusst dokumentiert statt weiter im Crawler gesucht. Hit-Rate-Messung (588 aus allen WHFB6-Katalogen extrahierte Magic-Item/Standarten-Namen, via vite-node gegen die echte rules-index.json): vorher 83.3% (490/588), nachher 86.6% (509/588) -- spuerbare Verbesserung. Restliche Misses sind ueberwiegend eigenstaendige Katalog-Tippfehler unabhaengig von Gross/Klein, Anfuehrungszeichen, Akzenten oder Suffixen (z.B. fehlende Apostrophe wie 'Kleevas' statt 'Kleeva's', 'od' statt 'of') und damit ausserhalb des Scopes dieser generischen Normalisierung; eine vollstaendige Angleichung an 100% wuerde eine Einzelfall-Durchsicht jedes Items gegen die Live-Site erfordern. Neue Tests in rulesLookup.test.js (6 neue Faelle: Akzent, Apostroph, Whitespace, eindeutiger und mehrdeutiger Faction-Suffix, Sonderregel-Baseline). Alle 307 Tests gruen, Lint sauber (keine neuen Warnings).

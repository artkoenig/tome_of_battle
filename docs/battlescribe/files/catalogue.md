[BSData-Formatreferenz](../../battlescribe-data-format.md) › Dateien

# 6. Catalogue (`.cat`)

Ein Katalog ist eine Armee/Fraktion. Sein Wurzelelement bindet sich per `gameSystemId` an ein
Game System:

```xml
<catalogue id="9945-8537-0944-c67b" name="Tomb Kings" revision="6"
           battleScribeVersion="2.03"
           authorName="Ergo Fargo and Bryce Rutledge" authorContact="ergofargo@gmail.com"
           library="false"
           gameSystemId="6d8e-38d9-3c69-febf" gameSystemRevision="8"
           xmlns="http://www.battlescribe.net/schema/catalogueSchema">
```

| Attribut | Bedeutung |
|----------|-----------|
| `gameSystemId` | Bindet den Katalog an ein Game System (`.gst`). |
| `gameSystemRevision` | Erwartete Revision des Game Systems. |
| `library` | `true` = reiner **Bibliotheks-Katalog** (nur geteilte Definitionen, nicht direkt spielbar; wird von anderen Katalogen per `catalogueLink` eingebunden). `false` = normale spielbare Armee. |
| `authorContact` | Kontakt des Autors (optional). |

**Typische Top-Level-Struktur eines Katalogs** (Zählung aus *Tomb Kings.cat*):

```
catalogue
├── publications                (1)
├── categoryEntries             (1)   ← katalogspezifische Zusatz-Kategorien
├── sharedSelectionEntries      (1)   ← die wiederverwendbaren Einheiten/Ausrüstung
├── sharedSelectionEntryGroups  (1)   ← wiederverwendbare Auswahlgruppen (z. B. Magic Items)
├── sharedProfiles              (1)   ← Statblöcke
├── sharedRules                 (1)   ← Regeltexte
├── selectionEntries           (21)   ← Wurzel-Einheiten
├── entryLinks                 (37)   ← Verweise auf shared entries
└── rules                       (1)
```

Manche Kataloge referenzieren zusätzlich per `<catalogueLinks>`/`<catalogueLink targetId="…">`
einen *Library*-Katalog, um dessen geteilte Definitionen zu importieren.

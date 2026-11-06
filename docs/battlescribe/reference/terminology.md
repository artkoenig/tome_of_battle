[BSData-Formatreferenz](../../battlescribe-data-format.md) › Referenz

# 14. Glossar

| Begriff | Bedeutung |
|---------|-----------|
| **Game System (`.gst`)** | Wurzel-Katalog; definiert `gameSystemId`, Kostenarten, Profil-Typen, Kategorien, Forces. |
| **Catalogue (`.cat`)** | Armee/Fraktion; bindet sich per `gameSystemId` an ein Game System. |
| **Library-Katalog** | `.cat` mit `library="true"`; enthält nur geteilte Definitionen zum Import via `catalogueLink`. |
| **Roster (`.ros`)** | Konkrete Armeeliste des Nutzers: `Roster → Force[] → Selection[]`. |
| **Selection Entry (SE)** | Baustein für Einheit/Modell/Upgrade. |
| **Selection Entry Group (SEG)** | Bündel von Alternativen („wähle X aus …"). |
| **Entry Link** | Verweis auf ein geteiltes SE/SEG (`targetId`); trägt eigene Kosten/Constraints. |
| **Info Link** | Verweis auf ein `profile`, eine `rule` oder eine `infoGroup`. |
| **Category Link** | Ordnet einen Eintrag einer Kategorie zu; `primary` steuert den UI-Bucket. |
| **Profile / Characteristic** | Statblock aus benannten Merkmalswerten, verweist auf einen `profileType`. |
| **Rule** | Mehrzeiliger Regeltext. |
| **Cost / Cost Type** | Ressourcenwert (Punkte etc.) und dessen abstrakte Definition. |
| **Constraint** | Grenze (`min`/`max`) über `field`/`scope`. |
| **Modifier** | Ändert eine Eigenschaft oder einen Constraint-Wert; ggf. bedingt/wiederholend. |
| **Condition / Condition Group** | Voraussetzung(en) für einen Modifier; `and`/`or`-Verknüpfung. |
| **Repeat** | Wendet einen Modifier mehrfach an (z. B. pro 1000 Punkte). |
| **Force Entry** | Detachment/Bataillon; legt per `categoryLink` fest, welche Kategorien erlaubt sind. Force-weite Kategoriegrenzen können am `categoryLink` **oder** direkt an der `categoryEntry`-Definition (`scope="force"`) hängen (siehe [§5.6](../files/game-system.md#56-force-entries-detachments)). |
| **Collective** | Flag zur Gruppierung/Synchronisierung identischer Auswahlen. |
| **`.bsr`** | Repository-Distribution (ZIP mit Index + Katalogen + Game System). |

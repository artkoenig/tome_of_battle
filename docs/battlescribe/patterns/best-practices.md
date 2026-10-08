[BSData-Formatreferenz](../../battlescribe-data-format.md) › Praxis

# 11. Best Practices

## 11.1 Die drei Grundregeln (Catalogue Guidelines)

1. **Konsistenz.** Bleib im Einklang mit anderen Katalogen desselben Systems — gleiche Konventionen,
   gleiche Struktur.
2. **Legale Builds ermöglichen.** Ein Katalog soll **jede legale Armeeliste** erzeugbar machen.
   Wenn sich eine exakte Bedingung nicht sauber abbilden lässt, lieber **erlauben** als valide
   Konfigurationen fälschlich als Fehler markieren. („Erlauben schlägt Verbieten.")
3. **Einfachheit.**
   - Nutze **Default-Einträge** in Entry Groups.
   - Neue Roster-Einträge sollen **out of the box legal** sein — der Nutzer soll Grundausstattung
     nicht mühsam manuell zusammenklicken müssen.
   - Benenne Entry Groups **selbsterklärend**, inklusive Auswahlgrenze — z. B.
     `"Weapons - choose 2"` oder `"Drones - up to 2 per member"`.

## 11.2 Datenmodellierung

- **Nie über Namen referenzieren** — immer über IDs / `categoryLinks`.
- **Keine armeespezifische Sonderlogik** — alle Regeln generisch über das Datenmodell abbilden.
- **Kosten an den Link** hängen, wenn dasselbe Item unterschiedlich viel kostet.
- **Optionale Upgrades** nicht automatisch auf die Einheit aufaddieren, solange nicht gewählt.
- **`min=1`+`max=1`** für „genau eins"; **`max=1`-Gruppe** für exklusive Wahl.
- **Constraint-`id`s** stabil halten — Modifier adressieren Constraints über ihre `id`.

## 11.3 Repository-Hygiene (Data Author Guide)

- ✅ Einchecken: **nur** `README.md`, die `*.cat`-Dateien und **eine** `*.gst`.
- ❌ **Keine** komprimierten Dateien (`*.gstz`, `*.catz`) — immer unkomprimiert als `*.cat`/`*.gst`
  speichern („Save as…" im Editor).
- ❌ **Keine** `index.xml`/`index.bsi` — den Data Indexer **nicht** laufen lassen; das macht die
  Infrastruktur automatisch.
- ❌ Den von BattleScribe erzeugten **`backups`-Ordner nicht** committen — Versionierung übernimmt git.
- ❌ Dateien **nach einem Release nicht umbenennen** — das bricht Auto-Updates bei den Nutzern.
  (Falls unvermeidbar: zusätzlich Katalog-`id` **und** internen Namen ändern.)
- ✅ Bei jeder Änderung das interne **`revision`-Attribut hochzählen** — sonst propagiert die
  Änderung nicht zu den Nutzern.

## 11.4 Windows-Fallstrick

Dateinamen mit Doppelpunkt (`:`) verursachen unter Windows Probleme. Das betrifft Kataloge, deren
Name einen `:` enthält — im Zweifel vermeiden bzw. den dokumentierten git-Workaround nutzen.

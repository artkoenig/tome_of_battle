[BSData-Formatreferenz](../battlescribe-data-format.md) › Grundlagen

# 1. Überblick: Was ist BSData?

**BattleScribe** ist ein Armeelisten-Editor für Tabletop-Spiele. Die Spielregeln, Einheiten,
Ausrüstung und Punktekosten werden nicht im Programm hartkodiert, sondern in **Datendateien**
beschrieben — den *BSData*-Dateien. Die Community pflegt diese Dateien in offenen GitHub-Repositories
unter der [BSData-Organisation](https://github.com/BSData).

Zwei Sichtweisen sind wichtig:

- **Ein Katalog ist eine Vorlage (Template).** Er beschreibt *alles, was gebaut werden kann*, samt
  Regeln und Beschränkungen. Aus ihm werden Armeelisten erzeugt und validiert.
- **Eine Roster ist eine konkrete Auswahl.** Sie referenziert Katalog-Einträge und enthält die
  tatsächlich gewählten Einheiten/Optionen.

Alle Dateien sind **XML**. Jedes Element hat einen eigenen XML-Namespace
(`http://www.battlescribe.net/schema/...`). Die zwei entscheidenden Eigenschaften des Formats:

1. **Referenzen statt Duplizierung** — Definitionen werden einmal beschrieben und über IDs
   verlinkt (siehe [§3](#3-grundprinzipien-des-formats)).
2. **Deklarative Regeln** — Beschränkungen und Anpassungen werden als Daten (`constraint`,
   `modifier`, `condition`) ausgedrückt, nicht als Code. Die Engine wertet sie generisch aus.

---

# 2. Dateitypen

| Endung | Typ | Beschreibung |
|--------|-----|--------------|
| `.gst` | **Game System** | Wurzel-Katalog eines Spielsystems. Definiert die `gameSystemId`, gemeinsame Kostenarten, Profil-Typen, Kategorien und Detachments. Alle `.cat` eines Systems verweisen darauf. |
| `.cat` | **Catalogue** | Ein einzelner Katalog, meist eine Armee/Fraktion (z. B. *Tomb Kings*). Enthält Einheiten, Ausrüstung, armeespezifische Regeln. |
| `.ros` | **Roster** | Eine konkrete Armeeliste des Nutzers: Auswahl von Einträgen, gruppiert in *Forces*. |
| `.gstz` / `.catz` / `.rosz` | **Komprimiert** | ZIP-komprimierte Varianten der obigen (dieselbe XML-Struktur, gezippt). |
| `index.xml` / `index.bsi` | **Index / Manifest** | Auflistung aller Dateien eines Repos samt Versionen — eine Art Protokoll/Manifest. |
| `.bsr` | **Repository-Distribution** | ZIP-Archiv mit Index + allen Katalogen + Game System. Auslieferungsformat. |

> **Best Practice (Data Author Guide):** Im Git-Repository werden **nur die unkomprimierten**
> `.cat`/`.gst`-Dateien eingecheckt — **keine** `.catz`/`.gstz`, **keine** `index.xml`/`index.bsi`
> und **kein** `backups`-Ordner. Kompression und Indizierung übernimmt die Auslieferungsinfrastruktur.
> Siehe [§11](patterns/best-practices.md#11-best-practices).

**In diesem Projekt:** Der Importer entpackt ein `.bsz`/ZIP mit `src/platform/battlescribe/zipExtractor.js`.
Vor dem Parsen prüft ein **beratender** Schema-Schritt (`src/platform/battlescribe/schemaValidator.js`, angebunden über
`src/platform/battlescribe/importSchemaGate.js`) jede Datei gegen die vendored `Catalogue.xsd` — ein Verstoß wird
per `console.warn` protokolliert (mit Datei + Zeile), **blockiert den Import aber nicht** und wird
**nicht in der UI angezeigt** (advisory, siehe ADR 0016). Anschließend parst
`src/platform/battlescribe/xmlParser.js` die `.cat`/`.gst`-XML zu einem „System"-Objekt, das in IndexedDB
gespeichert wird (`src/platform/persistence/database.js`).

---

# 3. Grundprinzipien des Formats

## 3.1 IDs und Namen

Jede Entität hat:

- **`id`** — eine kurze UUID-artige Kennung (`"5f2b-d3e2-60f2-a4e6"`). Eindeutig, stabil,
  maschinenlesbar. **Verweise erfolgen immer über die `id`, nie über den Namen.**
- **`name`** — der menschenlesbare Anzeigename (`"Tomb King"`). **Nicht** eindeutig und
  potenziell in mehreren Sprachen; **niemals** als Schlüssel für Logik verwenden.

> ⚠️ **Kritische Regel:** Keine sprachabhängigen String-Vergleiche als Parsing-/Validierungsschlüssel.
> Beziehungen (welche Einheit „General" sein kann, welche Kategorie „Core" ist) werden **ausschließlich
> über IDs / `categoryLinks`** aufgelöst, nie über Namensgleichheit.

## 3.2 Referenzen statt Einbettung

Der zentrale Kniff des Formats: Eine Auswahl **verweist** auf ihre Katalog-Definition, statt sie
einzubetten. Ein `selectionEntry` (etwa eine Waffe) wird **einmal** als *shared entry* definiert
und dann über `entryLink`s an vielen Stellen wiederverwendet. Beispiel: das „Spear (Mounted)" wird
per `targetId="027b-31d2-b3e2-23a4"` referenziert:

```xml
<entryLink id="c65c-9d2b-d1d2-ae51" name="Spear (Mounted)" hidden="false"
           collective="false" import="true"
           targetId="027b-31d2-b3e2-23a4" type="selectionEntry">
  <costs>
    <cost name="pts" typeId="ecfa-8486-4f6c-c249" value="3.0"/>
  </costs>
</entryLink>
```

Konsequenz für die Auswertung: Die Definition muss zum **Lesezeitpunkt** aus dem System aufgelöst
werden (in diesem Projekt: `resolveEntry`/`findEntryInSystem` in `src/contexts/armylist/model/catalogResolver.js`).
Dabei muss der **`catalogueId`-Kontext** mitgeführt werden, weil dieselbe Ziel-ID in verschiedenen
Katalogen/Detachments unterschiedliche Dinge bedeuten kann.

> **Bewusster Override in der Reinraum-Engine (ADR-0032):** Der Evaluator (`src/contexts/ruleengine/engine/`) führt
> **keinen** `catalogueId`-Kontext mit. Er mischt alle Quellen (`.gst` + alle `.cat`) in eine
> einzige flache `id→Definition`-Tabelle und löst **global-by-ID** auf — korrekt, solange die IDs
> katalogübergreifend disjunkte GUIDs sind, was die realen Datensätze erfüllen. Verletzt ein
> Datensatz die Disjunktheit, meldet der Kollisions-Guard die Diagnose `DUPLICATE_DEFINITION`,
> statt still falsch aufzulösen (siehe
> [ADR 0032](../adr/0032-evaluator-loest-mehr-katalog-datensaetze-global-by-id-auf.md)).

## 3.3 Revisionen (`revision`)

Jedes Wurzelelement trägt ein `revision`-Attribut (Ganzzahl). Wird eine Datei geändert, **muss die
Revision hochgezählt werden** — sonst erkennt die Update-Infrastruktur die Änderung nicht und sie
erreicht die Nutzer nie.

```xml
<catalogue id="9945-8537-0944-c67b" name="Tomb Kings" revision="6"
           battleScribeVersion="2.03" ...>
```

## 3.4 Kontext-Threading

Die Auflösung eines Eintrags ist **kontextabhängig**. `constraint`s mit `scope="parent"` vergleichen
aufgelöste **Ziel-IDs**, nicht `entryLinkId`s (verschiedene Links können auf dasselbe Ziel zeigen).
`constraint`s mit `scope="force"` zählen ein **Eintrags**-Ziel **pro Detachment**, ein
**Kategorie**-Ziel dagegen **armeeweit** (Ziel-Typ-Regel, siehe [§7.7](building-blocks/modifier.md#77-modifier-condition-condition-group-repeat) und ADR 0029).

---

# 4. Das Objektmodell im Überblick

```
gameSystem (.gst)  /  catalogue (.cat)
├── publications              ← Quellenangaben (Bücher)
├── costTypes                 ← z. B. "pts", "Casting Dice"   (nur .gst / library)
├── profileTypes              ← Spalten-Schemata für Statblöcke (nur .gst / library)
│   └── characteristicTypes   ← einzelne Spalten (Mv, WS, S, T …)
├── categoryEntries           ← Kategorien (Lord, Core, Special …)
│   └── constraints/modifiers
├── forceEntries              ← Detachments/„Armeeorganisation"
│   └── categoryLinks         ← welche Kategorien in dieser Force erlaubt sind
│       └── constraints/modifiers
├── sharedProfiles            ← wiederverwendbare Profile
├── sharedRules               ← wiederverwendbare Regeln
├── sharedSelectionEntries    ← wiederverwendbare Einheiten/Ausrüstung
├── sharedSelectionEntryGroups← wiederverwendbare Auswahlgruppen
├── selectionEntries          ← Wurzel-Einträge (die eigentlichen Einheiten)
│   ├── infoLinks             ← Verweise auf Profile/Regeln
│   ├── categoryLinks         ← Einordnung in Kategorien
│   ├── costs                 ← Punktekosten
│   ├── constraints           ← Min/Max-Grenzen
│   ├── modifiers             ← dynamische Anpassungen
│   ├── selectionEntries      ← verschachtelte Einträge (Rekursion!)
│   ├── selectionEntryGroups  ← „wähle 1 aus …"
│   └── entryLinks            ← Verweise auf shared entries
└── rules                     ← Wurzel-Regeln
```

Der Baum ist **rekursiv**: `selectionEntry` → `selectionEntry` → … beliebig tief. Ein
`selectionEntryGroup` bündelt Alternativen. In einer Roster spiegelt sich das als
`Roster → Force[] → Selection[]` (rekursiv) wider.

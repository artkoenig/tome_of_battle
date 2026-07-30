# BattleScribe-Datenformat (BSData) — Technische Dokumentation

> Umfassende Referenz zum Aufbau von BattleScribe-Datendateien (`.gst` / `.cat` / `.ros`),
> mit Best Practices und konkreten Beispielen.
>
> **Quellen:** das offizielle [BSData Catalogue-Development-Wiki](https://github.com/BSData/catalogue-development/wiki)
> (Home, *Data structure overview*, *Common Catalogue Patterns*, *Collective Entries*,
> *Catalogue Guidelines*, *Data Author Guide*, *Getting Started*) — seit Issue 076 als Submodul
> unter [`docs/bsdata-catalogue-development-wiki/`](bsdata-catalogue-development-wiki/) im Repo,
> aktualisierbar per `git submodule update --remote` — sowie reale
> WHFB-6th-Edition-Kataloge (heute zur Laufzeit aus dem externen Katalog-Fork bezogen, siehe
> ADR-0014; ein eingefrorener Ausschnitt liegt unter `src/solver/__fixtures__/whfb6/`).
> Alle XML-Beispiele stammen aus echten Dateien.
>
> Diese Datei ist die **kanonische Referenz** zum Battlescribe-Datenformat für dieses Projekt
> (inklusive der aus vergangenen Bug-Analysen gesammelten Domänen-Erkenntnisse). Wie das Projekt
> das Format konkret parst und auswertet, steht in [`CLAUDE.md`](../CLAUDE.md) sowie in den
> Solver-Modulen unter [`src/solver/`](../src/solver/).

---

## Inhaltsverzeichnis

1. [Überblick: Was ist BSData?](#1-überblick-was-ist-bsdata)
2. [Dateitypen](#2-dateitypen)
3. [Grundprinzipien des Formats](#3-grundprinzipien-des-formats)
4. [Das Objektmodell im Überblick](#4-das-objektmodell-im-überblick)
5. [Game System (`.gst`)](#5-game-system-gst)
6. [Catalogue (`.cat`)](#6-catalogue-cat)
7. [Die Kernbausteine im Detail](#7-die-kernbausteine-im-detail)
   - [7.1 Selection Entry & Selection Entry Group](#71-selection-entry--selection-entry-group)
   - [7.2 Entry Link, Info Link, Category Link](#72-entry-link-info-link-category-link)
   - [7.3 Profile, Profile Type, Characteristic](#73-profile-profile-type-characteristic)
   - [7.4 Rule](#74-rule)
   - [7.5 Cost & Cost Type](#75-cost--cost-type)
   - [7.6 Constraint](#76-constraint)
   - [7.7 Modifier, Condition, Condition Group, Repeat](#77-modifier-condition-condition-group-repeat)
8. [Kategorien & Sichtbarkeit](#8-kategorien--sichtbarkeit)
9. [Häufige Muster (Common Catalogue Patterns)](#9-häufige-muster-common-catalogue-patterns)
10. [Collective Entries](#10-collective-entries)
11. [Best Practices](#11-best-practices)
12. [Workflow: Erstellen, Versionieren, Veröffentlichen](#12-workflow-erstellen-versionieren-veröffentlichen)
13. [Referenztabellen](#13-referenztabellen)
14. [Glossar](#14-glossar)
15. [Lücken der Quelle](#15-lücken-der-quelle)

---

## 1. Überblick: Was ist BSData?

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

## 2. Dateitypen

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
> Siehe [§11](#11-best-practices).

**In diesem Projekt:** Der Importer entpackt ein `.bsz`/ZIP mit `src/parser/zipExtractor.js`.
Vor dem Parsen prüft ein **beratender** Schema-Schritt (`src/parser/schemaValidator.js`, angebunden über
`src/parser/importSchemaGate.js`) jede Datei gegen die vendored `Catalogue.xsd` — ein Verstoß wird
per `console.warn` protokolliert (mit Datei + Zeile), **blockiert den Import aber nicht** und wird
**nicht in der UI angezeigt** (advisory, siehe ADR 0016). Anschließend parst
`src/parser/xmlParser.js` die `.cat`/`.gst`-XML zu einem „System"-Objekt, das in IndexedDB
gespeichert wird (`src/db/database.js`).

---

## 3. Grundprinzipien des Formats

### 3.1 IDs und Namen

Jede Entität hat:

- **`id`** — eine kurze UUID-artige Kennung (`"5f2b-d3e2-60f2-a4e6"`). Eindeutig, stabil,
  maschinenlesbar. **Verweise erfolgen immer über die `id`, nie über den Namen.**
- **`name`** — der menschenlesbare Anzeigename (`"Tomb King"`). **Nicht** eindeutig und
  potenziell in mehreren Sprachen; **niemals** als Schlüssel für Logik verwenden.

> ⚠️ **Kritische Regel:** Keine sprachabhängigen String-Vergleiche als Parsing-/Validierungsschlüssel.
> Beziehungen (welche Einheit „General" sein kann, welche Kategorie „Core" ist) werden **ausschließlich
> über IDs / `categoryLinks`** aufgelöst, nie über Namensgleichheit.

### 3.2 Referenzen statt Einbettung

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
werden (in diesem Projekt: `resolveEntry`/`findEntryInSystem` in `src/roster/catalogResolver.js`).
Dabei muss der **`catalogueId`-Kontext** mitgeführt werden, weil dieselbe Ziel-ID in verschiedenen
Katalogen/Detachments unterschiedliche Dinge bedeuten kann.

> **Bewusster Override in der Reinraum-Engine (ADR-0032):** Der Evaluator (`src/evaluator/`) führt
> **keinen** `catalogueId`-Kontext mit. Er mischt alle Quellen (`.gst` + alle `.cat`) in eine
> einzige flache `id→Definition`-Tabelle und löst **global-by-ID** auf — korrekt, solange die IDs
> katalogübergreifend disjunkte GUIDs sind, was die realen Datensätze erfüllen. Verletzt ein
> Datensatz die Disjunktheit, meldet der Kollisions-Guard die Diagnose `DUPLICATE_DEFINITION`,
> statt still falsch aufzulösen (siehe
> [ADR 0032](adr/0032-evaluator-loest-mehr-katalog-datensaetze-global-by-id-auf.md)).

### 3.3 Revisionen (`revision`)

Jedes Wurzelelement trägt ein `revision`-Attribut (Ganzzahl). Wird eine Datei geändert, **muss die
Revision hochgezählt werden** — sonst erkennt die Update-Infrastruktur die Änderung nicht und sie
erreicht die Nutzer nie.

```xml
<catalogue id="9945-8537-0944-c67b" name="Tomb Kings" revision="6"
           battleScribeVersion="2.03" ...>
```

### 3.4 Kontext-Threading

Die Auflösung eines Eintrags ist **kontextabhängig**. `constraint`s mit `scope="parent"` vergleichen
aufgelöste **Ziel-IDs**, nicht `entryLinkId`s (verschiedene Links können auf dasselbe Ziel zeigen).
`constraint`s mit `scope="force"` zählen ein **Eintrags**-Ziel **pro Detachment**, ein
**Kategorie**-Ziel dagegen **armeeweit** (Ziel-Typ-Regel, siehe [§7.7](#77-modifier-condition-condition-group-repeat) und ADR 0029).

---

## 4. Das Objektmodell im Überblick

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

---

## 5. Game System (`.gst`)

Das Game System ist der Wurzel-Katalog. Nur hier (bzw. in *Library*-Katalogen) werden die
systemweit geteilten Definitionen wie Kostenarten und Profil-Typen abgelegt.

### 5.1 Wurzelelement

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<gameSystem id="6d8e-38d9-3c69-febf"
            name="Warhammer Fantasy Battle 6th edition"
            revision="8" battleScribeVersion="2.03" authorName="Ergo Fargo"
            xmlns="http://www.battlescribe.net/schema/gameSystemSchema">
```

| Attribut | Bedeutung |
|----------|-----------|
| `id` | Die **`gameSystemId`** — jeder Katalog verweist per `gameSystemId` hierauf. |
| `revision` | Versionszähler (siehe [§3.3](#33-revisionen-revision)). |
| `battleScribeVersion` | Schema-/Formatversion (hier `2.03`). |
| `authorName` | Autor. |

### 5.2 Publications (Quellen)

```xml
<publications>
  <publication id="315e-e3c4-08af-fd51" name="BRB"/>
</publications>
```

Profile, Regeln und Einträge referenzieren eine Publication per `publicationId` und geben oft
zusätzlich eine Seitenzahl (`page`) an. So lässt sich jeder Wert auf eine Buchquelle zurückführen.

### 5.3 Cost Types (Kostenarten)

Ein `costType` abstrahiert eine **abzählbare Ressource** — meist Punkte, aber auch beliebige andere:

```xml
<costTypes>
  <costType id="ecfa-8486-4f6c-c249" name="pts"           defaultCostLimit="-1.0" hidden="false"/>
  <costType id="fcec-2340-6368-a2ba" name=" Casting Dice" defaultCostLimit="-1.0" hidden="false"/>
  <costType id="6001-b2bf-4529-c07d" name=" Dispel Dice"  defaultCostLimit="-1.0" hidden="false"/>
</costTypes>
```

| Attribut | Bedeutung |
|----------|-----------|
| `defaultCostLimit` | Standard-Obergrenze; `-1.0` = kein Limit. |
| `hidden` | Ob die Kostenart dem Nutzer angezeigt wird. |

### 5.4 Profile Types & Characteristic Types

Ein `profileType` ist ein benanntes **Spalten-Schema** (ein „Column-Set") für Statblöcke. Jede Spalte
ist ein `characteristicType`:

```xml
<profileTypes>
  <profileType id="a54a-7f00-29bf-12b1" name="Profile">
    <characteristicTypes>
      <characteristicType id="0e92-d038-82bf-fb41" name="Mv"/>
      <characteristicType id="f95b-da01-0578-3bdc" name="WS"/>
      <characteristicType id="4a8b-0c8e-3daf-7901" name="BS"/>
      <characteristicType id="b690-4bc0-bb73-267b" name="S"/>
      <characteristicType id="8712-f56f-5b22-a720" name="T"/>
      <!-- W, I, A, Ld … -->
    </characteristicTypes>
  </profileType>
  <profileType id="7889-42d9-70a0-3ea9" name="Weapon">
    <characteristicTypes>
      <characteristicType id="3107-4d1e-9a51-6564" name="Range"/>
      <characteristicType id="6fe4-1ebb-cb04-1378" name="Strength"/>
      <characteristicType id="a21a-cdc0-4b13-b236" name="Special Rules"/>
    </characteristicTypes>
  </profileType>
</profileTypes>
```

Ein konkretes `profile` (siehe [§7.3](#73-profile-profile-type-characteristic)) verweist per
`typeId` auf einen dieser Typen und füllt die Spalten mit `characteristic`-Werten.

### 5.5 Category Entries (Kategorien)

Kategorien sind **tag-artige Entitäten**. Sie dienen der Einordnung in der Roster-UI und als
Bedingungen für die Validierung:

```xml
<categoryEntries>
  <categoryEntry id="d024-d25b-a9b4-73b6" name="Lord"    hidden="false"/>
  <categoryEntry id="64bf-efb4-9978-26df" name="Core"    hidden="false"/>
  <categoryEntry id="43cc-fc3f-35a7-8d03" name="Special" hidden="false"/>
  <categoryEntry id="a37e-7207-de6d-acb0" name="General" hidden="false">
    <constraints>
      <constraint field="selections" scope="roster" value="1.0" percentValue="false"
                  shared="true" includeChildSelections="true" includeChildForces="true"
                  id="d818-c60d-b1f8-8aaa" type="max"/>
      <constraint field="selections" scope="roster" value="1.0" percentValue="false"
                  shared="true" includeChildSelections="true" includeChildForces="true"
                  id="1077-7379-f142-f382" type="min"/>
    </constraints>
  </categoryEntry>
</categoryEntries>
```

Hier erzwingt die Kategorie „General" per `min=1`/`max=1`, dass **genau ein** General in der Armee
steht — komplett sprachneutral, allein über die verlinkte Kategorie-ID.

### 5.6 Force Entries (Detachments)

Ein `forceEntry` repräsentiert eine „Force" — ein Detachment/Bataillon/eine Armeeorganisation. Es
legt über `categoryLinks` fest, **welche Kategorien in dieser Force erscheinen** und mit welchen
Grenzen:

```xml
<forceEntries>
  <forceEntry id="7d9d-6c8d-4ea0-b7ad" name="Standard " hidden="false">
    <categoryLinks>
      <categoryLink id="223a-0bf6-f992-7db0" name="Lord"   targetId="d024-d25b-a9b4-73b6" primary="false"> … </categoryLink>
      <categoryLink id="7697-ca4b-195e-cd8d" name="Heroes" targetId="c16b-f319-2c62-2c12" primary="false"/>
      <categoryLink id="a87e-de8e-ade8-cae0" name="Core"   targetId="64bf-efb4-9978-26df" primary="false"> … </categoryLink>
    </categoryLinks>
  </forceEntry>
</forceEntries>
```

Die `categoryLink`s tragen häufig **dynamische Grenzen** über `modifier`s: In WHFB6 skalieren die
erlaubten Lord-/Core-Slots mit dem Punktelimit. Genau das zeigt das Beispiel in
[§7.7](#77-modifier-condition-condition-group-repeat).

> **Zwei Orte für Force-Kategoriegrenzen.** Eine force-weite Kategoriegrenze kann an **zwei**
> Stellen deklariert sein, und beide müssen bei der Validierung berücksichtigt werden:
> 1. Am **`categoryLink`** innerhalb des `forceEntry` (das oben gezeigte, klassische Muster).
> 2. Direkt an der **`categoryEntry`-Definition** ([§5.5](#55-category-entries-kategorien)) als
>    `constraint` mit `scope="force"` (inkl. punkteskalierender `modifier`). Diese Grenze gilt dann
>    für die Kategorie **in jeder Force**, ohne dass sie am `categoryLink` wiederholt werden muss.
>    Der Lexicanum-WHFB6-Datensatz nutzt genau diese Variante für die Charaktergrenzen (die
>    Characters-`categoryEntry` trägt die punkteskalierende `scope="force"`-Grenze, während die
>    Heroes-Kategorie `max="-1"` = unbegrenzt setzt). Eine Auswertung, die nur `categoryLink`-Grenzen
>    liest, würde diese Limits still nicht durchsetzen.

> **Regeln zur Auswertung:**
> - Force-Kategoriegrenzen zählen ihr **Kategorie**-Ziel **armeeweit** (über alle Forces aggregiert) —
>   unabhängig davon, ob sie am `categoryLink` oder an der `categoryEntry`-Definition hängen. Das ist
>   die einheitliche Ziel-Typ-Regel aus [§7.7](#77-modifier-condition-condition-group-repeat) (ADR 0029):
>   ein `scope="force"`-Constraint mit **Eintrags**-Ziel zählt pro Detachment, mit **Kategorie**-Ziel
>   armeeweit. Bei Ein-Force-Listen ist beides identisch.
> - Force Entries können **sowohl im Game System (`.gst`) als auch im einzelnen Katalog (`.cat`)**
>   deklariert sein — beim Erstellen einer Liste müssen **beide Quellen** berücksichtigt werden.
> - Ein `forceEntry` bzw. `categoryLink` mit `hidden="true"` (oder dynamisch per Modifier
>   `field="hidden"`, siehe [§8](#8-kategorien--sichtbarkeit)) darf dem Nutzer **nicht** als Option
>   angeboten und dessen Mindestgrenzen dürfen **nicht** validiert werden. Per Projektentscheidung
>   (Issue 0088) gilt das Validierungsverbot für **jede** effektiv versteckte Entität mit
>   Min-Grenzen — auch `selectionEntry`/`selectionEntryGroup` —, denn ein Verstoß über etwas, das
>   nicht angeboten wird, wäre für den Nutzer unbehebbar. Max-Grenzen bleiben davon unberührt.

> **`forceEntry`-eigene Constraints/Modifier (eigenes Punktelimit).** Ein `forceEntry` kann —
> zusätzlich zu seinen `categoryLinks` — **eigene** `constraints` und `modifiers` tragen (es erbt
> von `ContainerEntryBase`). Muster im Lexicanum-WHFB6-Datensatz (zwei Vampire-Counts-Sonderheere,
> „Army of the Lichemaster", „Vampire Coast"): eine Constraint mit `field="limit::<pts-costTypeId>"`
> und `scope="roster"` (Basis `min="0"`, also armeeweit **kein** Mindestpunktelimit), angehoben auf
> einen konkreten Wert durch einen `modifier`, dessen `condition` per `type="instanceOf"
> scope="force"` auf die **eigene** `forceEntry`-Id gated ist — netto: „wird dieses Sonderheer
> gewählt, muss die Liste auf mindestens X Punkte gebaut werden". Diese Constraint ist von den
> `categoryLink`-Constraints ([§7.6](#76-constraint)) unabhängig und wird gesondert ausgewertet.

---

## 6. Catalogue (`.cat`)

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

---

## 7. Die Kernbausteine im Detail

### 7.1 Selection Entry & Selection Entry Group

`selectionEntry` (SE) und `selectionEntryGroup` (SEG) sind laut Wiki **„absolutely fundamental"** —
sie repräsentieren *Einheiten, Modelle, Upgrades und sonstige Ausrüstung*.

#### Selection Entry

```xml
<selectionEntry id="5f2b-d3e2-60f2-a4e6" name="Tomb King"
                hidden="false" collective="false" import="true" type="unit">
  <infoLinks> … </infoLinks>          <!-- Profile & Regeln -->
  <categoryLinks> … </categoryLinks>  <!-- Einordnung -->
  <selectionEntries> … </selectionEntries>          <!-- verschachtelte Einträge -->
  <selectionEntryGroups> … </selectionEntryGroups>  <!-- Auswahlgruppen -->
  <entryLinks> … </entryLinks>        <!-- Verweise auf shared entries -->
  <constraints> … </constraints>
  <costs> … </costs>
</selectionEntry>
```

| Attribut | Werte | Bedeutung |
|----------|-------|-----------|
| `type` | `unit` \| `model` \| `upgrade` | Metadatum, das Anzeige und Statistiken beeinflusst. `unit`/`model` sind physische Elemente, `upgrade` sind Optionen/Ausrüstung. |
| `collective` | `true`/`false` | Ob der Eintrag als eine gruppierte Zeile dargestellt/synchronisiert wird (siehe [§10](#10-collective-entries)). |
| `import` | `true`/`false` | Ob der Eintrag beim Export in die Roster übernommen wird. |
| `hidden` | `true`/`false` | Sichtbarkeit (kann per Modifier dynamisch werden). |

#### Selection Entry Group

Eine SEG bündelt Alternativen — typischerweise „wähle X aus dieser Liste". Ein `max="1"`-Constraint
auf einer Gruppe bedeutet **exklusive Wahl (Radiobutton-Semantik)**, nicht „höchstens 1 Stück von
etwas Zählbarem".

```xml
<selectionEntryGroup id="ea98-9474-c6d2-03af" name="Additional Weapons"
                     hidden="false" collective="false" import="true">
  <constraints>
    <constraint field="selections" scope="parent" value="1.0" percentValue="false"
                shared="true" includeChildSelections="false" includeChildForces="false"
                id="306f-ca1d-0f4d-0da0" type="max"/>
  </constraints>
  <entryLinks>
    <entryLink id="4c13-4d43-029c-39e4" name="Great Weapon" targetId="1eb7-3f36-8cf7-e0ba" type="selectionEntry">
      <costs><cost name="pts" typeId="ecfa-8486-4f6c-c249" value="6.0"/></costs>
    </entryLink>
    <entryLink id="f94d-f042-d658-698a" name="Flail" targetId="2eb9-be12-caec-57e8" type="selectionEntry">
      <costs><cost name="pts" typeId="ecfa-8486-4f6c-c249" value="3.0"/></costs>
    </entryLink>
  </entryLinks>
</selectionEntryGroup>
```

Eine Gruppe kann eine **Standardauswahl** über `defaultSelectionEntryId` festlegen:

```xml
<selectionEntryGroup id="7e80-30c2-95ef-51c3" name="Weapons"
                     collective="false" import="true"
                     defaultSelectionEntryId="163c-9fe8-772c-94a5"> … </selectionEntryGroup>
```

Auswertung von `defaultSelectionEntryId`:

- Es greift, wenn die Gruppe eine **Mindestauswahl** (`min > 0`) hat, und benennt die ID der Option
  (`selectionEntry` oder `entryLink` unterhalb der Gruppe), die dann vorausgewählt sein soll.
- Ist das Attribut gesetzt und passt zu einer Option der Gruppe, muss **diese** Option erzeugt werden
  — nicht die erste in der Liste.
- Fehlt das Attribut oder ist es ungültig, fällt das System auf die **erste verfügbare Option** der
  Gruppe zurück.

> **Wichtige Domänenregel:** Optionale Upgrades (kein `min > 0`) dürfen ihre Profile/Regeln **nicht**
> automatisch auf die Elterneinheit aufaddieren, bevor der Spieler sie tatsächlich wählt. Sonst wird
> z. B. ein *Savage Orc Great Shaman* fälschlich als beritten gewertet, nur weil im Katalog unter ihm
> ein optionaler *Boar*-Mount definiert ist.

### 7.2 Entry Link, Info Link, Category Link

Es gibt drei Link-Typen. Alle referenzieren per `targetId` eine geteilte Definition.

#### `entryLink` — verweist auf ein shared SE/SEG

```xml
<entryLink id="573d-1e36-4358-84ea" name="Light Armour"
           collective="false" import="true"
           targetId="055f-8e4e-f170-35d2" type="selectionEntry">
  <constraints>
    <constraint field="selections" scope="parent" value="1.0" type="max"
                id="3db3-9c83-7af4-8aa6" percentValue="false" shared="true"
                includeChildSelections="false" includeChildForces="false"/>
  </constraints>
  <costs><cost name="pts" typeId="ecfa-8486-4f6c-c249" value="3.0"/></costs>
</entryLink>
```

| `type` | Ziel |
|--------|------|
| `selectionEntry` | verweist auf ein geteiltes `selectionEntry` |
| `selectionEntryGroup` | verweist auf ein geteiltes `selectionEntryGroup` |

Ein `entryLink` kann eigene `constraints`, `modifiers` und `costs` mitbringen. So kostet dieselbe
Waffe an verschiedenen Einheiten unterschiedlich viel — die **Kosten liegen am Link, nicht an der
Definition**.

Das Ziel muss aus den **shared**-Listen *desselben* Katalogs stammen; per Grundregelwerk-Import
zählen die geteilten Einträge der `.gst` mit dazu (dort schreibgeschützt). Ein Roster, das einen
Verweis aus Katalog X benennt, ist gegen einen Datensatz ohne X folglich nicht auswertbar — auch
dann nicht, wenn die Ziel-Id zufällig in der `.gst` auflöst. Analog für Kontingente: *„All
selections within must originate from a single catalogue."*

> **Bewusster Override in der Reinraum-Engine (ADR-0032):** Der Evaluator erzwingt diese
> Katalog-Lokalität nicht. `entryLink`-/`infoLink`-Ziele lösen **global-by-ID** über eine flache
> Symboltabelle aller mitgegebenen Quellen auf; ein `catalogueLink` ist dort nur eine
> Abhängigkeits-Deklaration, kein eigener Auflösungsmechanismus. Abgesichert wird das durch
> Diagnosen statt stiller Fehlauswertung: eine echte ID-Kollision zwischen Katalogen meldet der
> Kollisions-Guard des Resolvers als `DUPLICATE_DEFINITION`; einen fehlenden Ziel-Katalog meldet
> die Datensatz-Vorbereitung der Fassade als `MISSING_CATALOGUE_DEPENDENCY`
> (siehe [ADR 0032](adr/0032-evaluator-loest-mehr-katalog-datensaetze-global-by-id-auf.md)).

Ein `modifier` am Link wirkt asymmetrisch: er ändert die **Eigenschaften des Ziels**, aber die
**Grenzwerte des Links**.

#### `infoLink` — verweist auf ein Profil oder eine Regel

```xml
<infoLinks>
  <infoLink id="2210-9741-7311-e655" name="Tomb King"  targetId="8a60-0398-a620-ca9e" type="profile"/>
  <infoLink id="6e69-d60f-61d8-5f27" name="Undead"     targetId="97a4-d2a9-5b16-f0c3" type="rule"/>
  <infoLink id="45ec-367c-3308-8f61" name="Flammable"  targetId="ff92-e6dd-2f5d-dcca" type="rule"/>
</infoLinks>
```

`type` ist `profile`, `rule` oder `infoGroup`. So bekommt eine Einheit ihren Statblock (`profile`)
und ihre Sonderregeln (`rule`) angehängt, ohne sie zu duplizieren.

#### `categoryLink` — ordnet den Eintrag in Kategorien ein

```xml
<categoryLinks>
  <categoryLink id="1c5b-4911-4cdb-fa23" name="New CategoryLink" targetId="d024-d25b-a9b4-73b6" primary="true"/>
  <categoryLink id="6751-1abf-6518-f54f" name="Characters"      targetId="7a1c-d611-c2dc-def1" primary="false"/>
  <categoryLink id="910e-ee4d-9fb6-ec1d" name="Tomb King"       targetId="a066-363e-a1c1-aa6b" primary="false"/>
</categoryLinks>
```

- **`primary="true"`** — die **eine** Kategorie, unter der der Eintrag in der Roster-UI einsortiert
  wird (hier: „Lord").
- **`primary="false"`** — unsichtbare, tag-artige Schlüsselwort-Kategorien, nur für die Validierung
  (z. B. „wer darf ein Reittier nehmen", „wer kann General sein").

> **Regel:** Die UI wird **nie** nach hartkodierten Kategorienamen gruppiert, sondern immer über
> `primary="true"` und die aufgelöste Kategorie-ID.

### 7.3 Profile, Profile Type, Characteristic

Ein `profile` ist eine benannte Liste von Merkmalswerten (ein Statblock). Es verweist per `typeId`
auf einen `profileType` ([§5.4](#54-profile-types--characteristic-types)) und liefert für jede Spalte
einen `characteristic`-Wert. Profile werden meist zentral unter `sharedProfiles` abgelegt und per
`infoLink` eingebunden:

```xml
<sharedProfiles>
  <profile id="8a60-0398-a620-ca9e" name="Tomb King" publicationId="04f9-cede-fdb3-1e6c"
           hidden="false" typeId="a54a-7f00-29bf-12b1" typeName="Profile">
    <characteristics>
      <characteristic name="Mv" typeId="0e92-d038-82bf-fb41">4</characteristic>
      <characteristic name="WS" typeId="f95b-da01-0578-3bdc">6</characteristic>
      <characteristic name="BS" typeId="4a8b-0c8e-3daf-7901">4</characteristic>
      <characteristic name="S"  typeId="b690-4bc0-bb73-267b">5</characteristic>
      <characteristic name="T"  typeId="8712-f56f-5b22-a720">5</characteristic>
      <characteristic name="W"  typeId="253a-9b00-4fde-8ac2">4</characteristic>
      <characteristic name="I"  typeId="dfff-363e-f72a-5a59">3</characteristic>
      <characteristic name="A"  typeId="6b9f-c8fe-8998-27e3">4</characteristic>
      <characteristic name="Ld" typeId="2d45-18fe-9eb3-b113">10</characteristic>
    </characteristics>
  </profile>
</sharedProfiles>
```

- Der **Textinhalt** eines `characteristic` ist die Anzeige (`4`, `6`, `4+`, `Str 5, no armour save`).
- Ist der Wert numerisch, kann er von Modifiern verrechnet werden.
- Der `name`/`typeId` jedes `characteristic` bindet ihn an eine Spalte des `profileType`.

> **Domänenregel (rekursive Profil-Sammlung):** Profile und Sonderregeln hängen oft **nicht** an der
> Grundeinheit, sondern verschachtelt an Upgrades (z. B. eine *Bloodline* eines *Vampire Thrall*). Die
> effektiven Profile/Regeln einer Einheit müssen daher **rekursiv** aus den Katalogdefinitionen **und**
> den tatsächlich getroffenen Spielerauswahlen eingesammelt werden — dabei aber nur *aktiv gewählte*
> optionale Upgrades berücksichtigen (siehe [§7.1](#71-selection-entry--selection-entry-group)).

### 7.4 Rule

Eine `rule` ist die **einzige mehrzeilige** Textentität — Zeilenumbrüche im `<description>` bleiben
erhalten. Regeln werden meist unter `sharedRules` definiert und per `infoLink type="rule"` verlinkt:

```xml
<sharedRules>
  <rule id="1165-2ae3-f1fb-075d" name="The Hierophant" publicationId="04f9-cede-fdb3-1e6c" hidden="false">
    <description>The army must include one Liche High Priest or Liche Priest. Highest leadership is
    the Hierophant. In the phase he is destroyed and at the beginning of each undead turn after,
    every unit must take a leadership test …</description>
  </rule>
</sharedRules>
```

Sonderzeichen werden XML-üblich escaped (`&apos;` `&quot;` `&amp;`).

### 7.5 Cost & Cost Type

Ein `cost` weist einer Auswahl einen Wert einer Kostenart (`costType`, [§5.3](#53-cost-types-kostenarten))
zu. Referenziert wird per `typeId`:

```xml
<costs>
  <cost name="pts"           typeId="ecfa-8486-4f6c-c249" value="45.0"/>
  <cost name=" Casting Dice" typeId="fcec-2340-6368-a2ba" value="0.0"/>
  <cost name=" Dispel Dice"  typeId="6001-b2bf-4529-c07d" value="0.0"/>
</costs>
```

> **Rechenregel:** `child.number * parent.number` muss für Kosten und Constraint-Zählungen
> **immer** durchmultipliziert werden — unabhängig vom `collective`-Flag. `collective` betrifft nur
> die *Anzeige* gestapelter Instanzen, nicht die zugrunde liegende Mathematik.
>
> **Zahlenbasis:** Diese Multiplikation gilt für **per-Eltern-relative** Stückzahlen — „Anzahl je
> Eltern-Instanz", die Zahlenbasis der Katalog-Constraint-Mathematik. Die Reinraum-Engine
> multipliziert dagegen **nicht** durch die Elternkette (`src/evaluator/countIndex.js`,
> `contributionOf`: jeder Knoten trägt sein `instance.count` unverrechnet bei). Sie setzt damit
> voraus, dass das `number` einer `.ros`-Selektion eine **absolute** Gesamtstückzahl ist, kein
> per-Eltern-Multiplikator — unter dieser Annahme fallen beide Rechnungen zusammen. Die
> `.ros`-Semantik selbst ist eine Lücke der Quelle ([§15](#15-lücken-der-quelle)); der
> ungeschriebene Roster-Vertrag der Fassade ist
> [Issue 084](issues/084-roster-vertrag-der-fassade-ist-ungeschrieben-und-ungeprueft.md).

### 7.6 Constraint

Ein `constraint` ist eine **Grenze** (Minimum oder Maximum). Er definiert *was* gezählt wird
(`field`), in *welchem Bezugsrahmen* (`scope`) und *welche Grenze* (`type`/`value`).

```xml
<constraint field="selections" scope="parent" value="1.0" type="max"
            id="61ef-db9b-f468-886e"
            percentValue="false" shared="true"
            includeChildSelections="false" includeChildForces="false"/>
```

| Attribut | Werte | Bedeutung |
|----------|-------|-----------|
| `type` | `min` \| `max` | Untere oder obere Grenze. |
| `field` | `selections` \| `forces` \| *`<costTypeId>`* | Was gezählt/summiert wird: Anzahl Auswahlen, Anzahl Forces oder die Summe einer Kostenart. |
| `scope` | `parent` \| `roster` \| `force` \| `category` \| `self` \| `unit` \| `primary-catalogue` | Bezugsrahmen der Zählung (`unit` = die umschließende Einheit, siehe den [Kasten in §7.7](#scope-unit-ancestor); `primary-catalogue` ist kein Zählrahmen, siehe den Kasten unten). |
| `value` | Zahl | Der Grenzwert (`-1.0` = unbegrenzt, siehe den Sentinel-Kasten unten). |
| `percentValue` | `true`/`false` | Ob `value` als Prozentsatz zu interpretieren ist. |
| `shared` | `true`/`false` | Ob der gezählte Wert über alle Link-Instanzen geteilt wird oder pro Instanz gilt. `true`: die Summe umfasst **alle** Auswahlen dieses shared entry im Roster; `false`: sie wird **je Verweis-Instanz** gerechnet ([BSData-Wiki, *Data structure overview*](https://github.com/BSData/catalogue-development/wiki/Data-structure-overview)). |
| `includeChildSelections` | `true`/`false` | Ob verschachtelte Auswahlen mitgezählt werden. `false` zählt *„just `scope`'s `field`"* — also eingeschränkt, **nicht** leer. |
| `includeChildForces` | `true`/`false` | Ob untergeordnete Forces mitgezählt werden. `false` rechnet *„only from parent force selections"* — die Auswahlen des eigenen Kontingents zählen also weiter mit. |

**Beispiel „ein Punkte-Budget pro Auswahl"** — Magische Gegenstände dürfen zusammen höchstens
100 Punkte kosten (`field` ist die *Punkte*-Kostenart, nicht `selections`):

```xml
<constraint field="ecfa-8486-4f6c-c249" scope="parent" value="100.0" type="max"
            id="f1bd-eb3b-6dad-d76c"
            percentValue="false" shared="true"
            includeChildSelections="false" includeChildForces="false"/>
```

**Beispiel „genau eins"** — kombiniere `min=1` und `max=1` (Handwaffe ist Pflicht, aber nur einmal):

```xml
<constraints>
  <constraint field="selections" scope="parent" value="1.0" type="min" id="3036-9f59-6708-d4a6" … />
  <constraint field="selections" scope="parent" value="1.0" type="max" id="7125-8869-4634-890f" … />
</constraints>
```

> **Regeln:**
> - **Gezählt werden die Auswahlen *unterhalb* des Trägers der Grenze**, nicht der Träger selbst.
>   Der `scope` sagt nur, in welchem Rahmen summiert wird — die Quelle: der `scope` entscheide,
>   *„which entity should sum up all `field`'s values **of descendant selections of this
>   constraint's parent entry**"*
>   ([*Data structure overview*](bsdata-catalogue-development-wiki/Data-structure-overview.md),
>   Abschnitt *Constraint*). Eine Grenze an einer `selectionEntryGroup` zählt damit **ihre
>   Mitglieder**, nicht die Gruppe.
> - `scope="parent"` vergleicht aufgelöste **Ziel-IDs**, nicht `entryLinkId`s.
> - `scope="force"` zählt ein **Eintrags**-Ziel **pro Detachment**, ein **Kategorie**-Ziel **armeeweit**
>   (Ziel-Typ-Regel, [§7.7](#77-modifier-condition-condition-group-repeat) / ADR 0029).
> - Die `id` eines `constraint`s ist wichtig: **Modifier adressieren einen Constraint über dessen `id`**,
>   um dessen `value` dynamisch zu ändern (siehe nächster Abschnitt).

> **Sentinel `-1` = „unbegrenzt" — nur als hingeschriebener Wert.** Upstream ist der Sentinel
> nirgends dokumentiert ([§15](#15-lücken-der-quelle)); aus den Daten belegt und in Issue 079
> entschieden gilt: `-1` bedeutet „unbegrenzt" genau dort, wo er **hingeschrieben** steht — am
> `value` eines `constraint`s, am `value` eines `set`-Modifiers auf einen Constraint, an
> `defaultCostLimit` ([§5.3](#53-cost-types-kostenarten)) und am eingestellten
> Roster-`costLimit` (Issue 0096; dieselbe Aufzählung wie in
> [§15](#15-lücken-der-quelle)). Reale Kataloge nutzen beide Richtungen:
> `set value="-1"` hebt eine konkrete Grenze auf, und ein Rohwert `-1` wird per bedingtem `set`
> auf einen konkreten Deckel gezogen (Border-Patrols-Muster). Ein **errechneter** negativer Wert
> (`increment`/`decrement`/`multiply`) ist dagegen **nie** unbegrenzt — ein Max, das rechnerisch
> auf `-1` fällt, heißt „nichts erlaubt", nicht „alles erlaubt". Arithmetik auf einer unbegrenzten
> Grenze lässt sie unbegrenzt; ein späterer `set` auf einen konkreten Wert überschreibt.

<a id="scope-primary-catalogue"></a>

> **`scope="primary-catalogue"` — das Armeebuch, kein Zählrahmen.** Upstream ist dieses
> Schlüsselwort **nirgends** dokumentiert: das Wiki zählt `parent|roster|force|primary category`
> und Vorfahren-Ids auf, die XSD typt `scope` als nackten String (`Catalogue.xsd:426`). Aus den
> Daten belegt und in Issue 077 entschieden gilt: **`primary-catalogue` bezeichnet das Armeebuch
> — den `<catalogue id=…>`, aus dem das umschließende Kontingent stammt.** Die Frage lautet nicht
> „wie viele?", sondern „ist es dieses?"; der Rahmen ist deshalb kein Zählrahmen, sondern eine
> **Identitätsprüfung** gegen die in `childId` genannte Katalog-Wurzel-Id. Drei Belege aus den
> eingefrorenen Fixture-Katalogen (`src/evaluator/__fixtures__/whfb6-definitive/`, 27 Vorkommen:
> 7 in der `.gst`, 20 in `Mercenaries (…).cat`):
> - Alle 27 stehen an einer `condition` (`instanceOf`/`notInstanceOf`, `field="selections"`), nie
>   an einem `constraint` oder `repeat`, und **jede** `childId` ist eine Katalog-Wurzel-Id
>   (`731d-5b13-2a92-5427` = Ogre Kingdoms, `4049-c46d-7f80-44fb` = Orcs and Goblins,
>   `4d73-5ab0-9020-403c` = Vampire Counts). Keine dieser Ids benennt irgendwo einen Eintrag,
>   eine Kategorie oder ein Kontingent.
> - Nur unter dieser Deutung lesen sich die Regeln richtig: Maneaters kosten außerhalb einer
>   Ogerarmee einen Rare-Slot extra und sind in der Ogerarmee versteckt; Kampagnen-Einträge der
>   `.gst` werden nur für benannte Armeebücher sichtbar.
> - Der Autor sagt es selbst: die Bedingung an `categoryEntry "Chariot"` trägt den Kommentar
>   „Tomb Kings may have more than one Chariot" an einem `notInstanceOf childId="…"
>   childName="Tomb Kings"`; auch die übrigen `childName` sind Armeebuch-Namen.
>
> Die Semantik der Engine (`src/evaluator/query.js`) folgt daraus: Treffer ⇒ 1, anderes Armeebuch
> ⇒ 0, `childId` leer (Prozent-Nenner „alles im Rahmen") ⇒ 1, denn der Rahmen hat genau **einen**
> Katalog. `shared="false"` verengt ihn nicht — ein Katalog wird durch eine Instanz nicht enger.
> Eine `childId`, deren Katalog im Datensatz gar nicht geladen ist, ist ein schlichter
> Nicht-Treffer und kein Datenfehler. Lässt sich das Armeebuch nicht bestimmen — keine
> umschließende Force, oder ihre Definition steht in der `.gst` statt in einem Armeebuch —, meldet
> die Engine `unresolvedScope` und wertet fail-closed, statt still ein Armeebuch anzunehmen.
> Welches Kontingent gemeint ist, entscheidet der Standort der Query; **welcher Katalog** ein
> Kontingent deklariert hat, kommt aus der Herkunft seiner Definition, nicht aus dem
> `catalogueId`-Attribut der `.ros` (Issue 077, Decisions).

### 7.7 Modifier, Condition, Condition Group, Repeat

Ein `modifier` **ändert** eine Eigenschaft des Elternelements oder den Wert eines Constraints.

| `modifier`-Attribut | Werte | Bedeutung |
|---------------------|-------|-----------|
| `type` | `increment` \| `decrement` \| `set` \| `append` \| `prepend` \| `multiply` \| `add` \| `remove` \| `set-primary` \| `unset-primary` | Operation. `increment`/`decrement`/`set`/`multiply` für numerische Felder, `append`/`prepend`/`set` für Text, `add`/`remove` für Kategoriezugehörigkeit (`field="category"`), `set-primary`/`unset-primary` für das `primary`-Flag eines Kategorie-Links. |
| `field` | *Constraint-`id`* \| *`<costTypeId>`* \| `hidden` \| `name` \| `category` \| `error` \| `warning` \| `info` \| *`<characteristicTypeId>`* | Was geändert wird. `category` (zusammen mit `add`/`remove`) ändert die Kategoriezugehörigkeit zur Laufzeit. `error`/`warning`/`info` (zusammen mit `type="add"`) tragen keinen Feldwert, sondern einen Klartext-Hinweis für den Spieler (siehe unten). |
| `value` | Zahl/Text | Der anzuwendende Wert. Bei `append`/`prepend` der anzufügende Text. |
| `join` | Text (optional, nur `append`/`prepend`) | Trennzeichen zwischen dem bestehenden Namen und dem angehängten/vorangestellten Text. **Wird verbatim übernommen, nicht angenommen** — reale Kataloge nutzen neben einem einfachen Leerzeichen auch NBSP (`&#160;`) und `"&#160;+&#160;"`. Fehlt das Attribut, wird ohne Trennzeichen zusammengefügt (siehe den Widerspruchs-Kasten unten). |

> **Widerspruch zum Wiki (`append` ohne `join`):** Das Wiki behauptet für `Append`: *„A space is
> implicitly added between `Field` and `Value`"*
> ([*Data structure overview*](bsdata-catalogue-development-wiki/Data-structure-overview.md),
> Abschnitt *Modifier*). Hier gilt die Entscheidung dieses Dokuments: **Fehlt `join`, wird ohne
> Trennzeichen zusammengefügt** — kein implizites Leerzeichen. Die Engine folgt dieser Semantik
> (`src/evaluator/modifiers.js`: fehlendes `join` ⇒ leerer Trenner). Beleg aus den im Repo
> eingefrorenen Definitive-Edition-Katalogen (`src/evaluator/__fixtures__/whfb6-definitive/`,
> 4 `.cat` + 1 `.gst`; 62 `join`-Vorkommen insgesamt, davon 6 wirkungslos an
> `set`-Modifiern): 56 von 57 `append`-Modifiern setzen `join` explizit (Leerzeichen, NBSP oder
> `"&#160;+&#160;"`) — dort ist der Unterschied latent. Der eine `append` ohne `join`
> (`Mercenaries`, `<modifier type="append" value="*" field="name"/>`) macht ihn sichtbar:
> nach dieser Entscheidung wird `*` direkt angefügt (`Name*`), nach dem Wiki mit Leerzeichen
> (`Name *`).

> **Nicht offiziell spezifiziert (`multiply`, `prepend`, `join`):** Diese drei Konstrukte sind in
> keiner bekannten `BSData/schemas`-Version definiert — geprüft bis einschließlich der
> unveröffentlichten `vNext`-Version. Sie werden dennoch vom BattleScribe-Referenzprogramm
> akzeptiert und von aktiv gepflegten Datensätzen (Lexicanum Imperialis' „Definitive Edition")
> real genutzt. Die vendorte `Catalogue.xsd` dieses Projekts wurde deshalb bewusst und dokumentiert
> um sie erweitert (siehe [ADR 0016](adr/0016-battlescribe-xsd-als-vendored-konformitaetsquelle.md),
> Revision 2026-07-19).

**`field="error"`/`"warning"`/`"info"` — Klartext-Hinweise an den Spieler.** Ein `modifier
type="add" field="error"` (analog `"warning"`/`"info"`), dessen `<conditions>`/`<conditionGroups>`
zutreffen, ist kein Wert-Modifier, sondern eine kontextabhängige Nachricht an den Spieler — `value`
trägt den Nachrichtentext. `error` verhält sich wie ein regulärer Regelverstoß (blockiert die
Roster als ungültig); `warning`/`info` sind rein informativ. Beispiel (Bretonnia/Dark Elves):

```xml
<modifier type="add" value="Please enable &quot;Allow special characters?&quot;" field="error">
  <conditions>
    <condition type="lessThan" value="1" field="selections" scope="force"
               childId="8923-5946-7b10-8957" shared="true" includeChildSelections="true"/>
  </conditions>
</modifier>
```

Ein Modifier kann **bedingt** (`<conditions>` / `<conditionGroups>`) und/oder **wiederholend**
(`<repeats>`) sein.

#### `condition` — eine Voraussetzung

| `condition`-Attribut | Bedeutung |
|----------------------|-----------|
| `type` | Vergleich: `lessThan`, `greaterThan`, `equalTo`, `notEqualTo`, `atLeast`, `atMost`, `instanceOf`, `notInstanceOf`. |
| `field` | Was verglichen wird — z. B. `selections`, eine Kostenart oder `limit::<costTypeId>` (das **Kostenlimit** der Roster). |
| `scope` | Bezugsrahmen (`roster`, `force`, `parent`, …) — dazu `unit` (die umschließende Einheit) und `ancestor` (die Vorfahrenkette, nur mit `instanceOf`/`notInstanceOf`), siehe den [Kasten unten](#scope-unit-ancestor), sowie `primary-catalogue`, das Armeebuch des umschließenden Kontingents ([Kasten in §7.6](#scope-primary-catalogue)). |
| `childId` | *Was* gezählt wird: eine Ziel-ID, ein Typ-Keyword (`model`, `unit`, `upgrade`) oder `any`. |
| `value` | Vergleichswert. |
| `percentValue` | `true`/`false` — ob `value` als **Prozentsatz** des im Rahmen gezählten Nenners zu lesen ist (die XSD trägt das Attribut an der gemeinsamen `QueryBase`, es gilt also für Constraint, Condition und Repeat gleichermaßen; gleiche Nenner- und Rundungskonvention wie bei Prozent-Grenzen, [§7.6](#76-constraint)). Bei `instanceOf`/`notInstanceOf` ohne Wirkung (Wiki: *„has no effect"*). |
| `shared` | Ob über alle Instanzen des Eintrags im Roster gezählt wird (`true`) oder nur über die eine Instanz, an der die Condition hängt (`false`). Vorgabewert laut XSD ist `true`. |
| `includeChildSelections` | Wenn `true`, werden auch **unterhalb** des Scope-Ziels verschachtelte Auswahlen mitgezählt, nicht nur dessen direkte Kinder (BattleScribe `QueryBase`-Attribut). |

> **Domänenregel (Kategorie-Zähler, Ziel-Typ-Regel):** Zählt eine Query ein Kategorie-Ziel
> (z. B. „maximal 3 Helden"), werden die Kategorie-Zähler **über alle Forces hinweg aggregiert**
> ausgelesen — nicht isoliert pro Force. Das gilt **einheitlich für alle Query-Arten** (Constraint,
> Condition, Repeat): das Datenformat (XSD `QueryBase`) unterscheidet `scope` nicht nach Query-Art,
> also entscheidet der **Ziel-Typ** den Bezugsrahmen — ein `scope="force"`-Eintragsziel zählt pro
> Detachment, ein Kategorie-Ziel armeeweit. Sonst schlagen dynamische Limits fehl, sobald dieselbe
> Kategorie in mehreren Detachments vorkommt. Umgesetzt an genau einer Stelle (`resolveScopeAnchor`,
> ADR 0029).

> **`instanceOf`/`notInstanceOf` gegen eine `forceEntry` — zwei Kodierungen.** Eine Condition, die
> prüft „ist das Kontingent eine Instanz dieses Detachments" (z. B. eine armeespezifische Variante),
> kann die `forceEntry`-Id auf **zwei** Wegen benennen, und beide kommen real vor:
> - **Selbst-gegatet:** die Id steht direkt in `scope` (`scope="<forceId>"`), `childId` bleibt leer
>   oder trägt `"any"` — so gatet in den Fixture-Katalogen das Orcs-and-Goblins-Sonderheer
>   „Mountain or Troll Country Waaagh!" seine Regeln (`scope="<forceId>" childId="any"`). Das
>   „eigene Punktelimit" aus [§5.6](#56-force-entries-detachments) nutzt dagegen die
>   **kanonische** Kodierung (`scope="force"` + eigene Id in `childId`), wie die realen
>   Vampire-Counts-Sonderheere belegen.
> - **Kanonisch:** `scope="force"` trägt das Literal-Keyword, die Id steht in `childId`
>   (`scope="force" childId="<forceId>"`) — so gatet die „Definitive Edition" z. B. ihre
>   Standard-vs.-Ironskin-Tribe-Regeln (`notInstanceOf` Ironskin Tribe).
>
> Beide bedeuten dasselbe. Die Auswertung erkennt eine `forceEntry`-Instanz-Prüfung daran, dass
> `scope` **oder** `childId` auf eine reale `forceEntry`-Id auflöst (das Literal `"force"` tut das
> nicht) — sonst fiele die kanonische Form fälschlich in die selektionsweise Zählung zurück.

<a id="scope-unit-ancestor"></a>

> **`scope="unit"` und `scope="ancestor"` — die umschließende Einheit und die Vorfahrenkette.**
> Das Wiki zählt `ancestor` in der Scope-Aufzählung auf (gültig nur mit
> `instanceOf`/`notInstanceOf`), beschreibt seine Semantik aber nicht; `unit` ist upstream gar
> nicht dokumentiert. Reale Kataloge nutzen beide (Fixture-Kataloge der Definitive Edition:
> `scope="unit"` 130×, `scope="ancestor"` 10×). Aus den Daten belegt und in Issue 086
> entschieden:
>
> - **`unit` ist ein regulärer Zählrahmen:** der nächste Vorfahre — den Träger der Query
>   **eingeschlossen** — mit `type="unit"`; steht die Einheit per `entryLink` im Baum, zählt der
>   rohe Typ ihres transitiv aufgelösten Ziels (dieselbe Erb-Regel wie beim Typ-Keyword-Zählen,
>   Issue 078). Das idiomatische Muster ist der **Kostenaufschlag je Modell** (Mercenaries):
>   `<repeat field="selections" scope="unit" childId="model"/>` an einer Option zählt die Modelle
>   der umschließenden Einheit. Ohne umschließende Einheit wertet die Engine fail-closed
>   (`unresolvedScope`) statt still zu raten.
> - **`ancestor` ist kein Zählrahmen**, sondern — wie `primary-catalogue` — eine Prüfung: eine
>   `instanceOf`-Condition hält genau dann, wenn **irgendein** Vorfahre der tragenden Auswahl
>   (die gesamte strikte Kette, Kontingente eingeschlossen) auf die `childId` auflöst —
>   über seine Definitions-Id, seine Link-Ziel-Id, eine seiner **effektiven** Kategorien oder
>   seinen rohen Typ; `notInstanceOf` invers. Alle 10 Fixture-Vorkommen benennen
>   **Kategorie-Ids** („Characters", „Battle standard bearer", „Slaanesh [DARK ELVES]") — die
>   Prüfung braucht also die effektiven Kategorien, nicht nur Definitions-Ids. Die Zähl-Flags
>   (`shared`, `includeChild…`) sind ohne Wirkung: eine Vorfahrenkette wird durch eine Instanz
>   nicht enger.

#### `conditionGroup` — Verknüpfung mehrerer Bedingungen

Gruppiert Bedingungen mit `type="and"` oder `type="or"` zu komplexer Logik.

#### `repeat` — Modifier mehrfach anwenden

Ähnlich einer Condition, bewirkt aber, dass der Modifier **mehrfach** angewendet wird (z. B. „+1
Slot je 1000 Punkte"). Attribute u. a. `repeats` (wie oft pro Treffer), `roundUp` und
`percentValue` (die Schrittweite `value` als Prozentsatz des Rahmen-Nenners, wie bei der
Condition oben).

#### Vollständiges Beispiel (aus dem `.gst`, Force „Standard")

Der erlaubte Maximalwert der Kategorie **Core** skaliert mit dem Punktelimit der Armee. Der Modifier
adressiert per `field="9636-e6ed-b522-1f4a"` die **`id` eines Constraints** und ändert dessen Wert
abhängig vom Kostenlimit `limit::ecfa-8486-4f6c-c249` (der pts-Kostenart):

```xml
<categoryLink id="a87e-de8e-ade8-cae0" name="Core" targetId="64bf-efb4-9978-26df" primary="false">
  <modifiers>
    <!-- +1 (increment) wenn 2000–2999 Punkte -->
    <modifier type="increment" field="9636-e6ed-b522-1f4a" value="1.0">
      <conditions>
        <condition field="limit::ecfa-8486-4f6c-c249" scope="roster" type="greaterThan"
                   value="1999.0" childId="model"
                   percentValue="false" shared="true"
                   includeChildSelections="false" includeChildForces="false"/>
      </conditions>
      <conditionGroups>
        <conditionGroup type="and">
          <conditions>
            <condition field="limit::ecfa-8486-4f6c-c249" scope="roster" type="lessThan"
                       value="3000.0" childId="model" … />
          </conditions>
        </conditionGroup>
      </conditionGroups>
    </modifier>

    <!-- setze auf 6 und wiederhole je 1000 Punkte, ab 5000 Punkten -->
    <modifier type="set" field="9636-e6ed-b522-1f4a" value="6.0">
      <repeats>
        <repeat field="limit::ecfa-8486-4f6c-c249" scope="roster" value="1000.0"
                childId="model" repeats="1" roundUp="false"
                percentValue="false" shared="true"
                includeChildSelections="false" includeChildForces="false"/>
      </repeats>
      <conditions>
        <condition field="limit::ecfa-8486-4f6c-c249" scope="roster" type="greaterThan"
                   value="4999.0" childId="model" … />
      </conditions>
    </modifier>
  </modifiers>
</categoryLink>
```

Lesart: „Wenn das Punktelimit zwischen 2000 und 2999 liegt, erhöhe die Core-Obergrenze um 1; ab 5000
Punkten setze sie auf 6 und erhöhe je weitere 1000 Punkte."

Ein Modifier kann auch `field="hidden"` setzen, um Einträge/Kategorielinks kontextabhängig ein- oder
auszublenden (in diesem Projekt ausgewertet von `src/solver/entryVisibility.js`).

---

## 8. Kategorien & Sichtbarkeit

- **`primary="true"`** bestimmt den **Anzeige-Bucket** in der Roster-UI (genau eine pro Eintrag).
- **`primary="false"`** sind unsichtbare Tag-Kategorien für die Validierung.
- **`hidden`** blendet eine Entität aus; per Modifier `field="hidden"` kann die Sichtbarkeit
  **dynamisch** werden (z. B. „Reittier X nur sichtbar, wenn Held Y gewählt"). Die Min-Grenzen
  einer effektiv versteckten Entität werden **nicht** validiert — die §5.6-Regel, per
  Projektentscheidung (Issue 0088) verallgemeinert auf alle Ankerarten; wird die Entität per
  Modifier wieder sichtbar, greifen sie wieder. Max-Grenzen gelten unabhängig von der Sichtbarkeit.
- **Laufzeit-dynamische Kategoriezugehörigkeit.** Die Kategorie-Links eines Eintrags sind nicht
  zwingend statisch: Modifier mit `type="add"`/`type="remove"` und `field="category"` fügen eine
  Kategoriezugehörigkeit bedingt hinzu bzw. entfernen sie, und `type="set-primary"`/`type="unset-primary"`
  schalten das `primary`-Flag eines Kategorie-Links kontextabhängig um. **Sämtliche** kategorie-abhängige
  Logik muss deshalb die **effektiven** (nach Modifier-Anwendung gültigen) Kategorie-Links auswerten, nicht
  die rohen Katalog-Links — sowohl die Zähler-/Validierungs-Logik (via `getEffectiveCategoryLinks` in
  `src/solver/modifierEvaluator.js`) als auch die **UI-Einsortierung** (Aushebe-Dialog,
  Sektions-Sichtbarkeit, armeeweite Selektoren; via `getEffectiveEntryCategoryLinks` /
  `isEntryPrimaryInCategory` in `src/solver/entryVisibility.js`). Ein häufiger Fall: ein Katalog importiert
  per `entryLink` eine Einheit aus einem verlinkten Bibliothekskatalog und gliedert sie per `set-primary`
  in eine eigene Kategorie um — würde nur der statische Link gelesen, verschwände die Einheit aus der UI.
- Beziehungen zwischen Einträgen und Kategorien werden **ausschließlich über `categoryLinks`/IDs**
  aufgelöst — nie über Namen.

Von der „keine hartkodierten Sprach-Strings"-Regel gibt es **keine Ausnahme**.

---

## 9. Häufige Muster (Common Catalogue Patterns)

### 9.1 Mehrere Standardauswahlen in einer Gruppe

*(Aus dem Wiki: „Multiple Defaults in a Group".)*

**Problem:** Eine Einheit soll standardmäßig **mehrere** Optionen einer Gruppe geladen haben (Beispiel
im Wiki: ein *T'au Empire Commander* startet mit 2 Waffen).

**Lösung:** Die Gruppe selbst setzt **kein** `defaultSelectionEntryId`. Stattdessen bekommen die
einzelnen Einträge je ein `min="1"`-Constraint. BattleScribe wählt beim Erzeugen automatisch die
Einträge, die ihr Minimum erfüllen (z. B. Burst Cannon + Missile Pod), und hört danach auf, diese
Constraints zu erzwingen, weil Modifier ins Spiel kommen. So entstehen faktisch mehrere Defaults,
ohne einen expliziten Gruppen-Default zu setzen.

### 9.2 Ausrüstungswahl „wähle genau 1" (Radiobutton)

Eine `selectionEntryGroup` mit `max="1"` erzwingt exklusive Wahl. Kombiniert mit `min="1"` wird die
Wahl zur Pflicht. Beachte: `max="1"` bedeutet hier **exklusive Alternative**, nicht „höchstens 1
Stück eines zählbaren Dings". Beispiel siehe [§7.1](#71-selection-entry--selection-entry-group).

### 9.3 Kosten am Link statt an der Definition

Dieselbe geteilte Waffe kostet je nach Träger unterschiedlich viel, weil das `<cost>` **am
`entryLink`** hängt — siehe „Spear (Mounted)" in [§3.2](#32-referenzen-statt-einbettung) und „Light
Armour" in [§7.2](#72-entry-link-info-link-category-link).

### 9.4 Punkte-Budget als Constraint

Ein `constraint`, dessen `field` eine **Kostenart-ID** ist (statt `selections`), begrenzt die *Summe*
dieser Kosten — z. B. „max. 100 Punkte magische Gegenstände" ([§7.6](#76-constraint)).

Summiert werden die Kosten **unterhalb des Trägers**: die Auswahlen im Bezugsrahmen, die unter dem
Eintrag (bzw. unter den Mitgliedern der Gruppe) hängen, den die Grenze trägt. `includeChildSelections`
entscheidet wie überall über die *verschachtelten* Auswahlen — mit `true` zählt auch der Gegenstand
mit, der an einem magischen Gegenstand hängt, mit `false` gilt die engere Lesart „just `scope`'s
`field`". Ein Träger mit eigenen Kosten bringt diese in seine Summe ein (Issue 091).

### 9.5 Grenzen, die mit dem Punktelimit skalieren

Slots pro Kategorie werden über `modifier` + `condition`/`repeat` an `limit::<costTypeId>` gekoppelt
([§7.7](#77-modifier-condition-condition-group-repeat)). Das ist das idiomatische Muster für
„X Core-Einheiten pro 1000 Punkte".

### 9.6 „Wer darf ein Reittier / General sein" über Tag-Kategorien

Statt Namen zu prüfen, bekommt ein Eintrag eine `primary="false"`-Kategorie (z. B. „kann General
sein"), und ein Constraint/Condition auf dieser Kategorie-ID setzt die Regel um — vollständig
sprachneutral ([§5.5](#55-category-entries-kategorien)).

### 9.7 Mehrfach erlaubte Gegenstände in einer `max="1"`-Gruppe (Dispel Scroll etc.)

Magische Gegenstände liegen typischerweise in Gruppen mit `max="1"` (z. B. „Arcane Items" — sonst
Radiobutton-Semantik, siehe [§9.2](#92-ausrüstungswahl-wähle-genau-1-radiobutton)). Für Gegenstände,
von denen man **mehr als einen** nehmen darf (klassisch *Dispel Scroll*, *Power Stone*, Skaven
*Warpstone Token/Scroll*), hebt ein **`increment`-Modifier mit `<repeat>`** die Obergrenze der Gruppe
**pro gewähltem Exemplar** wieder an — der Nettoeffekt ist „zählt nicht gegen das 1-Item-Limit":

```xml
<selectionEntryGroup name="Arcane Items">
  <modifiers>
    <modifier type="increment" field="8c44-…-max" value="1.0">
      <repeats><repeat field="selections" scope="parent" childId="…dispel-scroll…" repeats="1"/></repeats>
      <conditions><condition field="selections" scope="parent" childId="…dispel-scroll…" type="greaterThan" value="0"/></conditions>
    </modifier>
  </modifiers>
  <constraints><constraint id="8c44-…-max" field="selections" scope="parent" type="max" value="1"/></constraints>
  …
</selectionEntryGroup>
```

Erkennung: ein `increment`-Modifier, dessen `field` die **`id` eines `max`-Constraints der Gruppe** ist
und dessen `<repeat>`-`childId` (bzw. `field`) auf **genau diesen Eintrag** zeigt. Solche Einträge
müssen als **Mengen-Stepper** (nicht Radio) gerendert und aus der Radio-Exklusivität ausgenommen
werden (`src/components/editor/OptionGroup.jsx`).

Zwei Fallstricke:

- Der `childId` von `<repeat>`/`condition` kann die **Ziel-ID** (`entryLink.targetId`, hier die
  gemeinsame `.gst`-ID von Dispel Scroll) *oder* die lokale Link-ID sein — beim Zählen beide Fälle
  über `resolveEntry` abgleichen.
- Die `scope="parent"`-**Condition** muss auch dann greifen, wenn kein `parentSelection` existiert
  (Validierung einer **Top-Level-Einheit**): dort ist die Einheit selbst der Bezugs-Parent. Sowohl
  `evaluateCondition` als auch die `repeat`-Auswertung fallen deshalb auf `ctx.selection` zurück —
  sonst feuert der Modifier nur in der Editor-Vorschau, aber nicht im Regel-Check.

**Wrapper-Eintrag:** Power Stone ist zusätzlich ein **Wrapper** (Kosten 0) mit einem einzelnen
zählbaren Kind („Power Stones" mit `min="1"`/`max="4"`) — die Stückzahl pro Wrapper wird also im
Unter-Bereich gesteuert, während der oben beschriebene Modifier den Wrapper aus der Radio-Exklusivität
der Gruppe löst.

**Daten-Inkonsistenz (bewusst behoben):** Im BSData-`whfb6`-Satz erhielt **nur Dispel Scroll** in
allen Katalogen diesen Modifier; **Power Stone** hatte ihn nur in *Dogs of War* und *Vampire Counts*.
In den übrigen 13 Katalogen blieb Power Stone dadurch fälschlich eine exklusive Radio-Wahl (obwohl die
Regeln beliebig viele Power Stones erlauben). Der fehlende Modifier wurde deshalb in allen betroffenen
`Arcane Items`-Gruppen ergänzt (analog zum Vampire-Counts-Muster: zweiter `<modifier>` auf derselben
`max`-Constraint-`id`, `childId="0ed5-eacf-d55a-5e9e"`). Neu importierte Community-Kataloge können
dieselbe Lücke mitbringen — dann ist es dieselbe Daten-Ergänzung, kein App-Bug.

### 9.8 Bedingter Modifier auf ein Gruppen-Max/Min (an eine andere Auswahl oder einen Scope gekoppelt)

**Abgrenzung zu [§9.7](#97-mehrfach-erlaubte-gegenstände-in-einer-max1-gruppe-dispel-scroll-etc):** §9.7
behandelt „mehrere Stück **desselben** Items" — ein `increment`-Modifier **mit `<repeat>`**, dessen
`<repeat>` auf **genau den einen Eintrag** zeigt, hebt die Gruppen-Kappe je gewähltem Exemplar. Das ist
das Signal „dieses eine Item ist zählbar" (→ Mengen-Stepper), **nicht** „die Gruppe erlaubt mehrere
**verschiedene** Optionen".

Hier geht es um das andere Muster: ein `modifier` verändert das **Max (oder Min) einer ganzen
`selectionEntryGroup`** bedingt — gekoppelt an eine **andere** Auswahl (ein Geschwister-Item, eine
Kategorie) oder einen **Scope** (z. B. eine Rolle wie *Battle Standard Bearer*). Es ist **kein**
`<repeat>` im Spiel; die Gruppe wird dadurch inhärent mehr- oder weniger-wählbar. Die Katalog-Daten sind
korrekt — das effektive Limit ist schlicht kontextabhängig.

Das kanonische Beispiel ist **Rüstung + Schild**: Eine Rüstungsgruppe hat `max="1"`, trägt aber einen
`increment`-Modifier auf **die Gruppen-Max-Constraint selbst**, dessen `condition` an die Schild-Auswahl
gekoppelt ist. Ohne Schild ist das effektive Max 1, mit Schild 2 — genau so lassen sich eine Rüstung
**und** ein Schild kombinieren (Referenz-Tools zeigen dann „2/2"):

```xml
<selectionEntryGroup id="…" name="Armour">
  <modifiers>
    <!-- +1 auf die Gruppen-Max, wenn in dieser Gruppe ein Schild gewählt ist -->
    <modifier type="increment" field="3abf-ef75-7480-0e27" value="1">
      <conditions>
        <condition type="equalTo" field="selections" scope="parent"
                   childId="<Shield-Id>" value="1" includeChildSelections="true"/>
      </conditions>
    </modifier>
  </modifiers>
  <constraints>
    <constraint id="3abf-ef75-7480-0e27" field="selections" scope="parent" type="max" value="1"/>
  </constraints>
  …
</selectionEntryGroup>
```

Der Modifier kann auch **direkt am `entryLink` der koppelnden Option** hängen statt an der Gruppe — dann
gilt er nur, wenn diese Option gewählt ist (im `whfb6`-Satz z. B. *Enchanted Shield* in *Vampire Counts*,
ein `set`/`increment` auf die `max`-`id` der „Magic Armour"-Gruppe). Der Nettoeffekt ist derselbe.

**Verwandte Klassen desselben Musters** (durchgängig in fast allen Armeebüchern beider Forks belegt):

| Klasse | Wirkung auf das effektive Gruppen-Limit | UI-Konsequenz |
|--------|------------------------------------------|----------------|
| Max **hebend** (Rüstung+Schild) | `max` 1 → 2, wenn eine gekoppelte Option gewählt ist | Mehrfachauswahl (siehe Regel unten) |
| Max **senkend** (umgekehrt) | `max` 2 → 1 (z. B. Waffen bei *Battle Standard Bearer*) | gegenseitiger Ausschluss (Radio) |
| Max **auf 0** | `max` → 0 (Gruppe bedingt deaktiviert) | Gruppe nicht mehr wählbar |
| Min **erhöht** | `min` 0 → N (bedingte Pflichtwahl) | Gruppe wird zur Pflicht |

#### Abgeleitete UI-Regel: „Max-hebbar ⇒ Mehrfachauswahl mit Zähler"

Die Radio-vs-Checkbox-Entscheidung einer Gruppe darf sich **nicht** am rohen Katalog-`max` und **auch
nicht** am *aktuellen* effektiven Max festmachen, sondern daran, ob ein Modifier das Max über 1 **heben
kann**:

- Kann irgendein (nicht-`<repeat>`) Modifier das Gruppen-Max über 1 heben, rendert die Gruppe als
  **Mehrfachauswahl mit Live-Zähler** (`N/M`, wie NewRecruit „2/2") — **schon bevor** die Bedingung
  erfüllt ist. Andernfalls entstünde ein **Teufelskreis**: ohne Schild wäre das Max 1 → Radio → das
  Schild ließe sich nie stabil anwählen, um die Bedingung zu erfüllen.
- Nur eine **echt fix auf `max=1` gedeckelte** Gruppe **ohne** solchen Modifier bleibt gegenseitig
  ausschließendes **Radio** (klassische „wähle genau 1"-Wahl, [§9.2](#92-ausrüstungswahl-wähle-genau-1-radiobutton)).
- Der **senkende** Fall und die **Deaktivierung** leiten sich dagegen aus dem *aktuellen* effektiven Max
  ab: Sinkt es auf 1, greift Ausschluss; sinkt es auf 0, ist die Gruppe gesperrt.
- Das `increment`+`<repeat>`-Stepper-Muster ([§9.7](#97-mehrfach-erlaubte-gegenstände-in-einer-max1-gruppe-dispel-scroll-etc))
  bleibt davon **unberührt** — es wird gesondert erkannt und als Mengen-Stepper gerendert.

**Umsetzung:** Die statische „hebbar?"-Erkennung liefert `canGroupMaxBeRaisedAboveSingleChoice`
(`src/solver/modifierEvaluator.js`, über die Fassade `src/solver/validator.js`); die *aktuellen*
effektiven Werte liefern `getModifiedConstraintValue` / `getEffectiveConstraintLimit`. Sämtliche
Auswahl-, Anzeige- und Recruit-/Autofill-Entscheidungen (Radio/Checkbox/Binär/Mandatory, der angezeigte
„Max/Min: N", die Count-Klammerungen, `isOptionRosterUnique`, die Solver-Min-Sites) leiten sich aus
diesen **effektiven** Werten ab — kein roher Constraint-Wert steuert mehr eine dieser Entscheidungen
(`src/components/editor/OptionGroup.jsx`, `SelectionConfigurator.jsx`, `AutoFillSuggestions.jsx`).

### 9.9 Armeeweite Pflichteinheit (`min`-Constraint auf einem Wurzeleintrag)

**Problem:** Eine Armee **muss** mindestens eine Einheit eines bestimmten Typs enthalten (klassisch
Ogre Kingdoms: „mindestens eine Ogerbullen-Einheit"). Die Pflicht gilt, auch wenn die Einheit im
Roster **ganz fehlt** — die eintragsweise Constraint-Prüfung sieht aber nur Auswahlen, die bereits
liegen, und würde eine komplett fehlende Pflichteinheit übersehen.

**Lösung:** Ein **Wurzeleintrag des Katalogs** trägt einen `min`-Constraint mit `scope="roster"`
(armeeweit, über alle Detachments zusammen) oder `scope="force"` (pro Detachment). Zwei Kodierungen
kommen real vor und meinen dasselbe:

- **Als `selectionEntry`:** der Constraint hängt direkt am Wurzel-`selectionEntry` (alter
  `whfb6`/ergofarg-Satz: der „Bulls"-Eintrag trägt `min scope="roster" value="1"`).
- **Als `entryLink`:** der Katalog referenziert die geteilte Einheit als Wurzel-`entryLink`, und der
  Constraint hängt **am Link** — Basis `min="0"`, per Link-`modifier` (gegatet auf die Armeevariante,
  siehe [§7.7](#77-modifier-condition-condition-group-repeat)) auf 1 angehoben. So codiert die
  „Definitive Edition" die Ogerbullen-Pflicht (Standard = 1, Ironskin Tribe = 0).

**Auswertung:** Beide Wurzelformen — `selectionEntry` **und** `entryLink` — werden eingesammelt und
gegen die armeeweite bzw. kontingentweite Zählung geprüft; fehlt die Zieleinheit ganz, entsteht ein
blockierender Verstoß (`roster-selector-min` bzw. `force-selector-min`). Bei der `entryLink`-Form
werden die **Constraint und die Modifier des Links** ausgewertet (nicht die des Ziels), damit die
bedingte Anhebung greift; das Ziel wird nur zur Namensauflösung aufgelöst. Führte ein Katalog
dieselbe Pflicht in beiden Formen, wird sie über die Ziel-Id entdoppelt (genau ein Verstoß).

---

## 10. Collective Entries

*(Aus dem Wiki: „Collective Entries" / „Help: Collective Entries".)*

Das `collective`-Flag auf einem Eintrag hat **zwei** Funktionen:

1. **Gruppierung identischer Auswahlen.** Sind alle Kinder eines Eintrags `collective`, werden sie
   zu **einer einzigen Roster-Zeile** zusammengefasst statt pro Modell einzeln gelistet. Die
   Einheiten-Auswahl wechselt dann von einem „Add"-Button zu einem **Spinner** (Mengenauswahl).

   > *Beispiel:* Soldaten sind einheitlich mit Gewehr und Messer ausgerüstet → beide Items
   > `collective` markieren → sie kollabieren zu einer Zeile.

2. **Synchronisierte Auswahl.** Eltern-Einträge, die sich einen gemeinsamen Elternknoten teilen,
   müssen konsistente Auswahlen haben. Wählt eine Instanz die Option, müssen es alle tun.

   > *Beispiel:* Ninjas mit individuellen Ausrüstungsoptionen → „Climbing Claws" `collective` →
   > wählt ein Ninja sie, müssen alle Ninjas des Trupps sie nehmen.

> ⚠️ **Warnung (aus dem Wiki):** Funktion 2 kann unerwünschte Kaskaden auslösen. Würde man z. B.
> „Soldaten" als `collective` markieren, würden **alle** Infanterie-Einheiten einer Force ihre
> Soldaten-Auswahl automatisch angleichen, sobald man eine ändert — meist unerwünscht. `collective`
> also gezielt und bewusst einsetzen.

> **Für die Auswertung wichtig:** `collective` beeinflusst nur die *Darstellung* gestapelter
> Instanzen — die Kosten- und Constraint-Mathematik (`child.number * parent.number`) läuft immer
> durch (siehe [§7.5](#75-cost--cost-type)).

---

## 11. Best Practices

### 11.1 Die drei Grundregeln (Catalogue Guidelines)

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

### 11.2 Datenmodellierung

- **Nie über Namen referenzieren** — immer über IDs / `categoryLinks`.
- **Keine armeespezifische Sonderlogik** — alle Regeln generisch über das Datenmodell abbilden.
- **Kosten an den Link** hängen, wenn dasselbe Item unterschiedlich viel kostet.
- **Optionale Upgrades** nicht automatisch auf die Einheit aufaddieren, solange nicht gewählt.
- **`min=1`+`max=1`** für „genau eins"; **`max=1`-Gruppe** für exklusive Wahl.
- **Constraint-`id`s** stabil halten — Modifier adressieren Constraints über ihre `id`.

### 11.3 Repository-Hygiene (Data Author Guide)

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

### 11.4 Windows-Fallstrick

Dateinamen mit Doppelpunkt (`:`) verursachen unter Windows Probleme. Das betrifft Kataloge, deren
Name einen `:` enthält — im Zweifel vermeiden bzw. den dokumentierten git-Workaround nutzen.

---

## 12. Workflow: Erstellen, Versionieren, Veröffentlichen

*(Aus Data Author Guide / Getting Started.)*

### 12.1 Werkzeuge

- **BattleScribe Data Editor** (bzw. der **New Recruit Editor**, <https://www.newrecruit.eu/download/>) —
  bearbeitet die Datendateien in einer grafischen Oberfläche, sodass man das rohe XML (oft hunderte
  Zeilen) nicht von Hand editieren muss.
- **GitHub Desktop** oder ein beliebiger git-Client.
- Ein **Daten-Repository auf GitHub** (eigenes oder ein Fork).

### 12.2 Mitwirken

- **Aktive Repos:** Repo **forken**, Änderungen machen, als **Pull Request** einreichen — vorab die
  Maintainer kontaktieren, um Doppelarbeit zu vermeiden.
- **Weniger aktive Repos:** Nach Absprache Schreibrechte anfragen und direkt committen.

### 12.3 Entwicklungszyklus

1. Repo als „Current repository" wählen, **synchronisieren** (immer auf der neuesten Version
   arbeiten!).
2. Issues durchsehen (Labels/Milestones filtern) oder ein neues Issue anlegen.
3. Bearbeiten. Zum Reverse-Engineering ruhig bei etablierten Repos abschauen, wie Bedingungen/
   Modifier dort umgesetzt sind.
4. Auf Fehler prüfen, `revision` hochzählen.
5. Committen — im Commit die **Issue-Nummer erwähnen** (`Goblin fix #1234`); Keywords wie
   `closes #93` schließen das Issue automatisch.
6. **Synchronisieren** — erst dadurch landen die Änderungen auf GitHub.

### 12.4 Releasing & Versionierung

Nutzer mit Auto-Update-Link laden das **letzte Release** (ein getaggter Stand). Konvention `vMAJOR.MINOR.PATCH`:

- **MAJOR** — ändert sich selten (neues Regelbuch / grundlegend Neues für alle).
- **MINOR** — mehr als nur Bugfixes/Kleinkram (z. B. neuer Katalog). Setzt PATCH auf 0 zurück.
- **PATCH** — häufigste Änderung (Bugfixes). Ein Release „kostet nichts" außer einer Minute.

> Nach einem Release kann es **bis zu ~12 Stunden** dauern, bis der Daten-Cache der
> Auslieferungsinfrastruktur aktualisiert und das Update für die Nutzer verfügbar ist.

---

## 13. Referenztabellen

### 13.1 Wichtige Enum-Werte

| Kontext | Attribut | Werte |
|---------|----------|-------|
| `selectionEntry` | `type` | `unit`, `model`, `upgrade` |
| `entryLink` | `type` | `selectionEntry`, `selectionEntryGroup` |
| `infoLink` | `type` | `profile`, `rule`, `infoGroup` |
| `constraint` | `type` | `min`, `max` |
| `constraint` | `field` | `selections`, `forces`, *`<costTypeId>`* |
| `constraint`/`condition`/`repeat` | `scope` | `parent`, `roster`, `force`, `category`, `self`, `unit`, `ancestor` (nur `condition`, [§7.7](#scope-unit-ancestor)), `primary-catalogue` ([§7.6](#scope-primary-catalogue)) |
| `modifier` | `type` | `increment`, `decrement`, `set`, `append`, `prepend`, `multiply`, `add`, `remove`, `set-primary`, `unset-primary` (`prepend`/`multiply` ohne offiziellen Schema-Beleg, siehe [§7.7](#77-modifier-condition-condition-group-repeat)) |
| `modifier` | `field` | Constraint-`id`, `<costTypeId>`, `hidden`, `name`, `category`, `error`, `warning`, `info`, `<characteristicTypeId>` |
| `condition` | `type` | `lessThan`, `greaterThan`, `equalTo`, `notEqualTo`, `atLeast`, `atMost`, `instanceOf`, `notInstanceOf` |
| `conditionGroup` | `type` | `and`, `or` |

### 13.2 Der `field`-Wert je nach Kontext

| Element | `field` bedeutet … | Beispielwerte |
|---------|--------------------|---------------|
| `constraint` | *was gezählt/summiert wird* | `selections`, `forces`, `<costTypeId>` |
| `modifier` | *was geändert wird* | Constraint-`id`, `<costTypeId>`, `hidden`, `name`, `category`, `error`, `warning`, `info`, `<characteristicTypeId>` |
| `condition` / `repeat` | *worauf getestet/gezählt wird* | `selections`, `<costTypeId>`, `limit::<costTypeId>` |

- `limit::<costTypeId>` = das **Kostenlimit** (Budget) der Roster für diese Kostenart.
- `childId` (auf `condition`/`repeat`) = *welche* Elemente gezählt werden: eine Ziel-ID, ein
  Typ-Keyword (`model`/`unit`/`upgrade`) oder `any`.

### 13.3 Gemeinsame Attribute fast aller Entitäten

| Attribut | Zweck |
|----------|-------|
| `id` | eindeutige Kennung (UUID-artig) |
| `name` | Anzeigename (nicht eindeutig, nicht als Schlüssel nutzen) |
| `hidden` | Sichtbarkeit (per Modifier dynamisierbar) |
| `publicationId` + `page` | Quellenangabe |
| `revision` (nur Wurzel) | Versionszähler für Update-Erkennung |

---

## 14. Glossar

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
| **Force Entry** | Detachment/Bataillon; legt per `categoryLink` fest, welche Kategorien erlaubt sind. Force-weite Kategoriegrenzen können am `categoryLink` **oder** direkt an der `categoryEntry`-Definition (`scope="force"`) hängen (siehe [§5.6](#56-force-entries-detachments)). |
| **Collective** | Flag zur Gruppierung/Synchronisierung identischer Auswahlen. |
| **`.bsr`** | Repository-Distribution (ZIP mit Index + Katalogen + Game System). |

---

## 15. Lücken der Quelle

Wo das Wiki schweigt, gibt es keine Autorität — hier entscheidet dieses Projekt selbst, und
jede solche Entscheidung gehört begründet in ein Issue statt in eine stille Annahme. Die
Lücken, die uns bisher konkret getroffen haben:

| Lücke | Was fehlt | Wo es uns betrifft |
|-------|-----------|--------------------|
| **`.ros`-Struktur** | Die Abschnitte *Roster*, *Force* und *Selection* stehen im Wiki als `TODO`. Es gibt **keine** Aussage darüber, welche Id (`entryId`, `entryLinkId`, `entryGroupId`) die Identität einer Auswahl trägt. | Issue 076 — welche Id der Roster-Adapter binden soll |
| **Grenze am Verweis oder am Ziel** | Belegt ist nur, dass ein `entryLink` eigene `constraint`s tragen darf und dass ein Modifier am Link dessen Grenzwerte ändert. Ob eine am Link deklarierte Grenze *für den Link* oder *für das Ziel* gilt, steht nirgends. | Issue 076 |
| **`scope="primary-catalogue"`** | Die Aufzählung kennt `parent\|roster\|force\|primary category` und Vorfahren-Ids — `primary-catalogue` kommt nicht vor, obwohl reale Kataloge es verwenden. | [Der Kasten in §7.6](#scope-primary-catalogue) beschreibt die in Issue 077 aus den Daten belegte Semantik: das Armeebuch des umschließenden Kontingents, als Identitätsprüfung statt als Zählrahmen. |
| **`type` am `entryLink`** | Dass ein `selectionEntry` ein `type` (`unit\|model\|upgrade`) trägt, ist dokumentiert. Ob ein Verweis den Typ seines Ziels erbt, nicht. | Issue 078 |
| **`scope="unit"` / Semantik von `ancestor`** | `unit` fehlt in der Scope-Aufzählung des Wikis völlig; `ancestor` ist zwar aufgezählt (nur mit `instanceOf`/`notInstanceOf` gültig), seine Semantik aber nicht beschrieben. Reale Kataloge nutzen beide (130× bzw. 10× in den Fixture-Katalogen). | [Der Kasten in §7.7](#scope-unit-ancestor) beschreibt die in Issue 086 aus den Daten belegte Semantik: `unit` = die umschließende Einheit als Zählrahmen, `ancestor` = Mitgliedschaftsprüfung über die Vorfahrenkette. |
| **`value="-1"` als „unbegrenzt"** | Der Sentinel ist nicht dokumentiert — weder seine Bedeutung noch, an welchen Stellen er gilt. | [§7.6](#76-constraint) dieses Dokuments beschreibt die in Issue 079 aus den Daten belegte Semantik: `-1` = unbegrenzt nur als **hingeschriebener** Wert (Constraint-`value`, `set`-Modifierwert auf eine Grenze, `defaultCostLimit`, eingestelltes Roster-`costLimit` — Issue 0096); errechnete negative Werte sind kein Sentinel. |
| **Modifier-Typen `add`/`remove`** | Das Wiki kennt nur `Increment\|Decrement\|Set\|Append`. Reale Kataloge verwenden `add`/`remove` für Kategoriezugehörigkeit und `multiply`, `prepend`, `set-primary`/`unset-primary`. | §7.7 dieses Dokuments beschreibt sie aus den Daten, nicht aus der Quelle |

Die Seite trägt am Ende selbst den Hinweis `TODO: Update to 2.02` — sie beschreibt einen
älteren Stand als die heutigen Kataloge (Libraries, Publications, neue Gruppen).

---

*Erstellt auf Basis des offiziellen BSData Catalogue-Development-Wikis (im Repo unter
[`bsdata-catalogue-development-wiki/`](bsdata-catalogue-development-wiki/)) und realer
WHFB-6th-Edition-Kataloge. Wo das Wiki unvollständig ist (siehe §15), ist der Blick in
aktuelle, gepflegte Community-Repos die beste Referenz.*

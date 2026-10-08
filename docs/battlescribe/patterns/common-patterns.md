[BSData-Formatreferenz](../../battlescribe-data-format.md) › Praxis

# 9. Häufige Muster (Common Catalogue Patterns)

## 9.1 Mehrere Standardauswahlen in einer Gruppe

*(Aus dem Wiki: „Multiple Defaults in a Group".)*

**Problem:** Eine Einheit soll standardmäßig **mehrere** Optionen einer Gruppe geladen haben (Beispiel
im Wiki: ein *T'au Empire Commander* startet mit 2 Waffen).

**Lösung:** Die Gruppe selbst setzt **kein** `defaultSelectionEntryId`. Stattdessen bekommen die
einzelnen Einträge je ein `min="1"`-Constraint. BattleScribe wählt beim Erzeugen automatisch die
Einträge, die ihr Minimum erfüllen (z. B. Burst Cannon + Missile Pod), und hört danach auf, diese
Constraints zu erzwingen, weil Modifier ins Spiel kommen. So entstehen faktisch mehrere Defaults,
ohne einen expliziten Gruppen-Default zu setzen.

## 9.2 Ausrüstungswahl „wähle genau 1" (Radiobutton)

Eine `selectionEntryGroup` mit `max="1"` erzwingt exklusive Wahl. Kombiniert mit `min="1"` wird die
Wahl zur Pflicht. Beachte: `max="1"` bedeutet hier **exklusive Alternative**, nicht „höchstens 1
Stück eines zählbaren Dings". Beispiel siehe [§7.1](../building-blocks/selection-entry.md#71-selection-entry--selection-entry-group).

## 9.3 Kosten am Link statt an der Definition

Dieselbe geteilte Waffe kostet je nach Träger unterschiedlich viel, weil das `<cost>` **am
`entryLink`** hängt — siehe „Spear (Mounted)" in [§3.2](../overview.md#32-referenzen-statt-einbettung) und „Light
Armour" in [§7.2](../building-blocks/links.md#72-entry-link-info-link-category-link).

## 9.4 Punkte-Budget als Constraint

Ein `constraint`, dessen `field` eine **Kostenart-ID** ist (statt `selections`), begrenzt die *Summe*
dieser Kosten — z. B. „max. 100 Punkte magische Gegenstände" ([§7.6](../building-blocks/constraint.md#76-constraint)).

Summiert werden die Kosten **unterhalb des Trägers**: die Auswahlen im Bezugsrahmen, die unter dem
Eintrag (bzw. unter den Mitgliedern der Gruppe) hängen, den die Grenze trägt. `includeChildSelections`
entscheidet wie überall über die *verschachtelten* Auswahlen — mit `true` zählt auch der Gegenstand
mit, der an einem magischen Gegenstand hängt, mit `false` gilt die engere Lesart „just `scope`'s
`field`". Ein Träger mit eigenen Kosten bringt diese in seine Summe ein (Issue 091).

## 9.5 Grenzen, die mit dem Punktelimit skalieren

Slots pro Kategorie werden über `modifier` + `condition`/`repeat` an `limit::<costTypeId>` gekoppelt
([§7.7](../building-blocks/modifier.md#77-modifier-condition-condition-group-repeat)). Das ist das idiomatische Muster für
„X Core-Einheiten pro 1000 Punkte".

## 9.6 „Wer darf ein Reittier / General sein" über Tag-Kategorien

Statt Namen zu prüfen, bekommt ein Eintrag eine `primary="false"`-Kategorie (z. B. „kann General
sein"), und ein Constraint/Condition auf dieser Kategorie-ID setzt die Regel um — vollständig
sprachneutral ([§5.5](../files/game-system.md#55-category-entries-kategorien)).

## 9.7 Mehrfach erlaubte Gegenstände in einer `max="1"`-Gruppe (Dispel Scroll etc.)

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
werden (`src/ui/components/editor/OptionGroup.jsx`).

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

## 9.8 Bedingter Modifier auf ein Gruppen-Max/Min (an eine andere Auswahl oder einen Scope gekoppelt)

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

### Abgeleitete UI-Regel: „Max-hebbar ⇒ Mehrfachauswahl mit Zähler"

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

**Umsetzung:** Die statische „hebbar?"-Erkennung liefert der Bericht
(`capability.isMaxRaisable`, `src/contexts/ruleengine/engine/groupBehavior.js`); die *aktuellen*
effektiven Werte liefern `getModifiedConstraintValue` / `getEffectiveConstraintLimit`. Sämtliche
Auswahl-, Anzeige- und Recruit-/Autofill-Entscheidungen (Radio/Checkbox/Binär/Mandatory, der angezeigte
„Max/Min: N", die Count-Klammerungen, `isOptionRosterUnique`) leiten sich aus
diesen **effektiven** Werten ab — kein roher Constraint-Wert steuert mehr eine dieser Entscheidungen
(`src/ui/components/editor/OptionGroup.jsx`, `SelectionConfigurator.jsx`). Die Auffüll-Vorschläge
(`AutoFillSuggestions.jsx`) rechnen seit dem Cutover gar nicht mehr selbst: sie lesen die
**effektiven** Werte fertig aus dem Bericht der Evaluator-Fassade (ADR-0034).

## 9.9 Armeeweite Pflichteinheit (`min`-Constraint auf einem Wurzeleintrag)

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
  siehe [§7.7](../building-blocks/modifier.md#77-modifier-condition-condition-group-repeat)) auf 1 angehoben. So codiert die
  „Definitive Edition" die Ogerbullen-Pflicht (Standard = 1, Ironskin Tribe = 0).

**Auswertung:** Beide Wurzelformen — `selectionEntry` **und** `entryLink` — werden eingesammelt und
gegen die armeeweite bzw. kontingentweite Zählung geprüft; fehlt die Zieleinheit ganz, entsteht ein
blockierender Verstoß (`roster-selector-min` bzw. `force-selector-min`). Bei der `entryLink`-Form
werden die **Constraint und die Modifier des Links** ausgewertet (nicht die des Ziels), damit die
bedingte Anhebung greift; das Ziel wird nur zur Namensauflösung aufgelöst. Führte ein Katalog
dieselbe Pflicht in beiden Formen, wird sie über die Ziel-Id entdoppelt (genau ein Verstoß).

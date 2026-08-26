# E2E-Regeln & Testkatalog: Eintrags-Id im `scope` einer `greaterThan`-Condition — das Brain-transplant-Gatter der Mutant Rat Ogres

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Alle Regeln,
Constraint-Ids und Erwartungswerte sind **ausschließlich aus den Katalogdaten**
der *6th Definitive Edition* (`src/contexts/ruleengine/engine/__fixtures__/whfb6-definitive/`),
der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md),
§7.6, §7.7, §8) und der vendorten `Catalogue.xsd` abgeleitet. Die Roster-Form ist
an den bereits verifizierten Szenarien nachgebildet (direktes `entryId`,
`entryLinkId` als leeres Attribut, verschachtelte `selections` mit `number`).

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebuch: `Skaven (6th definitive edition).cat`
  (`cac6-5f02-f95d-a403`, rev 1, Z. 2) — Kontingent **„Hell Pit (WD-311)"**
  `9f0b-5346-a3bc-b5fe` (Z. 184)
- Bibliothek: `Mercenaries (6th definitive edition).cat`
  (`fc47-8392-a6c8-452a`) — per `catalogueLink` `4f16-8437-4e47-58a8`
  (Z. 11452) erklärte Abhängigkeit des Armeebuchs

Zeilenangaben ohne Dateipräfix beziehen sich auf
`Skaven (6th definitive edition).cat`.

> **Assertion-Form:** Je Roster ein `expect.capabilities[]`-Eintrag auf dem Slot
> der Einheit (`defId` = `7a4a-301b-af31-9ee0`, `frameDefId` = das Kontingent) mit
> `infoElements` / `infoElementsAbsent` — dort ist die Sichtbarkeit des
> Regel-Vorkommens `12c2-071e-1e09-5918` beobachtbar, denn wirksam verborgene
> Info-Elemente fehlen in der Projektion (Präzedenz:
> [`info-projection`](../info-projection/README.md)). Dazu ein zweiter Eintrag auf
> dem Slot der Aufwertung „Rat Ogre" mit den **Merkmalswerten** des
> Rat-Ogre-Profils und — als dritte, im Verletzungsbericht sichtbare Wirkung
> derselben Bedingung — `expect.firing`/`expect.absent` für die Pflichtgrenze
> `6fda-622a-eae1-fc61`. Die `condition` selbst ist **keine** zählende Grenze und
> taucht im Verletzungsbericht nie auf. Weitere Armeeaufbau-Diagnosen
> (General-/Core-Pflicht des Kontingents, Punktebudget) dürfen zusätzlich
> auftreten; die Erwartung ist selektiv.

---

## Die Regel (In-World)

Die *Mutant Rat Ogres* aus White Dwarf #311 (`publicationId="c085-da7d-f7c0-44c1"`,
`page="115"`) sind Zuchtexperimente von Clan Moulder. Der geteilte Regeltext
lautet (Z. 10230):

> **Loss of Packmaster Ogres** — „If all Packmasters are killed and there are no
> characters in the unit the Rat ogres suffer from Stupidity."

Nimmt ein Rat Ogre die Option **Brain transplant**, braucht er keinen Treiber
mehr: der Katalog **entfernt** die Regel von der Einheit (`set hidden="true"` auf
ihr Vorkommen), **blendet** stattdessen **Regeneration** ein, **versteckt** die
Aufwertung **„Packmaster each pack"** und senkt deren Pflicht von 1 auf 0, und
**setzt** am Rat-Ogre-Profil **Ld 7** und **WS 4**. Fünf Konstrukte, ein Gatter —
und dieses Gatter ist **eine einzige Bedingung**, wortgleich fünfmal
hingeschrieben (Z. 6803, 6813, 6848, 6932, 6938):

```xml
<infoLink id="12c2-071e-1e09-5918" name="Loss of Packmaster Ogres"
          hidden="false" targetId="c78e-7036-f2ed-c05b" type="rule">
  <modifiers>
    <modifier type="set" field="hidden" value="true">
      <conditions>
        <condition field="selections" scope="7a4a-301b-af31-9ee0" value="0"
                   percentValue="false" shared="true"
                   includeChildSelections="true" includeChildForces="false"
                   childId="8b1c-de3a-982e-e323" type="greaterThan"/>
      </conditions>
    </modifier>
  </modifiers>
</infoLink>
```

Der `scope` ist **die Id der tragenden Einheit selbst**, ausgeschrieben statt als
Schlüsselwort. Derselbe Autor schreibt an anderer Stelle sehr wohl Schlüsselwörter
hin — zwei **andere** Einheiten desselben Katalogs gattern dasselbe
Regel-Vorkommen per `scope="force"` + `instanceOf` (Z. 2812 blendet es aus,
Z. 6673 blendet es ein) —, die ausgeschriebene Id ist hier also kein Versehen,
sondern die gemeinte Kodierung.

---

## Was die Formatspezifikation über die Zelle sagt

- **Der `scope` darf eine Eintrags-Id sein.** Die Aufzählung in
  [§7.6](../../battlescribe-data-format.md#76-constraint) ist keine abschließende
  Liste von Literalen: die Quelle zählt neben `parent|roster|force|primary
  category` ausdrücklich **Vorfahren-Ids** mit, und die XSD typt `scope` als
  nackten String (`Catalogue.xsd:426`, `QueryBase` — dieselbe Basis für
  `constraint`, `condition` und `repeat`). Zitiert im
  [§7.6-Kasten](../../battlescribe-data-format.md#scope-primary-catalogue).
- **Der Rahmen sagt nur, *wo* summiert wird.** Gezählt werden „`field`'s values
  of descendant selections"
  ([§7.6-Regelkasten](../../battlescribe-data-format.md#76-constraint)) — hier
  also die Auswahlen **unterhalb** der benannten Einheit, die auf die `childId`
  passen.
- **`includeChildSelections="true"` reicht beliebig tief.** Die Spezifikation ist
  in der Condition-Tabelle (§7.7) ausdrücklich: „werden auch **unterhalb** des
  Scope-Ziels verschachtelte Auswahlen mitgezählt, **nicht nur dessen direkte
  Kinder**". Genau darauf beruht dieses Gatter — die gezählte Aufwertung steht
  zwei Ebenen tiefer.
- **`greaterThan` ist echt größer.** Die Vergleichsarten sind in §7.7 aufgezählt
  (`lessThan`, `greaterThan`, `equalTo`, `notEqualTo`, `atLeast`, `atMost`, …);
  `greaterThan 0` hält ab dem ersten Treffer und bei 0 nicht. Präzedenz für
  dieselbe Vergleichsart an einem Schlüsselwort-Rahmen:
  [`greater-than-parent-upgrade-gate`](../greater-than-parent-upgrade-gate/README.md).
- **`shared="true"` verbreitert keinen Rahmen.** Das Flag entscheidet, ob über
  alle **Verweis-Instanzen** eines geteilten Eintrags summiert wird (§7.6-Tabelle)
  — welcher Knoten der Zählrahmen ist, sagt allein der `scope`. Präzedenz:
  [`equal-to-ancestor-id-scope-mount-gate`](../equal-to-ancestor-id-scope-mount-gate/README.md),
  Roster 06.
- **`type="set"` auf `field="hidden"`** blendet eine Entität kontextabhängig aus
  bzw. ein (§7.7 Ende, §8). Ein wirksam verborgenes Info-Element **fehlt** in der
  Info-Projektion des Slots — deshalb ist die Aussage hier
  `infoElements` ↔ `infoElementsAbsent` und kein eigenes Flag.
- **`type="set"` auf `field="<constraint-id>"` ersetzt** den Wert dieses
  Constraints, solange die Bedingung hält; hält sie nicht, bleibt der
  **geschriebene** Rohwert stehen (§7.6/§7.7).
- **Eine `modifierGroup` ist die Klammer** „dieselbe Bedingung an mehreren
  Modifiern" (§7.7). Wer fragt „gattert der Katalog das überhaupt?", muss
  `<modifiers>` **und** `<modifierGroups>` durchsuchen — bei „Packmaster each
  pack" (Z. 6846) steht das Gatter in der Gruppe.
- **Sichtbarkeit vor Mindestmaß:** Min-Grenzen einer effektiv versteckten Entität
  werden **nicht** validiert (§5.6, verallgemeinert in §8). Das betrifft hier
  zweierlei: die Einheit selbst muss im benutzten Kontingent sichtbar sein
  (**GTIS-R2**), und die auf 0 gesenkte Pflicht ist zugleich versteckt
  (**GTIS-R7**) — beide Wege führen zur selben Stille.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **GTIS-R1** | **Der `scope` ist eine Eintrags-Id, kein Schlüsselwort.** `scope="7a4a-301b-af31-9ee0"` benennt den `selectionEntry` „Mutant Rat Ogres" `type="unit"` — dieselbe Einheit, an deren `infoLink` die Bedingung hängt. Die Id benennt **kein** Kontingent (die acht `forceEntry`-Ids des Katalogs stehen Z. 21/36/49/63/145/158/171/184), **keine** Kategorie (Z. 12–18 + `.gst`) und **keinen** Verweis. Sie kommt im Korpus 17× vor: 1× als Definition (Z. 6778) und 16× als `scope` — 10× an einer `condition`, 6× an einem `repeat`. | Volltextsuche über die 12 Fixture-Dateien nach `7a4a-301b-af31-9ee0` (Treffer nur in `Skaven (…).cat`). |
| **GTIS-R2** | **Die Einheit ist nur im Kontingent „Hell Pit (WD-311)" sichtbar.** Sie trägt `hidden="true"` als Basiswert und genau **einen** `set hidden="false"`-Modifikator, gegatet auf `instanceOf` `childId="9f0b-5346-a3bc-b5fe"` mit `scope="force"` (die kanonische Kodierung einer `forceEntry`-Instanzprüfung, §7.7-Kasten). Alle Roster dieses Szenarios benutzen deshalb dieses Kontingent — sonst wäre keine Min-Behauptung unter der Einheit validierbar (§5.6/§8). | Einheit Z. 6778, Modifikator Z. 6780–6784; `forceEntry` Z. 184. |
| **GTIS-R3** | **Gezählt wird die Aufwertung „Brain transplant".** `childId="8b1c-de3a-982e-e323"` ist ein `selectionEntry` `type="upgrade"` mit `hidden="false"`, eigener Grenze `max 1` (`14e8-5762-d2d0-ee18`) und einem `increment` auf die pts-Kostenart, wiederholt je Ogre Pack. Die Id kommt im Korpus 6× vor: 1× als Definition (Z. 7018) und 5× als `childId` — genau die fünf Konstrukte aus GTIS-R5. Kein `entryLink` zeigt auf sie; sie ist ausschließlich inline unter „Rat Ogre" wählbar. | Definition Z. 7018–7034; Volltextsuche nach `8b1c-de3a-982e-e323`. |
| **GTIS-R4** | **Die gezählte Auswahl liegt ZWEI Ebenen unter dem Rahmen.** Kette: `selectionEntry` „Mutant Rat Ogres" `7a4a-…` (Z. 6778) → `selectionEntry` „Rat Ogre" `40c5-05e4-da1d-6194` (Z. 6897, `type="upgrade"`) → `selectionEntryGroup` „Options" `a0a2-1a3d-86d3-4a67` (Z. 6945) → `selectionEntry` „Brain transplant" (Z. 7018). Nur `includeChildSelections="true"` erreicht sie; mit `false` („just `scope`'s `field`", §7.6) bliebe die Zählung 0. | Verschachtelung Z. 6778 → 6897 → 6945 → 7018. |
| **GTIS-R5** | **Dieselbe Bedingung gattert fünf Konstrukte derselben Einheit** (Attribute jeweils wortgleich, `value="0"`, `shared="true"`, `includeChildSelections="true"`, `includeChildForces="false"`): (a) `set hidden="true"` am `infoLink` „Loss of Packmaster Ogres" `12c2-071e-1e09-5918`; (b) `set hidden="false"` am Basis-verborgenen `infoLink` „Regeneration" `7105-391b-fc3a-3771`; (c) eine `modifierGroup` an „Packmaster each pack" `90fa-58e6-5fdf-28c7` mit `set hidden="true"` **und** `set 6fda-622a-eae1-fc61 = 0`; (d) `set 2d45-18fe-9eb3-b113` (**Ld**) `= 7` und (e) `set f95b-da01-0578-3bdc` (**WS**) `= 4` am `infoLink` des Rat-Ogre-Profils. Wer eine Erwartung nur an (a) formuliert, übersieht (b)–(e) — deshalb stehen sie hier vollständig. | Bedingungen Z. 6803 / 6813 / 6848 / 6932 / 6938; Modifikatoren Z. 6801 / 6811 / 6851+6852 / 6929 / 6935. |
| **GTIS-R6** | **Die Regel „Loss of Packmaster Ogres" ist ein Verweis, kein eigenes Element.** `infoLink 12c2-071e-1e09-5918 type="rule" targetId="c78e-7036-f2ed-c05b"`, Basis `hidden="false"`. In der Info-Projektion erscheint sie unter der **Verweis-Id**, mit dem Regeltext des Ziels (Z. 10231): *„If all Packmasters are killed and there are no characters in the unit the Rat ogres suffer from Stupidity."* Kein `field="name"`-Modifikator berührt sie — der effektive Name ist der geschriebene. | `infoLink` Z. 6799; `rule` Z. 10230–10232. Die Verweis-Id kommt im Korpus **nur** an dieser einen Stelle vor. |
| **GTIS-R7** | **Die Pflicht „Packmaster each pack" ist die im Bericht sichtbare Hälfte derselben Bedingung.** Der `selectionEntry` `90fa-58e6-5fdf-28c7` trägt `min 1` (`6fda-622a-eae1-fc61`) und `max 1` (`fab5-b1e4-3574-fbb3`), beide `scope="parent"`. Die `modifierGroup` (Z. 6846) setzt bei haltender Bedingung `hidden=true` **und** `6fda-… = 0`. Ohne Brain transplant gilt also der Rohwert `min 1`; ist die Aufwertung nicht gewählt, feuert die Grenze mit **Ist 0 / Grenze 1**. Mit Brain transplant ist sie **still** — doppelt abgesichert (Wert 0 **und** versteckt, §8). Die Id `6fda-…` kommt im Korpus 2× vor: als Constraint (Z. 6857) und als `field` des `set` (Z. 6852). | Aufwertung Z. 6844–6896; Grenzen Z. 6857/6858; `modifierGroup` Z. 6846–6854. |
| **GTIS-R8** | **Die Merkmalswerte des Rat-Ogre-Profils sind die dritte Beobachtungsstelle.** Der `infoLink a9e1-ff0e-140a-a6f4` (Z. 6903) zeigt auf das geteilte `profile fc86-fbd7-0686-603e` „Rat Ogre" (Z. 10904, `typeId="a54a-7f00-29bf-12b1"` = „Profile") mit den Basiswerten **Mv 6, WS 3, S 5, T 4, A 3, Ld 5**. Am Verweis hängen ein **unbedingter** `set field="name" value="Mutant Rat Ogre"` und sechs bedingte Modifikatoren: S+1 bei „Powerhouses" `259c-…`, T+1 bei „Resilient" `b03e-…`, A+1 bei „Extra extremities" `d7e7-…`, Mv+1 bei „Quadrupedal" `d9b9-…`, sowie Ld=7 und WS=4 bei „Brain transplant". Der Slot der Aufwertung heißt weiterhin „Rat Ogre" — der Namens-Modifikator sitzt am **Profil**, nicht am Eintrag. | Z. 6903–6942; Profil Z. 10904–10920. |
| **GTIS-R9** | **Die Pflicht-Kinder der Einheit, die jedes Roster tragen muss.** „Ogre Pack" `8ea5-88f7-6636-7aaf` (`type="model"`, 65 pts) mit `min 1` (`40f9-18a7-a6cf-c6f3`) und `max -1` (`f4c1-c87e-2fcf-5ce9`, Sentinel „unbegrenzt" als **hingeschriebener** Wert, §7.6; nur unter „Border Patrols rules" `4e15-0353-165f-5528` per `set` auf 25 gezogen, in keinem Roster vorhanden) sowie „Rat Ogre" `40c5-05e4-da1d-6194` mit `min 1` (`0352-7667-f50c-5eda`) und `max 1` (`b296-d0c8-b18b-b5cd`). Jedes Roster wählt genau ein Exemplar von beiden. | Z. 6823–6843 und Z. 6897–6901. |
| **GTIS-R10** | **Ein ZWEITER Rat Ogre in derselben Einheit ist nicht baubar** — `b296-d0c8-b18b-b5cd` ist `max 1` mit `scope="parent"`. Die „nicht nur das erste Kind"-Aussage wird deshalb über die Gruppe „Options" geführt: sie erlaubt `max 2` (`8fcf-0d32-a63c-37a1`, `scope="parent"`, Z. 6947), Roster 03 wählt „Powerhouses" **und** „Brain transplant", den Transplant als **zweite** Auswahl. | Grenze Z. 6900; Gruppengrenze Z. 6947; Optionen Z. 6950/6967/6984/7001/7018/7035. |
| **GTIS-R11** | **Zwei Einheiten „Mutant Rat Ogres" sind baubar.** Die Einheit trägt — anders als ihre Schwester „Augmented Rat Ogres" `cdcd-2130-f1a3-819d` (Z. 7068 mit `max 1` `cb6c-f3f2-1690-327d`) — **überhaupt keine** eigenen `<constraints>`. Begrenzt wird nur ihr Kategorie-Slot: `categoryLink` „Special" `6a45-fd16-99d7-277b` `primary="true"` → Kategorie `43cc-fc3f-35a7-8d03`, deren force-skopierte Grenze `16f0-6e5b-55d0-4102` bei dem in allen Rostern gesetzten `costLimit` **1000 pts** auf ihrem Rohwert **3** steht (die punkte- und Warband-abhängigen `set`-Modifikatoren greifen erst <500 bzw. ≥2000 pts). Höchststand in den Rostern: 2. | Einheit Z. 6778–6822 (kein `<constraints>`-Kind); `categoryLink` Z. 6820; `.gst` Z. 434–541. |
| **GTIS-R12** | **Die Einheit ist der einzige Träger dieses Gatters.** Die Zelle „`greaterThan` + Id-`scope` + Id-`childId`" kommt im Korpus 12× vor, 10× davon an dieser einen Einheit (die restlichen 2 in `The Empire (…).cat`). Die beiden anderen Skaven-Einheiten mit derselben Regel gattern sie per **Kontingent**-Prüfung (`scope="force"`, `instanceOf`: Z. 2812 blendet aus, Z. 6673 blendet ein), die vierte (`Augmented Rat Ogres`, `infoLink 4940-1183-1f8b-9af9`, Z. 7103) gar nicht. Ein Nachbar-Träger, an dem sich die Aussage duplizieren ließe, existiert nicht. | Z. 6803/6813/6848/6865/6909/6915/6921/6926/6932/6938; Kontrast Z. 2808/6669/7103. |

### Die zehn Bedingungen am selben Rahmen — vollständig gelesen

Alle zehn tragen `scope="7a4a-301b-af31-9ee0"`, `type="greaterThan"`,
`field="selections"`, `value="0"`, `shared="true"`,
`includeChildSelections="true"`, `includeChildForces="false"` — sie unterscheiden
sich **allein** in der `childId`:

| Z. | `childId` (Option) | Gegattertes Konstrukt | In diesen Rostern aktiv |
|----|--------------------|------------------------|--------------------------|
| 6803 | `8b1c-…` Brain transplant | `set hidden="true"` am `infoLink` „Loss of Packmaster Ogres" `12c2-…` | 02, 03, 04 (Einheit A) |
| 6813 | `8b1c-…` Brain transplant | `set hidden="false"` am Basis-verborgenen `infoLink` „Regeneration" `7105-…` | 02, 03, 04 (Einheit A) |
| 6848 | `8b1c-…` Brain transplant | `modifierGroup` an „Packmaster each pack": `set hidden="true"` + `set 6fda-… = 0` | 02, 03, 04 (Einheit A) |
| 6932 | `8b1c-…` Brain transplant | `set` **Ld** `2d45-…` `= 7` am Rat-Ogre-Profil | 02, 03, 04 (Einheit A) |
| 6938 | `8b1c-…` Brain transplant | `set` **WS** `f95b-…` `= 4` am Rat-Ogre-Profil | 02, 03, 04 (Einheit A) |
| 6909 | `259c-…` Powerhouses | `increment` **S** `b690-…` `+1` am Rat-Ogre-Profil | **03** |
| 6915 | `b03e-…` Resilient | `increment` **T** `8712-…` `+1` am Rat-Ogre-Profil | — |
| 6921 | `d7e7-…` Extra extremities | `increment` **A** `6b9f-…` `+1` am Rat-Ogre-Profil | — |
| 6926 | `d9b9-…` Quadrupedal | `increment` **Mv** `0e92-…` `+1` am Rat-Ogre-Profil | — |
| 6865 | `d9b9-…` Quadrupedal | `increment` **Mv** `0e92-…` `+1` am Packmaster-Profil (`infoLink 4993-…`) | — |

Die sechs `<repeat>`-Elemente mit demselben `scope`
(Z. 6954/6971/6988/7005/7022/7039) sind der Kosten-Aufschlag „je Ogre Pack" an
den sechs Optionen; sie berühren weder Sichtbarkeit noch Grenzen und werden hier
nicht behauptet.

**Konsequenz für die Erwartung:** Keine der drei stummen `childId`s
(`b03e-…`, `d7e7-…`, `d9b9-…`) kommt in irgendeinem Roster vor — T, A und Mv
stehen daher überall auf ihren Basiswerten. Mv 6 wird in jedem Roster
mitbehauptet, gerade **weil** es sich nie ändert: ein zu grob gelesener
`childId`-Filter („irgendeine Auswahl im Rahmen") ließe die Quadrupedal-Bedingung
mitlaufen und Mv auf 7 steigen.

---

## Was die Roster über den **Rahmen** sagen — und was nicht

Der `scope` benennt die Einheit, unter der die tragenden Elemente hängen. Damit
fallen in dieser Datenlage mehrere Rahmen zusammen:

| Rahmen | Bezeichneter Knoten in diesen Rostern | Zählwert |
|--------|----------------------------------------|----------|
| `scope="7a4a-301b-af31-9ee0"` (Eintrags-Id) | die Einheit, an der der `infoLink` hängt | 0 bzw. 1 |
| `scope="unit"` | dieselbe Einheit (nächster Vorfahre mit `type="unit"`, §7.7-Kasten) | identisch |
| `scope="parent"` (am `infoLink` der Einheit) | dieselbe Einheit | identisch |

**Offen deklariert:** Die Roster 01–03 pinnen das **Zählergebnis** im Rahmen der
tragenden Einheit; sie können `parent`, `unit` und die Eintrags-Id **nicht**
voneinander unterscheiden. Ein Fall, der das könnte, wäre eine „Mutant Rat
Ogres"-Selektion **unterhalb** einer anderen Einheit; der Katalog kennt ihn nicht
(die Einheit ist ein Wurzel-`selectionEntry`, Z. 6778, und kein `entryLink` hängt
sie irgendwo darunter).

Was Roster 04 sehr wohl abgrenzt, ist die **Weite** des Rahmens: `7a4a-…`
bezeichnet die **jeweils eigene** Einheit, nicht „irgendwo im Kontingent". Und
was die Roster 02/03 gegen 01 abgrenzen, ist die **Tiefe**: die gezählte Auswahl
steht zwei Ebenen unter dem Rahmen.

### Was eine falsche Lesart produzieren würde

| Fehl-Lesart | Roster 01 | Roster 02 | Roster 03 | Roster 04 |
|---|---|---|---|---|
| **Id im `scope` nicht aufgelöst** ⇒ Bedingung fällt immer | still (feuert ohnehin korrekt) | Regel bleibt sichtbar, `6fda-…` feuert, Ld 5 / WS 3 — **fällt auf** | wie 02, zusätzlich S 5 statt 6 — **fällt auf** | `6fda-…` feuert **2×** statt 1× — **fällt auf** |
| **Id im `scope` nicht aufgelöst** ⇒ Bedingung als *wahr* behandelt | Regel fehlt, `6fda-…` feuert **nicht**, Ld 7 / WS 4 — **fällt auf** | still (korrekt, aber unbewiesen) | still | `6fda-…` feuert **0×** — **fällt auf** |
| **`includeChildSelections` ignoriert** (nur direkte Kinder des Rahmens) | still | Zählwert 0 ⇒ Zustand von 01 — **fällt auf** | **fällt auf** | `6fda-…` feuert 2× — **fällt auf** |
| **Rahmen zu weit** (Kontingent/Roster statt der benannten Einheit) | still | still | still | `6fda-…` feuert **0×** — **fällt auf** |
| **`shared="true"` als roster-weite Teilung eines Eintrags-Rahmens gelesen** | still | still | still | `6fda-…` feuert **0×** — **fällt auf** |
| **`greaterThan` wie `atLeast` gelesen** (0 ≥ 0 hielte auch ohne Transplant) | Regel fehlt, `6fda-…` still — **fällt auf** | still | still | `6fda-…` feuert 0× — **fällt auf** |
| **Nur das erste Kind / erster Treffer im Rahmen gezählt** | still | still | Regel bliebe sichtbar (Transplant ist die zweite Option) — **fällt auf** | — |
| **`childId`-Filter ignoriert** (irgendeine Auswahl im Rahmen genügt) | Regel fehlt schon ohne Option — **fällt auf** | still | Mv 7 statt 6 (Quadrupedal-Gatter liefe mit) — **fällt auf** | `6fda-…` feuert 0× — **fällt auf** |
| **Verstecktes Info-Element bleibt in der Projektion** | still | `12c2-…` steht in `infoElementsAbsent` — **fällt auf** | **fällt auf** | — |
| **Basis-`hidden` am `infoLink` ignoriert** | „Regeneration" erschiene bereits ohne Transplant — **fällt auf** | still | still | — |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle vier laufen
gegen **denselben** Datensatz (`.gst` + Skaven `.cat` + Mercenaries `.cat`), im
**selben** Kontingent „Hell Pit (WD-311)" und mit demselben Punktelimit
**1000 pts**; 01 ↔ 02 unterscheiden sich in **genau einer** Selektion.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
|---|-----------|----------------|-------------------------------------|---------|
| 01 | Kein Transplant ⇒ Regel sichtbar, Packmaster Pflicht | Einheit + 1 Ogre Pack + 1 Rat Ogre, **keine** Option. | Zählwert 0, `greaterThan 0` hält nicht. `12c2-…` steht in `infoElements`, `7105-…` (Regeneration) in `infoElementsAbsent`; Profil **Mv 6 / WS 3 / S 5 / Ld 5**; `6fda-…` feuert **Ist 0 / Grenze 1**, genau **1×**. | [`01-hell-pit-no-brain-transplant.ros`](rosters/01-hell-pit-no-brain-transplant.ros) |
| 02 | Ein Transplant ⇒ Regel verschwindet | **Baugleich zu 01**, plus **eine** Selektion „Brain transplant" unter dem Rat Ogre (zwei Ebenen unter dem Rahmen). | Zählwert 1, die Bedingung hält: `12c2-…` in `infoElementsAbsent`, `7105-…` in `infoElements`; Profil **WS 4 / Ld 7** (S 5, Mv 6 unverändert); `6fda-…` **absent**. | [`02-hell-pit-with-brain-transplant.ros`](rosters/02-hell-pit-with-brain-transplant.ros) |
| 03 | Transplant als **zweite** Option | Wie 02, plus „Powerhouses" **vor** dem Transplant in der Gruppe „Options" (max 2, exakt erreicht). | Unverändert zu 02 — **plus** S **6** durch die Powerhouses-Bedingung derselben Bauform. Belegt, dass der Rahmen **alles** unter sich zählt, nicht nur das erste Kind, und dass zwei Gatter nebeneinander wirken. | [`03-hell-pit-brain-transplant-second-option.ros`](rosters/03-hell-pit-brain-transplant-second-option.ros) |
| 04 | **Der Rahmen ist je Einheit** | **Zwei** Einheiten „Mutant Rat Ogres" im selben Kontingent: A mit Transplant, B ohne; sonst baugleich. | Für A hält die Bedingung (Pflicht auf 0, still), für B fällt sie (Pflicht bleibt 1): `6fda-…` feuert **Ist 0 / Grenze 1**, **genau 1×**. Ein zu weiter Rahmen ergäbe 0×, ein nicht aufgelöster 2×. | [`04-hell-pit-two-units-frame-per-unit.ros`](rosters/04-hell-pit-two-units-frame-per-unit.ros) |

### Herleitung der Zahlen

`bound` ist stets der **wirksame** Wert des Constraints: der geschriebene
`value` (`6fda-…`: `1`) oder der per `set` ersetzte (`0`, wenn die Bedingung
hält). `actual` folgt aus dem Roster-Aufbau unter `scope="parent"` — gezählt
werden die Selektionen von „Packmaster each pack" im Rahmen der jeweiligen
Einheit; **keines** der Roster wählt sie, der Ist-Stand ist also überall 0.

- **01:** Bedingung fällt ⇒ `min 1`, sichtbar; 0 Selektionen ⇒ **Ist 0 / Grenze 1**, 1 Anker.
- **02/03:** Bedingung hält ⇒ `min 0` **und** versteckt; still.
- **04:** A hält ⇒ still; B fällt ⇒ **Ist 0 / Grenze 1**. Summe: **1** Verletzung.

Die Merkmalswerte folgen aus GTIS-R8: Basis **Mv 6 / WS 3 / S 5 / Ld 5**, darauf
`set Ld=7` und `set WS=4` (Brain transplant, Roster 02–04) sowie
`increment S +1` (Powerhouses, nur Roster 03) — ein `set` schreibt einen Wert,
ein `increment` rechnet auf den geschriebenen (§7.7).

---

### Bewusst nicht Teil des Verletzungsberichts

| Facette | Warum nicht als feuernde Grenze / Assertion erwartet |
|---------|------------------------------------------------------|
| **Die `condition` selbst** | Eine `condition` ist keine `constraint`. Der Verletzungsbericht kodiert zählende Grenzen, keine Bedingungen — die Zelle ist nur mittelbar beobachtbar: über die Info-Projektion, über die Merkmalswerte und über den per `set` geänderten Constraint-Wert. |
| **Sichtbarkeit** (`field="hidden"`) — die Kernwirkung dieses Gatters | Verfügbarkeit ist **keine** zählende Schranke und erzeugt **nie** eine Verletzung (Präzedenz: [`vampire-bloodlines`](../vampire-bloodlines/README.md), VBL-R4/R5). Behauptet wird sie ausschließlich über `expect.capabilities`: `isHidden` am Einheiten-Slot und `infoElements`/`infoElementsAbsent` für das Regel-Vorkommen. |
| **Ein `isHidden` am Info-Element** | Der Manifest-Vertrag kennt für einen `infoElements`-Eintrag nur `id`/`kind`/`name`/`profileTypeId`/`profileTypeName`/`text`/`characteristics`. Ein wirksam verborgenes Info-Element **fehlt** in der Projektion; die Gegenaussage dazu ist `infoElementsAbsent`, und genau sie trägt hier die Erwartung. |
| **Profilwerte als Verletzung** | Merkmalswerte sind nicht Teil des Verletzungsberichts (VBL-R6). Sie werden ausschließlich über `capabilities.infoElements[].characteristics` behauptet. |
| **Ein zweiter „Rat Ogre" in derselben Einheit** | Nach GTIS-R10 durch `max 1` (`b296-d0c8-b18b-b5cd`) nicht baubar. Ein Roster mit zwei Rat Ogres wäre regelwidrig und würde zwei Aussagen (Rahmen-Tiefe **und** gerissene Obergrenze) vermischen. Die „nicht nur das erste Kind"-Aussage trägt deshalb Roster 03 über die zwei Optionen derselben Gruppe. |
| **Slot-Aussagen in Roster 04** | Dort steht **jede** benutzte Definition zweimal unter **demselben** `frameDefId` (zwei Einheiten). Eine `capabilities`-Auswahl über `defId` + `frameDefId` träfe zwei Slots; der `path` eines Slots ist aus den Katalogdaten nicht ableitbar. Roster 04 behauptet deshalb nur `firing`/`absent` — dafür mit `count`. |
| **Der Kategorie-Anker „Special"** (`43cc-fc3f-35a7-8d03`, Grenze `16f0-6e5b-55d0-4102`) | In Roster 04 stehen zwei Special-Einheiten gegen eine Grenze von 3 (GTIS-R11) — unverletzt. Die Zählsemantik force-skopierter Kategoriegrenzen ist jedoch eine **eigene** Zelle mit eigenen Szenarien; sie wird hier weder in `firing` noch in `absent` behauptet, um den Fall nicht zu verwässern. |
| **Der `entryLink`-Unterbau von „Packmaster each pack"** (Light Armour `5551-…`/`6844-…`, Whip `8459-…`/`c15f-…`, Hand Weapon `e2ab-…`/`268c-…`, je `min 1`/`max 1`) | Kein Roster wählt den Packmaster; seine eigenen Pflicht-Kinder werden dadurch nie erreicht. Ob und wie eine Engine Pflichten **unterhalb** eines unbesetzten Pflicht-Ankers meldet, ist eine Aussage über die Anker-Kaskade, nicht über diese Zelle — die Ids stehen deshalb weder in `firing` noch in `absent`. |
| **General- und Core-Pflichten des Kontingents** | Sie feuern in **allen** Rostern, weil bewusst weder ein General noch eine Core-Einheit gewählt ist — jede zusätzliche Auswahl würde den Fall verwässern. Die Erwartung ist selektiv; diese Ids stehen weder in `firing` noch in `absent`. |
| **Eine Diagnose für den Id-`scope`** (etwa `UNRESOLVED_SCOPE`) | Aus den erlaubten Quellen nicht entscheidbar: die Formatspezifikation regelt fail-closed-Verhalten samt Diagnose ausdrücklich nur für `primary-catalogue` und für `unit` ohne umschließende Einheit. Hier ist der Rahmen in jedem Roster auflösbar. Das Szenario fordert **weder** Anwesenheit **noch** Abwesenheit einer solchen Diagnose. |
| **`anchorKind` des Packmaster-Ankers** | Ob ein unbesetzter Pflicht-Eintrag als `mandatoryPhantom` oder als `offerAnchor` geführt wird, ist eine Aussage über die Slot-Taxonomie der Engine, nicht über die Katalogdaten. Das Manifest behauptet dazu nichts. |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine erst
im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur (blinden)
Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **GTIS-R1/R4** — ob ein Id-wertiger `scope` an einer *Condition* überhaupt als
   Eintrags-Rahmen erkannt wird (statt als unbekanntes Schlüsselwort still zu
   scheitern) **und** ob `includeChildSelections="true"` dabei transitiv bis in
   die zweite Ebene reicht. Roster 01 ↔ 02 unterscheiden beides maximal: sie
   differieren in genau einer Selektion, und jede Fehl-Lesart macht die beiden
   Fälle ununterscheidbar.
2. **GTIS-R5** — dass **alle fünf** gegatterten Konstrukte gemeinsam schalten. Die
   Erwartung prüft drei davon an drei verschiedenen Berichtsstellen
   (Info-Projektion, Merkmalswerte, feuernde Grenze); fällt eines aus, fällt genau
   eine Zeile.
3. **Roster 04** — die Weite des Rahmens **und** die Frage, ob `shared="true"`
   einen Eintrags-Rahmen roster-weit teilt. Beide Fehl-Lesarten verändern dort die
   **Zahl** der Verletzungen (0 statt 1 bzw. 2 statt 1), nicht nur ihren Wert;
   deshalb trägt die Erwartung dort ein `count`.
4. **Die Richtung des `hidden`-Gatters an „Regeneration"** — ein `infoLink` mit
   Basis `hidden="true"`, den ein Modifikator **einblendet**. Erscheint das
   Element schon in Roster 01, wird das Basis-`hidden` am Verweis nicht gelesen
   (§8); fehlt es in 02, greift der `set false` nicht.
5. **Die Identität des Info-Elements** — die Projektion muss das Vorkommen unter
   der **Verweis**-Id `12c2-071e-1e09-5918` führen, nicht unter der Ziel-Id
   `c78e-7036-f2ed-c05b`. Letztere trägt derselbe Katalog an **vier** Stellen
   (Z. 2808/6669/6799/7103); nur die Verweis-Id ist eindeutig.

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Katalog **Skaven** (rev 1, Z. 2) | `cac6-5f02-f95d-a403` |
| Bibliothek **Mercenaries** (per `catalogueLink` `4f16-8437-4e47-58a8`, Z. 11452) | `fc47-8392-a6c8-452a` |
| ForceEntry „Hell Pit (WD-311)" (einziges Kontingent, in dem die Einheit sichtbar ist; Z. 184) | `9f0b-5346-a3bc-b5fe` |
| SelectionEntry „Mutant Rat Ogres" (Ziel des Id-`scope`, `hidden="true"`, Z. 6778) | `7a4a-301b-af31-9ee0` |
| — dessen `categoryLink` „Special" (`primary="true"`, Z. 6820) → Kategorie | `6a45-fd16-99d7-277b` → `43cc-fc3f-35a7-8d03` |
| — `infoLink` „Loss of Packmaster Ogres" (Träger des `set hidden="true"`, Z. 6799) | `12c2-071e-1e09-5918` → `c78e-7036-f2ed-c05b` (Regel Z. 10230) |
| — `infoLink` „Regeneration" (`hidden="true"`, per `set false` eingeblendet, Z. 6809) | `7105-391b-fc3a-3771` → `59c1-8a35-5a25-ebe1` (`.gst` Z. 16726) |
| — `infoLink` „Mixed Units" / „Fear" (ungegattert, Kontrollen; Z. 6798/6808) | `4f84-868d-b76b-8cf9` → `1cd6-47da-45f9-1044` / `cd83-0b1a-0a82-1d44` → `1524-2372-4aa0-6881` (`.gst` Z. 16679) |
| SelectionEntry „Ogre Pack" (`type="model"`, 65 pts; min 1 / max -1; Z. 6823) | `8ea5-88f7-6636-7aaf` — `40f9-18a7-a6cf-c6f3` / `f4c1-c87e-2fcf-5ce9` |
| SelectionEntry „Packmaster each pack" (min 1 / max 1; `modifierGroup` Z. 6846) | `90fa-58e6-5fdf-28c7` — `6fda-622a-eae1-fc61` / `fab5-b1e4-3574-fbb3` |
| SelectionEntry „Rat Ogre" (min 1 / max 1, Z. 6897) | `40c5-05e4-da1d-6194` — `0352-7667-f50c-5eda` / `b296-d0c8-b18b-b5cd` |
| — dessen `infoLink` auf das Rat-Ogre-Profil (Träger der Merkmals-Modifikatoren, Z. 6903) | `a9e1-ff0e-140a-a6f4` → `fc86-fbd7-0686-603e` (Profil Z. 10904) |
| SelectionEntryGroup „Options" (max 2, Z. 6945) | `a0a2-1a3d-86d3-4a67` — `8fcf-0d32-a63c-37a1` |
| — Option „Brain transplant" (Ziel der `childId`, max 1; Z. 7018) | `8b1c-de3a-982e-e323` — `14e8-5762-d2d0-ee18` |
| — Option „Powerhouses" (in Roster 03, max 1; Z. 6950) | `259c-906d-4b40-2b31` — `c161-77b3-0542-5ff1` |
| — Optionen „Quadrupedal" / „Resilient" / „Extra extremities" / „Trollblood" (nie gewählt) | `d9b9-4315-f6b5-e02e` / `b03e-5d16-19d6-d9fa` / `d7e7-5079-ecb3-cfa7` / `8d5c-b0df-3935-db73` |
| ProfileType „Profile" (`.gst`) und die behaupteten Merkmale Mv / WS / S / Ld | `a54a-7f00-29bf-12b1` — `0e92-d038-82bf-fb41` / `f95b-da01-0578-3bdc` / `b690-4bc0-bb73-267b` / `2d45-18fe-9eb3-b113` |
| Kategorie „Special" (`.gst` Z. 434) — Grenze `max 3`, punkteskaliert (Z. 436) | `43cc-fc3f-35a7-8d03` — `16f0-6e5b-55d0-4102` |
| Kostenart „pts" (Roster-`costLimit` 1000) | `ecfa-8486-4f6c-c249` |
| Schwester-Einheit „Augmented Rat Ogres" (dieselbe Regel **ohne** Gatter, `max 1`; Z. 7068) | `cdcd-2130-f1a3-819d` — `cb6c-f3f2-1690-327d` |
| „Border Patrols rules" (Teil der Punkte-/Kategorie-Gatter; nie benutzt) | `4e15-0353-165f-5528` |

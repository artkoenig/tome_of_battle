# E2E-Regeln & Testkatalog: Root-Level-`entryLink` gehört seinem eigenen Katalog

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln allein aus den
Katalogdaten der *6th Definitive Edition*
(`src/evaluator/__fixtures__/whfb6-definitive/`) und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md)) abgeleitet;
die Roster-Form ist an den bestehenden Szenarien verifiziert (direktes `entryId`,
`entryLinkId=""`, verschachtelte `selections` mit `number`). Struktureller Zwilling
von [`primary-catalogue-scope`](../primary-catalogue-scope/README.md), das denselben
Vier-Kataloge-Datensatz lädt und denselben Drei-Armeebücher-Kontrast fährt — hier
jedoch nicht für `scope="primary-catalogue"`, sondern für die **Eigentümerschaft
eines Katalog-Wurzel-`entryLink`s selbst**.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Armeebücher: `Ogre Kingdoms (…).cat` (`731d-5b13-2a92-5427`, rev 2),
  `Vampire Counts (…).cat` (`4d73-5ab0-9020-403c`, rev 1),
  `Orcs and goblins (…).cat` (`4049-c46d-7f80-44fb`, rev 1)
- Gemeinsame Bibliothek: `Mercenaries (…).cat` (`fc47-8392-a6c8-452a`,
  `library="true"`) — enthält das gemeinsame Ziel `sharedSelectionEntry "Ogre Bulls"`
  (`7754-8b3d-df99-d2d5`), auf das alle drei Armeebücher unabhängig verlinken.

---

## Worum es geht

`Ogre Kingdoms (…).cat` deklariert unter seinem eigenen Katalog-Wurzelelement
(`<entryLinks>`, Geschwister von `<forceEntries>` — **kein** Verweis unterhalb einer
konkreten `selectionEntry`) einen `entryLink` namens „Ogre Bulls“
(`d82e-111e-89b9-2be1`), der auf die gemeinsame Mercenaries-Einheit
`7754-8b3d-df99-d2d5` zeigt und eine armeeweite Mindestpflicht trägt. `Vampire Counts
(…).cat` und `Orcs and goblins (…).cat` deklarieren **je ihren eigenen**, separaten
Katalog-Wurzel-`entryLink` auf **dasselbe** Ziel — ohne jede Pflicht, als reines
optionales Söldner-Angebot.

Die Frage, die dieses Szenario stellt: Gilt die Pflicht, die **ein** Katalog an
**seinem eigenen** Wurzel-`entryLink` deklariert, nur innerhalb der Kontingente,
die aus **diesem** Katalog stammen — oder „entkommt“ sie in ein Kontingent eines
ganz anderen, gleichzeitig geladenen Armeebuchs, weil der Reinraum-Evaluator laut
[ADR 0032](../../adr/0032-evaluator-loest-mehr-katalog-datensaetze-global-by-id-auf.md)
alle Katalog-Definitionen in eine einzige flache `id→Definition`-Tabelle mischt und
**global-by-id** auflöst?

Die Katalogdaten selbst beantworten das: Keines der drei Armeebücher verlinkt per
`catalogueLink` auf ein anderes Armeebuch — jedes verlinkt **ausschließlich** auf
`Mercenaries`:

| Katalog | `catalogueLink` | Ziel |
|---------|------------------|------|
| Ogre Kingdoms | `a067-78d5-50a2-affe` | `fc47-…` (Mercenaries) |
| Vampire Counts | `ef73-f9bd-e250-54d2` | `fc47-…` (Mercenaries) |
| Orcs and Goblins | `b066-2f8e-11ee-1dce` | `fc47-…` (Mercenaries) |

Es existiert also **kein** Importpfad, über den ein Vampire-Counts- oder
Orcs-and-Goblins-Kontingent den *Ogre-Kingdoms-eigenen* `entryLink`
`d82e-111e-89b9-2be1` überhaupt erreichen könnte — dessen Herkunft ist der
Katalog-**Wurzelbaum** von `Ogre Kingdoms (…).cat` selbst, nicht die geteilte
Mercenaries-Bibliothek. Dass jedes der drei Armeebücher **eigens** einen fast
identischen `entryLink` auf dasselbe Ziel anlegt (statt sich einen einzigen, in
Mercenaries deklarierten `entryLink` zu teilen), ist selbst der Beleg dafür, dass
Katalog-Wurzelinhalt nicht katalogübergreifend sichtbar ist — sonst wäre die
Dreifachdeklaration überflüssig. `id→Definition`-Auflösung *global-by-id* (ADR 0032)
betrifft nur, **wie** eine referenzierte `targetId` gefunden wird, nicht **welche**
Wurzel-`entryLink`s in welchem Kontingent überhaupt als Slot angeboten werden.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **RECS-R1** | **Ogre Kingdoms deklariert die Pflicht an seinem eigenen Katalog-Wurzel-`entryLink`.** `entryLink "Ogre Bulls"` `d82e-111e-89b9-2be1` (`targetId="7754-8b3d-df99-d2d5"`) trägt `<constraints><constraint type="min" value="0" field="selections" scope="force" shared="true" id="32ed-26da-3f27-5c04" includeChildSelections="false"/></constraints>`. | `Ogre Kingdoms (…).cat:3132-3163` — `entryLink` direkt unter dem Katalog-Wurzelelement `<entryLinks>`, Geschwister von `<forceEntries>`, nicht unterhalb irgendeiner `selectionEntry`. |
| **RECS-R2** | **Die Pflicht ist bedingt auf „nicht Ironskin Tribe“ angehoben.** Ein `modifierGroup` mit Kommentar „Standard“ setzt `modifier type="set" value="1" field="32ed-26da-3f27-5c04"` unter `condition type="notInstanceOf" value="1" field="selections" scope="force" childId="8711-ed16-2a44-7251"` (die `forceEntry` „Ironskin Tribe (WD#309-UK)“). Eine zweite `modifierGroup` (Kommentar „Ironskin Tribe“, `condition type="instanceOf" … childId="8711-…"`) ändert die Constraint-`value` **nicht** — der Rohwert (min 0) bleibt dort stehen. | `Ogre Kingdoms (…).cat:3134-3160`. Die Force „Standard (OK-AB)“ `729f-9246-5cd3-5044` ist keine Instanz von `8711-…`, also greift der erste Zweig: effektive Grenze **1**. |
| **RECS-R3** | **Vampire Counts deklariert einen eigenen, constraint-losen Wurzel-`entryLink`** auf dasselbe Ziel. `entryLink "Ogre Bulls"` `21f4-c979-396b-c02a` (`targetId="7754-8b3d-df99-d2d5"`) — ein reines Selbstschluss-Element ohne `<constraints>`, ohne `<modifiers>`, ohne `<modifierGroups>`. | `Vampire Counts (…).cat:29613` — `<entryLink import="true" name="Ogre Bulls" hidden="false" id="21f4-c979-396b-c02a" type="selectionEntry" targetId="7754-8b3d-df99-d2d5"/>`. |
| **RECS-R4** | **Orcs and Goblins deklariert ebenso seinen eigenen, constraint-losen Wurzel-`entryLink`** auf dasselbe Ziel. `entryLink "Ogre Bulls"` `0612-9f28-e986-2bce` — ebenfalls ein bloßes Selbstschluss-Element. | `Orcs and goblins (…).cat:14843` — `<entryLink import="true" name="Ogre Bulls" hidden="false" id="0612-9f28-e986-2bce" type="selectionEntry" targetId="7754-8b3d-df99-d2d5"/>`. |
| **RECS-R5** | **Kein katalogübergreifender Importpfad zwischen den drei Armeebüchern.** Jedes der drei `.cat` trägt genau **einen** `catalogueLink`, und der zeigt in allen drei Fällen auf `Mercenaries` (`fc47-8392-a6c8-452a`) — nie auf eines der beiden anderen Armeebücher. Der Ogre-Kingdoms-eigene `entryLink` `d82e-…` ist damit für ein Vampire-Counts- oder Orcs-and-Goblins-Kontingent strukturell unerreichbar. | `Ogre Kingdoms (…).cat:3086-3088` (`a067-78d5-50a2-affe`), `Vampire Counts (…).cat:29510-29511` (`ef73-f9bd-e250-54d2`), `Orcs and goblins (…).cat:14915-14916` (`b066-2f8e-11ee-1dce`) — alle drei `targetId="fc47-8392-a6c8-452a"`. |
| **RECS-R6** | **`scope="force"` zählt pro Detachment, nicht armeeweit.** Ein Eintrags-Ziel-Constraint mit `scope="force"` summiert die Auswahlen des Ziels **innerhalb des einen Kontingents**, das den Constraint-Träger enthält — nicht über alle Kontingente eines Rosters hinweg. | [`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §3.4 und §7.6: „`scope="force"` zählt ein **Eintrags**-Ziel **pro Detachment**“. |

**Was dieses Szenario *nicht* behauptet:** Es unterstellt **nicht**, dass der
Evaluator die Pflicht in einem Vampire-Counts-/Orcs-and-Goblins-Kontingent als
„erfüllt“ auswertet (`actual ≥ bound`, keine Verletzung *trotz* Auswertung). Aus den
Daten (RECS-R5) folgt nur, dass der Ogre-Kingdoms-eigene `entryLink` in einem
fremden Kontingent gar nicht erst als Slot/Anker existiert — ob die Engine das als
„nicht anwendbar“ oder als „trivial erfüllt“ intern führt, ist Implementierungsdetail.
Schwarzbox-beobachtbar und geprüft wird ausschließlich das **Außenverhalten**: die
Constraint-ID `32ed-26da-3f27-5c04` darf im Verletzungsbericht eines
Vampire-Counts- oder Orcs-and-Goblins-Kontingents **nicht auftauchen**.

---

## Testkatalog (E2E-Szenarien)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle laufen gegen
**denselben** Datensatz (`.gst` + Ogre + Vampire Counts + O&G + Mercenaries).

> **Assertion-Fokus:** nur `32ed-26da-3f27-5c04`. Andere Armeeaufbau-Diagnosen
> (General-/Core-Pflicht, Punktelimit, sonstige Armeebuch-Regeln) können zusätzlich
> auftreten und sind hier ohne Belang.

| # | Testtitel | Kontingent (Armeebuch) | Roster-Zustand | Erwartetes Ergebnis des Evaluators (nicht-technisch) | Fixture |
|---|-----------|------------------------|-----------------|--------------------------------------------------------|---------|
| 01 | Ogerarmee **ohne** Ogre Bulls | `729f…` (Ogre `731d…`) | Leeres Kontingent. | **RECS-R1/R2 feuern:** `32ed-26da-3f27-5c04` (Ist 0, Grenze 1) — die per Katalog-Wurzel-`entryLink` gehobene Pflicht ist unerfüllt. Regressionswache: dies ist das bereits korrekt funktionierende Verhalten, kein Bug. | [`01-ogre-standard-no-bulls.ros`](rosters/01-ogre-standard-no-bulls.ros) |
| 02 | Ogerarmee **mit** Ogre Bulls | `729f…` (Ogre) | Eine „Ogre Bulls“-Einheit mit drei „Bulls“-Modellen. | Positive Kontrolle: `32ed-26da-3f27-5c04` ist erfüllt (Ist 1, Grenze 1) und feuert **nicht**. Belegt, dass die Pflicht überhaupt erfüllbar und korrekt aufgelöst ist. | [`02-ogre-standard-with-bulls.ros`](rosters/02-ogre-standard-with-bulls.ros) |
| 03 | Vampire-Counts-Kontingent **ohne** Ogre Bulls | `e989…` (VC `4d73…`) | Leeres Kontingent, kein Bezug zum Ogre-Kingdoms-`entryLink`. | **Die eigentliche geprüfte Regel:** `32ed-26da-3f27-5c04` darf **nicht** feuern — dieses Kontingent stammt aus einem anderen Armeebuch, das seinen eigenen, constraint-losen `entryLink` (`21f4-…`) auf dasselbe Ziel trägt. | [`03-vampire-standard-no-bulls.ros`](rosters/03-vampire-standard-no-bulls.ros) |
| 04 | Orcs-and-Goblins-Kontingent **ohne** Ogre Bulls | `2bfa…` (O&G `4049…`) | Leeres Kontingent, kein Bezug zum Ogre-Kingdoms-`entryLink`. | Wie 03, mit einem **zweiten, unabhängigen** Armeebuch: `32ed-26da-3f27-5c04` darf **nicht** feuern. Schützt davor, dass ein Fix zufällig nur für Vampire Counts wirkt. | [`04-orcs-standard-no-bulls.ros`](rosters/04-orcs-standard-no-bulls.ros) |

### Warum 03/04 nicht einfach „leere Kontingente ohne Bezug“ sind

Roster 03 und 04 enthalten **keine** Selektion, die auf `7754-8b3d-df99-d2d5` (Ogre
Bulls) oder auf einen der beiden fremden `entryLink`s verweist — bewusst, denn genau
das ist der Kern der Regel: Die Konstruktion braucht **keinen** Verweis auf den
Ogre-Kingdoms-`entryLink`, um zu prüfen, dass dessen Pflicht dort nicht greift. Ein
Roster, das stattdessen den VC-eigenen `entryLink` `21f4-…` referenziert, würde eine
andere (in diesem Szenario nicht gestellte) Frage beantworten — ob der optionale,
constraint-lose Verweis korrekt **keine** Pflicht mitbringt.

### Was bewusst **nicht** als feuernde Grenze erwartet wird

| Facette | Warum nicht im Bericht |
|---------|--------------------------|
| **Kategorie-Umhängung des Ogre-Kingdoms-`entryLink`s** (`set-primary`/`add`/`remove` auf `field="category"`, hebt Ogre Bulls in der Ogerarmee auf Core, in VC/O&G bleibt es Rare/Regiment of Renown). | Kategoriezugehörigkeit, keine zählende Grenze. Nicht Teil des Verletzungsberichts. |
| **Die eigene Mindestgröße der Einheit** (`constraint min 3` auf dem „Bulls“-Modell, `92d9-b5d1-9411-e954`). | Roster 02 erfüllt sie bereits (drei Modelle) — sie ist nicht Gegenstand dieses Szenarios, das ausschließlich die Katalog-Eigentümerschaft der äußeren Einheiten-Pflicht prüft. |
| **`UNRESOLVED_SCOPE`** (die Diagnose aus [`primary-catalogue-scope`](../primary-catalogue-scope/README.md)). | Die hier geprüfte Bedingung (`notInstanceOf … scope="force" childId="8711-…"`) ist keine `scope="primary-catalogue"`-Identitätsprüfung, sondern eine gewöhnliche `scope="force"`-Detachment-Identitätsprüfung, ausgewertet **innerhalb** des Ogre-Kingdoms-`entryLink`s selbst. In einem VC-/O&G-Kontingent wird sie überhaupt nicht ausgewertet, weil der `entryLink`, an dem sie hängt, dort strukturell nicht existiert (RECS-R5) — sie kann daher auch keine `UNRESOLVED_SCOPE`-Diagnose auslösen. |

---

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Katalog **Ogre Kingdoms** | `731d-5b13-2a92-5427` |
| Katalog **Vampire Counts** | `4d73-5ab0-9020-403c` |
| Katalog **Orcs and Goblins** | `4049-c46d-7f80-44fb` |
| Bibliothek **Mercenaries** (`library="true"`) | `fc47-8392-a6c8-452a` |
| Spielsystem WHFB 6th definitive | `0d13-7737-ea86-4662` |
| Force „Standard (OK-AB)“ (Ogre) | `729f-9246-5cd3-5044` |
| Force „Standard (VC-AB)“ (Vampire Counts) | `e989-15b8-7eb6-9668` |
| Force „Standard (OG-AB)“ (Orcs and Goblins) | `2bfa-e64a-7123-895f` |
| Geteiltes Ziel `sharedSelectionEntry "Ogre Bulls"` (Mercenaries) | `7754-8b3d-df99-d2d5` |
| Modell „Bulls“ (min 3, max unbegrenzt) | `411b-6f5f-06f1-be37` — constraints `92d9-b5d1-9411-e954` (min 3) / `d5f9-2bf9-c174-f44e` (max −1) |
| Ogre-Kingdoms-eigener `entryLink "Ogre Bulls"` (trägt die Pflicht) | `d82e-111e-89b9-2be1` — constraint `32ed-26da-3f27-5c04` (min 0→1) |
| `forceEntry "Ironskin Tribe (WD#309-UK)"` (Bedingung, die die Pflicht hebt) | `8711-ed16-2a44-7251` |
| Vampire-Counts-eigener `entryLink "Ogre Bulls"` (ohne Pflicht) | `21f4-c979-396b-c02a` |
| Orcs-and-Goblins-eigener `entryLink "Ogre Bulls"` (ohne Pflicht) | `0612-9f28-e986-2bce` |
| `catalogueLink` Ogre Kingdoms → Mercenaries | `a067-78d5-50a2-affe` |
| `catalogueLink` Vampire Counts → Mercenaries | `ef73-f9bd-e250-54d2` |
| `catalogueLink` Orcs and Goblins → Mercenaries | `b066-2f8e-11ee-1dce` |

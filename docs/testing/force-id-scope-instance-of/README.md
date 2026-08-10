# E2E-Regeln & Testkatalog: `instanceOf` mit der `forceEntry`-Id im `scope` (selbst-gegatterte Kodierung)

**Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln ausschließlich
aus den Katalogdaten der *6th Definitive Edition* und der Formatspezifikation
([`docs/battlescribe-data-format.md`](../../battlescribe-data-format.md), §7.7)
abgeleitet; das Roster-Format ist an den bereits verifizierten Szenarien
(direktes `entryId`, leeres Kontingent wie in `orcs-and-goblins/01-empty-force.ros`)
nachgebildet.

- Spielsystem: `Warhammer Fantasy Battles (6th definitive edition).gst`
  (`0d13-7737-ea86-4662`, rev 1)
- Katalog: `Orcs and goblins (6th definitive edition).cat` (`4049-c46d-7f80-44fb`, rev 1),
  dazu die per `catalogueLink` (`b066-2f8e-11ee-1dce`, Z. 14916) benötigte
  `Mercenaries (6th definitive edition).cat` (`fc47-8392-a6c8-452a`).

> **Assertion-Form:** Die Kernaussage ist je Roster ein `expect.capabilities[]`-Eintrag
> mit `isHidden` an einem **Angebots-Anker** (`anchorKind: offerAnchor`,
> `frameDefId` = das Kontingent) — exakte Gleichheit auf dem effektiven
> Sichtbarkeits-Flag. Die `instanceOf`-Bedingung selbst ist **keine zählende
> Grenze** und erscheint daher **nicht** im Verletzungsbericht; sie ist nur über
> ihre Wirkung auf `field="hidden"` beobachtbar. In `firing` stehen lediglich die
> beiden Armeeaufbau-Pflichten des Spielsystems (General `min 1`, Core `min 2`) —
> sie sind nicht Gegenstand des Szenarios, sondern der Nachweis, dass das
> Kontingent überhaupt aufgelöst und als leer erkannt wurde. Weitere Diagnosen
> dürfen zusätzlich auftreten (selektive Erwartung).

---

## Was §7.7 über die beiden Kodierungen sagt

Aus dem Kasten
[„`instanceOf`/`notInstanceOf` gegen eine `forceEntry` — zwei Kodierungen"](../../battlescribe-data-format.md#77-modifier-condition-condition-group-repeat)
und der `condition`-Attributtabelle derselben Sektion, wörtlich abgeleitet:

- **Selbst-gegattert:** die `forceEntry`-Id steht direkt in `scope`
  (`scope="<forceId>"`), `childId` bleibt leer oder trägt `"any"`.
- **Kanonisch:** `scope` trägt das Literal-Keyword `force`, die Id steht in
  `childId` (`scope="force" childId="<forceId>"`).
- **Beide bedeuten dasselbe:** die Bedingung hält genau dann, wenn das
  umschließende Kontingent eine Instanz dieses `forceEntry` ist — und in jedem
  anderen Kontingent nicht.
- Erkannt wird eine `forceEntry`-Instanzprüfung daran, dass **`scope` oder
  `childId`** auf eine reale `forceEntry`-Id auflöst; das Literal `"force"` tut
  das nicht.
- Es ist eine **Identitätsprüfung, kein Zählrahmen**. Die Zähl-Flags engen sie
  folglich nicht ein: `percentValue` ist bei `instanceOf` laut Wiki „has no
  effect"; `shared`, `includeChildSelections`, `includeChildForces` und der
  `value` beschreiben eine Summe, die hier nicht gebildet wird. Ein Kontingent
  wird durch eine Instanz nicht enger — dieselbe Argumentation, die §7.7 für
  `scope="ancestor"` und §7.6 für `scope="primary-catalogue"` führt.
- `type="set"` auf `field="hidden"` **ersetzt** den Feldwert, solange die
  Bedingungen halten; halten sie nicht, bleibt der geschriebene Basiswert des
  `hidden`-Attributs stehen. Eine `or`-Gruppe hält, wenn **mindestens ein**
  Mitglied hält.

---

## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)

Alle Zeilenangaben beziehen sich auf `Orcs and goblins (6th definitive edition).cat`,
sofern nicht anders vermerkt.

| ID | Regel | Beleg (Datei / Element) |
|----|-------|--------------------------|
| **FIS-R1** | **Die selbst-gegatterte Kodierung existiert und benennt ein reales `forceEntry`.** `scope="a2fa-6a0e-8c17-373c"` ist keine Scope-Vokabel des Formats, sondern die Id des Kontingents „Mountain or Troll Country Waaagh! (OG-AB)" derselben Datei. | `forceEntry id="a2fa-6a0e-8c17-373c"` (Z. 110). Der Konstrukt-Typ steht 11× in dieser Datei: Z. 184, 497, 1398, 3113, 3398, 4988, 5539, 6734, 9086, 12478, 14880 — jeweils `scope="a2fa-6a0e-8c17-373c" childId="any"`, `field="selections"`, `type="instanceOf"`. |
| **FIS-R2** | **Bedingung hält → `set` ersetzt das Flag:** Im Kontingent `a2fa-…` sind **Savage Orc Warboss** und **Savage Orc Great Shaman** verborgen (`isHidden` = `true`), obwohl beide den Basiswert `hidden="false"` tragen. Von der `or`-Gruppe hält dort **ausschließlich** das selbst-gegatterte Mitglied. | `selectionEntry "Savage Orc Warboss"` `ca27-a5f4-4a3e-7aeb` (Z. 177, `type="unit"`, `hidden="false"`) → `<modifier type="set" field="hidden" value="true">` (Z. 179) mit **einer** `conditionGroup type="or"` (Z. 181). Ihre sieben Mitglieder (Z. 183–189): `scope="force" childId="c248-eea0-b5c1-857b"`, **`scope="a2fa-6a0e-8c17-373c" childId="any"` (Z. 184)**, `childId="b26c-6f4c-34a5-dc0c"`, `childId="03cc-8a3f-abd4-3c03"`, `childId="1821-fbd1-0d96-2d88"`, `childId="9f70-0506-b8c7-f2c4"` sowie ein zählendes `type="atLeast" value="1" childId="5653-1e8a-640d-fc56"`. Der Zwilling `selectionEntry "Savage Orc Great Shaman"` `0767-0a7d-7c03-8833` (Z. 490) trägt **dieselbe** Gruppe mit denselben sieben Mitgliedern (Z. 496–502, selbst-gegattert in Z. 497). |
| **FIS-R3** | **Die Zähl-Flags engen nicht ein:** Das selbst-gegatterte Mitglied trägt `field="selections"`, `value="1"`, `includeChildSelections="false"`, `includeChildForces="false"`. Trotzdem hält es in einem **völlig leeren** Kontingent. Eine zählende Lesart käme dort zwangsläufig auf 0 Auswahlen und dürfte nicht halten — genau diese Unterscheidung pinnt Roster 01. | Z. 184 / Z. 497 (Attributsatz) gegen den Roster-Zustand (Kontingent ohne jede `selection`). Format: §7.7, „Es ist eine Identitätsprüfung, kein Zählrahmen" (siehe oben). |
| **FIS-R4** | **Kein Mitglied hält → Basiswert bleibt:** Im Kontingent „Savage Orc Horde (OG-AB)" (`59e1-efd7-af88-55a1`) kommt **keine** der sechs `forceEntry`-Ids der `or`-Gruppe vor, und das zählende `atLeast`-Mitglied zählt 0 (Grom ist nicht gewählt). Beide Savage-Orc-Charaktere behalten ihren Basiswert und sind **sichtbar** (`isHidden` = `false`). | `forceEntry "Savage Orc Horde (OG-AB)"` `59e1-efd7-af88-55a1` (Z. 88) — diese Id steht in **keiner** Zeile von Z. 183–189 bzw. Z. 496–502. `selectionEntry "Grom the Paunch of Misty Mountain"` `5653-1e8a-640d-fc56` (Z. 8397, `hidden="true"`) ist in keinem Roster dieses Szenarios enthalten, das `atLeast 1` bleibt also bei Ist 0. Beide Träger besitzen je **genau einen** `field="hidden"`-Modifikator (Warboss: Z. 179–193, sonst keiner bis Z. 335; Great Shaman: Z. 492–506, sonst keiner bis Z. 635). |
| **FIS-R5** | **Beide Kodierungen wirken gleich:** Im Kontingent „Night Goblin Horde (OG-AB)" (`c248-eea0-b5c1-857b`) hält das **erste, kanonisch kodierte** Mitglied derselben `or`-Gruppe — mit demselben Ergebnis wie in FIS-R2: beide Träger verborgen. Das selbst-gegatterte Mitglied hält dort **nicht**. | `forceEntry "Night Goblin Horde (OG-AB)"` `c248-eea0-b5c1-857b` (Z. 62); Bedingung Z. 183 bzw. Z. 496 (`scope="force" childId="c248-eea0-b5c1-857b"`). |
| **FIS-R6** | **Kontrolle — die Wirkung ist dem selbst-gegatterten Mitglied zuzuschreiben, nicht dem Kontingent:** „Orc Great Shaman" (`aa57-63c4-136b-4af5`) trägt denselben `set hidden=true`-Bau, seine `or`-Gruppe enthält aber **kein** `a2fa-…` (dafür kanonisch `59e1-…`). Er ist deshalb im Kontingent `a2fa-…` **sichtbar** und im Kontingent `59e1-…` **verborgen** — exakt invers zu den beiden Savage-Orc-Charakteren. Wäre in Roster 01 etwas Kontingentweites die Ursache, müsste er dort mitverschwinden. | `selectionEntry "Orc Great Shaman"` `aa57-63c4-136b-4af5` (Z. 336, `hidden="false"`); sein `<modifier type="set" field="hidden" value="true">` am Ende des Eintrags (Z. 473, Kommentar „Savage Orc Horde (OG-AB, p.76)" Z. 474) mit den Mitgliedern Z. 478–483: `c248-…`, **`59e1-efd7-af88-55a1`**, `b26c-…`, `03cc-…`, `9f70-…`, `atLeast` Grom. Kein `a2fa-…`, kein `1821-…`. |
| **FIS-R7** | **Alle drei Träger erscheinen in allen drei Kontingenten als Angebots-Anker.** Sie tragen die Kategorie *Lord* primär, und jedes der drei `forceEntry` führt einen `categoryLink` auf *Lord*; keiner der drei Träger hat eine eigene `min`-Grenze, ist also Angebot und kein Pflicht-Anker. | Primärkategorie *Lord* `d024-d25b-a9b4-73b6`: `ca27-…` Z. 202, `0767-…` Z. 516, `aa57-…` Z. 343. `categoryLink` *Lord* im `forceEntry`: `c248-…` Z. 68, `59e1-…` Z. 94, `a2fa-…` Z. 114. Keiner der drei Wurzel-Einträge trägt ein `<constraints>`-Element auf Wurzelebene (Warboss Z. 177–335, Orc Great Shaman Z. 336–489, Savage Orc Great Shaman Z. 490–635). |
| **FIS-R8** | **Der Autor behandelt beide Kodierungen als Synonyme** — zusätzlicher Datenbeleg außerhalb der Testträger: zwei benachbarte Stellen benennen dasselbe `forceEntry` `a2fa-…` mit demselben `value="0"`, die eine selbst-gegattert, die andere kanonisch. | Z. 4988 (`scope="a2fa-6a0e-8c17-373c" childId="any"`) und Z. 5002 (`scope="force" childId="a2fa-6a0e-8c17-373c"`), beide `type="instanceOf" value="0" field="selections"`. Ebenso trägt der `entryLink "Wyvern"` `5ddb-5bfd-a86d-4ff6` (Z. 1394) das selbst-gegatterte Muster (Z. 1398). |
| **FIS-R9** | **Nachweis, dass das Kontingent aufgelöst wurde:** Ein leeres Kontingent verletzt die beiden Spielsystem-Pflichten *General* (`min 1`, `scope="force"`) und *Core* (`min 2`, `scope="force"`) mit Ist 0. Ohne Punktelimit im Roster greift keiner der punkteskalierenden `set`-Modifikatoren auf die Core-Grenze, der Grenzwert bleibt bei 2. | `.gst`: `categoryEntry "General"` `a37e-7207-de6d-acb0` → `constraint id="1077-7379-f142-f382" type="min" value="1" field="selections" scope="force"` (Z. 724). `categoryEntry "Core"` `64bf-efb4-9978-26df` → `constraint id="35c2-d478-392a-aeb1" type="min" value="2" field="selections" scope="force"` (Z. 374); die `set`-Modifikatoren darauf (Z. 377 ff.) sind an Punkte-Brackets bzw. „Border Patrols" gebunden, die hier alle nicht halten. |

### Bewusst ausgelassene Facetten

| Facette | Warum nicht abgedeckt |
|---------|------------------------|
| Die `instanceOf`-Bedingung als **feuernde Grenze** | Eine `condition` ist keine `constraint`; der Verletzungsbericht kodiert zählende Grenzen, nicht Bedingungen. Der Effekt ist nur mittelbar — über `field="hidden"` — beobachtbar und wird deshalb ausschließlich per `expect.capabilities[].isHidden` gepinnt. |
| `notInstanceOf` in selbst-gegatterter Kodierung | In diesem Katalog kommt zu `scope="<forceId>"` nur `type="instanceOf"` vor; ein `notInstanceOf` mit `forceEntry`-Id im `scope` ist in den Fixture-Daten nicht belegt und wäre erfunden. |
| Der `value`-Unterschied `1` vs. `0` an den 11 Fundstellen (FIS-R8) | Er ist real, aber an den **Testträgern** durchgehend `value="1"`. Ob eine Engine `value="0"` an einer Identitätsprüfung anders liest, ließe sich nur über andere Träger (u. a. `Trolls` `7b28-6caa-7922-aeb8`) prüfen; das ist ein eigenes Szenario und würde die hier isolierte Aussage verwässern. |
| Die Träger als **gewählte** Auswahl statt als Angebot | Ein `.ros` trägt sein Kontingent fest; „dieselbe Auswahl wird durch Kontingentwechsel unsichtbar" ist mit statischen Rostern nicht abbildbar. Der Angebots-Anker trägt dasselbe `isHidden`-Flag und pinnt die Modifikator-Zelle vollständig. |
| Profil-/Regel-Änderungen, Kosten, Kategoriezugehörigkeit | Der hier gepinnte Modifikator ist ausschließlich `set` auf `field="hidden"`. Andere Modifikator-Zellen gehören in eigene Szenarien. |

---

## Testkatalog (E2E-Szenarien der neuen Engine)

Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle drei Roster
sind **bis auf `entryId`/`name` des Kontingents identisch** und enthalten
**keine einzige Auswahl**. Genau der eine Unterschied ist der Auslöser — die
Sichtbarkeitsänderung lässt sich keiner anderen Ursache zuschreiben, und die
Leere des Kontingents schließt jede zählende Erklärung aus.

| # | Testtitel | Roster-Zustand | Erwartetes Ergebnis (nicht-technisch) | Fixture |
|---|-----------|----------------|----------------------------------------|---------|
| 01 | Selbst-gegattertes Mitglied hält | Leeres Kontingent **„Mountain or Troll Country Waaagh! (OG-AB)"** (`a2fa-6a0e-8c17-373c`). | **FIS-R2/R3:** Savage Orc Warboss (`ca27…`) und Savage Orc Great Shaman (`0767…`) melden `isHidden: true` — allein wegen der Bedingung mit der `forceEntry`-Id im `scope`. **FIS-R6:** Orc Great Shaman (`aa57…`) meldet `isHidden: false`. **FIS-R9:** General- und Core-Pflicht feuern mit Ist 0. | [`01-mountain-waaagh-self-gated.ros`](rosters/01-mountain-waaagh-self-gated.ros) |
| 02 | Kein Mitglied hält | **Derselbe** leere Aufbau im Kontingent **„Savage Orc Horde (OG-AB)"** (`59e1-efd7-af88-55a1`). | **FIS-R4:** Beide Savage-Orc-Charaktere melden `isHidden: false` — der Basiswert `hidden="false"` bleibt stehen. **FIS-R6:** Orc Great Shaman meldet `isHidden: true` (kanonisches `59e1`-Mitglied) — die Kontrolle kippt genau invers. | [`02-savage-orc-horde-no-member-holds.ros`](rosters/02-savage-orc-horde-no-member-holds.ros) |
| 03 | Kanonisches Mitglied hält (Zeuge) | **Derselbe** leere Aufbau im Kontingent **„Night Goblin Horde (OG-AB)"** (`c248-eea0-b5c1-857b`). | **FIS-R5:** Beide Savage-Orc-Charaktere melden `isHidden: true` — dieselbe Wirkung wie in 01, nur über die kanonische Kodierung erreicht. Orc Great Shaman ebenfalls `isHidden: true` (führt `c248` gleichfalls). | [`03-night-goblin-horde-canonical.ros`](rosters/03-night-goblin-horde-canonical.ros) |

Die Matrix, die das Szenario aufspannt (Zelle = `isHidden` des Angebots-Ankers):

| Träger | 01 `a2fa` (selbst-gegattert) | 02 `59e1` (kein Mitglied) | 03 `c248` (kanonisch) |
|--------|------------------------------|---------------------------|------------------------|
| Savage Orc Warboss `ca27-a5f4-4a3e-7aeb` | `true` | `false` | `true` |
| Savage Orc Great Shaman `0767-0a7d-7c03-8833` | `true` | `false` | `true` |
| Orc Great Shaman `aa57-63c4-136b-4af5` (Kontrolle) | `false` | `true` | `true` |

---

## Abgleich mit dem Engine-Bericht (Runner-Verifikation)

Die oben aus den Katalogdaten **abgeleiteten** Erwartungen treffen die Engine
erst im **Runner-Lauf** — der separate Verifikationsschritt, der nicht zur
(blinden) Autorenschaft gehört (siehe
[ADR 0033](../../adr/0033-evaluator-e2e-manifest-runner-und-black-box-autorenschaft.md)).
Abweichungen sind zu **untersuchen**, nicht durch Anpassen der Erwartung
wegzudefinieren. Die erwartungsgemäß heiklen Stellen:

1. **FIS-R2/R3** — ob `scope="<forceId>"` überhaupt als `forceEntry`-Instanzprüfung
   erkannt wird, statt als unbekannte Scope-Vokabel zu scheitern oder in eine
   selektionsweise Zählung zurückzufallen. Im leeren Kontingent unterscheidet
   sich beides maximal: die Identitätslesart liefert „hält", jede Zähllesart
   „hält nicht".
2. **FIS-R3** — ob `includeChildSelections="false"` / `includeChildForces="false"`
   und `value="1"` die Prüfung fälschlich einengen.
3. **FIS-R5** — ob beide Kodierungen dieselbe Wirkung erzeugen (01 und 03 müssen
   für `ca27…`/`0767…` dasselbe Ergebnis liefern).
4. **FIS-R6** — ob die Kontrolle wirklich invers kippt; ein „im Kontingent `a2fa`
   ist alles verborgen"-Kurzschluss würde hier auffallen.
5. Die Slot-Adressierung: `defId` + `frameDefId` (= die `forceEntry`-Id) muss den
   Angebots-Anker **eindeutig** treffen — im leeren Kontingent steht jede
   Definition genau einmal.

### Verifizierte Bausteine (aus den Katalogdaten)

| Element | ID |
|---------|-----|
| Force „Mountain or Troll Country Waaagh! (OG-AB)" (Ziel der selbst-gegatterten Bedingung) | `a2fa-6a0e-8c17-373c` (Z. 110) |
| Force „Savage Orc Horde (OG-AB)" (Gegenprobe: in keiner der `or`-Gruppen der Savage-Orc-Träger) | `59e1-efd7-af88-55a1` (Z. 88) |
| Force „Night Goblin Horde (OG-AB)" (Zeuge der kanonischen Kodierung) | `c248-eea0-b5c1-857b` (Z. 62) |
| Savage Orc Warboss, Träger 1 (`hidden="false"` + `set hidden=true`-Gatter) | `ca27-a5f4-4a3e-7aeb` (Z. 177; Modifikator Z. 179–193, selbst-gegattertes Mitglied Z. 184) |
| Savage Orc Great Shaman, Träger 2 (identische `or`-Gruppe) | `0767-0a7d-7c03-8833` (Z. 490; Modifikator Z. 492–506, selbst-gegattertes Mitglied Z. 497) |
| Orc Great Shaman, Kontrolle (`or`-Gruppe ohne `a2fa`, mit `59e1`) | `aa57-63c4-136b-4af5` (Z. 336; Modifikator Z. 473–487, Mitglieder Z. 478–483) |
| Weitere `forceEntry`-Ids der `or`-Gruppe (kanonisch kodiert, in keinem Roster benutzt) | `b26c-6f4c-34a5-dc0c` (Z. 75), `03cc-8a3f-abd4-3c03` (Z. 136), `1821-fbd1-0d96-2d88` (Z. 147), `9f70-0506-b8c7-f2c4` (Z. 162) |
| „Grom the Paunch of Misty Mountain" (Ziel des zählenden `atLeast`-Mitglieds; nie gewählt ⇒ Ist 0) | `5653-1e8a-640d-fc56` (Z. 8397) |
| Kategorie *Lord* (primär an allen drei Trägern; `categoryLink` in allen drei Forces) | `d024-d25b-a9b4-73b6` |
| Spielsystem-Pflicht *General* `min 1` / *Core* `min 2` (`scope="force"`) | `1077-7379-f142-f382` (`.gst` Z. 724) / `35c2-d478-392a-aeb1` (`.gst` Z. 374) |
| `catalogueLink` O&G → Mercenaries | `b066-2f8e-11ee-1dce` → `fc47-8392-a6c8-452a` (Z. 14916) |
| Weitere Fundstellen des selbst-gegatterten Musters (11×, nicht alle getestet) | Z. 184, 497, 1398, 3113, 3398, 4988, 5539, 6734, 9086, 12478, 14880 |

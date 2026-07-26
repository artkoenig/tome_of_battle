# Army Builder

Ein WHFB6-Armeelisten-Builder als PWA. Dieser Glossar-Abschnitt hält Begriffe fest, die im Projekt sonst leicht verwechselt werden.

## Language / Glossary

**Release**:
Der bewusste, manuelle Akt, eine neue Versionsnummer zu setzen (`package.json` + Git-Tag `vX.Y.Z`) und den zugehörigen `main`-Commit in Vercel auf Production zu promoten.
_Avoid_: Deployment (siehe unten — nicht jedes Deployment ist ein Release).

**Deployment**:
Jeder von Vercel gebaute Build (bei Push auf `main` oder einen anderen Branch). Ein Deployment ist noch kein Release — es wird erst durch manuelles Promoten in Vercel produktiv.

**Version**:
Die Semver-Nummer (`vX.Y.Z`) in `package.json`, die einen Release eindeutig identifiziert und in den App-Einstellungen angezeigt wird.

**Release Notes** ("Chronik der Veränderungen"):
Die nutzersichtbare Liste der `feat:`/`fix:`-Commit-Subjects seit der zuletzt installierten Version, angezeigt im PWA-Update-Dialog. Datenquelle ist die Git-Commit-Historie, nicht der Issue-Tracker.
_Avoid_: Changelog (technischer Begriff für dieselbe Sache — `changelog.json` als Dateiname bleibt, aber im Nutzerkontext heißt es Release Notes / "Chronik der Veränderungen").

**Production** (Domain):
Die vom Nutzer aufgerufene Live-Domain, auf die zuletzt ein Deployment manuell promotet wurde (siehe Release). Nicht gleichzusetzen mit "der `main`-Build" — ein Deployment vom `main`-Branch (z. B. die Vercel-Branch-Alias-URL) ist erst nach dem manuellen Promoten tatsächlich Production, siehe [ADR 0021](docs/adr/0021-preview-badge-laufzeit-hostname-erkennung.md).
_Avoid_: "main-Build" als Synonym für Production — seit ADR 0019 sind das zwei verschiedene Zustände.

**UI-Sprache**:
Die Sprache der App-eigenen Oberflächentexte (Buttons, Menüs, Dialoge, Validierungsmeldungen) — Deutsch oder Englisch. Sie wird beim ersten Start aus der Browser-Sprache abgeleitet (Deutsch → Deutsch, sonst Englisch) und kann manuell umgestellt werden; die manuelle Wahl wird lokal gespeichert und übersteuert die Automatik dauerhaft. Jede Oberfläche (App, Landing Page) merkt sich ihre Wahl getrennt.
_Avoid_: "Locale" (mehr als wir abbilden — wir schalten nur Texte und Zahlenformat), "App-Sprache und Datensprache" als ein Begriff (siehe Katalogsprache).

**Fallback-Sprache**:
Englisch. Fehlt ein Übersetzungsschlüssel in der aktiven UI-Sprache, wird der englische Text angezeigt; neue Sprachen entstehen als reine Übersetzungsdateien gegen den englischen Schlüsselbestand.

**Katalogsprache**:
Die Sprache der geladenen Battlescribe-Katalogdaten (Einheitennamen, Regeln, Profile, Optionsnamen) — faktisch Englisch. Katalogtexte werden nie von der App übersetzt, unabhängig von der UI-Sprache (Entscheidung aus Issue 47/02, bekräftigt in [ADR 0026](docs/adr/0026-i18n-eigenloesung-json-und-intl-ohne-library.md)). „Pass-through" meint **keine Übersetzung**, nicht „byte-identisch": das Rendern belegter BattleScribe-Text-Tokens (`{this}` → Eintragsname) ist Darstellung, die den Text in Katalogsprache belässt (siehe [ADR 0028](docs/adr/0028-battlescribe-text-tokens-in-autor-meldungen.md)).
_Avoid_: "Spieldaten übersetzen" — das wäre ein eigenes Vorhaben und liegt außerhalb der App-i18n.

**Zustandsbericht**:
Die bei jedem Push auf `main` neu erzeugte HTML-Seite über den Zustand des Projekts — Healthcheck (Qualitäts-Gates mit ihrer tatsächlichen Wirksamkeit, Kennzahlen, Testabdeckung, längste Funktionen, Strukturfakten) und die offenen Vorgänge des lokalen Trackers. Sein Inhalt leitet sich vollständig aus der Live-Messung ab; es gibt keinen hand-gepflegten Deutungstext, der veralten könnte. Er ist eine Momentaufnahme über das *Projekt*, richtet sich an den Maintainer und wird über GitHub Pages veröffentlicht (siehe [ADR 0025](docs/adr/0025-pages-quelle-auf-github-actions-mit-jekyll-build.md)).

Sein Veröffentlichen heißt **Veröffentlichung des Zustandsberichts** — es ist ausdrücklich kein *Deployment*, kein *Release* und erreicht keine *Production*: Diese drei Begriffe bleiben exklusiv an die Auslieferung der **Anwendung** über Vercel gebunden. Der Bericht enthält keinen Anwendungscode, hat keine Versionsnummer und kein Freigabe-Gate.
_Avoid_: "Pages-Deployment", "Report-Release", "Doku-Production" — jede Übertragung der Auslieferungsbegriffe auf den Bericht verwässert sie.

### Regelauswertung (Constraints)

**Query**:
Der gemeinsame BSData-Grundbaustein (XSD `QueryBase`), der *etwas zählt oder eine Bezugsgröße liest* (`field`: Anzahl Auswahlen, Summe einer Kostenart, oder — als `limit::<costTypeId>` — die *eingestellte Grenze* einer Kostenart aus dem Roster-Budget, nicht die verplante Summe) in einem *Bezugsrahmen* (`scope`). Seine drei Ausprägungen sind **Grenze** (Constraint, min/max), **Bedingung** (Condition, Vergleich → Wahrheitswert) und **Wiederholung** (Repeat, Teilung → Wiederholungszahl); sie unterscheiden sich nur darin, was mit dem gezählten Wert geschieht.
_Avoid_: „Constraint" als Oberbegriff für alle drei — eine Constraint ist nur die Grenzen-Ausprägung.

**Bezugsrahmen (Scope)**:
Der Bereich, über den eine Query zählt — ein fester Satz Schlüsselwörter (`roster`, `force`, `parent`, `self`) oder die ID eines Eintrags bzw. einer Kategorie. Ein `roster`-Bezug zählt über die ganze Liste, nicht nur den lokalen Teilbaum. Ein `force`-Bezug richtet sich nach dem **Ziel-Typ**: ein Eintrags-Ziel zählt pro Kontingent, ein Kategorie-Ziel armeeweit (über alle Forces aggregiert) — einheitlich für Constraint, Condition und Repeat (ADR 0029).
_Avoid_: „Scope" mit „Ziel" (`childId`, *was* gezählt wird) zu vermengen — der Bezugsrahmen ist *wo* gezählt wird.

**Modifikator** (Modifier):
Eine Regel eines Katalog-Autors, die einen Zielwert verändert (XSD `Modifier`). Sie trägt eine **Art** (`type`: `set`, `increment`, `decrement`, `add`, `remove`, `append`, `prepend`, `set-primary`, `unset-primary`, `multiply`), ein **Ziel** (`field`: die ID des veränderten Werts oder ein Schlüsselwort wie `"category"`/`"hidden"`) und einen **Wert**. Es gibt **kein** eigenes `targetKind`/`targetId`-Attribut — das Ziel steckt allein im `field`-String (siehe [ADR 0016](docs/adr/0016-battlescribe-xsd-als-vendored-konformitaetsquelle.md), [ADR 0031](docs/adr/0031-evaluator-liest-battlescribe-xsd-syntax-und-teilt-enum-ssot.md)).
_Avoid_: `op`/`operation`/`targetKind` — diese Namen existieren nicht in der BattleScribe-XSD; kanonisch sind `type` und `field`.

**Bedingungsgruppe / Modifikatorgruppe** (conditionGroup / modifierGroup):
Verschachtelungs-Bausteine der Regelauswertung. Eine **Bedingungsgruppe** (XSD `ConditionGroup`) verknüpft mehrere Bedingungen und/oder weitere Bedingungsgruppen mit `and`/`or` zu einem einzigen Wahrheitswert. Eine **Modifikatorgruppe** (XSD `ModifierGroup`) bündelt mehrere Modifikatoren unter einer gemeinsamen Bedingung bzw. Bedingungsgruppe, sodass sie gemeinsam greifen oder gemeinsam entfallen.
_Avoid_: eine Bedingungsgruppe mit einer einzelnen Bedingung gleichzusetzen — die Gruppe ist die `and`/`or`-Verknüpfung, nicht der einzelne Vergleich.

### Auswertungsbericht

**Slot**:
Eine Stelle im Auswertungsbaum, an der eine Auswahl stehen kann — entweder belegt durch eine Instanz aus dem Roster oder als **Phantom** synthetisiert, damit eine Grenze auch *beim Fehlen* der Auswahl ausgewertet werden kann. Zwei Instanzen derselben Definition sind zwei Slots.
_Avoid_: „Slot" mit „Definition" gleichzusetzen — die Definition steht im Katalog, der Slot in der Auswertung einer konkreten Liste.

**Fähigkeitsdatensatz** (SlotCapability):
Was der Bericht je Slot aussagt: effektives Mindest- und Höchstmaß, aktueller Stand, verbleibender Spielraum, ob eine Pflicht unerfüllt ist, ob der Slot gesperrt oder versteckt ist, sowie die bedingten Hinweise an ihm. Er ist eine *Sicht auf denselben, genau einmal ausgewerteten Stand* wie die Validierungsmeldungen — keine zweite Auswertung.
_Avoid_: ihn als „Verfügbarkeitsprüfung" zu bezeichnen — er ist ein abgelesener Zustand, kein eigener Prüflauf.

### Validierung & Fehlermeldungen

**Validierungsmeldung**:
Eine einzelne Aussage des Roster-Validators über einen Regelverstoß an der Armeeliste (z. B. ein über- oder unterschrittenes Limit). Sie trägt einen stabilen maschinellen Typ, einen Schweregrad und Korrelations-IDs (Force/Kategorie/Auswahl).
_Avoid_: "Fehler" als pauschaler Sammelbegriff — auch Hinweise und Warnungen sind Validierungsmeldungen, nicht nur blockierende Fehler.

**Schweregrad** (error / warning / info):
Die Dringlichkeitsstufe einer Validierungsmeldung. Nur `error` blockiert das Spielen der Liste; `warning` und `info` sind rein hinweisend.
_Avoid_: "Fehlerstufe" — der Schweregrad gilt auch für nicht-fehlerhafte Meldungen.

**App-Meldung** vs. **Autor-Meldung**:
Eine App-Meldung erzeugt die Anwendung selbst aus den Regeldaten. Der Solver liefert dafür nur einen stabilen Schlüssel plus Parameter (ADR 0026); den fertigen Satz bildet erst die Oberfläche aus der Vorlage der aktiven UI-Sprache (`src/i18n/locales/de.json` bzw. `en.json`) — es gibt also je Sprache eine frei formulierbare Vorlage, keine einzelne „deutsche Vorlage". Eine Autor-Meldung ist der Text eines Katalog-Autors (`modifier-error/-warning/-info`) und bleibt in seiner Katalogsprache (siehe [ADR 0022](docs/adr/0022-ui-verfuegbarkeit-leitet-sich-aus-dem-validator-ab.md)). Sie wird nicht übersetzt und nicht umformuliert; einzige Ausnahme ist das Rendern belegter BattleScribe-Text-Tokens (`{this}` → effektiver Name des betroffenen Eintrags) beim Erzeugen der Meldung im Solver — Darstellung, keine Übersetzung (siehe [ADR 0028](docs/adr/0028-battlescribe-text-tokens-in-autor-meldungen.md)).
_Avoid_: beide unter "Fehlertext" zusammenzufassen — nur App-Meldungen dürfen umformuliert werden.

**Katalogname**:
Ein aus den Regeldaten stammender Eigenname (Einheit, Option, Kategorie — z. B. `"Weapons"`, `"Commander"`), der in Meldungen eingebettet wird. Er wird unverändert und unübersetzt übernommen (siehe [ADR 0003](docs/adr/0003-battlescribe-domain-rules.md)); nur das sprachabhängige Satzgerüst der jeweiligen Vorlage darum herum ist frei formulierbar.
_Avoid_: Katalognamen zu "verschönern" oder zu übersetzen.

**Ursache** (einer Validierungsmeldung):
Die auslösende Auswahl hinter einer App-Meldung, deren verletzter Grenzwert **bedingt** verändert wurde — also durch einen Modifier mit erfüllter Bedingung, der den Wert erst zum verletzten Wert gemacht hat (z. B. „weil `"Battle Standard Bearer"` gewählt ist → Waffen-Max = 0"). Eine Meldung kann mehrere Ursachen tragen (mehrere zusammenwirkende bedingte Modifier). Der Solver liefert sie sprachfrei als optionales Feld am Fehlerobjekt (benennbare Auswahl als Katalogname/-ID), die Oberfläche zeigt sie als „Ursachen"-Block (siehe [ADR 0027](docs/adr/0027-validierungs-ursachen-am-fehlerobjekt.md)).
_Avoid_: reine Basiswerte oder unbedingte Modifier als "Ursache" zu bezeichnen — die sind Teil der Grundregel, kein „weil du X getan hast"; und nicht sauber auf eine benennbare Auswahl auflösbare Bedingungen als Ursache anzuzeigen.

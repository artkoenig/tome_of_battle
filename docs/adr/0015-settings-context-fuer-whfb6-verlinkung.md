# 0015: React Context für die whfb6-Verlinkungs-Einstellung

- **Status:** Superseded by [ADR-0023](0023-settingscontext-generischer-store.md)
- **Datum:** 2026-07-17
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs (falls vorhanden):** Präzisiert [ADR-0010: Einheitliches Dialog- und Toast-System](0010-einheitliches-dialog-und-toast-system.md) für einen Fall, den es explizit als YAGNI-Revisionsgrund benannt hat; betrifft [ADR-0012: Integration externer Regeltexte (6th.whfb.app)](0012-integration-externer-regeltexte-6th-whfb-app.md); der hier begründete enge Scope wird durch [ADR-0023](0023-settingscontext-generischer-store.md) revidiert

## Kontext und Problemstellung

Eine neue Einstellung soll die Verlinkung von Regeln/Waffen/Magic-Item-Chips zu `6th.whfb.app` global ein-/ausschaltbar machen (bei "aus" verhält sich die App überall so, als gäbe es kein URL-Mapping – reiner Katalog-Fallback). Der Wert wird an mindestens sechs Stellen unterschiedlicher Verschachtelungstiefe gebraucht: `RuleChipIcon`, `UnitChips`, `SelectionConfigurator`, `OptionGroup`, `RosterEditor`, `PlayMode`, `PlayUnitDetails`.

ADR-0010 hat einen globalen React-Context für Toasts/Bestätigungsdialoge bewusst abgelehnt, weil dort ausschließlich einzelne, kontextnahe Aufrufer betroffen waren ("Da alle `alert`-Meldungen in `App.jsx` ausgelöst werden..."). Es hat aber selbst den Revisionsfall benannt: *"Falls zukünftig tiefe Kindkomponenten Bestätigungsdialoge benötigen, müssen Callbacks oder Props nach oben gereicht werden (oder zu dem Zeitpunkt refaktoriert werden)."*

## Entscheidungsfaktoren (Drivers)

- **Reaktivität:** Ändert der Nutzer die Einstellung, müssen alle sichtbaren Chips sofort reagieren (kein Reload nötig).
- **Wartbarkeit:** Kein Prop-Drilling eines einzelnen Booleans durch 6+ Komponentenebenen, die diesen Prop sonst alle kennen und weiterreichen müssten.
- **Konsistenz mit ADR-0010:** Abweichung nur dort, wo dessen eigene Kriterien (tiefe Verschachtelung) tatsächlich zutreffen – kein Freibrief für Context an anderer Stelle.

## Betrachtete Optionen

- **Option 1: Prop-Drilling** – Boolean wird wie der bestehende `onShowRule`-Callback durch alle Ebenen gereicht.
- **Option 2: Modul-Singleton in `rulesLookup.js`** – Ein modul-interner mutable Flag, den `getRuleUrl()` selbst prüft.
- **Option 3: Neuer `SettingsContext` (Gewählte Option)** – Ein schlanker React-Context liefert den Boolean reaktiv an jede Tiefe.

## Entscheidungsergebnis

Gewählte Option: **Option 3**, weil sie die einzige ist, die sowohl Reaktivität (React-Re-Render bei Änderung) als auch Wartbarkeit (keine Prop-Kette durch 6+ Komponenten) bietet. Der Scope ist bewusst eng: `SettingsContext` liefert ausschließlich `{ whfb6LinkingEnabled, setWhfb6LinkingEnabled }` – kein generischer "App-Settings-Store" für beliebige zukünftige Einstellungen, um keinen unbegründeten Präzedenzfall für Context-Nutzung zu schaffen.

### Konsequenzen (Auswirkungen)

- **Positiv:** Jede Komponente, die den Link-Status prüft, liest ihn über einen Hook (z. B. `useSettings()`), ohne dass Zwischenkomponenten ihn kennen müssen. Neue Call-Sites können sich nicht "vergessen", den Prop weiterzureichen.
- **Negativ:** Erster Context in der Codebase für einen reinen App-Zustand (nicht Dialog/Toast) – etabliert ein Muster, das künftige Einstellungen ggf. nachahmen wollen. Bewusst in Kauf genommen, da die Alternative (Prop-Drilling durch 6+ Ebenen) schlechter wartbar wäre.
- **Neutral:** Re-Renders bei Änderung sind auf die Context-Consumer begrenzt (kleine, gezielte Komponentenmenge), kein spürbarer Performance-Impact.

## Vor- und Nachteile der Optionen

### Option 1: Prop-Drilling

- **Gut, weil** es konsistent mit ADR-0010 bleibt und keine neue Zustands-Technologie einführt.
- **Schlecht, weil** 6+ Komponenten den Prop explizit kennen und durchreichen müssen; jede neue Call-Site (z. B. eine künftige Chip-Variante) muss aktiv daran denken, sonst bricht die Einstellung lautlos.

### Option 2: Modul-Singleton in `rulesLookup.js`

- **Gut, weil** kein Context/Props nötig sind, `getRuleUrl()` bliebe die einzige Anlaufstelle.
- **Schlecht, weil** ein mutabler Modul-Singleton kein React-State ist – Komponenten rendern bei Änderung nicht automatisch neu, was manuelles Forcing oder einen Workaround erfordern würde. Bricht mit dem deklarativen React-Modell.

### Option 3: Neuer `SettingsContext` (Gewählte Option)

- **Gut, weil** Reaktivität und Wartbarkeit ohne Prop-Drilling kombiniert werden, exakt der von ADR-0010 selbst benannte Revisionsfall.
- **Schlecht, weil** es den ersten reinen App-Zustands-Context einführt – Scope daher bewusst eng gehalten (nur diese eine Einstellung, siehe oben).

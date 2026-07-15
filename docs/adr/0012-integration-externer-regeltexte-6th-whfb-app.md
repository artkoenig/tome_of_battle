# 0012: Integration externer WHFB-Regeltexte via 6th.whfb.app

- **Status:** Accepted
- **Datum:** 2026-07-15
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** 0010 (Einheitliches Dialog- und Toast-System), 0002 (Data Flow & IndexedDB)

## Kontext und Problemstellung

Die App zeigt Regeltexte (Sonderregeln, Waffen, Magic Items) nur in der knappen
Form an, die in den BattleScribe-Datendateien (`.gst`/`.cat`) steht — meist ein
einzelner Satz. Die vollständigen, durch Errata gepflegten Regelbuch-Texte mit
Tabellen, Querverweisen und Kontext fehlen.

Diese Volltexte existieren bereits gepflegt und frei zugänglich auf
`https://6th.whfb.app/` — einem Contentful-basierten, statisch generierten
Online-Regelindex für Warhammer Fantasy 6th Edition. Die Frage war, **wie** diese
Inhalte in unseren Builder eingebunden werden, ohne fremde Inhalte zu kopieren,
ohne die Offline-First-PWA zu belasten und ohne neue Laufzeit-Abhängigkeiten.

## Entscheidungsfaktoren (Drivers)

- **Keine Inhalts-Duplikation / Urheberrecht:** Fremde Regeltexte sollen nicht
  gescraped und lokal gehostet werden.
- **Aktualität:** Errata und neue Inhalte auf 6th.whfb.app sollen ohne Code-Release
  bei den Nutzern ankommen.
- **Offline-First bleibt erhalten (ADR-0002):** Die Kern-App muss ohne Netz voll
  funktionsfähig bleiben; externe Inhalte dürfen den Service-Worker nicht belasten.
- **Keine neuen Abhängigkeiten:** Weder für die Einbettung noch für die Daten-Pipeline.
- **Graceful Degradation:** Unbekannte Regeln und fehlendes Netz dürfen nie zu
  Broken Links führen — das bestehende Verhalten bleibt der Rückfall.
- **Wartbarkeit:** Das Name→URL-Mapping muss aktualisierbar sein, wenn 6th.whfb.app
  wächst; Namensabweichungen zwischen BSData und 6th.whfb.app müssen pflegbar sein.

## Betrachtete Optionen

- **Option 1 — Volltext-Scraping & lokale Speicherung** (analog zum Tooltip-Scraping
  in [old-world-builder](https://github.com/nthiebes/old-world-builder)): Die
  Regeltexte werden gecrawlt und als Daten mitgeliefert / in Tooltips gezeigt.
- **Option 2 — Verlinkung + Einbettung fremder Seiten** (Iframe-Dialog für
  Einzelregeln, neuer Tab für das Gesamt-Regelbuch), mit einem eingecheckten
  Name→URL-Mapping.
- **Option 3 — Laufzeit-Crawl / Live-API** von 6th.whfb.app bei jedem Aufruf.

## Entscheidungsergebnis

Gewählt: **Option 2 — Verlinkung und Einbettung statt Kopie.** Die App hält kein
fremdes Regeltext-Inhaltsmaterial, sondern nur ein **Name→URL-Mapping** und öffnet
die Original-Seiten von 6th.whfb.app.

### 1. Name→URL-Lookup (build-time, eingecheckt)

- **`scripts/generate-rules-index.js`** — manuell gestartetes CLI-Skript (Node 18+
  `fetch`, keine Dependencies). Crawlt die Index-Seiten der Sektionen
  `special-rules`, `weapons`, `magic-items`, `spell-lists`, `characteristics` und
  schreibt **`src/data/rules-index.json`** (eingecheckt, ~845 Einträge).
- **`src/data/synonyms.js`** — handgepflegtes Mapping `BSData-Name → kanonischer
  Name`, um Namensabweichungen zu überbrücken (z. B. `Short Bow → Shortbow`).
- **`src/data/rulesLookup.js`** — exportiert `getRuleUrl(name) → string | null`
  (Synonyms zuerst, dann `rules-index.json`, case-insensitive). `null` = kein
  Mapping.

Das Mapping wird **nicht zur Build- oder Laufzeit** neu gecrawlt, sondern bewusst
manuell aktualisiert und als Datenstand eingecheckt.

### 2. Zwei Darstellungsmodi

- **Einzelne Regel/Waffe/Magic Item → Iframe-Dialog** (`RulesIndexDialog`) auf der
  `?minimal=true`-Seite (ohne Seitennavigation). Nur wenn ein Mapping existiert;
  der betroffene Chip zeigt dann ein **`BookOpen`-Icon**. Ohne Mapping bleibt das
  bisherige Verhalten (Detail-Anzeige, **`Info`-Icon**) — kein Broken Link.
  **Link-Priorität (bewusste Entscheidung):** Existiert ein Regel-Link *und*
  Katalog-Info zum selben Eintrag, gewinnt der Link — die Katalog-Info wird dann
  nicht zusätzlich angeboten. Diese Entscheidung ist in der gemeinsamen Komponente
  `RuleChipIcon` zentralisiert und gilt einheitlich für Regel-Chips,
  Standalone-Optionen **und gruppierte Optionen** (Magic Items/Waffen in Gruppen).
- **Gesamtes Regelbuch → neuer Browser-Tab** ("Regelbuch"-Button im PlayMode),
  der `https://6th.whfb.app/` **im neuen Tab** öffnet (kein Iframe).

Die ursprüngliche Planung sah auch das Gesamt-Regelbuch als Iframe-Dialog
(`/digital-rulebook`) vor. Das wurde bewusst revidiert: Die Regelbuch-Navigation
ist im beengten Modal schlecht bedienbar; ein vollwertiger Tab gibt dem Leser die
native Navigation der Zielseite. Der Iframe bleibt dem fokussierten Einzelregel-
Nachschlagen vorbehalten, wo genau eine Seite gezeigt wird.

### 3. Weitere Festlegungen

- **UTM-Parameter** (`utm_source=6th-builder&utm_medium=referral`) an allen Ziel-URLs
  zur Traffic-Attribution für den Betreiber von 6th.whfb.app.
- **Dialog-State lokal** in den aufrufenden Komponenten (`RosterEditor`, `PlayMode`),
  kein globaler Context — gemäß ADR-0010.
- **Keine PWA-Änderungen:** Externe Iframe-Inhalte werden nicht vom Service-Worker
  gecached; die Offline-Fähigkeit der App bleibt unverändert (ADR-0002).
- **Fehlerbehandlung des Iframe-Dialogs:** Da ein Cross-Origin-Iframe `onError`
  nicht zuverlässig auslöst, sichert ein Lade-Timeout den Ladevorgang ab. Bleibt
  `onLoad` aus (offline, blockierte Einbettung), zeigt der Dialog eine
  benutzerfreundliche Meldung („Keine Verbindung zu 6th.whfb.app") mit
  „Erneut versuchen" statt eines endlosen Spinners.
- **Umfang des Mappings:** Nur globale Regeln mit eigener Seite. Armee-spezifische
  Anker-Regeln werden nicht automatisch gecrawlt, können aber manuell über
  `synonyms.js` ergänzt werden.
- **Begleitendes Wartungswerkzeug:** Ein eigenständiger, rein lokaler
  `tools/rules-editor/` (siehe `docs/PRD-rules-url-editor.md`) pflegt Mapping und
  Synonyme per GUI. Er ist **nicht Teil der PWA**, des Builds oder des Deployments.

## Konsequenzen (Auswirkungen)

- **Positiv:**
  - Immer aktuelle, reich formatierte Volltexte (Tabellen, Errata) ohne Hosting-
    oder Urheberrechts-Last — die App kopiert keine fremden Inhalte.
  - Keine neuen npm-Abhängigkeiten; Offline-First und Service-Worker unangetastet.
  - Robuste Degradation: unbekannte Regeln → bestehendes BottomSheet; fehlendes
    Netz → App bleibt voll nutzbar, der Iframe-Dialog zeigt eine eigene
    Fehlermeldung mit Retry (nicht nur die native Browser-Fehlerseite).
- **Negativ / Trade-offs:**
  - Abhängigkeit von einer Drittseite (Verfügbarkeit und URL-Stabilität liegen
    außerhalb unserer Kontrolle).
  - Die Iframe-Einbettung setzt voraus, dass 6th.whfb.app kein `X-Frame-Options`
    sendet (verifiziert, aber nicht garantiert).
  - Das Mapping veraltet und muss periodisch manuell nachgecrawlt werden; die
    Namensauflösung erfordert Synonym-Pflege.
- **Neutral:**
  - Zwei unterschiedliche Öffnungs-Verhalten (Iframe-Dialog vs. neuer Tab) müssen
    bewusst gehalten werden.
  - Der Iframe-Dialog invertiert bei Bedarf die Farben für den Dark-Theme-Abgleich —
    ein rein kosmetischer Workaround für fremde Inhalte.

## Vor- und Nachteile der Optionen

### Option 1 — Volltext-Scraping & lokale Speicherung

- **Gut, weil** die Texte offline verfügbar und als Tooltip direkt sichtbar wären.
- **Schlecht, weil** fremde Inhalte kopiert/gehostet werden (Urheberrecht),
  Datenmenge und Pflegeaufwand stark steigen und Errata sofort veralten.

### Option 2 — Verlinkung + Einbettung (gewählt)

- **Gut, weil** keine Inhalte kopiert werden, Aktualität automatisch von der
  Quelle kommt und keine neuen Abhängigkeiten oder PWA-Änderungen nötig sind.
- **Schlecht, weil** eine Laufzeit-Abhängigkeit von einer Drittseite entsteht und
  das Mapping manuell gepflegt werden muss.

### Option 3 — Laufzeit-Crawl / Live-API

- **Gut, weil** das Mapping immer maximal aktuell wäre.
- **Schlecht, weil** 6th.whfb.app keine öffentliche API bietet, HTML-Scraping zur
  Laufzeit fragil ist und eine harte Netz-Abhängigkeit bei jedem Aufruf entstünde.

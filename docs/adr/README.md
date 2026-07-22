# Architecture Decision Records (ADRs)

Dieses Verzeichnis enthält die Dokumentation aller wesentlichen Architekturentscheidungen für das Projekt **Tome of Battle**.

Der Prozess und die Struktur der ADRs sind in [ADR 0001: Record Architecture Decisions](0001-record-architecture-decisions.md) detailliert beschrieben. Neue Entscheidungen können auf Basis der Vorlage [template.md](template.md) angelegt werden.

## Übersicht der Entscheidungen

| Nummer | Titel | Status | Zuletzt aktualisiert |
| :---: | :--- | :---: | :---: |
| 0001 | [Record Architecture Decisions](0001-record-architecture-decisions.md) | Accepted | 2026-07-05 |
| 0002 | [Data Flow and IndexedDB Storage](0002-data-flow-and-indexeddb-storage.md) | Accepted | 2026-06-28 |
| 0003 | [Battlescribe Domain Rules](0003-battlescribe-domain-rules.md) | Accepted | 2026-07-22 |
| 0004 | [Styling Conventions](0004-styling-conventions.md) | Accepted | 2026-07-21 |
| 0005 | [React Lifecycle and Performance](0005-react-lifecycle-and-performance.md) | Accepted | 2026-07-03 |
| 0006 | [Testing and Automation](0006-testing-and-automation.md) | Accepted | 2026-07-05 |
| 0007 | [CI/CD Workflow](0007-ci-cd-workflow.md) | Accepted | 2026-07-21 |
| 0008 | [Native Vercel Integration](0008-vercel-deployment.md) | Accepted | 2026-07-21 |
| 0009 | [Branching and Release Train Strategy](0009-branching-and-release-train-strategy.md) | Accepted | 2026-07-05 |
| 0010 | [Einheitliches Dialog- und Toast-System](0010-einheitliches-dialog-und-toast-system.md) | Accepted | 2026-07-13 |
| 0011 | [Roster als Referenz-Modell, abgeleitete Kosten & Serialisierungs-Adapter](0011-roster-referenzmodell-und-serialisierungs-adapter.md) | Accepted | 2026-07-21 |
| 0012 | [Integration externer WHFB-Regeltexte via 6th.whfb.app](0012-integration-externer-regeltexte-6th-whfb-app.md) | Accepted | 2026-07-15 |
| 0013 | [Generischer Undo/Redo-Hook statt roster-spezifischer History-Logik](0013-generischer-undo-redo-hook.md) | Accepted | 2026-07-15 |
| 0014 | [Kataloge als externes Fork-Repo mit Laufzeit-Abruf](0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md) | Accepted | 2026-07-15 |
| 0015 | [React Context für die whfb6-Verlinkungs-Einstellung](0015-settings-context-fuer-whfb6-verlinkung.md) | Accepted | 2026-07-17 |
| 0016 | [BattleScribe-XSD als vendored Konformitätsquelle](0016-battlescribe-xsd-als-vendored-konformitaetsquelle.md) | Accepted | 2026-07-18 |
| 0017 | [Wechsel des Katalog-Forks zu Lexicanum Imperialis mit eigener Revision-CI](0017-lexicanum-katalog-fork-mit-eigener-revision-ci.md) | Accepted | 2026-07-17 |
| 0018 | [Katalog-Mehrquellenbetrieb (Ergofarg und Lexicanum parallel)](0018-katalog-mehrquellenbetrieb-ergofarg-und-lexicanum-parallel.md) | Accepted | 2026-07-18 |
| 0019 | [Manuelle Versionierung über package.json statt Git-Tag-Prognose](0019-manuelle-versionierung-und-release-freigabe.md) | Accepted | 2026-07-18 |
| 0020 | [Katalogdaten werden network-only geladen, kein Service-Worker-Cache](0020-katalogdaten-network-only-kein-service-worker-cache.md) | Accepted | 2026-07-19 |
| 0021 | [Preview-Badge über Laufzeit-Hostname-Vergleich](0021-preview-badge-laufzeit-hostname-erkennung.md) | Accepted | 2026-07-19 |
| 0022 | [UI-Verfügbarkeit im Aushebe-Dialog leitet sich aus dem Validator ab](0022-ui-verfuegbarkeit-leitet-sich-aus-dem-validator-ab.md) | Accepted | 2026-07-20 |
| 0023 | [Die Solver-Fassade ist die exklusive Schnittstelle zur Regel-Engine](0023-solver-fassade-als-exklusive-schnittstelle.md) | Accepted | 2026-07-21 |
| 0024 | [Statik-Toolchain: oxlint, Knip und dependency-cruiser mit getrennten Rollen](0024-statik-toolchain-oxlint-knip-dependency-cruiser.md) | Accepted | 2026-07-21 |
| 0025 | [GitHub-Pages-Quelle auf Actions umgestellt, Jekyll-Build wird mitgeführt](0025-pages-quelle-auf-github-actions-mit-jekyll-build.md) | Accepted | 2026-07-21 |
| 0026 | [i18n als Eigenlösung: JSON-Sprachdateien + Intl-API, keine i18n-Library](0026-i18n-eigenloesung-json-und-intl-ohne-library.md) | Accepted | 2026-07-22 |


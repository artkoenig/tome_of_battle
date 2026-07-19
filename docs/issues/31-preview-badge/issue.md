Status: resolved
Type: feature
Blocked by: None

## Description
# PRD: Preview-Badge für die Preproduction-Domain

## Problem Statement / Bug Description
Seit ADR 0019 wird ein `main`-Branch-Deployment erst durch manuelles Promoten
zur echten Production. Bis dahin läuft derselbe Build bereits auf der festen
Vercel-Branch-Alias-URL `army-builder-git-main-neardy.vercel.app`. Das
bestehende Nicht-`main`-Signal (Versions-Hash-Suffix `<Version>+<Kurz-Hash>`,
siehe ADR 0008/0019) wird zur Build-Zeit aus dem Git-Branch abgeleitet — ein
Build vom `main`-Branch gilt dort bereits als "production". Alias-URL und die
später promotete Produktions-Domain teilen sich denselben Build; das
bestehende Signal kann sie strukturell nicht unterscheiden. Dadurch ist die
Preproduction-Instanz heute optisch nicht von der echten Production zu
unterscheiden — weder Badge noch Hash-Suffix zeigen sich dort.

## Solution
Ein kleines, dezentes "Preview"-Badge im Header vergleicht zur Laufzeit
`window.location.hostname` gegen die als benannte Konstante hinterlegte
Preproduction-Alias-URL (`army-builder-git-main-neardy.vercel.app`) und wird
nur bei exakter Übereinstimmung angezeigt — ein positiver Abgleich gegen
genau diese eine URL, keine Negativ-Erkennung "alles außer Production".
Auf allen anderen Hostnamen (echte Production-Domain, andere PR-Preview-URLs,
`localhost`) erscheint kein Badge. Der bestehende Versions-Hash-Suffix im
Einstellungen-Dialog bleibt unverändert erhalten — beide Signale beantworten
unterschiedliche Fragen (Hash-Suffix: welcher Commit genau; Badge: bin ich
auf der bekannten Preproduction-Alias-URL). Architektonische Begründung und
verworfene Alternativen sind in
[ADR 0021](../../adr/0021-preview-badge-laufzeit-hostname-erkennung.md)
festgehalten; ADR 0008 §2 verweist per Nachtrag darauf.

## User Stories / Requirements
1. Als Entwickler möchte ich auf einen Blick erkennen, wenn ich die
   Preproduction-App (`army-builder-git-main-neardy.vercel.app`) statt der
   echten Production-App vor mir habe, damit ich nicht versehentlich
   Preproduction-Zustände für Production hält.
2. Als Nutzer der echten Production-App möchte ich, dass dort kein Badge
   erscheint, damit die reguläre Nutzung unverändert bleibt.

## Technical Decisions
- **Affected Modules:** `src/App.jsx` (Header, Wiedereinführung des früheren
  `EnvBadge`-Slots in `.logo-container`), neues kleines Hostname-Vergleichs-
  Modul, `src/index.css` (Badge-Styling).
- **Technical Clarifications / Architectural Decisions:** siehe
  [ADR 0021](../../adr/0021-preview-badge-laufzeit-hostname-erkennung.md).
  Erkennung erfolgt bewusst als harter, positiver Vergleich gegen genau eine
  Preproduction-Alias-URL (Konstante, kein Muster/keine Liste) — YAGNI, da
  aktuell nur diese eine URL relevant ist. Label-Text bewusst Englisch
  ("Preview"), abweichend vom sonst deutschsprachigen UI, um es als
  technisches/internes Signal abzuheben. Styling: kleine Schrift, kein
  Rahmen (dezenter als das frühere `VORSCHAU`-Badge mit Rahmen).
- **API Contracts / Data Models:** keine — reiner Client-seitiger
  String-Vergleich, keine neuen Datenstrukturen.

## Testing Decisions
- **Modules to Test:** Hostname-Vergleichsfunktion; Badge-Rendering bedingt
  auf deren Ergebnis.
- **Test Interfaces (Seams):**
  - Eine reine Funktion `isPreviewHost(hostname)`, isoliert testbar ohne
    DOM/React (verschiedene Hostnamen rein, Boolean raus).
  - Die Badge-Komponente reicht `window.location.hostname` an diese Funktion
    weiter und rendert bedingt auf deren Rückgabewert.

## Out of Scope
- Generische Mehrfach-Domain-Erkennung (Liste/Muster für beliebige
  Preview-URLs) — nur die eine genannte Preproduction-URL wird erkannt.
- Entfernen oder Ändern des bestehenden Versions-Hash-Suffixes im
  Einstellungen-Dialog.
- Änderungen am Build-Zeit-Signal `VITE_DEPLOY_ENV` / `scripts/deployEnv.js`.

## Acceptance Criteria
- [x] Auf `army-builder-git-main-neardy.vercel.app` erscheint im Header ein
      kleines "Preview"-Badge (kleine Schrift, kein Rahmen).
- [x] Auf der echten Produktions-Domain erscheint kein Badge.
- [x] Der bestehende Versions-Hash-Suffix im Einstellungen-Dialog bleibt
      unverändert funktionsfähig.
- [x] Die Hostname-Vergleichsfunktion ist isoliert unit-getestet (mind. ein
      Fall Preview-Hostname, ein Fall Produktions-Hostname).

## Comments
- Preview-Badge implementiert: isPreviewHost(hostname) (src/utils/previewHost.js) vergleicht window.location.hostname positiv gegen die Konstante PREVIEW_HOSTNAME (army-builder-git-main-neardy.vercel.app). PreviewBadge.jsx rendert bei Treffer ein dezentes 'Preview'-Label im Header (.logo-container, kein Rahmen, --fs-micro). Bestehender Versions-Hash-Suffix unveraendert. Vier-Achsen-Verifikation (testing skill) durchlaufen: Standards gruen (oxlint pass, Funde ausserhalb des Diffs, siehe Issue 28), Spec alle 4 Acceptance Criteria erfuellt, Tests 670/670 + E2E gruen, Docs 0 Befunde. Versions-Bump 1.1.0 -> 1.2.0 (feature, Minor).
- Versions-Bump auf Nutzerwunsch zurueckgenommen: package.json bleibt bei 1.1.0 (kein Versions-Bump fuer dieses Main-Issue).

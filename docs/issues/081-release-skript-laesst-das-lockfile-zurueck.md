---
status: backlog
branch:
pr:
---

# Das Release-Skript lässt das Lockfile zurück

## Intent

`node scripts/release.js <bump>` schreibt die neue Version nur nach
`package.json`. `package-lock.json` führt dieselbe Version an zwei Stellen
(`.version` und `.packages[""].version`) und bleibt unberührt. Beide Dateien
driften damit bei jedem Release auseinander.

Belegt am aktuellen `main`: `package.json` steht auf `1.9.0`,
`package-lock.json` auf `1.8.2`. Praktische Folge: ein `npm install` schreibt
das Lockfile stillschweigend um und macht damit jeden frisch aufgesetzten
Arbeitsbaum schmutzig — der Diff jeder unbeteiligten Arbeit trägt eine
Versionsänderung mit, die niemand gemacht hat.

Gewünschtes Ergebnis: nach einem Release-Lauf nennen `package.json` und
`package-lock.json` dieselbe Version, und ein `npm install` direkt danach
lässt den Arbeitsbaum sauber.

Acceptance criteria:

1. Nach `node scripts/release.js <patch|minor|X.Y.Z>` nennen `package.json`
   und beide Versionsstellen in `package-lock.json` dieselbe Version.
2. Ein `npm install` unmittelbar nach einem Release-Lauf hinterlässt keine
   Änderung an `package-lock.json` (`git status` sauber).
3. Der bestehende Rückstand ist eingeholt: `package-lock.json` nennt die
   Version, die `package.json` nennt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Nebenbefund während Issue 076. Dort fiel auf, dass ein
  `npm install` im frischen Cloud-Arbeitsbaum `package-lock.json` von `1.8.2`
  auf `1.9.0` zog, ohne dass etwas an den Abhängigkeiten geändert wurde. Die
  Änderung wurde aus dem Diff von 076 zurückgenommen, weil sie dessen Absicht
  nicht dient.
- **Ursache belegt:** `scripts/release.js:46-52` (`writePackageVersion`)
  liest, ändert und schreibt ausschließlich `PACKAGE_JSON_PATH`.

## Log

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro

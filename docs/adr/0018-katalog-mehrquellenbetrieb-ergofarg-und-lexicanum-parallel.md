# 0016: Katalog-Mehrquellenbetrieb (Ergofarg und Lexicanum parallel)

- **Status:** Accepted (amendiert [ADR-0014](0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md); hebt dessen Einquellen-Prinzip auf, amendiert auch [ADR-0017](0017-lexicanum-katalog-fork-mit-eigener-revision-ci.md)s Konsequenz "Ergofarg-Systeme laufen passiv aus")

## Kontext und Entscheidung

ADR-0014 legte ein bewusstes Einquellen-Prinzip fest: genau ein Fork, genau ein
`CATALOG_REPO_RAW_BASE_URL`/`CATALOG_INDEX_URL`. ADR-0017 wechselte dieses eine Ziel von
Ergofarg auf Lexicanum und ließ bereits importierte Ergofarg-Systeme dabei bewusst passiv
auslaufen (kein automatisches Update mehr).

Der Ergofarg-Fork (`artkoenig/Warhammer-Fantasy-6th-edition`) ist jedoch weiterhin aktiv
gepflegt und trägt lokal eingepflegte Datenfixes (u. a. Bloodline-Korrekturen, Arcane-Items-
Lift-Modifier, ConditionKind-Schemakonformität), die im Lexicanum-Datensatz nicht existieren.
Der Nutzer möchte diese Variante weiterhin frisch importieren können — nicht nur bereits
gespeicherte Rosters darauf weiternutzen.

**Entscheidung:** Beide Forks werden dauerhaft und gleichberechtigt als benannte
Katalogquellen betrieben. Die bisherigen Einzelkonstanten weichen einer Liste
`CATALOG_SOURCES` (`{gameSystemId, label, indexUrl, rawBaseUrl}`), über die sowohl die
Spielsystem-Auswahl beim Import als auch der stille Update-Mechanismus iterieren. Die
Zuordnung eines bereits gespeicherten Systems zu seiner Quelle läuft über seine ohnehin
eindeutige `gameSystemId` (kein neues Datenbankfeld, keine Migration nötig — jede
BattleScribe-`gameSystemId` ist bereits pro Quelle einmalig und stabil).

## Verworfene Alternative

Ergofarg nur als manuellen ZIP-Import weiter anbieten, ADR-0014/0015 sonst unangetastet
lassen. Verworfen, weil damit lokale Ergofarg-Fixes nie automatisch beim Nutzer ankämen — das
widerspricht demselben Wirksamkeits-Kriterium, das schon ADR-0014 zum Laufzeit-Abruf bewegt
hat.

## Konsequenzen

- ADR-0017s Aussage "Ergofarg-Systeme laufen passiv aus" gilt nicht mehr: beide Quellen
  erhalten symmetrisch stille Updates (higher wins, pro Quelle).
- Eine dritte Quelle ließe sich künftig durch einen weiteren `CATALOG_SOURCES`-Eintrag
  ergänzen, ohne bestehende Verzweigungslogik zu ändern (Open/Closed).

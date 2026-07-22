Status: resolved
Type: feature
Blocked by: None

## Description
Tracer Bullet der Mehrsprachigkeit (Spec im Main-Issue 58-i18n, Architektur in
[ADR 0026](../../../adr/0026-i18n-eigenloesung-json-und-intl-ohne-library.md)):
das i18n-Fundament, demonstriert daran, dass die Einstellungen-Ansicht komplett
zweisprachig ist.

Umfang:
- Eigenes Übersetzungsmodul mit `t(key, params)` als einzigem öffentlichen
  API: Platzhalter-Ersetzung, Pluralvarianten je Schlüssel über
  `Intl.PluralRules`, Zahlenformatierung über `Intl.NumberFormat`, Fallback
  auf Englisch bei fehlendem Schlüssel.
- Flache Key-Value-JSON-Sprachdateien für Deutsch und Englisch.
- Spracherkennung als reine Funktion: gespeicherte Wahl gewinnt, sonst
  Browser-Sprache (Deutsch → `de`, alles andere → `en`).
- Persistente Sprachwahl (lokal, nur für die App-Oberfläche) und ein
  unaufdringlicher Umschalter Deutsch/English in den Einstellungen; die
  Umstellung wirkt sofort, ohne Neuladen.
- Das `lang`-Attribut des Dokuments folgt der aktiven UI-Sprache.
- Test-Setup pinnt die Sprache global auf Deutsch, damit bestehende
  Assertions gültig bleiben.
- Paritätstest: alle Sprachdateien haben exakt dieselben Schlüsselmengen.
- Die Texte der Einstellungen-Ansicht (inkl. des neuen Umschalters) laufen
  bereits über `t()` — als erster, durchgestochener Nachweis.

Katalogtexte bleiben unberührt (Katalogsprache, CONTEXT.md). Statik-Toolchain
(Knip/depcruise, ADR 0024) bei Bedarf für das neue Modul nachziehen.

## Acceptance Criteria
- [ ] `t(key, params)` ersetzt Platzhalter, wählt numerus-korrekte
      Pluralvarianten und fällt bei fehlendem Schlüssel auf Englisch zurück
      (unit-getestet).
- [ ] Paritätstest schlägt fehl, sobald DE- und EN-Datei unterschiedliche
      Schlüssel haben.
- [ ] Spracherkennung unit-getestet: gespeicherte Wahl > Browser-Sprache;
      Deutsch → de, sonst en.
- [ ] Umschalter in den Einstellungen stellt sofort um; die Wahl überlebt
      einen Reload; das `lang`-Attribut wechselt mit.
- [ ] Einstellungen-Ansicht ist in beiden Sprachen vollständig übersetzt.
- [ ] Bestehende Tests laufen unverändert grün (Sprache im Test-Setup auf
      Deutsch gepinnt).

## Comments
- i18n-Fundament (ADR 0026): eigenes Modul unter src/i18n/ mit t(key,params) (Platzhalter, Intl.PluralRules-Numerus, Intl.NumberFormat, EN-Fallback), reiner Spracherkennung, localStorage-Persistenz und useSyncExternalStore-Hook. Flache DE/EN-JSON-Sprachdateien + Paritaetstest. Einstellungen-Dialog laeuft komplett ueber t() und hat einen sofort wirkenden DE/EN-Umschalter; document.lang folgt der aktiven Sprache. Test-Setup pinnt global auf Deutsch.

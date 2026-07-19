# 0023: Revision von ADR-0015 — SettingsContext wird generischer Mehr-Werte-Store

- **Status:** Accepted
- **Datum:** 2026-07-19
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs (falls vorhanden):** Revidiert [ADR-0015: React Context für die whfb6-Verlinkungs-Einstellung](0015-settings-context-fuer-whfb6-verlinkung.md)

## Kontext und Problemstellung

ADR-0015 hat den `SettingsContext` bewusst eng gehalten: ausschließlich
`{ whfb6LinkingEnabled, setWhfb6LinkingEnabled }`, explizit kein generischer
"App-Settings-Store", um keinen unbegründeten Präzedenzfall zu schaffen. Die
neue Sprachpräferenz (manuell übersteuerbar, siehe ADR-0022) braucht denselben
reaktiven, tief verschachtelten Zugriff und dieselbe Persistenz im
`settings`-Store (ADR-0002), den `whfb6LinkingEnabled` bereits hat.

## Entscheidungsergebnis

Statt eines zweiten, parallelen Contexts wird der bestehende `SettingsContext`
zu einem echten Mehr-Werte-Store erweitert: `{ whfb6LinkingEnabled, locale,
setWhfb6LinkingEnabled, setLocale }`. Die ursprüngliche Zurückhaltung aus
ADR-0015 (kein Freibrief für beliebige künftige Einstellungen) bleibt als
Prinzip bestehen — jede weitere Einstellung erfordert weiterhin eine
Einzelfallprüfung, ob sie tatsächlich reaktiv und tief verschachtelt gebraucht
wird, statt automatisch in diesen Context zu wandern.

### Konsequenzen (Auswirkungen)

- **Positiv:** Ein einziger, bekannter Context-Hook (`useSettings()`) für beide
  App-weiten Einstellungen; keine zweite Provider-Ebene im Baum.
- **Negativ:** `SettingsContext` ist nun kein Ein-Wert-Context mehr — künftige
  Einstellungen könnten sich leichter auf diesen Präzedenzfall berufen; dem
  wird weiterhin durch bewusste Einzelfallprüfung begegnet, nicht durch
  technische Sperren.

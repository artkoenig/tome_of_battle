Status: resolved
Type: refactor
Blocked by: None

## Description
Die App-Versionsnummer (`import.meta.env.VITE_APP_VERSION`) wird derzeit im
Header direkt neben dem Logo angezeigt (`src/App.jsx`). Diese Anzeige soll aus
dem Header entfernt und stattdessen im Options-/Einstellungsdialog
(`src/components/SettingsDialog.jsx`, geöffnet über das Zahnrad-Icon im
Header) dargestellt werden — z. B. als kleine, dezente Zeile im Dialog (Stil
analog zur bisherigen Header-Darstellung: `text-dim`/`text-micro`).

Die Wortmarke/das Logo im Header bleibt unverändert; nur die Versionszeile
entfällt dort. Bestehende Tests, die die Versionsnummer im Header prüfen
(`src/App.test.jsx`) bzw. den Einstellungsdialog abdecken
(`src/components/SettingsDialog.test.jsx`), sind entsprechend anzupassen.

## Acceptance Criteria
- [ ] Der Header zeigt keine Versionsnummer mehr an.
- [ ] Der Options-/Einstellungsdialog zeigt die aktuelle App-Versionsnummer
      (`import.meta.env.VITE_APP_VERSION`) sichtbar an.
- [ ] Die Darstellung im Dialog fügt sich stilistisch in die bestehende
      Optik des Dialogs ein (kein Fremdkörper).
- [ ] `getDiffChanges`/Update-Toast-Logik in `src/App.jsx`, die ebenfalls
      `VITE_APP_VERSION` nutzt, bleibt unverändert funktionsfähig.
- [ ] Bestehende und ggf. neue Tests für Header und Einstellungsdialog sind
      grün.

## Comments
- Versionszeile aus dem Header (src/App.jsx) entfernt und dezent im Einstellungsdialog (src/components/SettingsDialog.jsx) als 'Version <VITE_APP_VERSION>'-Zeile im text-dim/text-micro-Stil ergaenzt (.settings-version in index.css). Update-Toast/getDiffChanges bleibt unveraendert. Tests fuer beide Dateien angepasst; 15 gruen.

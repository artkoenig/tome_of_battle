Status: ready-for-agent
Type: chore
Blocked by: None

## Description

Der beschreibende Kommentar ueber dem eingebetteten Stylesheet des
Statusberichts beschreibt ein Erscheinungsbild, das es nicht mehr gibt. Er
stammt aus der Zeit vor der Umstellung auf das dunkle "Epic Battlefield"-Thema
(Main-Issue 57) und wurde dabei nicht mitgezogen. Wer ihn liest, bekommt ein
falsches Bild davon, wie die Seite aussieht und woher ihre Werte kommen.

Drei belegte Widersprueche zwischen Beschreibung und Wirklichkeit, alle in
`scripts/project-state/renderReport.js`:

| Die Beschreibung sagt (Z. 659-678) | Tatsaechlich |
|---|---|
| "Pergament, Gold und Obsidian-Dunkel" | Die Palette ist durchgehend dunkel, kein Pergament mehr (`--bg: #07090E`, Z. 689) |
| "kein Nachladen von Google Fonts, sondern der Fallback-Serifen-Stack der App … nicht ueber Cinzel/Lora selbst" | Z. 680 laedt Cinzel, Outfit und Inter per `@import` von Google Fonts |
| "Helles und dunkles Erscheinungsbild ueber `prefers-color-scheme`" | Nur dunkel; Z. 683 steht fest auf `color-scheme: dark` |

Zusaetzlich benennt die Beschreibung `src/styles/01-tokens.css` als Herkunft der
Farbwerte. Zu pruefen ist, ob das noch stimmt — die Werte des dunklen Themas
liegen in `docs/assets/landing.css`.

Gefunden bei der PO-Sichtung von Main-Issue 57 (dessen Umsetzung selbst bereits
auf `main` liegt).

Ein zweiter, groesserer Befund aus derselben Sichtung gehoert ausdruecklich
**nicht** hierher: der Statusbericht fuehrt dieselben Farbwerte wie die
Landingpage unter eigenen Namen ein zweites Mal. Das ist eine
Struktur-Entscheidung (eine gemeinsame Token-Quelle gegen die bewusste
Eigenstaendigkeit der Berichtsseite als einzelne HTML-Datei) und braucht einen
eigenen Schnitt, nicht eine Kommentar-Korrektur.

## Acceptance Criteria
- [ ] Die Beschreibung des eingebetteten Stylesheets gibt das tatsaechliche Erscheinungsbild wieder: dunkles Thema, keine Pergament-Variante, kein helles Gegenstueck.
- [ ] Sie sagt zutreffend, woher die Schriften kommen und ob sie nachgeladen werden.
- [ ] Die genannte Herkunft der Farbwerte ist belegt oder korrigiert.
- [ ] Keine Verhaltensaenderung: die Tests des Berichts bleiben unveraendert gruen.

## Comments

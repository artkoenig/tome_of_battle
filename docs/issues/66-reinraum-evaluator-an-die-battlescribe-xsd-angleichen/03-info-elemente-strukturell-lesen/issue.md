Status: resolved
Type: refactor
Blocked by: [01]

## Description
Der Evaluator liest die reinen **Info-Elemente** des Formats strukturell:
`profile` (Profil), `rule` (Regel), `infoGroup` (Info-Gruppe) und `infoLink`
(Info-Link, der auf ein Profil / eine Regel / eine Info-Gruppe verweist). Diese
Elemente tragen **keine** Grenzen- oder Modifikator-Logik — sie beschreiben
Werte/Texte. Ziel ist, dass reale Kataloge, die sie enthalten, ohne Lücken und
ohne Parse-Abbruch gelesen werden und die Info-Elemente als Teil des Modells
verfügbar sind, statt als UNSUPPORTED-Diagnose zu erscheinen oder das Parsen zu
stören.

Baut auf der XSD-konformen Lesart aus 01 auf. Die Auflösung eines `infoLink` auf
sein Ziel folgt derselben Link-Auflösung wie die übrigen Verweise der Engine.

## Acceptance Criteria
- [x] Ein Katalog mit `profile`, `rule`, `infoGroup` und `infoLink` wird ohne
      Fehler geparst; keines dieser Elemente erzeugt eine UNSUPPORTED-Diagnose.
- [x] Ein `infoLink` wird auf sein Ziel (Profil/Regel/Info-Gruppe) aufgelöst und
      das verlinkte Info-Element ist am betroffenen Eintrag verfügbar.
- [x] Info-Elemente verändern weder Grenzen noch effektive Werte (sie tragen keine
      Constraint-/Modifikator-Logik).
- [x] Die Engine-Testsuite deckt das Lesen und Auflösen der Info-Elemente ab und
      ist grün.

## Comments
- Info-Elemente strukturell umgesetzt: catalogReader liest profile/rule/infoGroup/infoLink (InfoLinkKind aus SSOT), der Eintrag traegt infos[]; resolver indiziert die Info-Definitionen und loest infoLink ueber die bestehende ID-Karte auf sein Ziel (Profil/Regel/Info-Gruppe) auf. Keine UNSUPPORTED-Diagnose, keine Veraenderung von Grenzen/effektiven Werten. Neue infoElements.test.js gruen.

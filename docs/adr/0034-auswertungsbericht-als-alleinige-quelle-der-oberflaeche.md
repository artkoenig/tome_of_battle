# Der Auswertungsbericht ist die alleinige Quelle der Oberfläche

- **Status:** Accepted
- **Datum:** 2026-07-26
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** setzt ADR-0030 (Reinraum-Engine als
  Nachfolger) für den Cutover um; überträgt das Fassaden-Prinzip aus ADR-0023 auf
  die neue Engine; berührt ADR-0026 (i18n), ADR-0027 (Ursachen), ADR-0028
  (Text-Tokens), ADR-0003 (Domänenregeln), ADR-0014/0017/0018 (Katalog-Forks).
  Wird ergänzt durch ADR-0035 (Verfügbarkeit aus Fähigkeitsdatensätzen).

## Kontext und Problemstellung

ADR-0030 hat beschlossen, dass die Reinraum-Engine (`src/evaluator/`) die alte
Engine (`src/solver/`) ablöst. Beim Zuschnitt des Cutovers stellte sich heraus,
dass die eigentliche Frage nicht „welche Engine" ist, sondern **wo die Grenze
zwischen Engine und Oberfläche verläuft**.

Der Befund aus der Bestandsaufnahme: die Oberfläche bezieht von der alten Engine
69 verschiedene Namen über deren Fassade. Diese Namen sind sehr ungleicher Natur.
Manche sind echte Regelauswertung (was ist erlaubt, was ist verletzt). Manche
sind reine Datenstruktur-Hilfen über den Roster-Baum. Manche sind
Anzeige-Formatierung. Und einige wenige sind weder das eine noch das andere:
hartkodierte Katalog-IDs eines bestimmten Spielsystems und
Stichwort-Heuristiken auf Klartext-Namen.

Genau diese Vermischung hat schon einmal Schaden angerichtet: ADR-0023 musste
zwölf Umgehungen der Solver-Fassade zurückbauen, weil eine Schichtgrenze, die
nichts durchsetzt, still erodiert. Würde der Cutover die Grenze nicht vorab
festlegen, entstünde dieselbe Erosion neu — nur diesmal verteilt über zwei
Engines.

Zusätzlich stellt sich die Frage bei jedem einzelnen Bereich neu, solange kein
Kriterium existiert: gehört „welche Optionen hat diese Einheit" in die Engine
oder in die Oberfläche? Und „wie heißt diese Kostenart"? Ohne benanntes Kriterium
wird jede dieser Fragen einzeln und womöglich widersprüchlich beantwortet.

## Entscheidungsfaktoren (Drivers)

- **Eine Rechenstelle, nicht zwei.** Rechnet die Oberfläche irgendetwas selbst
  nach, kann sie zum Bericht in Widerspruch geraten — und genau dieser
  Widerspruch ist als Fehlerbild nahezu unauffindbar.
- **Reinraum bleibt Reinraum.** ADR-0030 begründet die neue Engine damit, dass
  sie ihr Verhalten allein aus den BattleScribe-Daten ableitet. Jede hartkodierte
  Katalog-ID und jede Stichwortliste in ihr wäre ein Rückfall.
- **Wahrhaftigkeit statt Wunsch.** ADR-0023 hat gezeigt: ein Anspruch, den nichts
  prüft, beschreibt nach kurzer Zeit nicht mehr die Wirklichkeit.
- **Sprachfreiheit.** ADR-0026 verlangt, dass die Regelschicht keine Sprache
  kennt. Sie darf deshalb auch keine Meldungsschlüssel der Oberfläche kennen.
- **Ein einziger, konsistenter Stand.** Der Bericht entsteht aus genau einer
  Auswertung. Zwei Fragen an denselben Zustand dürfen nicht über zwei
  verschiedene Wege beantwortet werden, die auseinanderlaufen können.

## Betrachtete Optionen

- **Option 1 — Engine bleibt reine Constraint-Arithmetik.** Der Bericht behält
  seinen heutigen Umfang (Verletzungen als Zahlen, Fähigkeitsdatensätze,
  Diagnosen). Optionslisten, Profile, Meldungstypen leitet eine neue Schicht in
  der Anwendung selbst her — aus dem Bericht *und* aus dem geparsten Katalog.
- **Option 2 — Alles Katalog-Abgeleitete gehört in den Bericht.** Die Engine
  beantwortet jede Frage, deren Antwort in den Katalogdaten steht; die Oberfläche
  projiziert den Bericht und rechnet nichts nach. Anzeige-Entscheidungen und
  Sonderfälle ohne Katalog-Grundlage bleiben außerhalb.
- **Option 3 — Alles in die Engine, auch Sonderfälle und Heuristiken.** Genau eine
  Stelle für „was gilt", einschließlich der systemgebundenen Ausnahmen und der
  Stichwort-Klassifikation.

## Entscheidungsergebnis

Gewählte Option: **Option 2.** Das Kriterium lautet: **steht die Antwort in den
Katalogdaten, beantwortet sie die Engine.**

Daraus folgt die Aufteilung:

**In den Bericht gehört**, was sich aus den Katalogdaten ableitet — was erlaubt,
verlangt, gesperrt oder versteckt ist; was gewählt ist und was noch hineinpasst;
welche Grenze in welchem Bezugsrahmen an welcher Art Anker gerissen ist, mit
welchem Schweregrad und durch welche Auswahl ausgelöst; welche Profile und
Regeltexte für eine Auswahl gelten; wie eine Autor-Meldung des Katalogs lautet,
mit aufgelösten Text-Tokens (ADR-0028); und die schlichten Katalog-Angaben, die
ohne Roster gebraucht werden (Kostenarten, spielbare gegenüber
Bibliotheks-Katalogen, anlegbare Kontingente).

**Außerhalb bleibt**, was nicht in den Katalogdaten steht: welcher übersetzte
Satz zu welcher Verletzungsart gehört, wie eine Zahl formatiert wird, welche
Reihenfolge eine Liste hat. Die Engine ordnet eine Verletzung **fachlich** ein;
welchen i18n-Schlüssel die Oberfläche daraus wählt, ist ihr Vertrag, nicht der
der Engine (ADR-0026). Ebenso bleiben außerhalb: reine Roster-Modell-Hilfen, die
den Baum der Anwendung traversieren oder verändern, und die Import-Pipeline
(ZIP, XSD-Gate, Katalog-Editor, Update-Erkennung) — so wie ADR-0030 sie ohnehin
abgrenzt.

**Systemgebundene Sonderfälle gehören in keine der beiden Schichten.** Der
heutige Vererbungs-Sonderfall — eine Kategorie erbt ein fehlendes Maximum von
einer anderen, festgemacht an hartkodierten IDs eines bestimmten Spielsystems —
ist kein Regelwissen, sondern eine **Korrektur fehlerhafter Katalogdaten**. Er
wird dort behoben, wo der Fehler sitzt: in den Katalog-Forks (ADR-0014,
ADR-0017), und weil beide Quellen parallel betrieben werden (ADR-0018), in
beiden. Dasselbe gilt für Stichwort-Heuristiken auf Klartext-Namen: sie sind
keine Regelauswertung und haben in der Engine nichts verloren; wo eine Oberfläche
sie für ihre Darstellung braucht, trägt sie sie selbst.

Bis die Datenkorrektur ausgeliefert ist, erzwingt die Anwendung das betroffene
gemeinsame Maximum nicht. Das wird bewusst hingenommen — der Preis dafür, den
Sonderfall nicht ein zweites Mal in Code zu gießen.

### Konsequenzen (Auswirkungen)

- **Positiv:** Es gibt genau eine Stelle, die aus Katalogdaten Schlüsse zieht. Ein
  Widerspruch zwischen Anzeige und Validierung ist strukturell ausgeschlossen,
  weil beide dieselbe Auswertung lesen.
- **Positiv:** Die Engine bleibt systemagnostisch und damit für ein zweites
  Spielsystem brauchbar, ohne angefasst zu werden.
- **Positiv:** Ein Katalogfehler wird als Katalogfehler behandelt. Die Anwendung
  hört auf, fremde Daten still zu reparieren und dabei zu verschleiern, dass sie
  fehlerhaft sind.
- **Negativ:** Der Bericht wird deutlich umfangreicher als heute. Die Engine
  trägt Verantwortung für Dinge, die man zunächst nicht in einer „Regel-Engine"
  vermutet — etwa Profile und Regeltexte.
- **Negativ:** Bis die Katalog-Forks korrigiert sind, fehlt eine Validierung, die
  die Anwendung heute leistet. Das ist eine Abhängigkeit außerhalb dieses
  Repositories und damit außerhalb der eigenen Kontrolle.
- **Neutral:** Der Umfang der Import-Pipeline bleibt unverändert; sie parst
  weiterhin für Import, Editor und Update-Erkennung.

## Vor- und Nachteile der Optionen

### Option 1 — Engine bleibt reine Constraint-Arithmetik

- **Gut, weil** der Eingriff in die neue Engine klein bliebe und ihr Kern
  schlank.
- **Gut, weil** die Anwendung ihre Anzeige-Logik dort behielte, wo sie heute
  liegt — kein Umlernen.
- **Schlecht, weil** die Oberfläche dann erneut selbst aus Katalogdaten schließt.
  Genau das ist der Zustand, den die Referenzarchitektur mit „die UI rechnet nie
  selbst, sie projiziert nur den einen Bericht" ausschließen wollte.
- **Schlecht, weil** zwei Wege zur selben Frage entstehen — der Bericht und die
  eigene Herleitung —, die auseinanderlaufen können, ohne dass es auffällt.

### Option 2 — Alles Katalog-Abgeleitete in den Bericht

- **Gut, weil** das Kriterium für jeden künftigen Zweifelsfall trägt: steht die
  Antwort im Katalog, gehört sie in die Engine.
- **Gut, weil** es die Reinraum-Eigenschaft aus ADR-0030 nicht nur behauptet,
  sondern eine benannte Grenze zieht, an der sie verteidigt werden kann.
- **Gut, weil** Sprachfreiheit gewahrt bleibt: die Engine ordnet ein, die
  Oberfläche formuliert.
- **Schlecht, weil** der Bericht groß wird und die Engine mehr Verantwortung
  trägt als der Name „Auswertung" nahelegt.

### Option 3 — Alles in die Engine, auch Sonderfälle und Heuristiken

- **Gut, weil** es dann tatsächlich nur eine einzige Stelle für „was gilt" gäbe,
  ohne jede Ausnahme.
- **Schlecht, weil** es dem Kern von ADR-0030 frontal widerspricht: eine
  Reinraum-Engine, die hartkodierte IDs eines Spielsystems kennt, ist keine mehr.
- **Schlecht, weil** Stichwort-Heuristiken auf Klartext-Namen keine Regeln sind,
  sondern Ratehilfen für die Darstellung — sie würden die Engine mit einer
  Fehlerquelle belasten, die nichts mit Regelauswertung zu tun hat.

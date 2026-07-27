# Verfügbarkeit ergibt sich aus Fähigkeitsdatensätzen, nicht aus einem Validierungs-Diff

- **Status:** Accepted
- **Datum:** 2026-07-26
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** **ersetzt ADR-0022** (UI-Verfügbarkeit
  leitet sich aus dem Validator ab); baut auf ADR-0034 (Bericht als alleinige
  Quelle) und ADR-0030 (Reinraum-Engine als Nachfolger) auf; berührt ADR-0029
  (Verhaltensmodell je Option).

## Kontext und Problemstellung

ADR-0022 beantwortet die Frage „darf ich diese Einheit jetzt aufstellen?" mit
einem Kunstgriff: die Anwendung fügt die Einheit **hypothetisch** in eine Kopie
der Liste ein, lässt den Validator ein zweites Mal laufen und vergleicht das
Ergebnis mit einer zuvor gebildeten Grundlinie. Kommt eine sperrende Verletzung
hinzu, gilt die Einheit als nicht verfügbar.

Der Kunstgriff war nötig, weil die alte Engine nur eine Frage beantworten konnte:
„ist die Liste, so wie sie ist, regelkonform?" Sie kannte keinen Begriff für
einen Platz, der noch frei ist. Verfügbarkeit ließ sich deshalb nur als
*Differenz zweier Zustände* ausdrücken, nicht als Eigenschaft eines Zustands.

Das hat drei Folgen, die ADR-0022 teilweise selbst benennt:

1. **Aufwand.** Für jeden angebotenen Eintrag läuft eine vollständige Validierung
   der ganzen Liste. Im Aushebe-Dialog geschieht das je Kandidat und ohne
   Zwischenspeicherung.
2. **Eine Sperrtabelle.** Weil eine Verletzung nicht von sich aus sagt, ob sie
   ein Hinzufügen verhindert, braucht es eine gepflegte Klassifikation, welche
   Verletzungsart sperrend wirkt. Eine neue Verletzungsart, die dort vergessen
   wird, sperrt still nicht.
3. **Ein indirekter Begriff.** „Verfügbar" ist nichts, was irgendwo abgelesen
   wird, sondern das Ergebnis eines Vergleichs — schwer zu prüfen und schwer zu
   erklären.

Mit der neuen Engine ändert sich die Ausgangslage: sie kennt **Slots** — Stellen,
an denen eine Auswahl stehen kann — und synthetisiert bereits heute Anker für
Pflichtauswahlen, *die gar nicht vorhanden sind*. Damit existiert erstmals ein
Begriff für einen leeren Platz. Die Frage ist, ob Verfügbarkeit weiterhin
errechnet oder künftig abgelesen wird.

## Entscheidungsfaktoren (Drivers)

- **Ablesen schlägt Vergleichen.** Ein Zustand, der direkt aussagt „hier passen
  noch zwei hinein", ist prüfbar und erklärbar; eine Differenz zweier
  Auswertungen ist es nicht.
- **Kein zweiter Weg zur selben Frage.** ADR-0034 verlangt genau eine
  Rechenstelle. Ein Verfügbarkeits-Diff neben dem Bericht wäre ein zweiter Weg.
- **Keine Pflegeliste, die still veralten kann.** Eine Klassifikationstabelle,
  deren Lücke sich als fehlende Sperre äußert, ist eine schlechte Fehlerquelle:
  sie schweigt.
- **Aufwand.** Die Auswertung soll nicht je angebotenem Eintrag erneut über die
  ganze Liste laufen.
- **Ein Begriff für alle Fälle.** Einheit im Aushebe-Dialog, Option an einer
  Einheit, Kategorie-Abschnitt in der Übersicht — dreimal dieselbe Frage sollte
  dieselbe Antwortquelle haben.

## Betrachtete Optionen

- **Option 1 — Diff-Verfahren beibehalten, auf die neue Engine übertragen.** Die
  Anwendung baut weiterhin einen hypothetischen Zustand, wertet zweimal aus und
  vergleicht; nur die Engine darunter ist eine andere.
- **Option 2 — Verfügbarkeit als abgelesene Eigenschaft.** Die Engine erzeugt
  einen Fähigkeitsdatensatz nicht nur für belegte Slots und Pflicht-Anker,
  sondern für **jede im Bezugsrahmen wählbare Definition** sowie für
  Kategorie-Knoten. Verfügbarkeit ist dann eine Eigenschaft dieses Datensatzes.
- **Option 3 — Zweiter Berichtszweig „Angebot".** Der Auswertungsbaum bleibt
  schlank; der Bericht bekommt daneben eine eigene Sicht, die je Knoten die
  wählbaren Definitionen mit ihren Grenzen auflistet.

## Entscheidungsergebnis

Gewählte Option: **Option 2.** Ein Slot ist künftig **jede Stelle, an der eine
Auswahl stehen kann** — ob dort etwas steht oder nicht. Der Bericht führt für
jeden dieser Slots einen Fähigkeitsdatensatz, und Verfügbarkeit wird daraus
abgelesen statt errechnet: gesperrt ist, wessen Höchstmaß ausgeschöpft ist;
versteckt ist, was ein Modifikator ausgeblendet hat; wie viel noch hineinpasst,
sagt der verbleibende Spielraum.

Das gilt ausdrücklich auch für **Kategorien**. Eine Kategorie ist kein
Auswahl-Slot, wird von der Oberfläche aber als eigener Abschnitt mit eigenen
Grenzen dargestellt; ohne sie bliebe eine budget-gesteuert ausgeblendete
Kategorie im Bericht unsichtbar — die bislang offene Grenze aus ADR-0030.

Damit entfallen **beide** Bestandteile von ADR-0022 ersatzlos: das hypothetische
Hinzufügen mitsamt der Grundlinie, und die Tabelle, welche Verletzungsart ein
Hinzufügen sperrt. Eine Verletzung muss nicht mehr klassifiziert werden, weil
nicht mehr die Verletzung die Sperre trägt, sondern der Slot.

**ADR-0022 ist damit ersetzt.** Der dort beschriebene Mechanismus bleibt bis zum
Cutover in Betrieb; die Entscheidung gegen ihn ist jedoch hier getroffen und
nicht erst dann.

Bewusst **nicht** entschieden ist, wie ein Anwender erfährt, *warum* etwas
gesperrt ist. Der Fähigkeitsdatensatz trägt die bedingten Hinweise des Katalogs;
ob und wie die Oberfläche daraus einen Freischalt-Grund formuliert, bleibt ihre
Sache (ADR-0034) und ist getrennt zu spezifizieren.

### Konsequenzen (Auswirkungen)

- **Positiv:** Verfügbarkeit ist eine ablesbare Eigenschaft statt einer
  Differenz. Sie lässt sich an einem einzigen Auswertungsergebnis prüfen.
- **Positiv:** Die Sperrtabelle entfällt. Eine neue Verletzungsart kann keine
  stille Lücke mehr in der Verfügbarkeit erzeugen.
- **Positiv:** Statt einer vollständigen Auswertung je angebotenem Eintrag
  genügt eine für die ganze Liste.
- **Positiv:** Einheit, Option und Kategorie werden über denselben Begriff
  beantwortet.
- **Negativ:** Der Auswertungsbaum wächst erheblich — er umfasst künftig nicht
  nur das Gewählte, sondern auch das Wählbare. Die Fixpunktschleife trägt diesen
  Zuwachs allerdings nicht: sie iteriert allein über die realen Knoten, während
  die synthetischen Anker ihre wirksamen Werte in **einem** Durchlauf nach der
  Konvergenz erhalten. Das ist zulässig, weil ein Anker keine Instanz trägt, in
  keine Zählung eingeht und den ausgewerteten Zustand deshalb nicht verändern
  kann — er empfängt Werte, er erzeugt keine. Ob der Zugewinn aus dem Wegfall der
  Pro-Kandidat-Auswertung den Zuwachs überwiegt, ist zu **messen** und nicht
  vorab behauptet.
- **Negativ:** „Wählbar im Bezugsrahmen" muss präzise bestimmt werden. Zu weit
  gefasst bläht es den Baum sinnlos auf, zu eng gefasst fehlen Optionen in der
  Oberfläche.
- **Neutral:** Der Aushebe-Dialog ändert sein beobachtbares Verhalten nicht — nur
  die Herkunft seiner Antwort.

## Vor- und Nachteile der Optionen

### Option 1 — Diff-Verfahren beibehalten

- **Gut, weil** das Verfahren erprobt ist und der Cutover es unverändert
  übernehmen könnte.
- **Gut, weil** der Auswertungsbaum schlank bliebe.
- **Schlecht, weil** die Sperrtabelle bliebe — samt ihrer Eigenschaft, Lücken
  durch Schweigen zu äußern.
- **Schlecht, weil** die Anwendung dafür einen hypothetischen Zustand bauen muss
  und damit wieder eigenes Wissen über Auswahl-Erzeugung trägt — gegen ADR-0034.
- **Schlecht, weil** je Kandidat eine vollständige Auswertung anfiele, nun sogar
  auf einer Engine, die den Katalog bei jedem Aufruf neu aufbereitet.

### Option 2 — Verfügbarkeit als abgelesene Eigenschaft

- **Gut, weil** Verfügbarkeit aufhört, ein Verfahren zu sein, und ein Zustand
  wird.
- **Gut, weil** es die vorhandene Phantomknoten-Idee der Engine konsequent zu
  Ende führt, statt ein neues Konzept danebenzustellen.
- **Gut, weil** dieselbe Antwortquelle für Einheiten, Optionen und Kategorien
  gilt.
- **Schlecht, weil** der Auswertungsbaum wächst und der Aufwand dadurch an einer
  neuen Stelle anfällt — belegt werden muss das durch eine Messung.

### Option 3 — Zweiter Berichtszweig „Angebot"

- **Gut, weil** der Auswertungsbaum schlank bliebe und der Aufwand berechenbar.
- **Schlecht, weil** dann zwei Wege dieselbe Frage beantworten — „darf hier etwas
  hinein?" einmal über Fähigkeitsdatensätze, einmal über das Angebot. Sie können
  auseinanderlaufen, und der Widerspruch fiele niemandem auf.
- **Schlecht, weil** die Unterscheidung „belegter Slot" gegen „angebotene
  Definition" eine Begriffsgrenze einzieht, die die Oberfläche bei jeder Frage
  erneut treffen müsste.

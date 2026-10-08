[BSData-Formatreferenz](../../battlescribe-data-format.md) › Praxis

# 10. Collective Entries

*(Aus dem Wiki: „Collective Entries" / „Help: Collective Entries".)*

Das `collective`-Flag auf einem Eintrag hat **zwei** Funktionen:

1. **Gruppierung identischer Auswahlen.** Sind alle Kinder eines Eintrags `collective`, werden sie
   zu **einer einzigen Roster-Zeile** zusammengefasst statt pro Modell einzeln gelistet. Die
   Einheiten-Auswahl wechselt dann von einem „Add"-Button zu einem **Spinner** (Mengenauswahl).

   > *Beispiel:* Soldaten sind einheitlich mit Gewehr und Messer ausgerüstet → beide Items
   > `collective` markieren → sie kollabieren zu einer Zeile.

2. **Synchronisierte Auswahl.** Eltern-Einträge, die sich einen gemeinsamen Elternknoten teilen,
   müssen konsistente Auswahlen haben. Wählt eine Instanz die Option, müssen es alle tun.

   > *Beispiel:* Ninjas mit individuellen Ausrüstungsoptionen → „Climbing Claws" `collective` →
   > wählt ein Ninja sie, müssen alle Ninjas des Trupps sie nehmen.

> ⚠️ **Warnung (aus dem Wiki):** Funktion 2 kann unerwünschte Kaskaden auslösen. Würde man z. B.
> „Soldaten" als `collective` markieren, würden **alle** Infanterie-Einheiten einer Force ihre
> Soldaten-Auswahl automatisch angleichen, sobald man eine ändert — meist unerwünscht. `collective`
> also gezielt und bewusst einsetzen.

> **Für die Auswertung wichtig:** `collective` beeinflusst nur die *Darstellung* gestapelter
> Instanzen — die Kosten- und Constraint-Mathematik (`child.number * parent.number`) läuft immer
> durch (siehe [§7.5](../building-blocks/cost.md#75-cost--cost-type)).

> **Funktion 2 wird bewusst nicht geprüft (Issue 0104).** Die Engine **liest** `collective` seit
> Issue 0102 (`isCollective` an Eintrag, Gruppe und Verweis, XSD-Vorgabe `false`), **wertet** es aber
> nicht aus: sie meldet keinen Befund, wenn zwei Geschwister-Instanzen mit gemeinsamem Elternknoten
> ein `collective`-Kind verschieden gewählt haben. Zwei Gründe:
> - **Es ist im Referenzprogramm eine Bearbeitungs-, keine Prüfregel.** Das Wiki beschreibt sie als
>   Angleichung beim Wählen („wählt ein Ninja sie, müssen alle Ninjas sie nehmen"), nicht als
>   Verstoß, den ein Validator im Nachhinein feststellt. Eine Liste, die die Regel verletzt, kann im
>   Editor gar nicht erst entstehen.
> - **Sie hätte im Bericht keinen Ort.** Jede Meldung trägt eine Herkunft aus einem geschlossenen
>   Wertevorrat — *aus einer Grenze abgeleitet* oder *Autor-Meldung* ([ADR 0034](../../adr/0034-auswertungsbericht-als-alleinige-quelle-der-oberflaeche.md)).
>   Ein Synchron-Befund ist weder das eine noch das andere; ihn aufzunehmen hieße, den Vorrat um
>   eine dritte Herkunft zu erweitern, für eine Regel, die kein Fixture-Katalog braucht (`collective="true"`
>   kommt vor, aber an keiner Stelle, an der Geschwister-Instanzen divergieren können).
>
> Der Verzicht ist damit ein **dokumentierter Schnitt**, kein Versehen. Fällt ein realer Katalog auf,
> in dem die Regel greift, ist das der Anlass, ihn erneut zu bewerten.

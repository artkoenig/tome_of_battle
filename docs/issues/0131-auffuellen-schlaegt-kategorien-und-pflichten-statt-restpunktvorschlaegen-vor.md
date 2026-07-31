---
status: active
branch: claude/auffuellen-suggestions-bug-rxtyjk
pr:
---

# „Auffüllen" schlägt Kategorien und Pflichten vor statt der Liste auf den Punktwert zu helfen

## Intent

Das Panel „Auffüllen" im Editor schlägt Dinge vor, für die es nie gedacht
war. Gemeldet am Beispiel **„General"**: das ist keine aushebbare Einheit,
sondern eine **Kategorie** — im WHFB6-Datensatz die `categoryEntry`
`a37e-7207-de6d-acb0` mit `min 1` je Kontingent. Führt das Kontingent diese
Kategorie nicht per `categoryLink` (in „Ogre Kingdoms" ist das so), hängt sie
im Bericht als `mandatoryPhantom` statt als `categoryAnchor` — und genau
diese Ankerart lässt das Panel durch. Der „+"-Knopf daneben baut daraus eine
Roster-Auswahl aus einer **Kategorie-ID**, also eine Auswahl, die kein
Katalogeintrag ist. Reproduziert an
`docs/testing/ogre-kingdoms/rosters/07-one-tyrant.ros` (gst + Ogre Kingdoms):
das Panel führt „General" (Slot `0/3`, `defId a37e-7207-de6d-acb0`,
`anchorKind mandatoryPhantom`, `isMandatoryUnmet true`).

Dahinter steht der eigentliche Fund: das Panel beantwortet seit dem Cutover
(Issue 0121) gar nicht mehr die Frage, für die es da ist. Es listet **offene
Pflichten**; gedacht war es, die Liste **auf den eingestellten Punktwert zu
bringen** (die Restpunkt-Vorschläge sind beim Cutover verlorengegangen,
Issue 0123 hält das fest). Gewollt ist: solange noch nennenswert Punkte
fehlen, zeigt „Auffüllen", was in die Restpunkte passt — wählbare Einheiten
und wählbare Optionen an bestehenden Einheiten, sonst nichts.

Acceptance criteria:

1. Hat die Liste keine Punktgrenze (keine Limit-Kostenart oder Punktwert 0),
   erscheint „Auffüllen" nicht.
2. Beträgt die Lücke zwischen dem eingestellten Punktwert und der aktuellen
   Summe der Limit-Kostenart **weniger als 50** Punkte — auch bei 0 oder bei
   Überschreitung —, erscheint „Auffüllen" nicht.
3. Beträgt die Lücke **50 Punkte oder mehr**, erscheint das Panel und nennt
   die verbleibende Summe in der Limit-Kostenart.
4. Vorgeschlagen wird ausschließlich, was der Bericht als wählbar führt: eine
   Einheit unmittelbar unter dem Kontingent oder eine Option an einer
   **bestehenden** Auswahl dieses Kontingents. Ein Kategorie-Slot erscheint
   nie — „General" also auch dann nicht, wenn seine Mindestgrenze offen ist.
5. Kein Vorschlag ist versteckt (`isHidden`) oder ausgeschöpft (`isBlocked`).
6. Jeder Vorschlag kostet **mehr als 0** und **höchstens die verbleibende
   Summe** der Limit-Kostenart und zeigt seine Kosten an; ein Vorschlag an
   einer bestehenden Einheit nennt die Einheit, zu der er gehört.
7. Eine offene Pflicht als solche erzeugt **keinen** Vorschlag mehr: ein
   Pflicht-Slot ohne Kosten in der Limit-Kostenart erscheint nicht im Panel.
8. Der „+"-Knopf eines Vorschlags fügt genau den benannten Katalogeintrag
   hinzu — nie eine Auswahl, die aus einer Kategorie-ID gebaut wurde.
9. Die Vorschläge stehen nach Kosten absteigend; sind es mehr als acht, zeigt
   das Panel zunächst acht und lässt den Rest aufklappen.

## Plan

## Tasks

## Decisions

- **Schwelle: 50 Punkte, Panel erst ab dieser Lücke.** *(Mensch, Antwort auf
  Rückfrage: „auffüllen sollte erst bei einer Differenz von … punkten zum
  eingestellten punktwert der liste angeboten werden" → „50 punkte".)*
  Gelesen als **Mindest**lücke: unter 50 fehlenden Punkten lohnt kein
  Vorschlag.
- **Inhalt: nur Wählbares im Restbudget.** Einheiten unter dem Kontingent und
  Optionen bestehender Einheiten; offene Pflichten stehen weiterhin im
  Meldungs-Panel und im Konfigurator der Einheit, nicht hier. *(Mensch,
  Auswahl „Nur Wählbares im Restbudget".)*
- **Ohne Punktgrenze kein Panel.** *(Mensch, Auswahl „Kein Panel".)*
- **Kein Engine-Eingriff.** Die Kategorie kam allein über `mandatoryPhantom`
  ins Panel; mit „nur Wählbares" als Quelle (`offerAnchor` und belegte Slots
  mit Restspielraum) fällt sie ohne Änderung am Bericht heraus — beide
  Ankerarten tragen nie eine Kategorie. Der Bericht bleibt die alleinige
  Quelle (ADR-0034). *(Default, unanswered.)*
- **Acht Vorschläge sichtbar, Rest aufklappbar.** Schon eine Liste mit zwei
  Auswahlen liefert 43 Kandidaten (gemessen an `07-one-tyrant.ros`); ohne
  Deckel wäre das Panel unlesbar. *(Default, unanswered.)*

## Log

- 2026-07-31: Gemeldet („auffüllen schlägt mir Optionen vor, wofür es nicht
  gedacht war. z.b. general"). Ursache reproduziert: `General` ist die
  Kategorie `a37e-7207-de6d-acb0` (min 1, Rahmen `force`); weil das
  Ogre-Kontingent sie nicht per `categoryLink` führt, bekommt sie in
  `evalTree.js` (`synthesizeMandatoryPhantoms`) ein Pflicht-Phantom statt
  eines Kategorie-Ankers, und `AutoFillSuggestions.jsx` lässt `occupied` und
  `mandatoryPhantom` durch. Der Fähigkeitsdatensatz trägt kein Merkmal, das
  eine Kategorie von einem Eintrag unterscheidet — der eigene Kommentar der
  Komponente („ein Kategorie- oder Gruppen-Anker benennt keinen aushebbaren
  Eintrag") ist damit nicht durchgesetzt.

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja. Der Mensch nannte zwei Probleme:
  die Schwelle (50 Punkte Lücke zum eingestellten Wert) und den Inhalt (nur
  Einheiten und Optionen bestehender Einheiten). Der gemeldete Fall
  („General") fällt unter die Inhaltsregel — er ist weder das eine noch das
  andere.
- **What surprised me?** Das gemeldete Symptom ist eine **Kategorie**, kein
  Eintrag — und die Komponente behauptet in ihrem eigenen Kommentar, genau
  das auszuschließen. `anchorKind` allein kann eine Kategorie nicht von einem
  Eintrag unterscheiden, weil eine Kategorie mit MIN-Grenze ein Pflicht-
  Phantom statt eines Kategorie-Ankers bekommt; der Kommentar war nie
  durchgesetzt.
- **What am I assuming without having verified it?** (a) „Differenz von 50
  Punkten" heißt **Mindest**lücke, nicht Höchstlücke — die Rückfrage ließ die
  Richtung offen. (b) Bei mehreren Kontingenten zeigt jedes sein eigenes
  Panel mit derselben roster-weiten Restsumme; das ist heute schon so und
  bleibt so. Verifiziert (kein Assume): ein Angebots-Anker trägt nur
  `selectionEntry`/`entryLink`, nie eine Kategorie (`offer.js`).

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro

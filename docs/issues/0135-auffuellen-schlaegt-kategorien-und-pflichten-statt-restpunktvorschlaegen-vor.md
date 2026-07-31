---
status: done
branch: claude/auffuellen-suggestions-bug-rxtyjk
pr: https://github.com/artkoenig/tome_of_battle/pull/188
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
10. Vorgeschlagen wird nur, was aus dem Armeebuch **dieses** Kontingents, dem
    Spielsystem oder einem Bibliothekskatalog stammt; eine Einheit aus einem
    fremden Armeebuch erscheint nicht — dieselbe Herkunftsregel, die der
    Aushebe-Dialog schon anwendet.

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
- **Quelle: `offerAnchor` und belegte Slots mit Restspielraum.** Ein belegter
  Slot, der noch wachsen darf (`headroom > 0` oder kein Höchstmaß), ist ein
  Auffüll-Kandidat wie jeder andere — eine bestehende Einheit zu vergrößern
  ist der klassische Weg, Punkte zu verbrauchen. *(Default, unanswered; der
  `test-author` fand die Kante offen.)*
- **Ein Pflicht-Phantom erscheint nie, auch mit Kosten nicht.** Kriterium 4
  („ausschließlich, was der Bericht als wählbar führt") ist die schärfere
  Regel, Kriterium 7 ihr Sonderfall. *(Default, unanswered; dieselbe
  Rückfrage.)*
- **Keine Versionsanhebung in diesem PR.** Vorgeschlagen war `1.10.0`
  (Minor: das Panel kann etwas Neues). *(Mensch, Auswahl „Unverändert
  lassen".)*
- **Ein Kontingent ohne Slots im Bericht bekommt kein Panel — bewusst gegen
  den Buchstaben von Kriterium 3.** Kriterium 3 verlangt das Panel ab 50
  Punkten Lücke ohne Ausnahme; führt der Bericht für dieses Kontingent aber
  gar keine Slots (`forcePath === null`, etwa weil der Katalog seine
  Definition nicht mehr kennt), gäbe es dort nichts auszuheben und nichts
  Wahres zu sagen. Die Sektion trägt für diesen Fall schon die Meldung „gibt
  es im Katalog nicht mehr". Eine dritte Meldung im Panel wäre die
  buchstabengetreue Alternative; entschieden ist Schweigen. *(Default,
  unanswered; Befund R3-F1 der Prüfung, mit Reproduktion.)*
- **Acht Vorschläge sichtbar, Rest aufklappbar.** Schon eine Liste mit zwei
  Auswahlen liefert 43 Kandidaten (gemessen an `07-one-tyrant.ros`); ohne
  Deckel wäre das Panel unlesbar. *(Default, unanswered.)*

- **Kriterium 10 kam mitten im Lauf dazu.** Der Screenshot des fertigen Panels
  zeigte in einer Ogre-Liste Manfred von Carstein, Vampire Lord, Black Coach
  und Savage Orc Great Shaman — Einträge fremder Armeebücher. Der
  Aushebe-Dialog filtert das seit Issue 0121 über `capability.sourceId`, das
  Auffüll-Panel nicht. Kein bestehendes Kriterium verbot es, deshalb ging der
  Fund an den Menschen. *(Mensch, Auswahl „Jetzt mitnehmen": der Filter kommt
  in diesen PR statt in ein eigenes Issue.)* Abweichung von der Regel
  „Kriterien stehen fest, sobald die Umsetzung beginnt" — auf Ansage des
  Menschen, der die Kriterien freigibt.

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

- 2026-07-31: Umgesetzt. Das Panel liest jetzt die **wählbaren** Slots
  (`offerAnchor`, `occupied` mit Restspielraum) statt der Pflicht-Signale,
  filtert auf Kosten in der Limit-Kostenart (> 0, ≤ Restsumme), sortiert
  absteigend und deckelt bei acht. `remainingPoints` entsteht in
  `RosterEditor.jsx` und läuft über `ForceEditorSection.jsx` ins Panel. Der
  Herkunftsfilter des Aushebe-Dialogs ist als `foreignCatalogueIdsOf` nach
  `src/roster/catalogResolver.js` gezogen und wird von beiden Aufrufstellen
  benutzt.
- 2026-07-31: **Prüfrunde 1** (frischer Kontext, `origin/main..3b17a7f`),
  6 Befunde. Fakten der Runde: `npm test` exit 0 (251 Dateien / 2649 Tests
  plus Puppeteer-E2E), `lint`/`typecheck`/`depcruise` exit 0, `knip`
  warn-only mit ausschließlich vorbestehenden Meldungen.
  - *F1 (Kriterien 1–3): behoben.* Die Lücke wird in `RosterEditor.jsx`
    gerechnet und durchgereicht, und beides war ungeprüft — beide Stellen
    ließen sich brechen, ohne einen Test rot zu machen. Testfälle nachgefordert.
  - *F2 (Kriterium 3): behoben.* Das Panel verschwand auch bei großer Lücke,
    sobald nichts hineinpasste. Es erscheint jetzt immer ab der Schwelle;
    passt nichts, steht ein Hinweis statt der Liste
    (`editor.autofill.nothingFits`).
  - *F3 (kein Kriterium): abgelegt* als Issue 0136 — dieselbe Einheit
    erzeugt je Auswahl eine eigene Zeile.
  - *F4 (kein Kriterium): behoben.* Der Eintrag in Issue 0123 behauptete
    erfüllte Kriterien, die dort erst nach einer Entscheidung des Menschen
    gelten; jetzt hält er nur fest, welche Aussage dieser Umbau falsch macht.
  - *F5 (kein Kriterium): behoben* mit diesem Eintrag, Checkpoint 2 und dem
    Versionsvorschlag.
  - *F6 (kein Kriterium): behoben*, weil es die eigene Stilvorlage dieses
    Panels betrifft (ADR-0004 §6): `.autofill-remaining` hat jetzt eine Regel,
    die seit dem 0121-Cutover toten Selektoren der alten Panel-Struktur sind
    weg.
  - *Ohne Reproduktion gemeldet und damit verworfen:* ein möglicher
    Herkunftsfilter-Kurzschluss, wenn weder `forceCatalogueId` noch
    `activeCatalogue` gesetzt ist. Die Prüfung fand selbst keinen Pfad dorthin
    (`createRoster.js` setzt die Katalog-Id immer).
  - *Nebenbefund, mitgenommen:* `docs/battlescribe-data-format.md` nannte das
    Panel unter den Stellen, die effektive Werte selbst rechnen — seit dem
    Cutover falsch, und dieser Umbau macht es endgültig falsch.

- 2026-07-31: Rebase auf `b87af28`, weil main weitergelaufen war. Dabei
  die Nummern gezogen: 0131–0134 waren dort vergeben, diese Issue heißt
  jetzt 0135, der Folgefund 0136. Der Rebase machte drei Editor-Testdateien
  rot — ihre `lucide-react`-Attrappen kannten `Wand2`/`Plus` nicht, weil das
  Panel dort vor dem F2-Fix nie erschien. Ergänzt.
- 2026-07-31: **Prüfrunde 2** (derselbe Kontext, fortgesetzt), 3 Befunde, alle
  ohne Kriteriumsverletzung. Die Runde bestätigte F1 und F2 als geschlossen —
  F1 durch Mutation belegt (das Löschen der Durchreichung macht jetzt Tests
  rot). Fakten der Runde: `npm test` exit 0 (261 Dateien / 2715 Tests plus
  Puppeteer-E2E), `lint`/`typecheck`/`depcruise` je exit 0.
  - *R2-F1: behoben.* Die Akte behauptete einen Checkpoint 2, der noch nicht
    geschrieben war. Er steht jetzt.
  - *R2-F2: behoben.* Drei Commit-Betreffs nannten „issue 0131" — nach der
    Umnummerierung die Nummer einer fremden, schon gemergten Issue. Umbenannt.
  - *R2-F3: behoben*, obwohl kein Kriterium verletzt: dieser Diff selbst hatte
    den Fehler eingeführt. Für ein Kontingent, für das der Bericht keine Slots
    führt (`forcePath === null`), behauptete das Panel „Nichts passt mehr in
    die Restpunkte". Es schweigt dort jetzt.

- 2026-07-31: **Prüfrunde 3** (derselbe Kontext), 1 Befund. Die Runde bestätigte
  R2-F1 bis R2-F3 als geschlossen, R2-F3 per Mutation. Fakten: `npm test`
  exit 0 (261 Dateien / 2717 Tests plus Puppeteer-E2E),
  `lint`/`typecheck`/`depcruise` je exit 0.
  - *R3-F1 (Kriterium 3): verworfen mit Begründung* — siehe die Entscheidung
    oben. Der Fix zu R2-F3 nimmt dem Panel für ein Kontingent ohne Slots die
    Sichtbarkeit, die Kriterium 3 dem Buchstaben nach verlangt. Statt einer
    dritten Meldung ist Schweigen entschieden; die Annahme steht jetzt
    ausdrücklich im Checkpoint, und die beiden Testfälle stehen nicht mehr
    unter der Überschrift von Kriterium 3, sondern unter der Ausnahme.
  - *Nebenbefund, abgelegt als Issue 0137:* mehrere Fälle des
    Evaluator-E2E-Runners liegen im ruhigen Lauf bei über der Hälfte der
    5-Sekunden-Vorgabe; unter Nebenlast kippt die Suite. Betrifft keine Datei
    dieses Diffs.
  - **Runde 4 entfällt** (Waiver): die Antwort auf R3-F1 ändert keine
    Erwartung und keine Zeile Produktivcode — sie besteht aus der notierten
    Verwerfung und der Umbenennung zweier `describe`-Blöcke.

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

- **Does this match what was asked?** Ja, und mehr als der gemeldete Satz.
  Gemeldet war „General"; gefordert waren dann zwei Dinge — die Schwelle und
  „nur Einheiten und Optionen bestehender Einheiten". Beides steht, samt des
  Herkunftsfilters, den der Mensch unterwegs dazugegeben hat. Was der Mensch
  **nicht** verlangt hat und was deshalb draußen blieb: die Doppel-Zeilen
  (Issue 0136) und die Knapsack-Suche des alten Solvers.
- **What surprised me?** Dass der Fix zu „Panel erscheint auch ohne passenden
  Vorschlag" gleich zwei Folgen hatte, die niemand vorhergesehen hatte: drei
  fremde Testdateien brachen an einer unvollständigen Icon-Attrappe (das Panel
  erscheint jetzt an Stellen, an denen es nie erschien), und für ein
  Kontingent ohne Slots im Bericht behauptete es „nichts passt hinein" —
  eine Aussage über etwas, worüber der Bericht schweigt.
- **What am I assuming without having verified it?** Die Leserichtung der
  Schwelle („ab 50 Punkten Lücke", nicht „bis 50") — der Mensch hat die Zahl
  bestätigt, die Richtung nie ausdrücklich. Dass die roster-weite Restsumme je
  Kontingent zu wiederholen in Ordnung ist; bei mehreren Kontingenten steht
  dieselbe Zahl mehrfach. Und — die schärfste der drei — dass Kriterium 3 eine
  Ausnahme verträgt, die der Mensch nie gewährt hat: für ein Kontingent ohne
  Slots im Bericht schweigt das Panel, statt mit einer dritten Meldung zu
  erscheinen.

## Retro

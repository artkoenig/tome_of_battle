Status: ready-for-agent
Blocked by: [01]

## Description
Der Parser soll jedes `name`-Attribut beim Einlesen trimmen. Alles dahinter — Anzeige,
Sortierung, Vergleiche, Export — arbeitet damit mit sauberen Namen, ohne selbst zu trimmen.

**Warum an dieser Stelle:** Die Katalogdaten ziehen in einen Fork, der Upstream-Änderungen
mergen können muss. Jede kosmetische Abweichung ist dauerhafte Konfliktfläche gegen genau
diesen Zweck. Deshalb bleiben die Dateien byteidentisch zu Upstream, und die Formatierung
wird an der Systemgrenze normalisiert — derselbe Anti-Corruption-Layer-Gedanke, den ADR-0011
für den Roster-Import etabliert hat. Das ist keine Heuristik (die raten würde), sondern eine
deterministische Normalisierung.

**Damit wird die datenseitige Bereinigung aus Issue 11 zurückgenommen.** Dessen
Akzeptanzkriterium („kein `trim()` als Workaround") ist überholt — faktisch war es das bereits
durch `normalizeName()` aus Issue 07, das beim Regel-Lookup alles außer `[a-z0-9]` verwirft
und Whitespace-Unterschiede damit ohnehin ignoriert. Begründung und Abgrenzung zur Projektlinie
„Datenfehler gehören in den Katalog" (die für **semantische** Lücken unverändert gilt):
[ADR 0014](../../../adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md).

Verstreute `trim()`-Aufrufe an Verwendungsstellen sind ausdrücklich **nicht** die Lösung. Das
vorhandene `ct.name.trim()` in der Kostenaufstellung wird durch diese Änderung überflüssig und
entfällt.

Der reale Datenbestand ist klein: Von den führenden Leerzeichen entfallen fast alle auf das
`name`-Attribut von `<cost>`-Elementen, das der Parser gar nicht liest. Tatsächlich betroffen
sind die beiden `costType`-Definitionen `" Casting Dice"` und `" Dispel Dice"` sowie
Entry-Namen wie `"Armour of Damnation "`.

Der Umfang ist bewusst eng: führende/nachgestellte Leerzeichen, sonst nichts. Akzente,
Anführungszeichen und Interpunktion bleiben Sache von `normalizeName()` im Regel-Lookup.

Kontext: [PRD](../../../PRD-katalog-updates-und-roster-kompatibilitaet.md) (Requirement 8,
Seam 5), [Issue 11](../../11-katalognamen-mit-ueberfluessigen-leerzeichen-bereinigen/issue.md).

## Acceptance Criteria
- [ ] Roh-XML mit führenden/nachgestellten Leerzeichen in `name` erzeugt ein Systemobjekt mit
      getrimmten Namen (Test an der bestehenden Parser-Naht)
- [ ] `ct.name.trim()` in der Kostenaufstellung ist entfernt, die Kostenanzeige bleibt korrekt
- [ ] Kein neuer `trim()`-Aufruf an einer Verwendungsstelle
- [ ] Regression: Die fünf in Issue 11 genannten Regeln (`Cavalry hammer`, `Repeater Handgun`,
      `Repeater Pistol`, `Chariot of the Gods`, `Crazed!`) bleiben verlinkt
- [ ] Weder Anzeige noch Export zeigen Namen mit überflüssigen Leerzeichen
- [ ] Keine weitergehende Normalisierung (Akzente, Anführungszeichen, Interpunktion unberührt)

## Comments

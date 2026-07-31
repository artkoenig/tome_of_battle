---
status: done
branch: claude/vampire-editor-unwanted-items-syfq8s
pr:
---

# An option inside a hidden group keeps a visible offer anchor

## Intent

When a `selectionEntryGroup` is hidden, the report drops the group's own anchor
— but an option the group holds still gets an offer anchor with
`isHidden: false`. On the unit card that option then renders as a stray row
with no group around it, even though the group that owns it is hidden.

Found while building a synthetic catalogue for issue 0131: a container whose
only member was a group marked `hidden="true"` emitted no anchor for that
member group, yet the option inside it stayed visible until the option itself
was marked hidden too. Whether hiding a group is meant to hide what it holds is
the question this issue has to settle first — the BattleScribe data format
reference decides it, not this file.

Provenance worth knowing: the observation comes from a synthetic catalogue, not
from catalogue data in the fixtures. Nobody has yet checked whether a real
catalogue hides a group while leaving its options unhidden. If none does, this
may be a latent case rather than a live defect, and the right outcome may be to
close it as such.

Acceptance criteria:

1. It is established from the BattleScribe data format reference whether a
   hidden group is meant to hide the options it holds, and the answer is
   recorded here with its source.
2. It is established whether any catalogue in the fixtures hides a group whose
   options are not themselves hidden, and the answer is recorded here with the
   command that established it.
3. If the format says a hidden group hides its options: an option held only by
   a hidden group carries `isHidden: true` in the report, and the unit card
   shows no row for it.
4. If the format says otherwise, or no real catalogue exercises the case, this
   issue closes with that finding recorded and no production change.

## Plan

Erledigt zusammen mit
[Issue 0135](0135-fremde-magische-gegenstaende-erscheinen-am-vampir.md), dessen
Bugmeldung genau auf diesen Defekt fiel: „Bloody Nora" traegt selbst kein
`hidden`, versteckt ist allein die geteilte Gruppe, die es haelt. Beide Kriterien
dieses Issues sind dort beantwortet, die Umsetzung liegt in seinem Zweig.

## Tasks

## Decisions

- **Kriterium 1 — beantwortet: ja, eine versteckte Gruppe versteckt ihre
  Optionen.** Quelle: das BSData-Wiki, *Props: Hidden*
  (`docs/bsdata-catalogue-development-wiki/Data-structure-overview.md`): „the
  entity will not be visible to the user". Eine `selectionEntryGroup` ist der
  einzige Ort, an dem ihre Member dem Nutzer angeboten werden — ist die Gruppe
  nicht sichtbar, ist es keine ihrer Optionen. Die Projekt-Referenz haelt die
  Regel jetzt fest (`docs/battlescribe-data-format.md` §8).

- **Kriterium 2 — beantwortet: ja, echte Kataloge tun genau das** (die Vermutung
  „vielleicht nur ein latenter Fall" ist damit widerlegt). Zwei belegte Beispiele
  aus `src/evaluator/__fixtures__/whfb6-definitive/Vampire Counts (6th definitive
  edition).cat`:
  - die geteilte Gruppe „Magic Weapons (Vampire Coast)" (`e717-0f50-0c96-a2bc`,
    `hidden="true"`) haelt „Bloody Nora"/„Wharf Rats"/„Dirty Serpent" — keiner
    dieser Verweise traegt selbst `hidden="true"`;
  - die Gruppe „Armour" des Vampirs (`66f2-d6a1-420c-5a39`, `hidden="true"`,
    aufgedeckt nur fuer die Blutlinien Blood Dragon/Von Carstein) haelt „Heavy
    Armour" und „Light Armour", beide ohne eigenes `hidden`.

  Kommando, das den Bestand aufgezaehlt hat: `node scratch/slots.mjs` (Wegwerf-
  Skript ueber die Fassade `evaluate` gegen dieselben Fixtures, nicht im Repo);
  die Aussage steht seither als Test in
  `src/evaluator/offer.hiddenGate.test.js` (Abschnitte „Echte Katalogdaten").

- **Kriterium 3 — umgesetzt.** Eine Option, die ein Rahmen nur durch eine
  versteckte Gruppe anbietet, traegt `isHidden: true`; die Einheitenkarte zeigt
  keine Zeile fuer sie (`SelectionConfigurator`: `if (capability.isHidden)
  continue`). Belegt vor/nach der Aenderung in der laufenden App mit den
  DE-Katalogen.

## Log

- Observed by the `test-author` subagent while writing tests for issue 0131,
  against a synthetic catalogue it built for that purpose. Kept out of those
  tests deliberately: it is a different defect from the one 0131 is about.
- 2026-07-31: als Teil von Issue 0135 erledigt — Ursache, Beleg an echten Daten
  und Umsetzung stehen dort.

## Checkpoints

### Before implementation

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro

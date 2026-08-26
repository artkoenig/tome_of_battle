# Glossary — one name per domain term

This project speaks its domain twice: German in the prose, BattleScribe's English in the
identifiers. That is not a defect to translate away — but a *term* may only have one name in
code. This file is the decision, one row per term.

How to read it:

- **Name** is what an identifier is called. Nothing in `src/` may name the term differently.
- **Synonym (rejected / prose)** is what a search should also find: either a name that lost
  and no longer exists in code, or the German word the prose keeps using on purpose.
- **Context** is the bounded context the term belongs to (`armylist`, `ruleengine`, `catalog`,
  `play`, `rulebook`, `ui`), per [ADR-0042](adr/0042-schnitt-nach-fachlichkeit-bounded-contexts-und-ports.md).

Two rules decided every row:

1. Where BattleScribe's format defines the thing, **the format's word wins**.
   [`docs/battlescribe-data-format.md`](battlescribe-data-format.md) stays the authority for what
   such a term means; this file only points at it and never restates it.
2. Where this app means something narrower or different from the format, **this app's word wins**
   and the row says what it means.

The German prose keeps its vocabulary. `Kontingent` in a comment above a `force` parameter is
correct and stays — the mapping is this table, not a rename of 364 comments.

## Terms

| Name | Synonym (rejected / prose) | Context | Meaning |
|---|---|---|---|
| `force` | `contingent`, de. *Kontingent* | armylist, ruleengine | A roster's `<force>`: the frame a unit is raised into. BattleScribe's term — see [battlescribe-data-format.md](battlescribe-data-format.md). |
| `raise` | ~~`recruit`~~, ~~`addUnit`~~, de. *ausheben* | armylist | Putting a unit on the table: the write use case `raiseUnit`, the command `commands.raiseUnit`, the report's `raiseCosts`/`raiseMembers`. This app's term. `recruit` and `addUnit` name nothing in `src/`; the only hits left are the third-party product *New Recruit* and the pinned fixture `recruit-trees-pre-0157.json`, named after the corpus it freezes. |
| `slot` | de. *Slot*, *Position* | ruleengine | A position in the report's evaluated tree, addressed by its slot path. Not a BattleScribe term: the report invents it (ADR-0034/0036). |
| `offer` | de. *Angebot* | ruleengine, ui | A slot the roster could occupy but does not yet — anchor kind `offerAnchor` (ADR-0036). An offer is a *kind of* slot, never a synonym for one. |
| `occupied` | de. *besetzt* | ruleengine | The anchor kind of a slot an actual selection stands in. The counterpart of `offer`. |
| `capability` | de. *Fähigkeitsdatensatz* | ruleengine | The record the report carries per slot: what may happen there, and at what cost (ADR-0035). |
| `listRule` | de. *Listenregel*, *Pflichtregel* | ruleengine, armylist | An army-list rule of the rulebook (§9.9 and kin) that the roster must satisfy; `mandatory` marks the ones with no choice left. |
| `armyWide` | de. *armeeweit* | ruleengine, ui | A selector that applies to the whole army rather than to one force or unit. |
| `upgrade` | de. *Ausrüstung*, *Upgrade* | ui, armylist | What a unit takes below itself and what it costs. Distinct from `option`. |
| `option` | de. *Option* | armylist | The catalogue-side position an upgrade is chosen at: a group member or a standalone entry. Structure, not choice. |
| `subUnit` | de. *Untereinheit* | ruleengine, ui | A selection inside a unit that is itself unit-like (`isIndependentSubUnit` when it carries its own slot frame). |
| `costLimit` | de. *Punktegrenze* | armylist, ui | The roster's limit in the chosen cost type, and the type id itself (`resolveCostLimitTypeId`). |
| `category` | de. *Kategorie* | armylist, ruleengine | BattleScribe's `<category>`/`categoryLink`; the report's *effective primary* category decides which section a unit shows under. |
| `system` | de. *Spielsystem* | catalog | The parsed game system with its catalogues. BattleScribe's `.gst` — see [battlescribe-data-format.md](battlescribe-data-format.md). |
| `report` | de. *Bericht*, *Auswertung* | ruleengine | The evaluator's one result, the sole source of every display answer (ADR-0034). |

## Where the format's word is the authority

`force`, `category`, `system`, `selectionEntry`, `entryLink`, `categoryLink`, `infoLink`,
`modifier`, `constraint`, `profile` and the rest of the XML's own vocabulary mean what
[battlescribe-data-format.md](battlescribe-data-format.md) says they mean, and are not repeated
here. The last five of those additionally stop at an ACL: `src/contexts/armylist/acl/` and
`src/contexts/ruleengine/acl/` are where the catalogue's words end, and the UI may not name them
at all (`ui-kein-fremdformat` in `.cast/rules.json`).

## Scope

`src/contexts/ruleengine/engine/` is deliberately outside this table: the engine speaks the
format's language throughout (ADR-0031/0032), and its terms are pinned by its own test corpus.
User-visible strings are a translation question, not a naming one, and live in
`src/ui/i18n/locales/`.

---
paths:
  - "src/shared/**"
---

# shared

The shared kernels of the cut by subject (Issue 0186): vocabulary every layer may read and that
depends on nothing outside itself. Not a catch-all — the earlier `src/shared/` was dissolved by
Issue 0179 for being exactly that.

- Fan-out is zero and the gate enforces it: `shared-haengt-an-nichts` in `.cast/rules.json`
  forbids `shared -> src/ui/**`, `-> daten`, `-> src/contexts/**`. Adding one import out of here
  fails `npm run cast`, not the tests. Imports *within* `src/shared/` are allowed
  (`events/dataEvents.js` reads `rostermodel/types.js`).
- `rostermodel/types.js` is our own list vocabulary (`Selection`, `Force`, `Roster`), pure JSDoc
  typedefs with no runtime export. Consumers pull it in with a bare `import '.../types.js';` for
  the side effect of registering the typedefs, then reference them as
  `import('.../rostermodel/types.js').Roster`. Renaming or moving the file means rewriting both
  shapes — a plain grep for `from '` misses the JSDoc ones.
- `rostermodel/selectionIds.js` owns the one rule for a `Selection`'s two ids, and the two names
  are **not** interchangeable: `selectionIdentityId` (link id first) holds after
  `reconcileImportedSelectionIds`, `importedCatalogueEntryId` (entry id first) only before it, on
  the import path. Both always resolve to *something* — `findEntryInSystem` indexes link ids and
  entry ids in one map — so the wrong one is silent. Never spell the fallback out inline again;
  `docs/glossary.md` carries a row per name.
- `src/contexts/ruleengine/**` may **not** import `rostermodel/` (`evaluation-keine-roster-abhaengigkeit`);
  `acl/**` is the one exception (`acl-kennt-beide-vokabulare` under `allowed`). A read model that
  needs list vocabulary takes it re-exported from `acl/rosterAdapter.js`, the only door inward.
- Both id fields may arrive as the **empty string**, not just `null`: the `.ros` serializer writes
  `entryLinkId=""` for a direct selection, and so does BattleScribe. `??` keeps that `''` and is a
  bug on raw XML; `||` is the semantics this vocabulary means.
- `battlescribe/battlescribeSchema.generated.js` is generated, never hand-edited. Its source is
  the vendored `src/platform/battlescribe/schema/Catalogue.xsd`; `npm run generate:schema`
  (`scripts/generate-schema-module.js`, `GENERATED_MODULE_PATH`) writes it, and a guard test
  regenerates and fails on drift. Moving it means editing that constant and
  `src/platform/battlescribe/schema/PROVENANCE.md` in the same commit.
- `battlescribe/` is the Battlescribe vocabulary, `rostermodel/` is ours. The ACL exists to
  translate between them — do not merge the two directories to save a level.
- `events/dataEvents.js` is the one change channel. It lives here rather than in a context
  because every writer announces into it and `src/ui/viewmodels/useAppData.js` is the single
  subscriber; placed in a context it would make context import context.
- Test files stay under `src/tests/<old layer>/`, mirroring where the module used to live. They
  were not moved with the modules; only their import paths changed.

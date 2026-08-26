# Vendored BattleScribe schema — provenance & version pin

`Catalogue.xsd` in this directory is the **official BattleScribe data-format
schema, vendored and version-pinned** into the repository. It is the single
source of truth for the format's closed enum sets and canonical attribute names
(see [ADR 0016](../../../docs/adr/0016-battlescribe-xsd-als-vendored-konformitaetsquelle.md)).

## The file is NOT byte-identical to upstream — read this before you re-pull

Four constructs were added **by hand, on purpose**, because they occur in real
catalogue data and no published `BSData/schemas` version — `vNext` included —
declares them (ADR 0016, revisions 2026-07-19 and 2026-07-31):

| Addition | Where | Evidence |
| --- | --- | --- |
| `ModifierKind` value `multiply` | `ModifierKind` enum | Lexicanum "Definitive Edition" |
| `ModifierKind` value `prepend` | `ModifierKind` enum | Lexicanum "Definitive Edition" |
| `join` attribute on `<modifier>` | `Modifier` type | Lexicanum "Definitive Edition" |
| `ConditionGroupKind` value `not` | `ConditionGroupKind` enum | `Vampire Counts`, "Army of the Lichemaster" (Issue 0115) |

Replacing this file with the upstream bytes silently removes all four. Dropping
`conditionGroup type="not"` is what Issue 0115 was: the catalogue reader rejected
the group, the mandatory modifier never fired, and two compulsory units vanished
from the report without a message. **Do not overwrite this file with upstream —
merge into it**, and keep every hand-addition, each marked by a comment in the
XSD naming its catalogue evidence.

Beyond those four additions the file follows the pinned upstream revision below.
Do not edit it for any other reason.

## Pin

| Field | Value |
| --- | --- |
| Upstream repository | https://github.com/BSData/schemas |
| Upstream path | `src/xml/schema/v2_03/Catalogue.xsd` |
| Format version | 2.03 |
| Pinned commit | `ee8240d8daffbc5533d50370ba0ed3df016a4f99` (2020-08-14) |
| Retrieved | 2026-07-18 |
| Upstream license | MIT — Copyright (c) 2020 BSData |

No checksum is pinned. A hash over the vendored file cannot verify the upstream
bytes — the hand-additions above make the two differ by design — and a hash that
has to be re-typed after every deliberate addition drifts to the first stale
value and then verifies nothing. The guard that actually holds is
`scripts/generate-schema-module.test.js`: it regenerates the schema module from
*this* file and fails when the committed module has drifted, so no edit here
reaches the code unreviewed (Issue 0207).

The same file serves both build-time codegen and the (now implemented) runtime
import validation, via a namespace swap between `catalogue`, `gameSystem` and
`roster` (see the comment block at the top of the XSD).

## Generated artifact

`src/shared/battlescribe/battlescribeSchema.generated.js` (shared kernel, outside this
directory since Issue 0186) is produced from this XSD by
`npm run generate:schema`
([`scripts/generate-schema-module.js`](../../../scripts/generate-schema-module.js)).
It is committed. A guard check
([`scripts/generate-schema-module.test.js`](../../../scripts/generate-schema-module.test.js))
regenerates the module from this XSD and fails if the committed content has
drifted — so any change to the XSD forces a conscious regeneration and review.

## Updating the pin

1. Take the new `Catalogue.xsd` from the upstream path at the chosen commit and
   **merge** it into this file — do not replace it. Re-apply every hand-addition
   listed above that the new upstream version still does not declare, and drop
   only those it has meanwhile adopted (ADR 0016 requires that check on every
   version jump).
2. Update the **Pin** table above (commit, date).
3. Run `npm run generate:schema` and review the diff in
   `src/shared/battlescribe/battlescribeSchema.generated.js` — new or changed enum
   values / attribute
   names surface here.
4. Commit the XSD, the regenerated module and this file together.

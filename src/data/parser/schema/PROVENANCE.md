# Vendored BattleScribe schema — provenance & version pin

`Catalogue.xsd` in this directory is the **official BattleScribe data-format
schema, vendored and version-pinned** into the repository. It is the single
source of truth for the format's closed enum sets and canonical attribute names
(see [ADR 0016](../../../docs/adr/0016-battlescribe-xsd-als-vendored-konformitaetsquelle.md)).

The file is kept **byte-identical to upstream** so its checksum verifies the
exact source bytes. Do not edit it by hand.

## Pin

| Field | Value |
| --- | --- |
| Upstream repository | https://github.com/BSData/schemas |
| Upstream path | `src/xml/schema/v2_03/Catalogue.xsd` |
| Format version | 2.03 |
| Pinned commit | `ee8240d8daffbc5533d50370ba0ed3df016a4f99` (2020-08-14) |
| Retrieved | 2026-07-18 |
| SHA-256 | `22732015cbfbe7238beeee5e8c23227a164a55af2fcab416239731909b474784` |
| Upstream license | MIT — Copyright (c) 2020 BSData |

The same file serves both build-time codegen and the (now implemented) runtime
import validation, via a namespace swap between `catalogue`, `gameSystem` and
`roster` (see the comment block at the top of the XSD).

## Generated artifact

`battlescribeSchema.generated.js` in this directory is produced from this XSD by
`npm run generate:schema`
([`scripts/generate-schema-module.js`](../../../scripts/generate-schema-module.js)).
It is committed. A guard check
([`scripts/generate-schema-module.test.js`](../../../scripts/generate-schema-module.test.js))
regenerates the module from this XSD and fails if the committed content has
drifted — so any change to the XSD forces a conscious regeneration and review.

## Updating the pin

1. Copy the new `Catalogue.xsd` from the upstream path at the chosen commit,
   keeping it byte-identical.
2. Update the **Pin** table above (commit, date, SHA-256; run
   `shasum -a 256 Catalogue.xsd`).
3. Run `npm run generate:schema` and review the diff in
   `battlescribeSchema.generated.js` — new or changed enum values / attribute
   names surface here.
4. Commit the XSD, the regenerated module and this file together.

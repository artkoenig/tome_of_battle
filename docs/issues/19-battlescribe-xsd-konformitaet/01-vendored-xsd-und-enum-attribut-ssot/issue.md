Status: resolved
Type: fix
Blocked by: None

## Description
Grundlage (Prefactoring) für die gesamte XSD-Konformität aus Main-Issue 19;
deckt Solution B sowie User Stories 5 + 7 ab. Architektur: ADR 0016.

Die offizielle `Catalogue.xsd` (v2.03, BSData/schemas) wird versioniert und
**gepinnt** ins Repo aufgenommen. Ein per npm-Script (`npm run generate:schema`)
ausführbarer Codegen-Schritt erzeugt daraus ein **committetes** Modul, das die
geschlossenen Enum-Mengen und die kanonischen Attributnamen des Formats
exportiert. Parser und Evaluator konsumieren künftig ausschließlich dieses
generierte Modul statt handgepflegter String-Literale — damit ist die
Drift-Klasse hinter allen 9 Format-Bugs strukturell ausgeschlossen.

Ein Guard-Check (Teil der Test-Suite) regeneriert das Modul aus der vendored
XSD und vergleicht es mit dem committeten Stand; weichen sie ab, schlägt er
laut fehl. So erzwingt ein XSD-Update mit neuen gültigen Werten ein bewusstes
Nachziehen (US 7).

Exportierte Enums (aus der XSD): SelectionEntryKind, InfoLinkKind, EntryLinkKind,
CatalogueLinkKind, ConstraintKind, ModifierKind, ConditionKind,
ConditionGroupKind — plus die kanonischen Attributnamen.

## Acceptance Criteria
- [ ] `Catalogue.xsd` v2.03 liegt versioniert und mit dokumentierter Versions-Pinnung im Repo
- [ ] `npm run generate:schema` erzeugt reproduzierbar das Enum-/Attributnamen-Modul aus der vendored XSD
- [ ] Das generierte Modul exportiert alle 8 geschlossenen Enum-Mengen + kanonische Attributnamen und ist committet
- [ ] Guard-Check in der Test-Suite schlägt fehl, wenn committetes Modul ≠ aus vendored XSD generiert
- [ ] Nachweis US 7: eine simulierte XSD-Wertänderung lässt den Guard-Check rot werden

## Comments
- Vendored Catalogue.xsd v2.03 (BSData/schemas @ee8240d8, byte-identical, provenance dokumentiert) nach src/parser/schema/. Codegen 'npm run generate:schema' erzeugt committetes SSOT-Modul mit allen 8 geschlossenen Enums + 45 kanonischen Attributnamen aus den XSD-xs:enumeration/xs:attribute-Deklarationen. Guard-Test regeneriert und vergleicht byte-genau; US-7-Drift-Tests belegen Rot bei geaenderten/neuen Enum-Werten. Parser/Evaluator noch nicht angebunden (Folge-Issues 02-07).

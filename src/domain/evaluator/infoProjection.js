/**
 * Info-Projektion (`design.md`, Kontrakt „Profile und Regeltexte je Slot";
 * `docs/evaluator-architecture.md` §3.6).
 *
 * Beantwortet **eine** Frage: *welche Profile und Regeltexte gelten fuer diesen
 * Slot?* Sie loest Info-Verweise auf, erbt aus den belegten Unter-Auswahlen
 * herauf, filtert Verstecktes und setzt die **effektiven** Merkmalswerte und Namen
 * ein. Sie wertet nichts aus und rechnet nichts nach — jeder Wert stammt aus der
 * Effektiv-Werte-Schicht, die ihn genau einmal bestimmt hat (ADR-0034,
 * Leitprinzip 2).
 *
 * ── Was ein Eintrag traegt ───────────────────────────────────────────────────
 * Art (Profil oder Regel), die **ID des Vorkommens**, den **effektiven** Namen,
 * die **Buchquelle** (`source`: Buch mit Klartext-Namen und Seite, `null` ohne
 * Angabe — Issue 0102), bei einem Profil zusaetzlich seinen Profiltyp und die
 * Merkmale als Paare *(Charakteristik-Typ mit Namen, effektiver Wert)*, bei einer
 * Regel ihren Regeltext.
 *
 * ── Wer die Klartext-Namen stellt ────────────────────────────────────────────
 * Die `<profileType>`-Deklarationen des Datensatzes, und nur sie. Das ist keine
 * Vorliebe, sondern die XSD: `profileType/@name` und `characteristicType/@name`
 * sind Pflichtattribute, die am Profil bzw. an der Charakteristik mitgefuehrten
 * Kopien (`profile/@typeName`, `characteristic/@name`) dagegen optional bzw.
 * redundant. In den Fixture-Katalogen weichen sie in keinem von 744 Profilen und
 * keiner von 5881 Charakteristiken von der Deklaration ab — genau deshalb ist die
 * Deklaration die eine Quelle und die Kopie kein zweiter Zustand.
 *
 * ── Was *nicht* enthalten ist ────────────────────────────────────────────────
 * Verstecktheit regelt, was ein Knoten einem **anderen** Slot beisteuert, nicht
 * was sein **eigener** Datensatz traegt. Also:
 *
 * 1. Der eigene Datensatz eines Slots traegt **immer** dessen eigene, effektiv
 *    sichtbare Traeger — auch wenn der Slot selbst versteckt ist. Der Bericht
 *    materialisiert versteckte Slots und kennzeichnet sie mit `isHidden`
 *    (ADR-0035); eine leere Projektion widerspraeche dieser Materialisierung, und
 *    `docs/battlescribe-data-format.md` §8 nimmt einer versteckten Entitaet nur
 *    die Anzeige und die Mindestpruefung, nicht ihre Profile. Belegt vom Szenario
 *    `set-characteristic-force-gate`: die versteckte Einheit „Tomb stalker" traegt
 *    ihr eigenes Profil mit den Basiswerten.
 * 2. Ein effektiv versteckter Knoten steuert **nach oben nichts** bei — weder
 *    seine eigenen Traeger noch irgendetwas aus seinem Teilbaum.
 * 3. Ein Element, das **selbst** versteckt ist, bleibt ueberall draussen.
 *
 * „Versteckt" ist dabei die **effektive** Sichtbarkeit: das Basis-`hidden` der
 * Katalogdaten, ueberschrieben von einem `hidden`-Modifikator am selben Traeger.
 * Beide Wege kommen real vor — ein Info-Verweis mit `hidden="true"` und einem
 * bedingten `set hidden=false` darauf ist in den Fixture-Katalogen belegt.
 */

import { InfoElementKind } from './model.js';
import { infoCarriersOf } from './evalTree.js';

/** Ein Traeger, dessen Art keinen eigenen Eintrag erzeugt, liefert keinen. */
const NO_ENTRY = null;

/**
 * Ein Nachschlagewerk der Profiltyp-Deklarationen: die Klartext-Namen der
 * Profiltypen und ihrer Charakteristik-Typen. Es wird **einmal je Bericht**
 * gebaut, nicht je Slot.
 *
 * @param {ReadonlyArray<{ id: string, name: string, characteristicTypes?: ReadonlyArray<{ id: string, name: string }> }>} profileTypes
 * @returns {{ profileTypeNameOf: (id: string) => string|null, characteristicTypeNameOf: (id: string) => string|null }}
 */
export function createProfileTypeRegistry(profileTypes) {
  const profileTypeNames = new Map();
  const characteristicTypeNames = new Map();
  for (const profileType of profileTypes) {
    profileTypeNames.set(profileType.id, profileType.name);
    for (const characteristicType of profileType.characteristicTypes ?? []) {
      characteristicTypeNames.set(characteristicType.id, characteristicType.name);
    }
  }
  return Object.freeze({
    profileTypeNameOf: id => profileTypeNames.get(id) ?? null,
    characteristicTypeNameOf: id => characteristicTypeNames.get(id) ?? null,
  });
}

/**
 * Ein Nachschlagewerk der Quellen-Deklarationen: der Klartext-Name des Buchs
 * hinter einer `publicationId`. Wie {@link createProfileTypeRegistry} **einmal je
 * Bericht** gebaut, nicht je Slot.
 *
 * @param {ReadonlyArray<{ id: string, name: string }>} publications
 * @returns {{ publicationNameOf: (id: string) => string|null }}
 */
export function createPublicationRegistry(publications) {
  const namesById = new Map(publications.map(publication => [publication.id, publication.name]));
  return Object.freeze({
    publicationNameOf: id => namesById.get(id) ?? null,
  });
}

/** Ein Datensatz ohne Quellen-Deklarationen — der Rueckfall fuer Aufrufer ohne. */
const EMPTY_PUBLICATION_REGISTRY = createPublicationRegistry([]);

/** Ein Regelname auf das heruntergebrochen, was ein Katalogautor frei variiert: Schreibung und Rand. */
const ruleNameKeyOf = name => (name || '').toLowerCase().trim();

/**
 * Ein Nachschlagewerk der **gleichnamigen Regeln** je Dokument: zu einem Namen
 * die Regel, die ein Dokument des Datensatzes unter genau diesem Namen deklariert.
 *
 * Es traegt den einen Rueckfall der Info-Projektion (Issue 0173). Der Korpus
 * fuehrt Regeln, die kein `infoLink` je erreicht: ein Armeebuch legt den Text
 * eines magischen Gegenstands als *gleichnamige* geteilte Regel ab und verlinkt
 * sie nicht (`Frostblade` im Buch der Vampirfuersten ist eine von vieren dort).
 * Die Struktur sagt an dieser Stelle nichts, also bleibt der Name der einzige
 * Anker — aber als **Gleichheit** von Namen innerhalb eines bekannten Katalogs,
 * nie als Aehnlichkeit: gesucht wird erst im Katalog, der die Definition des
 * Slots deklariert, dann im Spielsystem, und erst danach im Rest. Zwei
 * gleichnamige Regeln zweier Armeebuecher entscheiden damit nicht per
 * Katalogreihenfolge.
 *
 * Wie die beiden Registries darueber **einmal je Bericht** gebaut.
 *
 * @param {ReadonlyArray<{ id: string|null, infos?: ReadonlyArray<object> }>} documents
 *   die Dokumente des Datensatzes (Spielsystem und Kataloge).
 * @param {{ gameSystemId?: string|null, sourceIdByDefId?: Map<string, string>|null }} [scope]
 * @returns {{ namedRuleFor: (def: { id: string }, name: string|null) => object|null }}
 */
export function createNamedRuleRegistry(documents, { gameSystemId = null, sourceIdByDefId = null } = {}) {
  /** @type {Map<string, Map<string, object>>} */
  const rulesByDocument = new Map();
  for (const document of documents) {
    if (document.id === null || document.id === undefined) continue;
    const byName = new Map();
    for (const info of document.infos ?? []) {
      if (info.kind !== InfoElementKind.RULE) continue;
      const key = ruleNameKeyOf(info.name);
      // Der erste Treffer eines Dokuments gilt — dieselbe Dokumentreihenfolge,
      // die auch sonst entscheidet.
      if (key && !byName.has(key)) byName.set(key, info);
    }
    rulesByDocument.set(document.id, byName);
  }
  const documentOrder = [...rulesByDocument.keys()];

  return Object.freeze({
    namedRuleFor(def, name) {
      const key = ruleNameKeyOf(name);
      if (!key) return null;
      const ownCatalogueId = sourceIdByDefId?.get(def.id) ?? null;
      const seen = new Set();
      for (const documentId of [ownCatalogueId, gameSystemId, ...documentOrder]) {
        if (documentId === null || seen.has(documentId)) continue;
        seen.add(documentId);
        const hit = rulesByDocument.get(documentId)?.get(key) ?? null;
        if (hit !== null) return hit;
      }
      return null;
    },
  });
}

/** Ein Datensatz ohne Dokumente — der Rueckfall fuer Aufrufer ohne. */
const EMPTY_NAMED_RULE_REGISTRY = createNamedRuleRegistry([]);

/**
 * Die **Buchquelle** eines Eintrags: Buch und Seite, wie sie das Datenformat
 * fuehrt (`publicationId` + `page`, `docs/battlescribe-data-format.md` §5.2 und
 * §13.3). `null`, wenn weder Buch noch Seite angegeben sind — eine leere Angabe
 * waere von einer fehlenden nicht zu unterscheiden.
 *
 * Gelesen wird die Angabe des **Traegers**, und erst wo er keine hat, die seines
 * Inhalts: dieselbe Richtung wie bei Identitaet und Name — ein per `infoLink`
 * bezogenes Profil erscheint unter dem Verweis, und nennt der Verweis ein
 * eigenes Buch, ist das seine Quelle. Der Klartext-Name kommt aus den
 * `<publication>`-Deklarationen des Datensatzes und nur von dort; ist die Id dort
 * unbekannt, bleibt der Name ehrlich `null` statt erfunden.
 */
export function sourceOf(carrier, registry) {
  const content = contentOf(carrier);
  const publicationId = carrier.publicationId ?? content.publicationId ?? null;
  const page = carrier.page ?? content.page ?? null;
  if (publicationId === null && page === null) return null;
  return {
    publicationId,
    publicationName: publicationId === null ? null : registry.publicationNameOf(publicationId),
    page,
  };
}

/**
 * Die Definition, die den **Inhalt** eines Traegers stellt: bei einem `infoLink`
 * sein aufgeloestes Ziel, sonst der Traeger selbst. Die **Identitaet** (ID, Name)
 * bleibt davon unberuehrt beim Traeger — ein ueber einen Verweis bezogenes Element
 * erscheint an der Stelle des Verweises und unter dessen Namen.
 */
function contentOf(carrier) {
  return carrier.resolved ?? carrier;
}

/**
 * Die Art des Eintrags, den ein Traeger erzeugt: bei einem `infoLink` die seines
 * Ziels, sonst seine eigene. Ein baumelnder Verweis hat keine — der Resolver hat
 * ihn bereits als Diagnose gemeldet, hier faellt er still weg statt einen Eintrag
 * ohne Inhalt zu erfinden.
 */
function entryKindOf(carrier) {
  return carrier.kind === InfoElementKind.INFO_LINK
    ? carrier.resolved?.kind ?? null
    : carrier.kind;
}

/**
 * Baut den Eintrag eines **Profils**: seine Merkmale mit ihrem effektiven Wert,
 * jeweils benannt ueber den Charakteristik-Typ, dazu der Profiltyp. Die Merkmale
 * stehen in Dokumentreihenfolge — sie ist die Spaltenordnung der Merkmalstabelle.
 */
function buildProfileEntry({ node, carrier, effective, registry, publicationRegistry }) {
  const profile = contentOf(carrier);
  return {
    kind: InfoElementKind.PROFILE,
    id: carrier.id,
    name: effective.nameOf(node, carrier),
    source: sourceOf(carrier, publicationRegistry),
    profileTypeId: profile.typeId ?? null,
    profileTypeName: registry.profileTypeNameOf(profile.typeId),
    characteristics: effective.characteristicEntriesOf(node, carrier).map(({ typeId, value }) => ({
      typeId,
      name: registry.characteristicTypeNameOf(typeId),
      value: value ?? null,
    })),
  };
}

/**
 * Baut den Eintrag einer **Regel**: ihr Regeltext, unveraendert aus dem Katalog.
 * Er ist kein Modifikator-Ziel (kein Modifikator der Katalogdaten adressiert
 * `description`) und deshalb der Basiswert, nicht ein effektiver.
 */
function buildRuleEntry({ node, carrier, effective, publicationRegistry }) {
  return {
    kind: InfoElementKind.RULE,
    id: carrier.id,
    name: effective.nameOf(node, carrier),
    source: sourceOf(carrier, publicationRegistry),
    text: contentOf(carrier).text ?? null,
  };
}

/**
 * Eine **Info-Gruppe** buendelt nur; sie traegt selbst weder Merkmale noch Text.
 * Ihre Mitglieder liefert die Traeger-Sicht bereits einzeln
 * (`evalTree.js`, `infoCarriersOf`), auch die einer per `infoLink` bezogenen
 * Gruppe.
 */
function buildNoEntry() {
  return NO_ENTRY;
}

/**
 * Registry Traeger-Art → Eintragsbauer. Eine weitere Art ist ein weiterer
 * Eintrag, keine weitere Fallunterscheidung (OCP).
 */
const INFO_ENTRY_BUILDERS = Object.freeze({
  [InfoElementKind.PROFILE]: buildProfileEntry,
  [InfoElementKind.RULE]: buildRuleEntry,
  [InfoElementKind.INFO_GROUP]: buildNoEntry,
});

/**
 * Traegt die **eigenen** sichtbaren Info-Elemente eines Knotens in die
 * Ergebnisliste ein — die seines eigenen Datensatzes, ohne die seiner
 * Unter-Auswahlen. Ob der Knoten selbst versteckt ist, spielt hier keine Rolle;
 * gefiltert wird allein je Traeger.
 */
function collectOwnInfoElements(node, context, entries) {
  const { effective } = context;
  for (const carrier of infoCarriersOf(node.def)) {
    if (effective.isHidden(node, carrier)) continue;
    const entryKind = entryKindOf(carrier);
    if (!Object.hasOwn(INFO_ENTRY_BUILDERS, entryKind)) continue;
    const entry = INFO_ENTRY_BUILDERS[entryKind]({ ...context, node, carrier });
    if (entry !== NO_ENTRY) entries.push(entry);
  }
}

/**
 * Traegt die Info-Elemente ein, die ein Knoten aus seinen **belegten**
 * Unter-Auswahlen erbt — rekursiv und in Baumreihenfolge.
 *
 * Ein effektiv versteckter Kindknoten steuert nichts bei: weder seine eigenen
 * Traeger noch irgendetwas aus seinem Teilbaum, denn was an ihm haengt, haengt an
 * einem versteckten Knoten. Ein Anker (Pflicht-Phantom, Gruppen-, Kategorie- oder
 * Angebots-Anker) ist keine belegte Unter-Auswahl und vererbt deshalb nichts nach
 * oben; seine eigenen Elemente traegt sein eigener Datensatz.
 */
function collectInheritedInfoElements(node, context, entries) {
  const { effective } = context;
  for (const child of node.children) {
    if (child.isPhantom) continue;
    if (effective.isHidden(child)) continue;
    collectOwnInfoElements(child, context, entries);
    collectInheritedInfoElements(child, context, entries);
  }
}

/**
 * Die fuer einen Slot geltenden **Profile und Regeltexte**, in Dokumentreihenfolge:
 * erst die eigenen Info-Elemente des Slots, danach die seiner belegten
 * Unter-Auswahlen in Baumreihenfolge.
 *
 * Bewusst **ohne Entdopplung**: derselbe Traeger unter zwei Unter-Auswahlen ist
 * zweimal vorhanden und kann *verschiedene* effektive Werte tragen — die
 * Effektiv-Werte-Schicht schluesselt nach dem Paar (Knoten, Traeger). Eine
 * Entdopplung nach ID wuerfe genau diese Unterscheidung still weg.
 *
 * @param {object} node  der Slot-Knoten (jeder Ankerart).
 * @param {import('./effectiveState.js').EffectiveState} effective  der effektive Zustand.
 * @param {{ profileTypeNameOf: Function, characteristicTypeNameOf: Function }} registry
 *   das Nachschlagewerk aus {@link createProfileTypeRegistry}.
 * @param {{ publicationNameOf: Function }} [publicationRegistry]
 *   das Nachschlagewerk aus {@link createPublicationRegistry}. Fehlt es, bleibt
 *   jeder Klartext-Name einer Buchquelle `null`; Id und Seite stehen trotzdem.
 * @param {{ namedRuleFor: Function }} [namedRuleRegistry]
 *   das Nachschlagewerk aus {@link createNamedRuleRegistry} fuer den Rueckfall
 *   auf die gleichnamige Regel. Fehlt es, entfaellt der Rueckfall.
 * @returns {Array<object>} die geordnete Liste der Eintraege.
 */
export function infoElementsOf(
  node,
  effective,
  registry,
  publicationRegistry = EMPTY_PUBLICATION_REGISTRY,
  namedRuleRegistry = EMPTY_NAMED_RULE_REGISTRY,
) {
  const entries = [];
  const context = { effective, registry, publicationRegistry };
  collectOwnInfoElements(node, context, entries);
  collectInheritedInfoElements(node, context, entries);
  appendNamedRuleFallback(node, effective, namedRuleRegistry, entries);
  return entries;
}

/**
 * Der eine **Rueckfall** der Projektion: gilt fuer einen Slot ueberhaupt kein
 * Regeltext, dann gilt die *gleichnamige* Regel seines eigenen Katalogs
 * ({@link createNamedRuleRegistry}). Sie steht hier, weil die Oberflaeche
 * andernfalls ein zweites Mal in den Katalog greifen muesste (ADR-0034) — und
 * dort auch nur eine von zwei Stellen sie faende (Issue 0173).
 *
 * Der Eintrag traegt **keine** Buchquelle: die Regel haengt an keinem Traeger
 * dieses Slots, also nennt sie auch keine Quelle fuer ihn.
 */
function appendNamedRuleFallback(node, effective, namedRuleRegistry, entries) {
  if (entries.some(entry => entry.kind === InfoElementKind.RULE)) return;
  const rule = namedRuleRegistry.namedRuleFor(node.def, effective.nameOf(node));
  if (rule === null || !rule.text) return;
  entries.push({
    kind: InfoElementKind.RULE,
    id: rule.id,
    name: rule.name,
    source: null,
    text: rule.text,
  });
}

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
 * bei einem Profil zusaetzlich seinen Profiltyp und die Merkmale als Paare
 * *(Charakteristik-Typ mit Namen, effektiver Wert)*, bei einer Regel ihren
 * Regeltext.
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
 * Ein Element, das **selbst** versteckt ist, und alles, was an einem
 * **versteckten Knoten** haengt. „Versteckt" ist dabei die **effektive**
 * Sichtbarkeit: das Basis-`hidden` der Katalogdaten, ueberschrieben von einem
 * `hidden`-Modifikator am selben Traeger. Beide Wege kommen real vor — ein
 * Info-Verweis mit `hidden="true"` und einem bedingten `set hidden=false` darauf
 * ist in den Fixture-Katalogen belegt.
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
function buildProfileEntry({ node, carrier, effective, registry }) {
  const profile = contentOf(carrier);
  return {
    kind: InfoElementKind.PROFILE,
    id: carrier.id,
    name: effective.nameOf(node, carrier),
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
function buildRuleEntry({ node, carrier, effective }) {
  return {
    kind: InfoElementKind.RULE,
    id: carrier.id,
    name: effective.nameOf(node, carrier),
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
 * Traegt die sichtbaren Info-Elemente eines Knotens und — rekursiv — die seiner
 * **belegten** Unter-Auswahlen in die Ergebnisliste ein.
 *
 * Ein effektiv versteckter Knoten steuert nichts bei: was an ihm haengt, haengt an
 * einem versteckten Knoten. Ein Anker (Pflicht-Phantom, Gruppen-, Kategorie- oder
 * Angebots-Anker) ist keine belegte Unter-Auswahl und vererbt deshalb nichts nach
 * oben; seine eigenen Elemente traegt sein eigener Datensatz.
 */
function collectInfoElements(node, context, entries) {
  const { effective } = context;
  if (effective.isHidden(node)) return;

  for (const carrier of infoCarriersOf(node.def)) {
    if (effective.isHidden(node, carrier)) continue;
    const entryKind = entryKindOf(carrier);
    if (!Object.hasOwn(INFO_ENTRY_BUILDERS, entryKind)) continue;
    const entry = INFO_ENTRY_BUILDERS[entryKind]({ ...context, node, carrier });
    if (entry !== NO_ENTRY) entries.push(entry);
  }

  for (const child of node.children) {
    if (child.isPhantom) continue;
    collectInfoElements(child, context, entries);
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
 * @returns {Array<object>} die geordnete Liste der Eintraege.
 */
export function infoElementsOf(node, effective, registry) {
  const entries = [];
  collectInfoElements(node, { effective, registry }, entries);
  return entries;
}

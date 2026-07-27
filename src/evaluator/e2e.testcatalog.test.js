/**
 * Generalisierter, **manifest-getriebener** E2E-Runner der Reinraum-Engine.
 *
 * Ein einziger, versionierter Testeinstieg entdeckt zur Laufzeit **alle** Szenarien
 * unter `docs/testing/`, die ein Manifest (`scenario.json`) tragen, wertet jedes
 * darin deklarierte Roster gegen die oeffentliche Fassade `evaluate` aus und prueft
 * den Bericht gegen die je Roster deklarierte Erwartung — sowohl den
 * Verletzungsbericht (`violations`) als auch die Diagnosen (`diagnostics`). Die
 * einzelnen Testfaelle entstehen **dynamisch zur Laufzeit** aus den Manifesten —
 * versioniert sind nur dieser Runner und die Szenario-Daten, nicht die generierten
 * Faelle.
 *
 * ── Manifest-Vertrag (`docs/testing/<szenario>/scenario.json`) ──────────────────
 * Die Quelle der Wahrheit je Szenario, ausfuellbar aus den Katalogdaten allein
 * (ohne Blick in den Evaluator-Quellcode):
 *
 *   {
 *     "schemaVersion": 1,
 *     "name": "<szenario-name>",
 *     "description": "<fachliche Kurzbeschreibung>",
 *     "dataset": {
 *       "gameSystem": "<pfad zur .gst>",        // optional; Pfad relativ zum Repo-Wurzelverzeichnis
 *       "catalogues": ["<pfad zur .cat>", ...]   // geordnet; Pfade relativ zum Repo-Wurzelverzeichnis
 *     },
 *     "rosters": [
 *       {
 *         "file": "rosters/<name>.ros",           // Pfad relativ zum Szenario-Verzeichnis
 *         "description": "<fachliche Kurzbeschreibung>",
 *         "dataset": { ... },                     // OPTIONAL: ueberschreibt das Szenario-`dataset`
 *                                                 //           NUR fuer dieses Roster (gleiche Form).
 *                                                 //           Damit prueft ein Roster denselben
 *                                                 //           Aufbau gegen einen abweichenden Satz —
 *                                                 //           z. B. ohne die Mercenaries-Abhaengigkeit.
 *         "expect": {
 *           "firing": [                           // Grenzen, die feuern MUESSEN
 *             { "limitId": "<constraint-id>", "actual": <ist>, "bound": <grenze>, "count": <n>? }
 *             //          `count` ist OPTIONAL: ist es gesetzt, muss die Grenze GENAU
 *             //          `count`-mal feuern (ein Anker je Kontingent, §7.7), und jede
 *             //          dieser Verletzungen traegt `actual`/`bound`. Ohne `count` wird
 *             //          nur geprueft, dass die Grenze (mind. einmal) mit `actual`/`bound`
 *             //          feuert.
 *           ],
 *           "absent": ["<constraint-id>", ...],   // Grenzen, die NICHT feuern duerfen
 *           "messages": [                          // OPTIONAL: Aussagen ueber die EINGEORDNETE
 *             {                                    //           Meldung (dieselbe `violations`-Liste)
 *               // ── Auswahl der gemeinten Meldung (Vorgabe: muss genau eine treffen) ──
 *               "origin": "derivedLimit|authorMessage",  // PFLICHT: der Diskriminator der Herkunft.
 *                                                  // `derivedLimit` = von der Engine aus einer Grenze
 *                                                  // abgeleitet; `authorMessage` = Meldung des
 *                                                  // Katalog-Autors (field="error"/"warning"/"info")
 *               "limitId": "<constraint-id>"?,     // nur bei derivedLimit
 *               "anchorDefId": "<Definitions-ID>"?, // Anker, an dem die Meldung haengt
 *               "anchorPath": "<Slot-Pfad>"?,      // nur noetig, wenn es sonst mehrdeutig bleibt
 *               "text": "<Meldungstext>"?,         // bei einer Autor-Meldung zugleich Auswahl UND
 *                                                  // Aussage: der Katalogtext, Text-Tokens wie
 *                                                  // `{this}` durch den effektiven Namen ersetzt
 *               "count": <n>?,                     // OPTIONAL: GENAU n Treffer. `0` fordert, dass
 *                                                  // keine solche Meldung erscheint.
 *               // ── Aussagen ueber die getroffene(n) Meldung(en) ──
 *               "severity": "error|warning|info"?, // abgeleitet: immer error; Autor-Meldung: aus dem Katalog
 *               "anchorName": "<effektiver Name>"?,
 *               "anchorKind": "occupied|mandatoryPhantom|groupAnchor|categoryAnchor|offerAnchor|roster"?,
 *                                                  // `roster` traegt allein die engine-eigene
 *                                                  // Budget-Regel; sie haengt an keinem Slot
 *               "isValueUnstable": true|false?,
 *               "limitKind": "min|max"?,           // nur bei derivedLimit: Mindest- oder Hoechstmass
 *               "measure": "selectionCount|forceCount|costSum|budgetLimit|rosterBudget"?,
 *                                                  // WAS die Grenze misst
 *               "costTypeId": "<costType-Id>"|null?,  // bei einer kostenbezogenen Messgroesse
 *               "isPercent": true|false?,          // Prozentgrenze: `bound` ist der abgeleitete Wert
 *               "scopeKind": "roster|force|parent|self|entryId|categoryId"?,  // Art des Bezugsrahmens
 *               "scopeTargetId": "<id>"|null?,     // die Ziel-Id eines ID-Bezugsrahmens
 *               "actual": <ist>?, "bound": <grenze>?, "delta": <differenz>?,
 *               "causes": [                        // die ausloesenden Auswahlen (ADR-0027):
 *                 { "witnessDefId": "<id>", "witnessName": "<Katalogname>",
 *                   "modifierKind": "set|increment|decrement|multiply|...", "value": <zwischenwert> }
 *               ]?                                 // VOLLSTAENDIG: [] fordert „keine Ursache"
 *             }
 *           ],
 *           "capabilities": [                     // OPTIONAL: Aussagen ueber einen Slot
 *             {
 *               // ── Auswahl des gemeinten Slots (muss genau einen treffen) ──
 *               "defId": "<Definitions-ID des Slots>",   // die eigene Definition des Slots;
 *                                                        // bei einem Verweis-Slot der VERWEIS
 *               "targetDefId": "<Ziel-Definitions-ID>"?, // worauf der Verweis zeigt: die
 *                                                        // Kategorie eines Kategorie-Ankers,
 *                                                        // der Eintrag hinter einem entryLink.
 *                                                        // Eines von beiden ist Pflicht.
 *               "anchorKind": "occupied|mandatoryPhantom|groupAnchor|categoryAnchor|offerAnchor"?,
 *                                                        // Herkunft des Slots: belegt, Pflicht-Anker,
 *                                                        // Gruppen-/Kategorie-Anker oder das Angebot
 *                                                        // (eine waehlbare, nicht gewaehlte Definition)
 *               "frameDefId": "<Definitions-ID des Rahmens>"?,  // Kontingent bzw. Eltern-Auswahl,
 *                                                        // unter der der Slot haengt
 *               "path": "<Slot-Pfad>"?,                  // nur noetig, wenn dieselbe Definition
 *                                                        // mehrfach im Roster steht
 *               // ── Aussagen ueber den getroffenen Slot ──
 *               "name": "<effektiver Anzeigename>"?,     // nach allen Namens-Modifikatoren
 *               "current": <ist>?,                       // aktueller Stand im Bezugsrahmen
 *               "effectiveMin": <grenze>|null?,          // effektives Mindestmass (null = keines)
 *               "effectiveMax": <grenze>|null?,          // effektives Hoechstmass (null = keines)
 *               "headroom": <rest>|null?,                // verbleibender Spielraum (null ohne Hoechstmass)
 *               "isHidden": true|false?,                 // vom Katalog ausgeblendet
 *               "isBlocked": true|false?,                // Hoechstmass ausgeschoepft
 *               "isMandatoryUnmet": true|false?,         // Mindestmass unerfuellt
 *               "unevaluatedLimitKinds": ["min"|"max"]?, // Grenzenarten OHNE Antwort an
 *                                                        // diesem Slot (leer, wenn alle
 *                                                        // Grenzen ausgewertet wurden). Ein
 *                                                        // nicht auswertbares Hoechstmass
 *                                                        // weist fail-closed `headroom` 0 und
 *                                                        // `isBlocked` true aus — nie das
 *                                                        // `null`, das „unbegrenzt" hiesse.
 *               "authorMessages": [                      // die Autor-Meldungen des Slots,
 *                 { "severity": "error|warning|info", "text": "<Katalogtext>" }
 *               ]?,                                      // VOLLSTAENDIG: [] fordert „keine"
 *               "infoElements": [                        // TEILMENGE: nur die genannten Profile/Regeln
 *                 {
 *                   "id": "<profile-, rule- oder infoLink-Id>",  // PFLICHT: das Vorkommen; bei einem
 *                                                        // Info-Verweis die Id des VERWEISES, denn
 *                                                        // dort erscheint das bezogene Element.
 *                                                        // Muss genau einen Eintrag treffen.
 *                   "kind": "profile|rule"?,             // Art des Eintrags
 *                   "name": "<effektiver Anzeigename>"?, // nach allen Namens-Modifikatoren
 *                   "profileTypeId": "<profileType-Id>"?,        // nur bei einem Profil
 *                   "profileTypeName": "<Klartext-Name>"?,       // nur bei einem Profil
 *                   "text": "<Regeltext>"?,              // nur bei einer Regel (<description>)
 *                   "characteristics": [                 // TEILMENGE der Merkmale dieses Profils
 *                     { "typeId": "<characteristicType-Id>", "name": "<Klartext-Name>"?, "value": "<effektiver Wert>" }
 *                   ]?
 *                 }
 *               ]?,
 *               "infoElementsAbsent": ["<id>", ...]?     // Vorkommen, die NICHT in der
 *                                                        // Info-Projektion dieses Slots stehen
 *                                                        // duerfen — die Gegenaussage zu
 *                                                        // `infoElements`. Ohne sie waere
 *                                                        // „Verstecktes bleibt draussen" nicht
 *                                                        // pruefbar, weil eine reine
 *                                                        // Teilmengen-Aussage das Fehlen eines
 *                                                        // Eintrags nie bemerkt.
 *             }
 *           ],
 *           "diagnostics": {                      // OPTIONAL: Aussagen ueber `report.diagnostics`
 *             "present": [                         // Diagnosen, die auftreten MUESSEN
 *               { "kind": "<DiagnosticKind-Schluessel>", "targetId": "<id>"?, "defId": "<id>"?, "minCount": <n>? }
 *               //         `kind` ist ein Schluessel der SSOT-Aufzaehlung `DiagnosticKind`
 *               //         (z. B. "MISSING_CATALOGUE_DEPENDENCY"). `targetId`/`defId` engen
 *               //         den Treffer optional auf ein konkretes Ziel ein; `minCount`
 *               //         (Default 1) fordert mindestens so viele passende Diagnosen.
 *             ],
 *             "absent": [                          // Diagnose-Arten, die NICHT auftreten duerfen
 *               { "kind": "<DiagnosticKind-Schluessel>", "targetId": "<id>"? }
 *             ]
 *           }
 *         }
 *       }
 *     ]
 *   }
 *
 * Die Erwartung ist **selektiv**, nicht erschoepfend: ueber die in `firing`/`absent`,
 * `messages`, `capabilities` bzw. `diagnostics.present`/`diagnostics.absent` genannten
 * Ids/Arten hinaus macht sie keine Aussage. Andere Armeeaufbau-Diagnosen (General-/Core-Pflicht,
 * Punktelimit, weitere Diagnose-Arten) duerfen zusaetzlich auftreten, ohne einen Fall
 * zu brechen. Innerhalb *eines* genannten Slots gilt das feiner: `name` ist eine
 * Gleichheit, `authorMessages` eine vollstaendige (aber reihenfolge-freie) Aussage
 * ueber die Meldungen dieses Slots, `infoElements` eine Teilmengen-Aussage — und
 * innerhalb eines genannten Info-Elements sind auch dessen `characteristics` eine
 * Teilmenge.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { evaluate, prepareDataset } from './evaluator.js';
import { DiagnosticKind } from './model.js';
import { violationsOf, violationOf, diagnosticsMatching } from './__fixtures__/e2eReport.js';
import { rosterFromRos } from './__fixtures__/rosParser.js';

// Relativ zum Projekt-Wurzelverzeichnis (dem cwd des Testlaufs) aufgeloest — wie
// die uebrigen fixture-lesenden Tests des Projekts.
const TESTING_ROOT = 'docs/testing';
const MANIFEST_FILE = 'scenario.json';

/**
 * Wirft mit klarer, auf das Manifest verweisender Meldung, wenn eine Bedingung
 * verletzt ist — damit ein Black-Box-Autor eines fehlerhaften Manifests sofort
 * sieht, was fehlt, statt einen kryptischen Laufzeitfehler zu bekommen.
 */
function assertManifest(condition, manifestPath, message) {
  if (!condition) {
    throw new Error(`Ungueltiges Szenario-Manifest ${manifestPath}: ${message}`);
  }
}

/** Liest und validiert das Manifest eines Szenario-Verzeichnisses. */
function loadManifest(scenarioDir) {
  const manifestPath = join(scenarioDir, MANIFEST_FILE);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  assertManifest(typeof manifest.name === 'string', manifestPath, 'Feld "name" fehlt.');
  assertManifest(manifest.dataset != null, manifestPath, 'Feld "dataset" fehlt.');
  assertManifest(Array.isArray(manifest.dataset.catalogues), manifestPath, '"dataset.catalogues" muss ein Array sein.');
  assertManifest(Array.isArray(manifest.rosters), manifestPath, '"rosters" muss ein Array sein.');
  manifest.rosters.forEach((rosterCase, index) => {
    assertManifest(typeof rosterCase.file === 'string', manifestPath, `rosters[${index}]: Feld "file" fehlt.`);
    assertManifest(rosterCase.expect != null, manifestPath, `rosters[${index}] (${rosterCase.file}): Feld "expect" fehlt.`);
  });

  return { ...manifest, scenarioDir, manifestPath };
}

/** Entdeckt alle Szenarien unter `docs/testing/`, die ein Manifest tragen. */
function discoverScenarios() {
  if (!existsSync(TESTING_ROOT)) return [];
  return readdirSync(TESTING_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(TESTING_ROOT, entry.name))
    .filter(dir => existsSync(join(dir, MANIFEST_FILE)))
    .map(loadManifest);
}

// Ein Datensatz wird je eindeutiger Spezifikation genau einmal von der Platte
// gelesen UND genau einmal aufbereitet — die grossen Katalog-XML teilen sich alle
// Roster desselben Satzes.
const preparedDatasetCache = new Map();

/**
 * Liest die deklarierten Katalog-Inputs und bereitet sie zu dem aufbereiteten
 * Datensatz auf, den `evaluate` erwartet — memoisiert je Spezifikation
 * (`{ gameSystem?, catalogues }`).
 *
 * Memoisiert wird bewusst die **Aufbereitung**, nicht nur der gelesene XML-Text:
 * der rosterunabhaengige Katalog-Vorlauf macht an echten Katalogdaten 98,9–99,5 %
 * einer Auswertung aus (Main-Issue 75, Baustein 8). Ihn je Fall zu wiederholen
 * hiess, denselben Datensatz fuer jedes der Roster erneut zu parsen und
 * aufzuloesen — dieselbe Rechnung, immer wieder. Genau das ist der Grund, aus dem
 * die Fassade zweistufig ist, und dieser Runner ist ihr erster Verbraucher.
 */
function preparedDatasetOf(datasetSpec) {
  const cacheKey = JSON.stringify(datasetSpec);
  const cached = preparedDatasetCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const { gameSystem, catalogues } = datasetSpec;
  const dataset = { catalogues: catalogues.map(path => readFileSync(resolve(path), 'utf8')) };
  if (gameSystem !== undefined) {
    dataset.gameSystem = readFileSync(resolve(gameSystem), 'utf8');
  }
  const prepared = prepareDataset(dataset);
  preparedDatasetCache.set(cacheKey, prepared);
  return prepared;
}

/**
 * Der fuer ein Roster gueltige, aufbereitete Datensatz: dessen eigener
 * `dataset`-Override, falls vorhanden, sonst der Szenario-Standard. Ein Override
 * ersetzt den Standard vollstaendig (kein Teil-Merge) — die Roster-Spezifikation
 * ist damit ihre eigene, lueckenlose Quelle der Wahrheit.
 */
function preparedDatasetForRoster(manifest, rosterCase) {
  return preparedDatasetOf(rosterCase.dataset ?? manifest.dataset);
}

/** Prueft den Verletzungsbericht gegen die `firing`/`absent`-Erwartung eines Rosters. */
function assertViolationsMatchExpectation(report, expectation) {
  const { firing = [], absent = [] } = expectation;
  for (const { limitId, actual, bound, count } of firing) {
    if (count !== undefined) {
      const violations = violationsOf(report, limitId);
      expect(violations, `Grenze ${limitId} muss genau ${count}x feuern`).toHaveLength(count);
      for (const violation of violations) {
        expect(violation, `jede Verletzung von ${limitId} traegt Ist/Grenze`).toMatchObject({ actual, bound });
      }
    } else {
      expect(violationOf(report, limitId), `Grenze ${limitId} muss feuern`).toMatchObject({ actual, bound });
    }
  }
  for (const limitId of absent) {
    expect(violationsOf(report, limitId), `Grenze ${limitId} darf nicht feuern`).toHaveLength(0);
  }
}

/**
 * Die **Merkmale, ueber die eine Meldungs-Erwartung ihre Meldung auswaehlt**.
 * `origin` ist Pflicht: es ist der Diskriminator, der bestimmt, welche Felder eine
 * Meldung ueberhaupt traegt. Die uebrigen engen nur ein.
 *
 * `text` steht bewusst hier und nicht unter den Aussagen: bei einer Autor-Meldung
 * ist der Wortlaut das benennende Merkmal. Ein abweichender Text findet dann keine
 * Meldung — und die Fehlermeldung nennt genau den erwarteten Wortlaut, statt einen
 * Zeichenvergleich an unbekannter Stelle zu zeigen.
 */
const MESSAGE_SELECTORS = Object.freeze({
  origin: (spec, message) => message.origin === spec.origin,
  limitId: (spec, message) => message.limitId === spec.limitId,
  anchorDefId: (spec, message) => message.anchor.defId === spec.anchorDefId,
  anchorPath: (spec, message) => message.anchor.path === spec.anchorPath,
  text: (spec, message) => message.text === spec.text,
});

/**
 * Die **Felder einer eingeordneten Meldung**, die eine Erwartung direkt vergleichen
 * kann — je mit dem Zugriff auf ihre Stelle in der Meldung. Die Einordnung ist
 * geschachtelt (Anker, Grenze, Bezugsrahmen), das Manifest bleibt flach: ein
 * Szenario-Autor soll ein Merkmal benennen, nicht eine Objektform nachbauen.
 *
 * Die Grenzen-Felder liefern an einer Autor-Meldung `undefined`, weil sie dort
 * nicht besetzt sind — ein Manifest, das sie dennoch behauptet, faellt auf.
 */
const COMPARABLE_MESSAGE_FIELDS = Object.freeze({
  severity: message => message.severity,
  anchorName: message => message.anchor.name,
  anchorKind: message => message.anchor.anchorKind,
  isValueUnstable: message => message.anchor.isValueUnstable,
  limitKind: message => message.limit?.kind,
  measure: message => message.limit?.measure,
  costTypeId: message => message.limit?.costTypeId,
  isPercent: message => message.limit?.isPercent,
  scopeKind: message => message.limit?.scope.kind,
  scopeTargetId: message => message.limit?.scope.targetId,
  actual: message => message.actual,
  bound: message => message.bound,
  delta: message => message.delta,
  text: message => message.text,
});

/** Die im Manifest gesetzten Auswahlmerkmale einer Meldung, menschenlesbar. */
function messageSelectorLabel(spec) {
  return Object.keys(MESSAGE_SELECTORS)
    .filter(key => spec[key] !== undefined)
    .map(key => `${key}="${spec[key]}"`)
    .join(', ');
}

/**
 * Die Meldungen, die eine Erwartung meint. Ohne `count` muss es **genau eine**
 * sein — sonst meint das Szenario nicht eindeutig eine, und das ist ein
 * Manifest-Fehler mit klarer Meldung statt einer stillschweigend gewaehlten. Mit
 * `count` ist die Trefferzahl selbst die Aussage; `count: 0` fordert Abwesenheit.
 */
function messagesForExpectation(report, spec, manifestPath) {
  const matches = report.violations.filter(message =>
    Object.entries(MESSAGE_SELECTORS)
      .every(([key, matchesSelector]) => spec[key] === undefined || matchesSelector(spec, message)));

  if (spec.count !== undefined) {
    expect(matches, `messages: ${messageSelectorLabel(spec)} muss genau ${spec.count}x erscheinen`)
      .toHaveLength(spec.count);
    return matches;
  }
  assertManifest(matches.length > 0, manifestPath,
    `messages: keine Meldung mit ${messageSelectorLabel(spec)}.`);
  assertManifest(matches.length === 1, manifestPath,
    `messages: ${messageSelectorLabel(spec)} ist mehrdeutig (${matches.length} Treffer); ` +
    '"anchorDefId", "anchorPath" oder "count" ergaenzen.');
  return matches;
}

/**
 * Prueft die **Ursachen** einer Meldung (ADR-0027). Vollstaendig und
 * reihenfolge-frei: `[]` fordert, dass die Meldung keine benennbare Ursache traegt
 * — und weil das Feld dann ganz fehlt, wird es als leere Liste gelesen.
 */
function assertCausesMatchExpectation(message, expectedCauses, spec) {
  const actualCauses = (message.causes ?? []).map(cause => ({
    witnessDefId: cause.witness.defId,
    witnessName: cause.witness.name,
    modifierKind: cause.modifierKind,
    value: cause.value,
  }));
  expect(actualCauses, `Meldung ${messageSelectorLabel(spec)}: Zahl der Ursachen`)
    .toHaveLength(expectedCauses.length);
  for (const expectedCause of expectedCauses) {
    expect(actualCauses, `Meldung ${messageSelectorLabel(spec)}: Ursache`)
      .toContainEqual(expect.objectContaining(expectedCause));
  }
}

/** Prueft die `messages`-Aussagen eines Rosters gegen die eingeordnete Meldungsliste. */
function assertMessagesMatchExpectation(report, expectation, manifestPath) {
  for (const spec of expectation.messages ?? []) {
    // Ohne Herkunft ist nicht bestimmt, welche Felder die gemeinte Meldung traegt.
    assertManifest(typeof spec.origin === 'string', manifestPath,
      'messages: Feld "origin" fehlt (der Diskriminator der Herkunft).');
    const messages = messagesForExpectation(report, spec, manifestPath);

    for (const message of messages) {
      for (const [field, valueOf] of Object.entries(COMPARABLE_MESSAGE_FIELDS)) {
        if (spec[field] === undefined) continue;
        expect(valueOf(message), `Meldung ${messageSelectorLabel(spec)}: ${field}`).toEqual(spec[field]);
      }
      if (spec.causes !== undefined) assertCausesMatchExpectation(message, spec.causes, spec);
    }
  }
}

/**
 * Die **Merkmale, ueber die eine Slot-Erwartung ihren Slot auswaehlt** — je als
 * Praedikat auf dem Paar (Pfad, Faehigkeitsdatensatz). Eine Tabelle statt einer
 * Kette von Bedingungen: ein weiteres Auswahlmerkmal ist ein weiterer Eintrag.
 *
 * Seit das Angebot im Bericht steht (ADR-0035), traegt derselbe Eintrag oft
 * mehrere Slots — belegt im einen Kontingent, angeboten im anderen. `anchorKind`
 * und `frameDefId` benennen den gemeinten fachlich, statt ihn ueber einen
 * positionellen Pfad festzunageln.
 */
const CAPABILITY_SELECTORS = Object.freeze({
  defId: (spec, capability) => capability.defId === spec.defId,
  targetDefId: (spec, capability) => capability.targetDefId === spec.targetDefId,
  path: (spec, capability, path) => path === spec.path,
  anchorKind: (spec, capability) => capability.anchorKind === spec.anchorKind,
  frameDefId: (spec, capability) => capability.frame?.defId === spec.frameDefId,
});

/** Die im Manifest gesetzten Auswahlmerkmale, menschenlesbar fuer Fehlermeldungen. */
function selectorLabel(spec) {
  return Object.keys(CAPABILITY_SELECTORS)
    .filter(key => spec[key] !== undefined)
    .map(key => `${key}="${spec[key]}"`)
    .join(', ');
}

/**
 * Der eine Faehigkeitsdatensatz, den eine Slot-Erwartung meint. Die Definitions-ID
 * benennt ihn fachlich; trifft sie mehrere Slots, engen `anchorKind`, `frameDefId`
 * oder der `path` ein. Bleibt es mehrdeutig oder findet sich nichts, ist das ein
 * Manifest-Fehler mit klarer Meldung — nicht ein stillschweigend gewaehlter Slot.
 */
function capabilityForExpectation(report, spec, manifestPath) {
  const matches = [...report.capabilities].filter(([path, capability]) =>
    Object.entries(CAPABILITY_SELECTORS)
      .every(([key, matchesSelector]) => spec[key] === undefined || matchesSelector(spec, capability, path)));

  assertManifest(matches.length > 0, manifestPath,
    `capabilities: kein Slot mit ${selectorLabel(spec)}.`);
  assertManifest(matches.length === 1, manifestPath,
    `capabilities: ${selectorLabel(spec)} ist mehrdeutig (Pfade: ${matches.map(([path]) => path).join(', ')}); ` +
    '"anchorKind", "frameDefId" oder "path" ergaenzen.');

  return matches[0][1];
}

/**
 * Die **Zustandsfelder eines Slots**, die eine Erwartung direkt vergleichen kann:
 * Zahlen und Flags des Faehigkeitsdatensatzes. Genannt wird nur, was das Szenario
 * festnagelt; ungenannte Felder bleiben ohne Aussage.
 */
const COMPARABLE_CAPABILITY_FIELDS = Object.freeze([
  'name',
  'current',
  'effectiveMin',
  'effectiveMax',
  'headroom',
  'isHidden',
  'isBlocked',
  'isMandatoryUnmet',
  'unevaluatedLimitKinds',
]);

/**
 * Die **Skalarfelder eines Info-Element-Eintrags**, die eine Erwartung direkt
 * vergleichen kann. Die Merkmale eines Profils sind kein Skalar und werden
 * gesondert (als Teilmenge) geprueft.
 */
const COMPARABLE_INFO_ELEMENT_FIELDS = Object.freeze([
  'kind',
  'name',
  'profileTypeId',
  'profileTypeName',
  'text',
]);

/**
 * Der eine Eintrag der Info-Projektion, den eine Erwartung meint — benannt ueber
 * die Id seines **Vorkommens** (bei einem Info-Verweis die des Verweises). Trifft
 * die Id mehrere Eintraege, meint das Szenario nicht eindeutig einen: derselbe
 * Traeger kann ueber zwei belegte Unter-Auswahlen zweimal beitragen, mit
 * moeglicherweise verschiedenen effektiven Werten. Das ist ein Manifest-Fehler mit
 * klarer Meldung, kein stillschweigend gewaehlter Eintrag.
 */
function infoElementForExpectation(capability, spec, manifestPath) {
  const matches = capability.infoElements.filter(entry => entry.id === spec.id);
  assertManifest(matches.length > 0, manifestPath,
    `infoElements: kein Info-Element mit id="${spec.id}" am Slot.`);
  assertManifest(matches.length === 1, manifestPath,
    `infoElements: id="${spec.id}" trifft ${matches.length} Eintraege am selben Slot (geerbt aus mehreren Unter-Auswahlen).`);
  return matches[0];
}

/** Prueft die `infoElements`-Aussagen eines Slots gegen seine Info-Projektion. */
function assertInfoElementsMatchExpectation(capability, specs, manifestPath) {
  for (const spec of specs) {
    assertManifest(typeof spec.id === 'string', manifestPath,
      'infoElements: Feld "id" fehlt (die Id des Vorkommens benennt den Eintrag).');
    const entry = infoElementForExpectation(capability, spec, manifestPath);

    for (const field of COMPARABLE_INFO_ELEMENT_FIELDS) {
      if (spec[field] === undefined) continue;
      expect(entry[field], `Info-Element ${spec.id}: ${field}`).toEqual(spec[field]);
    }
    for (const characteristic of spec.characteristics ?? []) {
      expect(entry.characteristics, `Info-Element ${spec.id}: effektiver Merkmalswert`)
        .toContainEqual(expect.objectContaining(characteristic));
    }
  }
}

/**
 * Prueft, dass die genannten Vorkommen **nicht** in der Info-Projektion eines Slots
 * stehen — die Gegenaussage zu {@link assertInfoElementsMatchExpectation}.
 *
 * Sie ist unverzichtbar, weil `infoElements` eine reine Teilmengen-Aussage ist: das
 * Fehlen eines Eintrags bemerkt sie nie. Genau darauf laufen aber zwei Regeln der
 * Projektion hinaus — „Verstecktes bleibt draussen" und „ein Verweis auf eine
 * Info-Gruppe traegt selbst keinen Eintrag".
 */
function assertInfoElementsAbsent(capability, absentIds, spec) {
  const presentIds = capability.infoElements.map(entry => entry.id);
  for (const id of absentIds) {
    expect(presentIds, `Slot ${spec.defId ?? spec.targetDefId}: Info-Element ${id} darf nicht erscheinen`)
      .not.toContain(id);
  }
}

/** Prueft die Slot-Aussagen (`capabilities`) eines Rosters gegen den Bericht. */
function assertCapabilitiesMatchExpectation(report, expectation, manifestPath) {
  for (const spec of expectation.capabilities ?? []) {
    // Ein Slot muss fachlich benannt sein — ueber seine eigene Definition oder,
    // bei einem Verweis-Slot (Kategorie-Anker, verlinkte Option), ueber sein Ziel.
    // `anchorKind`/`frameDefId`/`path` engen nur ein und benennen nichts.
    assertManifest(typeof spec.defId === 'string' || typeof spec.targetDefId === 'string', manifestPath,
      'capabilities: es fehlt ein benennendes Feld ("defId" oder "targetDefId").');
    const capability = capabilityForExpectation(report, spec, manifestPath);

    for (const field of COMPARABLE_CAPABILITY_FIELDS) {
      if (spec[field] === undefined) continue;
      expect(capability[field], `Slot ${spec.defId}: ${field}`).toEqual(spec[field]);
    }
    if (spec.authorMessages !== undefined) {
      expect(capability.authorMessages, `Slot ${spec.defId}: Zahl der Autor-Meldungen`)
        .toHaveLength(spec.authorMessages.length);
      for (const message of spec.authorMessages) {
        expect(capability.authorMessages, `Slot ${spec.defId}: Autor-Meldung`).toContainEqual(message);
      }
    }
    assertInfoElementsMatchExpectation(capability, spec.infoElements ?? [], manifestPath);
    assertInfoElementsAbsent(capability, spec.infoElementsAbsent ?? [], spec);
  }
}

/**
 * Uebersetzt einen Diagnose-Schluessel des Manifests in seinen SSOT-Wert und wirft
 * mit klarer Manifest-Meldung, wenn der Schluessel keine bekannte Diagnose-Art ist.
 */
function diagnosticKindOf(kindKey, manifestPath) {
  const kind = DiagnosticKind[kindKey];
  assertManifest(kind !== undefined, manifestPath, `Unbekannte Diagnose-Art "${kindKey}".`);
  return kind;
}

/** Menschenlesbarer Zusatz zur Diagnose-Spezifikation fuer Assertion-Meldungen. */
function diagnosticLabel(spec) {
  const target = spec.targetId !== undefined ? ` targetId=${spec.targetId}` : '';
  const def = spec.defId !== undefined ? ` defId=${spec.defId}` : '';
  return `${spec.kind}${target}${def}`;
}

/** Prueft die Diagnosen des Berichts gegen die optionale `diagnostics`-Erwartung eines Rosters. */
function assertDiagnosticsMatchExpectation(report, expectation, manifestPath) {
  const diagnosticsExpectation = expectation.diagnostics;
  if (diagnosticsExpectation === undefined) return;

  const { present = [], absent = [] } = diagnosticsExpectation;
  for (const spec of present) {
    const kind = diagnosticKindOf(spec.kind, manifestPath);
    const minCount = spec.minCount ?? 1;
    const matches = diagnosticsMatching(report, kind, spec);
    expect(matches.length, `Diagnose ${diagnosticLabel(spec)} muss mind. ${minCount}x auftreten`).toBeGreaterThanOrEqual(
      minCount,
    );
  }
  for (const spec of absent) {
    const kind = diagnosticKindOf(spec.kind, manifestPath);
    const matches = diagnosticsMatching(report, kind, spec);
    expect(matches.length, `Diagnose ${diagnosticLabel(spec)} darf nicht auftreten`).toBe(0);
  }
}

const scenarios = discoverScenarios();

describe('E2E Testkatalog (manifest-getrieben): docs/testing/<szenario>/scenario.json', () => {
  for (const manifest of scenarios) {
    describe(`Szenario: ${manifest.name}`, () => {
      manifest.rosters.forEach((rosterCase, index) => {
        // Der Roster-Dateiname allein ist nicht eindeutig: dasselbe `.ros` kann im
        // selben Szenario mehrfach gegen verschiedene `dataset`-Overrides laufen. Die
        // `description` (bzw. der Index als Rueckfall) haelt die Testtitel unterscheidbar.
        const label = rosterCase.description ? `${rosterCase.file} — ${rosterCase.description}` : `${rosterCase.file} [#${index}]`;
        it(`${label}: Bericht entspricht der deklarierten Erwartung`, () => {
          const prepared = preparedDatasetForRoster(manifest, rosterCase);
          const roster = rosterFromRos(join(manifest.scenarioDir, rosterCase.file));
          const report = evaluate(prepared, roster);
          assertViolationsMatchExpectation(report, rosterCase.expect);
          assertMessagesMatchExpectation(report, rosterCase.expect, manifest.manifestPath);
          assertCapabilitiesMatchExpectation(report, rosterCase.expect, manifest.manifestPath);
          assertDiagnosticsMatchExpectation(report, rosterCase.expect, manifest.manifestPath);
        });
      });
    });
  }
});

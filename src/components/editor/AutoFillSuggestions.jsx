import React, { useMemo, useState, useCallback } from 'react';
import { Plus, Wand2 } from 'lucide-react';
import { findEntryInSystem, foreignCatalogueIdsOf, getMandatoryChildrenCost } from '../../roster';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Vorschläge, die die Liste auf ihren eingestellten Punktwert bringen
 * (Issue 0135; ADR-0034/0035).
 *
 * Das Panel beantwortet genau eine Frage: **was passt noch in die
 * Restpunkte?** Es ist damit ein Werkzeug für den Schluss der Listenbauerei —
 * es erscheint erst auf den **letzten {@link FILL_UP_WINDOW_POINTS} Punkten**:
 * die Liste hat eine Punktgrenze, und es fehlt noch etwas zu ihr, aber
 * höchstens diese Spanne (Issue 0151). Bei einer größeren Lücke schweigt es —
 * dort ist die Frage nicht „was passt noch hinein", sondern „welche Einheiten
 * will ich überhaupt", und die beantwortet der Aushebe-Dialog. Innerhalb der
 * Spanne nennt es die verbleibende Summe und ist **immer** sichtbar, auch wenn
 * gerade nichts hineinpasst (dann steht statt der Liste ein Hinweis):
 * verschwände es still, wäre „nichts passt mehr" von „alle Punkte verplant"
 * nicht zu unterscheiden.
 *
 * Vorgeschlagen wird allein, was der Bericht als **wählbar** führt: ein
 * Angebots-Anker (`offerAnchor`) oder ein belegter Slot mit verbleibendem
 * Spielraum (eine schon aufgestellte Einheit, die noch wachsen darf). Beide
 * Ankerarten tragen ausschließlich `selectionEntry`/`entryLink` — nie eine
 * Kategorie. Genau daran scheiterte die Vorgängerfassung: sie speiste sich aus
 * den Pflicht-Signalen (`isMandatoryUnmet`), und eine Kategorie mit
 * MIN-Grenze, die kein Kontingent per `categoryLink` führt, hängt im Bericht
 * als Pflicht-Phantom — „General" stand als vermeintlich aushebbare Einheit im
 * Panel, und sein Knopf hätte eine Auswahl aus einer Kategorie-ID gebaut.
 * **Eine offene Pflicht erzeugt hier deshalb keinen Vorschlag mehr**; sie
 * steht im Meldungs-Panel und im Konfigurator der betroffenen Einheit.
 *
 * Dazu der **Herkunftsfilter** des Aushebe-Dialogs
 * ({@link foreignCatalogueIdsOf}, geteilte Regel): eine Einheit aus einem
 * fremden Armeebuch darf in dieser Liste gar nicht aufgestellt werden und
 * erscheint deshalb nicht — der Bericht verankert sie trotzdem als Angebot,
 * weil er global by Id auflöst (ADR-0032).
 *
 * Ein Vorschlag muss in der Limit-Kostenart etwas kosten (0 Punkte füllen
 * nichts auf) und darf die Restsumme nicht überschreiten; Verstecktes
 * (`isHidden`) und Ausgeschöpftes (`isBlocked`) fällt heraus. Sortiert wird
 * nach Kosten absteigend — der größte Brocken zuerst; über
 * {@link VISIBLE_SUGGESTION_COUNT} Vorschläge hinaus wird der Rest
 * aufklappbar, weil schon eine kleine Liste dutzende Kandidaten hat.
 *
 * **Was ein Vorschlag kostet**, hängt daran, was das Anwenden tut: an einem
 * **Angebots-Anker** legt die Selektions-Fabrik die Auswahl neu an — samt ihrer
 * Pflicht-Unterauswahlen —, und der Preis ist deshalb der Aushebepreis:
 * Eigenkosten aus dem Bericht plus `getMandatoryChildrenCost` des
 * Schreibmodells (dieselbe Rechnung wie im Aushebe-Dialog, dort ausführlich
 * begründet). Ohne den zweiten Posten galt eine Einheit, deren Punkte an ihren
 * Modellen hängen, als „kostet nichts" und fiel aus den Vorschlägen heraus. An
 * einem **belegten** Slot wächst dagegen nur die Anzahl; dort ist der Preis der
 * einer weiteren Instanz, also die Eigenkosten des Berichts allein.
 *
 * Die **Apply-Mechanik** bleibt die bestehende: eine Unter-Auswahl wächst über
 * `subSelectionOperations.increaseCount`, eine fehlende Einheit wird über
 * `addUnit` ausgehoben. Beides braucht Kontext, den nur der Editor hat
 * (`pathBySelectionId` zur Rahmen-Auflösung, `system`/`activeCatalogue` für
 * den Katalogeintrag, `addUnit`); fehlen diese optionalen Props, rendert der
 * Vorschlag ohne Aktionsknopf.
 */

/**
 * Die letzten Punkte einer Liste: nur bis zu dieser Lücke zum eingestellten
 * Punktwert wird aufgefüllt (Issue 0151).
 */
const FILL_UP_WINDOW_POINTS = 50;

/** Die Ankerart eines noch nicht vorhandenen Angebots (`report.js`-Ankervertrag). */
const OFFER_ANCHOR_KIND = 'offerAnchor';

/** So viele Vorschläge stehen ohne Aufklappen da. */
const VISIBLE_SUGGESTION_COUNT = 8;

export default function AutoFillSuggestions({
  capabilities,
  subSelectionOperations,
  costTypeLabel,
  forcePath = null,
  remainingPoints = null,
  costLimitTypeId = null,
  forceCatalogueId = null,
  pathBySelectionId = null,
  addUnit = null,
  system = null,
  activeCatalogue = null,
  roster = null
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  // Rahmen-Auflösung: Slot-Pfad → App-Selection-UUID (Umkehrung des Adapters).
  const selectionIdByPath = useMemo(() => {
    const inverse = new Map();
    if (pathBySelectionId) {
      for (const [selectionId, path] of pathBySelectionId) inverse.set(path, selectionId);
    }
    return inverse;
  }, [pathBySelectionId]);

  // Das eigene Armeebuch ist das des Kontingents; ohne eigenes gilt der aktive
  // Katalog der Liste — dieselbe Rückfallregel wie im Aushebe-Dialog.
  const ownCatalogueId = forceCatalogueId ?? activeCatalogue?.id ?? null;
  const foreignCatalogueIds = useMemo(
    () => foreignCatalogueIdsOf(system, ownCatalogueId), [system, ownCatalogueId]);

  // Der Katalogeintrag hinter einem Slot — für die bestehende Aushebe-Mechanik
  // und für den Aushebepreis eines Angebots.
  const entryFor = useCallback((capability) =>
    findEntryInSystem(system, capability.defId, activeCatalogue?.id)
      ?? { id: capability.defId, name: capability.name },
  [system, activeCatalogue]);

  const suggestions = useMemo(() => {
    const collected = [];
    // Ohne Punktgrenze gibt es keine Differenz zu füllen; über der Spanne ist
    // die Liste noch nicht am Auffüllen, darunter (0 oder Überschreitung) ist
    // nichts mehr zu füllen.
    if (!capabilities || costLimitTypeId === null || remainingPoints === null) return collected;
    if (remainingPoints <= 0 || remainingPoints > FILL_UP_WINDOW_POINTS) return collected;

    for (const [path, capability] of capabilities) {
      if (!isSelectableSlot(capability)) continue;
      if (capability.isHidden || capability.isBlocked) continue;
      // Nur zwei Standorte sind gemeint: unmittelbar unter dem Kontingent (eine
      // Einheit) oder unter einer bestehenden Auswahl (eine Option an ihr).
      const framePath = capability.frame?.path ?? null;
      if (framePath === null) continue;
      if (framePath !== forcePath && !selectionIdByPath.has(framePath)) continue;
      // Herkunft: eine Einheit eines fremden Armeebuchs darf in dieser Liste
      // nicht aufgestellt werden — sie füllt also nichts auf und erscheint gar
      // nicht (ADR-0032 löst global-by-Id auf, der Bericht verankert deshalb
      // auch fremde Wurzel-Einträge als Angebot).
      if (foreignCatalogueIds.has(capability.sourceId)) continue;
      // Ein Angebot wird angelegt (Aushebepreis), ein belegter Slot wächst nur
      // (Kosten einer weiteren Instanz) — siehe Kopfkommentar.
      const cost = (capability.costs?.[costLimitTypeId] ?? 0)
        + (capability.anchorKind === OFFER_ANCHOR_KIND
          ? getMandatoryChildrenCost(system, entryFor(capability), costLimitTypeId,
            { system, roster, currentCatalogueId: ownCatalogueId })
          : 0);
      if (cost <= 0 || cost > remainingPoints) continue;
      collected.push({ path, capability, cost });
    }
    collected.sort((a, b) => b.cost - a.cost);
    return collected;
  }, [capabilities, costLimitTypeId, remainingPoints, forcePath, selectionIdByPath,
    foreignCatalogueIds, entryFor, system, roster, ownCatalogueId]);

  /**
   * Die Anwenden-Aktion eines Vorschlags über die bestehende Mechanik — oder
   * `null`, wenn der nötige Kontext fehlt: ein Slot in einer Auswahl wächst
   * über `increaseCount` am Rahmen, ein Slot unter einem Kontingent wird über
   * `addUnit` ausgehoben (unter seiner effektiven Primärkategorie).
   */
  const applyActionFor = ({ capability }) => {
    const framePath = capability.frame?.path ?? null;
    if (framePath !== null && selectionIdByPath.has(framePath)) {
      const frameSelectionId = selectionIdByPath.get(framePath);
      return () => subSelectionOperations.increaseCount(frameSelectionId, entryFor(capability));
    }
    if (addUnit && framePath !== null) {
      return () => addUnit(entryFor(capability), capability.primaryCategoryId ?? null);
    }
    return null;
  };

  /** Der Name der Einheit, an der eine Option hängt — `null` unter dem Kontingent. */
  const unitNameFor = (capability) => {
    const framePath = capability.frame?.path ?? null;
    if (framePath === null || framePath === forcePath) return null;
    return capabilities.get(framePath)?.name ?? null;
  };

  // Sichtbar an der Lücke: steht die Liste auf ihren letzten Punkten, steht
  // das Panel da — auch wenn gerade nichts hineinpasst. Ein stilles
  // Verschwinden wäre von „alles erledigt" nicht zu unterscheiden.
  //
  // Ohne `forcePath` führt der Bericht für dieses Kontingent überhaupt keine
  // Slots (seine Definition kennt der Katalog nicht mehr). Dann schweigt das
  // Panel: „nichts passt hinein" wäre dort eine Behauptung über etwas, worüber
  // der Bericht nichts sagt.
  const isOpen = forcePath !== null
    && costLimitTypeId !== null
    && remainingPoints !== null
    && remainingPoints > 0
    && remainingPoints <= FILL_UP_WINDOW_POINTS;
  if (!isOpen) return null;

  const hasMore = suggestions.length > VISIBLE_SUGGESTION_COUNT;
  const visible = showAll || !hasMore ? suggestions : suggestions.slice(0, VISIBLE_SUGGESTION_COUNT);

  return (
    <div className="gothic-panel autofill-panel">
      <div className="autofill-header">
        <Wand2 className="text-gold" size={20} />
        <h3 className="font-serif text-gold no-margin">{t('editor.autofill.title')}</h3>
        <span className="text-label text-dim autofill-remaining">
          {t('editor.autofill.remaining', { points: remainingPoints, costType: costTypeLabel })}
        </span>
      </div>

      {suggestions.length === 0 && (
        <p className="text-dim no-margin">{t('editor.autofill.nothingFits')}</p>
      )}

      <div className="autofill-upgrade-list">
        {visible.map((suggestion) => {
          const { path, capability, cost } = suggestion;
          const unitName = unitNameFor(capability);
          const apply = applyActionFor(suggestion);
          return (
            <div key={path} className="sub-selection-row autofill-upgrade-row">
              <div className="flex-col">
                <span className="text-strong">{capability.name}</span>
                {unitName && (
                  <span className="text-micro text-dim">{t('editor.autofill.forUnit', { unit: unitName })}</span>
                )}
              </div>
              <div className="sub-selection-controls autofill-upgrade-controls">
                <span className="text-gold text-label">+{cost} {costTypeLabel}</span>
                {apply && (
                  <button
                    className="btn-secondary square-btn"
                    onClick={apply}
                    title={t('common.add')}
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          className="btn-secondary autofill-toggle-btn"
          onClick={() => setShowAll(value => !value)}
        >
          {showAll
            ? t('editor.autofill.showLess')
            : t('editor.autofill.showAll', { count: suggestions.length })}
        </button>
      )}
    </div>
  );
}

/**
 * True für einen Slot, an dem noch etwas gewählt werden kann: ein
 * Angebots-Anker (im Rahmen wählbar, noch nicht vorhanden) oder eine belegte
 * Auswahl mit verbleibendem Spielraum (`headroom === null` heißt: kein
 * Höchstmaß). Jede andere Ankerart — Pflicht-Phantom, Gruppen- und
 * Kategorie-Anker — benennt keinen Eintrag, den dieses Panel aushebt.
 */
function isSelectableSlot(capability) {
  if (capability.anchorKind === OFFER_ANCHOR_KIND) return true;
  return capability.anchorKind === 'occupied'
    && (capability.headroom === null || capability.headroom > 0);
}

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { findEntryInSystem, foreignCatalogueIdsOf, getMandatoryChildrenCost } from '../../roster';
import { childSlotsOf } from '../../evaluation/slotLookups';
import { useTranslation } from '../../i18n/useTranslation';
import BottomSheet from './BottomSheet';

/**
 * Aushebe-Dialog einer Kategorie (Issue 0121, Task 6; ADR-0035/0036).
 *
 * Kandidatenliste und Zustand kommen aus den **Fähigkeitsdatensätzen** des
 * Evaluator-Berichts (`capabilities`), abgelesen an den Slots direkt unter dem
 * Ziel-Kontingent (`forcePath`): wählbar ist, was dort als Angebots-Anker,
 * Pflicht-Phantom oder belegter Slot mit Restspielraum hängt; gesperrt
 * (`isBlocked`) wird deaktiviert mit „(Nicht verfügbar)" gezeigt; versteckt
 * (`isHidden`) erscheint gar nicht. Den Preis daneben siehe unten. Der
 * frühere Solver-Diff (Baseline-Validierung + hypothetisches Ausheben,
 * ADR-0022) ist ersatzlos entfallen (ADR-0035).
 *
 * Dazu der **Herkunftsfilter** (`capability.sourceId`, Task 13;
 * {@link foreignCatalogueIdsOf}, geteilt mit den Auffüll-Vorschlägen): angeboten wird
 * nur, was aus dem Armeebuch **dieses Kontingents** (`forceCatalogueId`), dem
 * Spielsystem oder einem Bibliothekskatalog stammt — eine Einheit eines fremden
 * Armeebuchs erscheint gar nicht. Maßgeblich ist der Katalog des Kontingents,
 * nicht der der ganzen Liste: ein verbündetes Kontingent bringt sein eigenes
 * Armeebuch mit (`force.catalogueId`, Task 19). Fehlt die Stütze oder ist sie
 * `null`, gilt der aktive Katalog der Liste. Ist eine explizite `entries`-Liste
 * vorgegeben, gilt der Filter gar nicht ({@link foreignCatalogueIdsOf}).
 *
 * `addUnit(kandidat, categoryId)` bleibt der Aushebe-Callback; als Kandidat
 * wird der Katalogeintrag der Definition übergeben (Auflösung über die
 * Schreibmodell `src/roster/` — die Schreibmechanik lebt dort),
 * ersatzweise ein `{ id, name }`-Paar aus dem Slot.
 *
 * ── Der angezeigte Preis ist der Aushebepreis ────────────────────────────────
 * Gezeigt wird, was das Ausheben tatsächlich kostet, und das sind zwei Posten
 * aus zwei Quellen, weil es zwei verschiedene Fragen sind:
 *
 * - die **Eigenkosten einer Instanz** liest der Bericht (`capability.costs`) —
 *   effektiv, nach allen Kosten-Modifikatoren (ADR-0034);
 * - die **Pflicht-Unterauswahlen**, die beim Ausheben mitkommen, rechnet das
 *   Schreibmodell (`getMandatoryChildrenCost` in `src/roster/`). Der
 *   Bericht kann das nicht: die Eigenkosten eines Slots sind vertraglich die
 *   einer Instanz, und ein Angebots-Anker ist ein Blatt — die Pflicht-Kinder,
 *   die eine Aushebung anlegen würde, hängen noch nirgends im Auswertungsbaum.
 *   Welche Option eine Pflichtgruppe füllt, ist zudem eine Regel des
 *   **Bearbeitens**, die der Evaluator bewusst nicht entscheidet. Gerechnet
 *   wird deshalb aus derselben Ermittlung, aus der die Fabrik die Auswahl
 *   anlegt (`selectionMembers.js`, SSOT): angezeigter und danach anfallender
 *   Preis stimmen überein.
 *
 * Ohne den zweiten Posten stand bei jeder Einheit, deren Punkte an ihren
 * Modellen hängen (Grave Guard: Eintrag 0, 10 Modelle × 12), gar kein Preis —
 * `costs` ist dort 0, und 0 zeigt der Dialog nicht an.
 */

/** Die Ankerarten, deren Slots im Dialog als Kandidaten erscheinen. */
const CANDIDATE_ANCHOR_KINDS = new Set(['occupied', 'offerAnchor', 'mandatoryPhantom']);

export default function CategoryUnitAdder({
  categoryId = null,
  categoryName,
  capabilities,
  forcePath = null,
  forceCatalogueId = null,
  system,
  activeCatalogue,
  roster = null,
  costTypeLabel,
  costLimitType,
  addUnit,
  entries = null
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Das eigene Armeebuch ist das des Kontingents; ohne eigenes gilt der aktive
  // Katalog der Liste (Altverhalten).
  const ownCatalogueId = forceCatalogueId ?? activeCatalogue?.id ?? null;

  // Der Aushebe-Callback erwartet den Katalogeintrag der Definition (die
  // Selektions-Fabrik liest ihn); bei einer expliziten Eintragsliste ist er
  // schon da, sonst löst ihn das Schreibmodell aus dem System auf.
  const entryFor = useCallback((capability) => {
    const fromEntries = entries?.find(entry =>
      entry.id === capability.defId || entry.id === capability.targetDefId
      || (entry.targetId && entry.targetId === capability.targetDefId));
    if (fromEntries) return fromEntries;
    return findEntryInSystem(system, capability.defId, activeCatalogue?.id)
      ?? { id: capability.defId, name: capability.name };
  }, [entries, system, activeCatalogue]);

  // Die Kandidaten samt ihrem Aushebepreis — einmal je Bericht/Katalog gebaut,
  // nicht je Render: der Preis läuft je Kandidat über die Definitionen des
  // Katalogs (Pflicht-Unterauswahlen, siehe Kopfkommentar).
  const candidates = useMemo(() => {
    if (!activeCatalogue) return [];

    // Erlaubte Definitions-Ids, wenn eine explizite Eintragsliste vorgegeben ist
    // (z. B. armeeweite Selektoren ohne eigene Kategorie-Sektion).
    const allowedIds = entries === null
      ? null
      : new Set(entries.flatMap(entry => [entry.id, entry.targetId].filter(Boolean)));

    // Der Herkunftsfilter gilt nur ohne explizite Eintragsliste: eine solche Liste
    // ist bereits vom Aufrufer kuratiert (armeeweite Selektoren), und ein
    // Herkunftsfilter darüber nähme einen bewusst übergebenen katalogübergreifenden
    // Eintrag weg.
    const foreignCatalogueIds = allowedIds === null
      ? foreignCatalogueIdsOf(system, ownCatalogueId)
      : null;

    // Der Lesekontext der Pflicht-Kinder-Rechnung: derselbe Katalog, aus dem der
    // Kandidat stammt (ADR-0018 — eine Eintrags-Id ist nur in ihrem Katalog
    // eindeutig), und die Liste selbst, damit ein bedingt angehobenes `min`
    // dieselbe Bedingung sieht wie beim tatsächlichen Ausheben.
    const costContext = { system, roster, currentCatalogueId: ownCatalogueId };

    // Kandidaten: je Definition genau ein Slot unter dem Kontingent. Versteckte
    // Slots erscheinen nicht; die Kategorie-Zuordnung liest die **effektive**
    // Primärkategorie aus dem Bericht (§8: nie aus rohen Katalog-Links).
    const seenDefIds = new Set();
    const collected = [];
    for (const { path, capability } of childSlotsOf(capabilities, forcePath)) {
      if (!CANDIDATE_ANCHOR_KINDS.has(capability.anchorKind)) continue;
      if (capability.isHidden) continue;
      if (seenDefIds.has(capability.defId)) continue;
      if (allowedIds !== null) {
        if (!allowedIds.has(capability.defId)
          && !(capability.targetDefId && allowedIds.has(capability.targetDefId))) continue;
      } else {
        if (capability.primaryCategoryId !== categoryId) continue;
        // Herkunft: eine Einheit eines fremden Armeebuchs darf in dieser Liste
        // nicht aufgestellt werden und erscheint deshalb gar nicht — nicht bloß
        // gesperrt (ADR-0032 löst global-by-Id auf, der Bericht verankert
        // deshalb auch fremde Wurzel-Einträge als Angebot).
        if (foreignCatalogueIds.has(capability.sourceId)) continue;
      }
      seenDefIds.add(capability.defId);
      // Eigenkosten aus dem Bericht plus die Pflicht-Unterauswahlen, die beim
      // Ausheben mitkommen (Kopfkommentar): zusammen der Aushebepreis.
      const points = (capability.costs?.[costLimitType] ?? 0)
        + getMandatoryChildrenCost(system, entryFor(capability), costLimitType, costContext);
      collected.push({ path, capability, points });
    }

    collected.sort((a, b) => b.points - a.points); // Descending
    return collected;
  }, [capabilities, forcePath, categoryId, entries, entryFor, system, roster, activeCatalogue, ownCatalogueId, costLimitType]);

  if (!activeCatalogue) return null;
  if (candidates.length === 0) return null;

  return (
    <div ref={wrapperRef} className="category-unit-adder-container">
      <button
        type="button"
        className="qty-btn"
        onClick={() => setIsOpen(!isOpen)}
        title={t('editor.adder.raise', { category: categoryName })}
      >
        {isOpen ? <X size={12} /> : <Plus size={12} />}
      </button>

      <BottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t('editor.adder.raise', { category: categoryName })}
        desktopMode="popover"
        containerRef={wrapperRef}
      >
        <div className="popover-list">
          {candidates.map(({ path, capability, points }) => {
            // Verfügbarkeit wird **abgelesen** (ADR-0035): gesperrt ist, wessen
            // Höchstmaß ausgeschöpft ist — keine Diff-Rechnung, keine Sperrtabelle.
            const isBlocked = capability.isBlocked === true;

            return (
              <div
                key={path}
                className={`popover-item ${isBlocked ? 'disabled' : ''}`}
                aria-disabled={isBlocked}
                onClick={() => {
                  if (isBlocked) return;
                  addUnit(entryFor(capability), categoryId);
                  setIsOpen(false);
                }}
              >
                <div className="popover-item-name popover-item-label">
                  <span>{capability.name}</span>
                  {isBlocked && <span className="text-danger text-micro popover-item-unavailable">{t('editor.adder.unavailable')}</span>}
                </div>
                {points > 0 && (
                  <span className="popover-item-cost font-body text-gold">
                    +{points} {costTypeLabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}

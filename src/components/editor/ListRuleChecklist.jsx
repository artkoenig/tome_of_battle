import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import SelectionConfigurator from './SelectionConfigurator';
import CategoryUnitAdder from './CategoryUnitAdder';
import BottomSheet from './BottomSheet';
import GothicTooltip from '../GothicTooltip';
import RuleChipIcon from './RuleChipIcon';
import { renderUpgradeDetails } from './upgradeDetails';
import { resolveEntry } from '../../roster';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Ankreuzliste der „Special list rules" einer Kategorie. Ersetzt die frühere
 * Auto-Materialisierung samt Einheiten-Karten: jede Katalog-Listenregel wird
 * datengetrieben aufgezählt (ob im Roster präsent oder nicht) und als Ankreuzfeld
 * dargestellt — angehakt ⇔ präsent. Anhaken fügt die Regel-Selektion hinzu,
 * Abhaken entfernt sie. Behälter-Regeln zeigen ihre Unteroptionen direkt und
 * eingerückt unter ihrer Zeile (ohne Karte, ohne Überschrift). Ein eigener
 * Pfeil-Umschalter klappt diese Unteroptionen ein bzw. aus — unabhängig vom
 * Ankreuzzustand (angehakt bleibt angehakt), anfänglich ausgeklappt.
 * Eine nicht-binäre Regel (`max > 1`) fällt datengetrieben auf den Mengen-Adder
 * zurück (ADR 0003 — keine hartkodierten Regelnamen).
 */
export default function ListRuleChecklist({
  system,
  activeCatalogue,
  categoryId,
  roster,
  capabilities,
  forcePath,
  pathBySelectionId,
  states,
  addUnit,
  removeUnit,
  subSelectionOperations,
  costTypeLabel,
  costLimitType,
  onShowRule,
}) {
  const { t } = useTranslation();
  const [activeInfo, setActiveInfo] = useState(null);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  // Eingeklappte Behälter, nach `resolvedId`. Fehlt ein Eintrag, gilt die Zeile
  // als ausgeklappt (Standard nach dem Anhaken), sodass Unteroptionen sofort
  // konfigurierbar sind, aber jederzeit ohne Abwählen einklappbar bleiben.
  const [collapsed, setCollapsed] = useState({});
  const toggleCollapsed = (resolvedId) =>
    setCollapsed((prev) => ({ ...prev, [resolvedId]: !prev[resolvedId] }));

  const handleMouseEnter = (title, text, e) => {
    if (window.innerWidth <= 900) return;
    setHoveredInfo({ title, text, x: e.clientX + 15, y: e.clientY + 15 });
  };
  const handleMouseMove = (e) => {
    if (window.innerWidth <= 900) return;
    setHoveredInfo((prev) => (prev ? { ...prev, x: e.clientX + 15, y: e.clientY + 15 } : null));
  };
  const handleMouseLeave = () => setHoveredInfo(null);

  if (!states || states.length === 0) return null;

  // Die Sperre einer eindeutigen Pflicht-Listenregel folgt ihrer **Präsenz**
  // (Issue 0140, Kriterium 4): gesperrt ist sie nur, solange sie tatsächlich im
  // Roster steht — dann ist sie nicht abwählbar (Issue 0138, AC5). Fehlt sie
  // dagegen (ein vor dem automatischen Setzen angelegtes Bestandsroster bekommt
  // sie nie nachgereicht), bleibt die Zeile ankreuzbar, damit der sonst
  // blockierende Fehler wie bisher von Hand behebbar ist. Der Pflicht-Hinweis
  // (Info-Symbol) hängt nicht an der Sperre und erscheint in beiden Zuständen.
  const isLocked = (state) => state.mandatory && state.checked;

  const toggleRule = (state, nextChecked) => {
    // Der disabled-Zustand der Checkbox verhindert das Abwählen einer präsenten
    // Pflichtregel ohnehin schon auf DOM-Ebene; dieser Guard hält die Regel auch
    // gegen einen programmatischen Aufruf ein.
    if (isLocked(state)) return;
    if (nextChecked) {
      addUnit(state.entry, categoryId);
    } else if (state.selection) {
      removeUnit(state.selection.id);
    }
  };

  // Erklärung einer gesperrten Pflichtregel-Zeile (Issue 0138, AC5, Revision
  // Prüfrunde 1 F2): dasselbe Info-Symbol-Muster, das `SelectionConfigurator.jsx`
  // für jede andere Unteroption schon einsetzt (`RuleChipIcon` + `resolveEntry`/
  // `renderUpgradeDetails`), statt einer separaten, nur-Hover-Mechanik auf der
  // (deaktivierten) Checkbox. `res`/`content` werden nur für Pflichtzeilen
  // berechnet, weil nur sie das Symbol bekommen.
  const mandatoryInfoContent = (state) => {
    const res = resolveEntry(system, state.entry, activeCatalogue?.id);
    return (
      <>
        {renderUpgradeDetails(res, system)}
        {t('editor.listRules.mandatoryTooltip')}
      </>
    );
  };

  const renderMandatoryInfoIcon = (state) => {
    if (!state.mandatory) return null;
    return (
      <RuleChipIcon
        name={state.name}
        // Das Symbol muss unbedingt erscheinen (auch ohne aufgelöste
        // Beschreibung) und darf nie vom externen BookOpen-Regel-Link
        // verdrängt werden (Plan Contract 3b) — beides deckt `forceInfo` ab;
        // `hasInfo` bleibt dennoch `true`, weil das Symbol auch ohne den
        // Override immer etwas zu zeigen hat (die Pflicht-Erklärung).
        hasInfo
        onShowRule={onShowRule}
        forceInfo
        onInfoClick={() => {
          if (window.innerWidth <= 900) {
            setActiveInfo({ title: state.name, text: mandatoryInfoContent(state) });
          }
        }}
        onInfoEnter={(e) => handleMouseEnter(state.name, mandatoryInfoContent(state), e)}
        onInfoMove={handleMouseMove}
        onInfoLeave={handleMouseLeave}
      />
    );
  };

  return (
    <div className="list-rule-checklist">
      {states.map((state) => {
        // Datengetriebener Rückfall: eine nicht-binäre Regel (echte Mengen-Beschränkung)
        // wird über den Mengen-Adder statt ein Ankreuzfeld bedient.
        if (!state.isBinary) {
          return (
            <div key={state.resolvedId} className="list-rule-row">
              <span className="list-rule-chevron-slot" />
              <span className="list-rule-name text-body">{state.name}</span>
              <CategoryUnitAdder
                categoryId={categoryId}
                categoryName={state.name}
                entries={[state.entry]}
                capabilities={capabilities}
                forcePath={forcePath}
                system={system}
                activeCatalogue={activeCatalogue}
                costTypeLabel={costTypeLabel}
                costLimitType={costLimitType}
                addUnit={addUnit}
              />
            </div>
          );
        }

        const hasSubOptions = state.checked && state.isContainer && !!state.selection;
        const isExpanded = !collapsed[state.resolvedId];

        return (
          <div key={state.resolvedId} className="list-rule-item">
            {hasSubOptions ? (
              // Behälter (angehakt, mit Unteroptionen): Ein Klick auf die Zeile klappt
              // ein/aus; nur die Checkbox schaltet die Regel an/aus. Der Chevron ist
              // reines Icon. Die Checkbox stoppt die Klick-Propagation, damit sie die
              // Zeile nicht zugleich einklappt.
              <div
                className="list-rule-row list-rule-row-expandable"
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? t('editor.subOptions.collapse') : t('editor.subOptions.expand')}
                onClick={() => toggleCollapsed(state.resolvedId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCollapsed(state.resolvedId);
                  }
                }}
              >
                <span className="list-rule-chevron-slot" aria-hidden="true">
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
                <span className="list-rule-name text-body">
                  {state.name}
                  {renderMandatoryInfoIcon(state)}
                </span>
                <input
                  type="checkbox"
                  checked={state.checked}
                  aria-label={state.name}
                  disabled={isLocked(state)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => toggleRule(state, e.target.checked)}
                />
              </div>
            ) : (
              // Schalter-Regel (oder noch nicht angehakter Behälter): keine
              // Unteroptionen zum Einklappen — der Klick auf die ganze Zeile schaltet
              // die Regel an/aus (natives Label-Verhalten).
              <label className="list-rule-row list-rule-row-toggle">
                <span className="list-rule-chevron-slot" />
                <span className="list-rule-name text-body">
                  {state.name}
                  {renderMandatoryInfoIcon(state)}
                </span>
                <input
                  type="checkbox"
                  checked={state.checked}
                  aria-label={state.name}
                  disabled={isLocked(state)}
                  onChange={(e) => toggleRule(state, e.target.checked)}
                />
              </label>
            )}

            {hasSubOptions && isExpanded && (
              <div className="list-rule-suboptions">
                <SelectionConfigurator
                  selection={state.selection}
                  capabilities={capabilities}
                  pathBySelectionId={pathBySelectionId}
                  system={system}
                  roster={roster}
                  subSelectionOperations={subSelectionOperations}
                  activeCatalogue={activeCatalogue}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseMove={handleMouseMove}
                  handleMouseLeave={handleMouseLeave}
                  setActiveInfo={setActiveInfo}
                  onShowRule={onShowRule}
                  isListRule
                />
              </div>
            )}
          </div>
        );
      })}

      {hoveredInfo && (
        <GothicTooltip title={hoveredInfo.title} x={hoveredInfo.x} y={hoveredInfo.y}>
          {hoveredInfo.text}
        </GothicTooltip>
      )}

      <BottomSheet
        isOpen={!!activeInfo}
        onClose={() => setActiveInfo(null)}
        title={activeInfo?.title || ''}
        desktopMode="modal"
      >
        <div className="info-popup-body">{activeInfo?.text}</div>
      </BottomSheet>
    </div>
  );
}

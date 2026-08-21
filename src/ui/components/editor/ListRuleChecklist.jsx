import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import SelectionConfigurator from './SelectionConfigurator';
import CategoryUnitAdder from './CategoryUnitAdder';
import BottomSheet from './BottomSheet';
import GothicTooltip from '../GothicTooltip';
import RuleChipIcon from './RuleChipIcon';
import { renderUpgradeDetails } from './upgradeDetails';
import { useListRuleChecklist } from '../../viewmodels/editor/useListRuleChecklist';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Ankreuzliste der „Special list rules" einer Kategorie. Jede Katalog-Listenregel
 * wird datengetrieben aufgezählt (ob im Roster präsent oder nicht) und als
 * Ankreuzfeld dargestellt — angehakt ⇔ präsent. Anhaken fügt die Regel-Selektion
 * hinzu, Abhaken entfernt sie. Behälter-Regeln zeigen ihre Unteroptionen direkt
 * und eingerückt unter ihrer Zeile (ohne Karte, ohne Überschrift). Ein eigener
 * Pfeil-Umschalter klappt diese Unteroptionen ein bzw. aus — unabhängig vom
 * Ankreuzzustand (angehakt bleibt angehakt), anfänglich ausgeklappt.
 * Eine nicht-binäre Regel (`max > 1`) fällt datengetrieben auf den Mengen-Adder
 * zurück (ADR 0003 — keine hartkodierten Regelnamen).
 *
 * Zeilenliste, Sperren und die beiden Schreib-Aktionen kommen seit Issue 0164
 * aus {@link useListRuleChecklist}; hier bleiben nur die Anzeige-Zustände
 * (Einklappen, Tooltip, Info-Blatt).
 */
export default function ListRuleChecklist({
  forceId = null,
  forcePath = null,
  categoryId,
  onShowRule,
}) {
  const { t } = useTranslation();
  const { rows } = useListRuleChecklist({ forceId, forcePath, categoryId });
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

  if (rows.length === 0) return null;

  // Erklärung einer gesperrten Pflichtregel-Zeile (Issue 0138, AC5, Revision
  // Prüfrunde 1 F2): dasselbe Info-Symbol-Muster, das `SelectionConfigurator.jsx`
  // für jede andere Unteroption schon einsetzt (`RuleChipIcon` +
  // `renderUpgradeDetails`), statt einer separaten, nur-Hover-Mechanik auf der
  // (deaktivierten) Checkbox.
  const mandatoryInfoContent = (row) => (
    <>
      {renderUpgradeDetails(row.detailElements)}
      {t('editor.listRules.mandatoryTooltip')}
    </>
  );

  const renderMandatoryInfoIcon = (row) => {
    if (!row.mandatory) return null;
    return (
      <RuleChipIcon
        name={row.name}
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
            setActiveInfo({ title: row.name, text: mandatoryInfoContent(row) });
          }
        }}
        onInfoEnter={(e) => handleMouseEnter(row.name, mandatoryInfoContent(row), e)}
        onInfoMove={handleMouseMove}
        onInfoLeave={handleMouseLeave}
      />
    );
  };

  return (
    <div className="list-rule-checklist">
      {rows.map((row) => {
        // Datengetriebener Rückfall: eine nicht-binäre Regel (echte Mengen-Beschränkung)
        // wird über den Mengen-Adder statt ein Ankreuzfeld bedient.
        if (!row.isBinary) {
          return (
            <div key={row.key} className="list-rule-row">
              <span className="list-rule-chevron-slot" />
              <span className="list-rule-name text-body">{row.name}</span>
              <CategoryUnitAdder
                forceId={forceId}
                forcePath={forcePath}
                categoryId={categoryId}
                categoryName={row.name}
                entries={[row.entry]}
              />
            </div>
          );
        }

        const isExpanded = !collapsed[row.resolvedId];

        return (
          <div key={row.key} className="list-rule-item">
            {row.hasSubOptions ? (
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
                onClick={() => toggleCollapsed(row.resolvedId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCollapsed(row.resolvedId);
                  }
                }}
              >
                <span className="list-rule-chevron-slot" aria-hidden="true">
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
                <span className="list-rule-name text-body">
                  {row.name}
                  {renderMandatoryInfoIcon(row)}
                </span>
                <input
                  type="checkbox"
                  checked={row.checked}
                  aria-label={row.name}
                  disabled={row.isLocked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => row.toggle(e.target.checked)}
                />
              </div>
            ) : (
              // Schalter-Regel (oder noch nicht angehakter Behälter): keine
              // Unteroptionen zum Einklappen — der Klick auf die ganze Zeile schaltet
              // die Regel an/aus (natives Label-Verhalten).
              <label className="list-rule-row list-rule-row-toggle">
                <span className="list-rule-chevron-slot" />
                <span className="list-rule-name text-body">
                  {row.name}
                  {renderMandatoryInfoIcon(row)}
                </span>
                <input
                  type="checkbox"
                  checked={row.checked}
                  aria-label={row.name}
                  disabled={row.isLocked}
                  onChange={(e) => row.toggle(e.target.checked)}
                />
              </label>
            )}

            {row.hasSubOptions && isExpanded && (
              <div className="list-rule-suboptions">
                <SelectionConfigurator
                  selection={row.selection}
                  tooltip={{
                    onEnter: handleMouseEnter,
                    onMove: handleMouseMove,
                    onLeave: handleMouseLeave,
                    onOpen: setActiveInfo,
                  }}
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

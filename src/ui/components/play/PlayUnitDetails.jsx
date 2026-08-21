import React from 'react';
import { Plus, Minus, ReceiptText } from 'lucide-react';
import { usePlayUnit } from '../../viewmodels/usePlayUnit';
import { UnitUpgradesChips, UnitRulesChips } from '../editor/UnitChips';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Die Einheitenkarte des Spielmodus — nur noch JSX (ADR-0038).
 *
 * Profil-Tabellen, Wunden, Kosten und die eigenständigen Untereinheiten kommen
 * aus `usePlayUnit`; die Karte leitet nichts mehr im Render ab.
 */
export default function PlayUnitDetails({
  selection,
  system,
  roster,
  costTypes = null,
  capability = null,
  slots,
  getUnitCurrentWounds,
  handleAdjustWound,
  handleMouseEnter,
  handleMouseLeave,
  setSaveSummaryData,
  setSaveSummaryOpen,
  isSubUnit = false,
  onShowRule
}) {
  const { t } = useTranslation();
  const unit = usePlayUnit({
    selection, system, roster, costTypes, capability, slots,
    getUnitCurrentWounds, isSubUnit,
  });

  const openDetails = (title, breakdown) => {
    setSaveSummaryData({ title, breakdown });
    setSaveSummaryOpen(true);
  };

  const renderProfileCell = (characteristic, headerKey) => {
    if (!characteristic) return <td key={headerKey} className="font-body">-</td>;

    const cell = unit.profileCellOf(characteristic);
    const title = t('common.modifications', { name: characteristic.name });

    return (
      <td
        key={headerKey}
        className={cell.className}
        onMouseEnter={(e) => {
          if (cell.breakdown) handleMouseEnter(e, title, cell.breakdown);
        }}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          if (cell.breakdown) openDetails(title, cell.breakdown);
        }}
      >
        {characteristic.value}
      </td>
    );
  };

  const renderProfileTable = (group, key) => {
    const { typeName, profiles, isModel } = group;
    if (!profiles || profiles.length === 0) return null;

    const headers = unit.profileTableHeadersOf(profiles);
    const showNameCol = isModel ? profiles.length > 1 : true;
    const nameHeader = isModel ? t('common.model') : (typeName || t('common.profileHeader'));

    return (
      <div key={key} className="profile-table-container">
        <table className="profile-table">
          <thead>
            <tr>
              {showNameCol && <th>{nameHeader}</th>}
              {headers.map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((prof, pIdx) => (
              <tr key={prof.id || pIdx}>
                {showNameCol && (
                  <td className="font-body">
                    {prof.name}
                  </td>
                )}
                {headers.map(h => renderProfileCell(prof.characteristics?.find(char => char.name === h), h))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div
      className={`play-unit-card ${unit.isDead ? 'unit-destroyed' : ''} ${isSubUnit ? 'play-unit-card--sub' : ''}`}
    >
      {unit.isDead && (
        <div className="destroyed-overlay">
          <span className="destroyed-text">{t('play.destroyed')}</span>
        </div>
      )}
      <div className="play-unit-header">
        <div className="play-unit-title text-ui-title">
          <div>
            {unit.name}
          </div>
          <div className="flex-row gap-8">
            {unit.totalCost > 0 && (
              <div className="text-ui-title text-gold text-strong">
                {unit.totalCost} {unit.costLabel}
              </div>
            )}
          </div>
        </div>

        <div className="flex-between">
          {/* Der Wundenzähler steht links im Kartenkopf, wo zuvor die AS/WS-Badges
              standen: er ist im Spiel das am häufigsten bediente Element. Der
              Platzhalter hält die Position auch bei Einheiten ohne eigenen Zähler
              (Untereinheiten führen ihn selbst), damit der Profil-Schalter rechts bleibt. */}
          {unit.hasSubUnits ? (
            <div />
          ) : (
            <div className={`play-unit-header-controls${unit.isDead ? ' play-unit-header-controls--dimmed' : ''}`}>
              {unit.isDead && <span className="text-danger font-serif play-unit-destroyed-label">{t('play.destroyedCaps')}</span>}
              <button
                className="qty-btn"
                onClick={() => handleAdjustWound(selection.id, -1, unit.totalMaxWounds)}
                disabled={unit.isDead}
              >
                <Minus size={12} />
              </button>
              <span className="font-body play-unit-wound-value">
                {unit.currentWounds} / {unit.totalMaxWounds}
              </span>
              <button
                className="qty-btn"
                onClick={() => handleAdjustWound(selection.id, 1, unit.totalMaxWounds)}
                disabled={unit.currentWounds === unit.totalMaxWounds}
              >
                <Plus size={12} />
              </button>
            </div>
          )}
          <div className="flex-row gap-8">
            {unit.showsDetailsToggle && (
              <button
                type="button"
                className={`square-btn unit-card-details-toggle ${unit.isDetailsOpen ? 'is-active' : ''}`}
                onClick={unit.toggleDetails}
                title={unit.isDetailsOpen ? t('play.hideProfiles') : t('play.showProfiles')}
                aria-expanded={unit.isDetailsOpen}
              >
                <ReceiptText size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="play-unit-body">
        <div className="flex-col gap-8">
          <div className={`play-unit-profiles ${unit.isDetailsOpen ? 'is-open' : ''}`}>
            {unit.showsProfiles && (
              <div>
                {unit.modelGroup
                  ? renderProfileTable(unit.modelGroup, 'model')
                  : <p className="text-dim text-label">{t('play.noProfileValues')}</p>}
                {unit.itemGroups.map((group, gIdx) => renderProfileTable(group, group.typeName || gIdx))}
              </div>
            )}
          </div>

          <div className="play-unit-chips">
            <UnitUpgradesChips
              selection={selection}
              handleMouseEnter={(title, text, e) => handleMouseEnter(e, title, text)}
              handleMouseMove={null}
              handleMouseLeave={handleMouseLeave}
              onClickDetails={(title, text) => {
                if (window.innerWidth <= 900) openDetails(title, text);
              }}
              onShowRule={onShowRule}
            />
            <UnitRulesChips
              selection={selection}
              handleMouseEnter={(title, text, e) => handleMouseEnter(e, title, text)}
              handleMouseMove={null}
              handleMouseLeave={handleMouseLeave}
              onClickDetails={(title, text) => {
                if (window.innerWidth <= 900) openDetails(title, text);
              }}
              onShowRule={onShowRule}
            />
          </div>
          {unit.hasSubUnits && (
            <div className="sub-units-container play-unit-sub-units">
              {unit.subUnits.map(subSel => (
                <PlayUnitDetails
                  key={subSel.id}
                  selection={subSel}
                  system={system}
                  roster={roster}
                  costTypes={costTypes}
                  slots={slots}
                  getUnitCurrentWounds={getUnitCurrentWounds}
                  handleAdjustWound={handleAdjustWound}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setSaveSummaryData={setSaveSummaryData}
                  setSaveSummaryOpen={setSaveSummaryOpen}
                  isSubUnit={true}
                  onShowRule={onShowRule}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

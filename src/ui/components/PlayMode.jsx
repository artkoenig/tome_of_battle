import React from 'react';
import { ArrowLeft, Swords, BookOpen } from 'lucide-react';
import { RosterReportProvider } from '../viewmodels/rosterContexts';
import { usePlayRoster } from '../viewmodels/usePlayRoster';
import BottomSheet from './editor/BottomSheet';
import PlayUnitDetails from './play/PlayUnitDetails';
import RulesIndexDialog from './RulesIndexDialog';
import GothicTooltip from './GothicTooltip';
import { useTranslation } from '../i18n/useTranslation';

const RULEBOOK_URL = 'https://6th.whfb.app/?utm_source=6th-builder&utm_medium=referral';

/**
 * Die Spielmodus-Hülle — nur noch JSX (ADR-0038).
 *
 * Bericht, Kopfzeile, Extra-Ressourcen, die gruppierten Einheiten, der
 * Wundenzustand und die drei Overlays kommen aus `usePlayRoster`.
 */
export default function PlayMode({ system, roster: initialRoster, onBack, onReportError }) {
  const { t } = useTranslation();
  const play = usePlayRoster({ system, initialRoster, onReportError });

  return (
    <RosterReportProvider report={play.report} roster={play.roster} system={system}>
    <>
      {/* Desktop Header in Play Mode (same style as editor) */}
      <div className="builder-top-bar play-mode-top-bar hide-on-mobile">
        <div className="builder-top-bar-left">
          <div className="builder-top-bar-title-section">
            <h2 className="builder-top-bar-title">{play.roster.name}</h2>
            <span className="builder-top-bar-subtitle">
              <span>{play.systemLabel}</span>
              {play.catalogueLabel}
            </span>
          </div>
        </div>

        <div className="builder-top-bar-right">
          <button className="btn btn-primary btn-top-bar" onClick={onBack}>
            <Swords size={16} /> <span>{t('common.equip')}</span>
          </button>
          <button
            className="btn btn-top-bar play-rulebook-btn"
            onClick={() => window.open(RULEBOOK_URL, '_blank')}
            title={t('play.rulebookTitle')}
          >
            <BookOpen size={16} /> <span>{t('play.rulebook')}</span>
          </button>
        </div>
      </div>

      <div className="play-layout">
        {/* Mobile Play Mode Header */}
        <div className="play-header">
          <button
            className="btn-sm play-header-back square-btn"
            onClick={onBack}
            title={t('play.backTitle')}
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="play-header-title">{t('play.title')}</h2>
          <button
            className="btn-sm square-btn hide-on-desktop push-end"
            onClick={() => window.open(RULEBOOK_URL, '_blank')}
            title={t('play.rulebookTitle')}
          >
            <BookOpen size={16} />
          </button>
        </div>

        {/* Army-wide resource totals (e.g. Casting/Dispel Dice) */}
        {play.extraResources.length > 0 && (
          <div className="play-resource-bar">
            {play.extraResources.map(res => (
              <span key={res.id} className="badge badge-muted">
                {res.total} {res.name}
              </span>
            ))}
          </div>
        )}

        {/* Active Units Roster Sheets */}
        <div className="play-category-list">
          {play.groups.map(group => (
            <div key={group.id} className="play-category-group">
              <h3 className="font-serif text-gold play-category-title">
                {group.name}
              </h3>
              <div className="play-units-grid">
                {group.selections.map(selection => (
                  <PlayUnitDetails
                    key={selection.id}
                    selection={selection}
                    system={system}
                    roster={play.roster}
                    costTypes={play.costTypes}
                    slots={play.report.slots}
                    getUnitCurrentWounds={play.getUnitCurrentWounds}
                    handleAdjustWound={play.adjustWound}
                    handleMouseEnter={play.showTooltip}
                    handleMouseLeave={play.hideTooltip}
                    setSaveSummaryData={play.setSaveSummaryData}
                    setSaveSummaryOpen={play.setSaveSummaryOpen}
                    onShowRule={play.showRule}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <BottomSheet
          isOpen={play.saveSummaryOpen}
          onClose={play.closeSaveSummary}
          title={play.saveSummaryData.title}
        >
          <div className="play-save-summary">
            {Array.isArray(play.saveSummaryData.breakdown) ? (
              play.saveSummaryData.breakdown.length > 0 ? (
                <ul className="breakdown-list breakdown-list--readable">
                  {play.saveSummaryData.breakdown.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-dim breakdown-empty-hint">{t('play.noModifiers')}</p>
              )
            ) : (
              play.saveSummaryData.breakdown
            )}
          </div>
        </BottomSheet>

        {/* Hover Tooltip for Desktop */}
        {play.tooltipState.visible && (
          <GothicTooltip title={play.tooltipState.title} x={play.tooltipState.x} y={play.tooltipState.y}>
            {Array.isArray(play.tooltipState.content) ? (
              <ul className="breakdown-list">
                {play.tooltipState.content.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              play.tooltipState.content
            )}
          </GothicTooltip>
        )}

        {play.activeRuleDialog && (
          <RulesIndexDialog
            ruleName={play.activeRuleDialog.ruleName}
            url={play.activeRuleDialog.url}
            isOpen={true}
            onClose={play.closeRuleDialog}
          />
        )}
      </div>
    </>
    </RosterReportProvider>
  );
}

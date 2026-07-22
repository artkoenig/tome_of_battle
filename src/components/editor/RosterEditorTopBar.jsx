import React from 'react';
import { Play, ArrowLeft, Download, Undo2, Redo2 } from 'lucide-react';
import { findForceEntryById } from '../../solver/validator';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Untertitel der Kopfleiste: der Katalogname, ergänzt um den Namen der
 * Kontingent-Definition, sofern der Katalog eine solche benennt. Ohne aufgelösten
 * Katalog bleibt der Untertitel leer.
 */
function formatCatalogueSubtitle(system, roster, activeCatalogue) {
  if (!activeCatalogue) return '';

  const forceDefinition = findForceEntryById(system, roster.forces?.[0]?.forceEntryId);
  const forceSuffix = forceDefinition ? ` (${forceDefinition.name})` : '';
  return `${activeCatalogue.name}${forceSuffix}`;
}

/**
 * Kopfleiste des Editors: Listenname und Herkunft, der mobile Punktestand sowie
 * die Aktionen Zurück, Rückgängig/Wiederherstellen, Spielen und Exportieren.
 */
export default function RosterEditorTopBar({
  roster,
  system,
  activeCatalogue,
  currentPoints,
  limitPoints,
  costTypeLabel,
  onBack,
  onPlay,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}) {
  const { t } = useTranslation();
  return (
    <div className="builder-top-bar">
      <button
        type="button"
        className="btn-primary square-btn mobile-only"
        onClick={onBack}
        title={t('app.nav.rosters')}
      >
        <ArrowLeft size={16} /> <span className="hide-on-mobile">{t('app.nav.rosters')}</span>
      </button>

      <div className="builder-top-bar-middle">
        <div className="builder-top-bar-title-section">
          <h2 className="builder-top-bar-title">{roster.name}</h2>
          <span className="builder-top-bar-subtitle">
            <span className="hide-on-mobile">{system.name} {activeCatalogue ? '· ' : ''}</span>
            {formatCatalogueSubtitle(system, roster, activeCatalogue)}
          </span>
        </div>

        {/* Points limit indicator */}
        <div className="mobile-points-indicator mobile-only">
          <span className="points-display builder-top-bar-title">
            {currentPoints}&nbsp;/ {limitPoints}
          </span>
          <span className="builder-top-bar-subtitle">
            {costTypeLabel}
          </span>
        </div>
      </div>

      <div className="builder-top-bar-actions">
        <button
          type="button"
          className="btn-secondary square-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title={t('editor.undo')}
          aria-label={t('editor.undo')}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          className="btn-secondary square-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title={t('editor.redo')}
          aria-label={t('editor.redo')}
        >
          <Redo2 size={16} />
        </button>
        <button className="btn-primary btn-top-bar hide-on-mobile" onClick={onPlay}>
          <Play size={16} /> <span>{t('common.play')}</span>
        </button>
        <button className="btn-secondary btn-top-bar hide-on-mobile" onClick={onExport}>
          <Download size={16} /> <span>{t('common.export')}</span>
        </button>
      </div>
    </div>
  );
}

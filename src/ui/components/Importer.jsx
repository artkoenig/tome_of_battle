import React from 'react';
import { Trash2, FileText, CheckCircle2, ShieldAlert, Download } from 'lucide-react';
import { useImporter } from '../viewmodels/useImporter';
import ConfirmationDialog from './editor/ConfirmationDialog';
import { useTranslation } from '../i18n/useTranslation';

/**
 * Der Import-Bildschirm — nur noch JSX (ADR-0038).
 *
 * Zustand, Meldungen und Revisionsanzeige kommen aus `useImporter`.
 *
 * @param {object} props
 * @param {object[]} [props.systems] die **eine** Systemliste der App
 *   (`useAppData`). Der Bildschirm liest sie nicht mehr selbst aus der
 *   Datenbank; eine zweite Liste konnte von der ersten abweichen.
 * @param {() => Promise<void>|void} [props.onSystemImported] runs after a system was stored.
 * @param {(message: string) => void} [props.onReportError] carries a failure to the app-wide
 *   channel. Needed because a completed import navigates away and unmounts this screen, so
 *   its own error area would take the message with it.
 * @param {boolean} [props.showAsEmptyState] renders the importer as the app's empty state
 *   when no system exists yet.
 */
export default function Importer({ systems = [], onSystemImported, onReportError, showAsEmptyState = false }) {
  const { t } = useTranslation();
  const importer = useImporter({ systems, onSystemImported, onReportError });
  const { bundle, loading } = importer;

  const renderBundleImporter = () => {
    if (!bundle.hasIndex) return null;

    return (
      <div className="gothic-panel bundle-importer-panel full-width">
        <h3 className="text-subheading">{t('importer.bundle.title')}</h3>
        <p className="text-dim text-body">
          {t('importer.bundle.description')}
        </p>

        <div className="bundle-form-group">
          <div className="bundle-form-group-header">
            <label className="text-label text-gold">{t('importer.bundle.systemLabel')}</label>
            {bundle.revisionDisplay && (
              <span
                className={importer.revisionLabelClassName(bundle.revisionDisplay.tone)}
                data-testid="selected-system-revision"
              >
                {bundle.revisionDisplay.text}
              </span>
            )}
          </div>
          <select
            value={importer.selectedBundleSysId}
            onChange={(e) => importer.selectSystem(e.target.value)}
            disabled={loading}
          >
            {importer.availableSystems.map(sys => (
              <option key={sys.id} value={sys.id}>{sys.name}</option>
            ))}
          </select>
        </div>

        {bundle.selectedSystem && (
          <div className="bundle-form-group">
            <div className="bundle-importer-header">
              <label className="text-label text-gold">{t('importer.bundle.cataloguesLabel', { count: bundle.selectedCount })}</label>
              <button
                type="button"
                className="btn-gold btn-sm"
                onClick={() => importer.toggleAllCatalogues(!bundle.allChecked)}
                disabled={loading}
              >
                {bundle.allChecked ? t('importer.bundle.deselectAll') : t('importer.bundle.selectAll')}
              </button>
            </div>
            <div className="bundle-catalog-list-container">
              {bundle.catalogues.map(cat => (
                <label key={cat.id} className="bundle-catalog-item-label">
                  <input
                    type="checkbox"
                    checked={cat.isSelected}
                    onChange={() => importer.toggleCatalogue(cat.id)}
                    disabled={loading}
                    aria-label={cat.name}
                  />
                  <span className="text-body">{cat.name}</span>
                  {cat.revisionDisplay && (
                    <span
                      className={importer.revisionLabelClassName(cat.revisionDisplay.tone)}
                      data-testid={`catalog-revision-${cat.id}`}
                    >
                      {cat.revisionDisplay.text}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="bundle-importer-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={importer.importSelectedBundle}
            disabled={loading || bundle.selectedCount === 0}
          >
            {t('common.import')}
          </button>
        </div>
      </div>
    );
  };

  // In the empty state the container is a centering flex row (.empty-state-wrapper).
  // The banners therefore belong inside the stacked layout below; as siblings of it
  // they would become a second flex item and squeeze the column beside the panel.
  const statusBanners = (
    <>
      {importer.error && (
        <div className="validation-error-item importer-status-banner importer-status-banner--error">
          <ShieldAlert className="text-danger" size={20} />
          <span className="text-danger">{importer.error}</span>
        </div>
      )}

      {importer.successMsg && (
        <div className="validation-error-item importer-status-banner importer-status-banner--success">
          <CheckCircle2 className="text-success" size={20} />
          <span className="text-success">{importer.successMsg}</span>
        </div>
      )}
    </>
  );

  return (
    <div className={`container ${showAsEmptyState ? 'empty-state-wrapper' : ''}`}>
      {!showAsEmptyState && statusBanners}

      {loading && (
        <div className="modal-overlay">
          <div className="loader-overlay-content">
            <div className="gothic-spinner" />
            <h3 className="text-subheading text-gold">{t('importer.loading.title')}</h3>
            <span className="text-body text-dim">{t('importer.loading.subtitle')}</span>
          </div>
        </div>
      )}

      {showAsEmptyState ? (
        <div className="empty-importer-layout">
          {statusBanners}

          <div className="empty-importer-text-center">
            <div className="empty-state-image empty-importer-image empty-importer-image-centered" />
            <h2 className="empty-state-title empty-state-title-large">{t('importer.empty.title')}</h2>
            <p className="empty-state-text text-dim">
              {t('importer.empty.text')}
            </p>
          </div>

          {renderBundleImporter()}
        </div>
      ) : (
        <div className="importer-layout">
          {renderBundleImporter()}
        </div>
      )}

      <input
        type="file"
        id="file-upload"
        className="is-hidden"
        accept=".zip"
        onChange={importer.pickUploadFile}
      />

      {!showAsEmptyState && (
        <div className="margin-top-md">
          <h2>{t('importer.installedTitle')}</h2>
          {importer.systems.length === 0 ? (
            <p className="text-dim importer-empty-hint">{t('importer.emptyListHint')}</p>
          ) : (
            <div className="imported-system-list">
              {importer.systems.map((sys) => (
                <div
                  key={sys.id}
                  className="catalog-item imported-system-item"
                >
                  <div className="imported-system-info">
                    <FileText className="text-gold no-shrink" size={24} />
                    <div className="flex-grow-truncating">
                      <h4 className="imported-system-name">
                        {sys.name}
                      </h4>
                      <span className="text-dim imported-system-catalogue-count">
                        {t('importer.factionCataloguesLoaded', { count: importer.catalogueCounts.get(sys.id) ?? 0 })}
                      </span>
                    </div>
                  </div>
                  <div className="imported-system-actions">
                    <button
                      className="btn-gold square-btn"
                      onClick={() => importer.exportSystem(sys)}
                      title={t('importer.exportSystemTitle')}
                    >
                      <Download size={16} />
                    </button>
                    <button
                      className="btn-danger square-btn"
                      onClick={() => importer.requestDelete(sys.id)}
                      title={t('importer.deleteSystemTitle')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Confirmation Dialog for deleting System */}
      <ConfirmationDialog
        isOpen={!!importer.systemToDelete}
        onClose={importer.cancelDelete}
        onConfirm={importer.confirmDelete}
        title={t('importer.deleteSystem.title')}
        message={
          <>
            {t('importer.deleteSystem.confirmPrefix')}<strong>{importer.systemToDelete?.name}</strong>{t('importer.deleteSystem.confirmSuffix')}
          </>
        }
        confirmLabel={t('common.delete')}
        isDanger={true}
      />
    </div>
  );
}

import React from 'react';
import SettingsDialog from './SettingsDialog';
import NewRosterModal from './editor/NewRosterModal';
import ConfirmationDialog from './editor/ConfirmationDialog';
import { useTranslation } from '../i18n/useTranslation';

/**
 * Bündelt die drei an der Wurzel gehosteten Dialoge (Einstellungen,
 * Neues-Roster-Modal, Lösch-Bestätigung) in einer reinen Präsentations-
 * komponente. Sie erhält ausschließlich Sichtbarkeits-Flags und Callbacks von
 * außen und hält keinen eigenen Zustand.
 *
 * **Kein Context/Provider** (ADR-0010): die Dialoge bleiben von außen gesteuert
 * und lokal an ihren jeweiligen Vorgang gebunden.
 */
export default function AppDialogs({
  isSettingsOpen,
  onCloseSettings,
  isNewRosterModalOpen,
  onCloseNewRosterModal,
  onCreateRoster,
  systems,
  rosterToDelete,
  onCancelRosterDeletion,
  onConfirmRosterDeletion,
}) {
  const { t } = useTranslation();
  return (
    <>
      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={onCloseSettings}
      />

      {/* New Roster Modal */}
      <NewRosterModal
        isOpen={isNewRosterModalOpen}
        onClose={onCloseNewRosterModal}
        onCreate={onCreateRoster}
        systems={systems}
      />

      {/* Confirmation Dialog for deleting Roster */}
      <ConfirmationDialog
        isOpen={!!rosterToDelete}
        onClose={onCancelRosterDeletion}
        onConfirm={onConfirmRosterDeletion}
        title={t('dashboard.deleteRoster.title')}
        message={
          <>
            {t('dashboard.deleteRoster.confirmPrefix')}<strong>{rosterToDelete?.name}</strong>{t('dashboard.deleteRoster.confirmSuffix')}
          </>
        }
        confirmLabel={t('common.delete')}
        isDanger={true}
      />
    </>
  );
}

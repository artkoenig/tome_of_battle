import React from 'react';
import { useRosterEditor } from '../viewmodels/useRosterEditor';
import { RosterCommandsProvider, RosterReportProvider } from '../viewmodels/rosterContexts';

import RosterEditorTopBar from './editor/RosterEditorTopBar';
import ForceEditorSection from './editor/ForceEditorSection';
import RosterSidebar from './editor/RosterSidebar';
import RulesIndexDialog from './RulesIndexDialog';

/**
 * Die Editor-Hülle — nur noch JSX (ADR-0038).
 *
 * Zustandsknoten, aktiver Katalog, Kosten-Anzeigen, Ausklapp-Zustand der
 * Listenregel-Gruppen und der Regel-Dialog kommen aus `useRosterEditor`; Bericht
 * und Kommandos gehen als Bündel in die beiden Kontexte, aus denen die
 * ViewModels der Blätter lesen.
 */
export default function RosterEditor({ system, roster: initialRoster, onBack, onPlay, onExportRoster, onReportError, isFreshRoster }) {
  const editor = useRosterEditor({
    system, initialRoster, onPlay, onExportRoster, onReportError, isFreshRoster,
  });

  return (
    <RosterCommandsProvider commands={editor.commands}>
      <RosterReportProvider
        report={editor.report}
        roster={editor.roster}
        system={system}
        activeCatalogue={editor.activeCatalogue}
      >
    <div className="builder-layout-container">
      <RosterEditorTopBar
        roster={editor.roster}
        system={system}
        activeCatalogue={editor.activeCatalogue}
        currentPoints={editor.currentPoints}
        limitPoints={editor.limitPoints}
        costTypeLabel={editor.costTypeLabel}
        onBack={onBack}
        onPlay={editor.playRoster}
        onExport={editor.exportRoster}
        onUndo={editor.undo}
        onRedo={editor.redo}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
      />

      <div className="builder-layout">
        <div className="builder-main active-mobile-tab">
          {/* Der Slot-Pfad eines Kontingents kommt aus der Zuordnung des
              Berichts (`pathByForceId`), nicht aus dem Schleifenindex: ein
              Kontingent, dessen Definition der Katalog nicht mehr kennt, hängt
              gar nicht im Auswertungsbaum, und jedes folgende liegt dann einen
              Index tiefer. Ein Kontingent ohne Pfad wird weiterhin gerendert —
              es zeigt dann keine Angebote und keine Kategorie-Grenzen (die
              Meldung „diese Auswahl gibt es im Katalog nicht mehr" nennt den
              Fall), statt dem Nutzer seine eigenen Daten zu verbergen. */}
          {editor.forces.map(({ force, forcePath }) => (
            <ForceEditorSection
              key={force.id}
              force={force}
              forcePath={forcePath}
              unitCardContext={editor.unitCardContext}
              ruleGroups={editor.ruleGroups}
              onShowRule={editor.showRule}
              onPlay={editor.playRoster}
            />
          ))}
        </div>

        {/* Desktop-only Validation Summary Sidebar */}
        {/* Die Armeeanforderungen gelten dem ERSTEN Kontingent; sein Slot-Pfad
            kommt aus derselben Zuordnung wie der der Sektionen, nie aus dem
            Eingabe-Index (Task 21). Fehlt das Kontingent im Bericht, weil seine
            Definition nicht auflöst, ist der Pfad `null` — dann zeigt die
            Seitenleiste keine Anforderungen statt der eines fremden Kontingents. */}
        <RosterSidebar className="desktop-only-sidebar" />

        {editor.activeRuleDialog && (
          <RulesIndexDialog
            ruleName={editor.activeRuleDialog.ruleName}
            url={editor.activeRuleDialog.url}
            isOpen={true}
            onClose={editor.closeRuleDialog}
          />
        )}
      </div>
    </div>
      </RosterReportProvider>
    </RosterCommandsProvider>
  );
}

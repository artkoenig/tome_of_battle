import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRosterState } from '../viewmodels/useRosterState';
import { RosterCommandsProvider, RosterReportProvider } from '../viewmodels/rosterContexts';
import { saveRoster } from '../db/database';
import { resolveCostLimitLabel } from '../roster';

import RosterEditorTopBar from './editor/RosterEditorTopBar';
import ForceEditorSection from './editor/ForceEditorSection';
import RosterSidebar from './editor/RosterSidebar';
import RulesIndexDialog from './RulesIndexDialog';
import { useRuleUrl } from '../hooks/useRuleUrl';

const ruleGroupKeyOf = (forceId, categoryId) => `${forceId}:${categoryId}`;

export default function RosterEditor({ system, roster: initialRoster, onBack, onPlay, onExportRoster, onReportError, isFreshRoster }) {
  // Der Zustandsknoten des Editors (ADR-0038): Bericht und Kommandos gehen als
  // Bündel in die beiden Kontexte, aus denen die ViewModels der Blätter lesen.
  const {
    roster,
    report,
    selectedRosterSelection,
    setSelectedRosterSelection,
    commands,
    canUndo,
    canRedo
  } = useRosterState(initialRoster, system, saveRoster, onReportError, isFreshRoster);
  const { costTotals, pathByForceId } = report;
  const { undo, redo } = commands;

  const [activeCatalogue, setActiveCatalogue] = useState(null);
  // Listenregel-Gruppen sind ausklappbar und **standardmäßig eingeklappt**. Wir
  // verfolgen daher die (pro force+Kategorie) ausdrücklich AUSGEKLAPPTEN Gruppen;
  // ein leeres Set bedeutet: alle eingeklappt.
  const [expandedRuleGroups, setExpandedRuleGroups] = useState(() => new Set());
  const isRuleGroupExpanded = useCallback(
    (forceId, categoryId) => expandedRuleGroups.has(ruleGroupKeyOf(forceId, categoryId)),
    [expandedRuleGroups]
  );
  const toggleRuleGroup = useCallback((forceId, categoryId) => {
    const groupKey = ruleGroupKeyOf(forceId, categoryId);
    setExpandedRuleGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
      return next;
    });
  }, []);
  // Ein Bündel statt zweier Props: die Sektion reicht es unverändert an ihre
  // Kategorie-Gruppen weiter und wertet es selbst nie aus.
  const ruleGroups = useMemo(
    () => ({ isExpanded: isRuleGroupExpanded, onToggle: toggleRuleGroup }),
    [isRuleGroupExpanded, toggleRuleGroup]
  );
  const resolveRuleUrl = useRuleUrl();

  // Holds the rule whose external index is currently shown, together with the URL
  // resolved at open time. Capturing the URL here (rather than re-resolving on each
  // render) keeps an already-open dialog intact when the setting is toggled off,
  // as required by the feature's out-of-scope note.
  const [activeRuleDialog, setActiveRuleDialog] = useState(null);

  const onShowRule = useCallback((ruleName) => {
    const ruleUrl = resolveRuleUrl(ruleName);
    if (!ruleUrl) return;
    setActiveRuleDialog({ ruleName, url: ruleUrl });
  }, [resolveRuleUrl]);

  const closeRulesDialog = useCallback(() => {
    setActiveRuleDialog(null);
  }, []);

  const costTypeLabel = resolveCostLimitLabel(roster, system);

  // Kosten-Anzeigen aus dem Bericht (Issue 0121, Task 7): der Ist-Stand ist die
  // roster-weite Kostensumme der Limit-Kostenart; die Extra-Ressourcen sind die
  // Nicht-Limit-Kostenarten mit Summe ≠ 0 (Kostenarten aus der
  // Datensatz-Beschreibung, `hidden` ausgeschlossen).
  const currentPoints = costTotals[roster.costLimitType] || 0;
  const limitPoints = roster.costLimit || 0;

  const playRoster = useCallback(() => onPlay(roster), [onPlay, roster]);
  const exportRoster = useCallback(() => onExportRoster?.(roster), [onExportRoster, roster]);

  // Was der Karte bleibt, seit ihr ViewModel den Bericht selbst liest: der
  // Auswahl-Zustand der Oberfläche und der Regel-Kanal.
  const unitCardContext = {
    selectedRosterSelection,
    setSelectedRosterSelection,
    costTypeLabel,
    onShowRule
  };

  // Resolve active catalogue definition
  useEffect(() => {
    if (system && roster) {
      const cat = system.catalogues.find(c => c.id === roster.catalogueId);
      setActiveCatalogue(cat);
    }
  }, [system, roster]);

  return (
    <RosterCommandsProvider commands={commands}>
      <RosterReportProvider report={report} roster={roster} system={system} activeCatalogue={activeCatalogue}>
    <div className="builder-layout-container">
      <RosterEditorTopBar
        roster={roster}
        system={system}
        activeCatalogue={activeCatalogue}
        currentPoints={currentPoints}
        limitPoints={limitPoints}
        costTypeLabel={costTypeLabel}
        onBack={onBack}
        onPlay={playRoster}
        onExport={exportRoster}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div className="builder-layout">
        <div className="builder-main active-mobile-tab">
          {/* Der Slot-Pfad eines Kontingents kommt aus der Zuordnung des
              Berichts (`pathByForceId`), nicht aus dem Schleifenindex: ein
              Kontingent, dessen Definition der Katalog nicht mehr kennt, hängt
              gar nicht im Auswertungsbaum, und jedes folgende liegt dann einen
              Index tiefer. Ein Kontingent ohne Pfad wird weiterhin gerendert —
              es zeigt dann keine Angebote und keine Kategorie-Grenzen (die
              Meldung „diese Auswahl gibt es im Katalog nicht mehr“ nennt den
              Fall), statt dem Nutzer seine eigenen Daten zu verbergen. */}
          {roster.forces.map(force => (
            <ForceEditorSection
              key={force.id}
              force={force}
              forcePath={pathByForceId?.get(force.id) ?? null}
              unitCardContext={unitCardContext}
              ruleGroups={ruleGroups}
              onShowRule={onShowRule}
              onPlay={playRoster}
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

        {activeRuleDialog && (
          <RulesIndexDialog
            ruleName={activeRuleDialog.ruleName}
            url={activeRuleDialog.url}
            isOpen={true}
            onClose={closeRulesDialog}
          />
        )}
      </div>
    </div>
      </RosterReportProvider>
    </RosterCommandsProvider>
  );
}

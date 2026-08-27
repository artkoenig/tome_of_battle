import React from 'react';
import { NewRosterModal } from 'army_builder';

// `systems` are imported Battlescribe data sets, each carrying the raw .gst/.cat
// XML that the view model parses to fill the catalogue, contingent and points
// fields. Parsing that XML is the rule engine's work and does not belong in a
// preview card, so the story shows the modal's own chrome in the state a user
// meets before any data set is imported: the form, its labels, and empty
// selects. The populated case is exercised in
// src/tests/ui/components/editor/NewRosterModal.evaluator.test.jsx.

const noop = () => {};

// Fixed overlay in a transformed card cell - see ConfirmationDialog.tsx.
const Stage = ({ children }: { children: React.ReactNode }) => (
  <div style={{ height: 680 }}>{children}</div>
);

export const NoDataSets = () => (
  <Stage>
    <NewRosterModal isOpen onClose={noop} onCreate={noop} systems={[]} />
  </Stage>
);

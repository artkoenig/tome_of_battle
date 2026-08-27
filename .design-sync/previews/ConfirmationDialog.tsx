import React from 'react';
import { ConfirmationDialog } from 'army_builder';

// `isOpen` gates the whole render - closed, the component returns nothing, so
// every story opens it. `isDanger` is the variant axis: it is what separates a
// destructive confirmation from an ordinary one.
//
// The overlay is `position: fixed`, and the preview card puts a `transform` on
// the cell - which makes that cell, not the viewport, the containing block. A
// cell only as tall as its content therefore centres the dialog around its own
// midpoint and clips the header off the top, so each story stands on an
// explicit stage tall enough to hold the whole dialog.

const noop = () => {};

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div style={{ height: 340 }}>{children}</div>
);

export const Destructive = () => (
  <Stage><ConfirmationDialog
    isOpen
    onClose={noop}
    onConfirm={noop}
    title="Delete roster"
    message={'„Host of Lothern“ and all of its units will be removed. This cannot be undone.'}
    confirmLabel="Delete"
    cancelLabel="Keep"
    isDanger
  /></Stage>
);

export const Ordinary = () => (
  <Stage><ConfirmationDialog
    isOpen
    onClose={noop}
    onConfirm={noop}
    title="Leave the editor?"
    message="Unsaved changes to this detachment will be kept in the browser and restored next time."
    confirmLabel="Leave"
    cancelLabel="Stay"
  /></Stage>
);

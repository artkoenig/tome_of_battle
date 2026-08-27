import React from 'react';
import { BottomSheet } from 'army_builder';

// `desktopMode` is the variant axis: the same sheet is a popover anchored in
// place or a centred modal. Below the mobile breakpoint both render as a sheet
// docked to the bottom edge. Closed, the component renders nothing, so every
// story opens it.

// The sheet is `position: fixed`; the preview card's `transform` on the cell
// makes that cell the containing block, so each story stands on an explicit
// stage tall enough to hold the sheet instead of clipping it.
const noop = () => {};

const Stage = ({ children }: { children: React.ReactNode }) => (
  <div style={{ height: 300 }}>{children}</div>
);

const Upgrades = () => (
  <div className="upgrade-details">
    <p>Sword Master of Hoeth — 13 pts</p>
    <p>Standard Bearer — 10 pts</p>
    <p>Musician — 5 pts</p>
  </div>
);

export const Popover = () => (
  <Stage><BottomSheet isOpen onClose={noop} title="Command group" desktopMode="popover">
    <Upgrades />
  </BottomSheet></Stage>
);

export const Modal = () => (
  <Stage><BottomSheet isOpen onClose={noop} title="Command group" desktopMode="modal">
    <Upgrades />
  </BottomSheet></Stage>
);

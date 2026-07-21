import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RosterEditorTopBar from './RosterEditorTopBar';

vi.mock('lucide-react', () => ({
  Play: () => <span data-testid="icon-play" />,
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Download: () => <span data-testid="icon-download" />,
  Undo2: () => <span data-testid="icon-undo" />,
  Redo2: () => <span data-testid="icon-redo" />
}));

vi.mock('../../solver/validator', () => ({
  findForceEntryById: (system, id) => system?.forceEntries?.find(fe => fe.id === id) || null
}));

const system = {
  name: 'Warhammer',
  forceEntries: [{ id: 'fe-1', name: 'Heerbann' }]
};

const roster = {
  name: 'Bretonische Kreuzfahrer',
  forces: [{ id: 'force-1', forceEntryId: 'fe-1' }]
};

const renderTopBar = (props = {}) => render(
  <RosterEditorTopBar
    roster={roster}
    system={system}
    activeCatalogue={{ id: 'bret-cat', name: 'Bretonia' }}
    currentPoints={420}
    limitPoints={1000}
    costTypeLabel="Pkt."
    onBack={vi.fn()}
    onPlay={vi.fn()}
    onExport={vi.fn()}
    onUndo={vi.fn()}
    onRedo={vi.fn()}
    canUndo={false}
    canRedo={false}
    {...props}
  />
);

const subtitleTextOf = (container) =>
  container.querySelector('.builder-top-bar-subtitle').textContent.replace(/\s+/g, ' ').trim();

describe('RosterEditorTopBar', () => {
  it('zeigt Listennamen und Punktestand', () => {
    const { container } = renderTopBar();

    expect(screen.getByText('Bretonische Kreuzfahrer')).toBeDefined();
    expect(container.querySelector('.mobile-points-indicator').textContent.replace(/\s+/g, ' ').trim())
      .toBe('420 / 1000Pkt.');
  });

  it('ergänzt den Katalognamen um die benannte Kontingent-Definition', () => {
    const { container } = renderTopBar();

    expect(subtitleTextOf(container)).toBe('Warhammer · Bretonia (Heerbann)');
  });

  it('lässt den Klammerzusatz weg, wenn der Katalog keine Kontingent-Definition benennt', () => {
    const { container } = renderTopBar({
      roster: { ...roster, forces: [{ id: 'force-1', forceEntryId: 'unbekannt' }] }
    });

    expect(subtitleTextOf(container)).toBe('Warhammer · Bretonia');
  });

  it('lässt den Untertitel leer, solange kein Katalog aufgelöst ist', () => {
    const { container } = renderTopBar({ activeCatalogue: null });

    expect(subtitleTextOf(container)).toBe('Warhammer');
  });

  it('sperrt Rückgängig und Wiederherstellen ohne Verlauf', () => {
    renderTopBar();

    expect(screen.getByLabelText('Rückgängig').disabled).toBe(true);
    expect(screen.getByLabelText('Wiederherstellen').disabled).toBe(true);
  });

  it('löst Rückgängig und Wiederherstellen aus, sobald Verlauf vorliegt', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    renderTopBar({ canUndo: true, canRedo: true, onUndo, onRedo });

    fireEvent.click(screen.getByLabelText('Rückgängig'));
    fireEvent.click(screen.getByLabelText('Wiederherstellen'));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it('meldet Zurück, Spielen und Exportieren an die jeweilige Aktion', () => {
    const onBack = vi.fn();
    const onPlay = vi.fn();
    const onExport = vi.fn();
    renderTopBar({ onBack, onPlay, onExport });

    fireEvent.click(screen.getByTitle('Heerlager'));
    fireEvent.click(screen.getByText('Spielen'));
    fireEvent.click(screen.getByText('Exportieren'));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NewRosterModal from './NewRosterModal';

// Bibliothekskataloge (catalogue@library) liefern nur geteilte Einträge und sind
// keine spielbare Armee. Die Fraktionsauswahl darf sie deshalb nicht anbieten.

const forceEntry = { id: 'force-1', name: 'Patrol' };

const buildSystem = (catalogues) => ({
  id: 'sys-1',
  name: 'Test System',
  costTypes: [{ id: 'pts', name: 'Points' }],
  catalogues,
});

const libraryCatalogue = { id: 'cat-library', name: 'Shared Library', isLibrary: true, forceEntries: [forceEntry] };
const factionCatalogue = { id: 'cat-faction', name: 'Faction', isLibrary: false, forceEntries: [forceEntry] };
const unflaggedCatalogue = { id: 'cat-legacy', name: 'Legacy Faction', forceEntries: [forceEntry] };

const renderModal = (systems) =>
  render(<NewRosterModal isOpen onClose={vi.fn()} onCreate={vi.fn()} systems={systems} />);

const catalogueSelect = () =>
  screen.getByText('Katalog / Fraktion').closest('.form-field').querySelector('select');

const catalogueOptionNames = () =>
  Array.from(catalogueSelect().querySelectorAll('option'))
    .filter(option => !option.disabled)
    .map(option => option.textContent);

describe('NewRosterModal Fraktionsauswahl', () => {
  it('bietet als Bibliothek gekennzeichnete Kataloge nicht an', () => {
    renderModal([buildSystem([libraryCatalogue, factionCatalogue])]);

    expect(catalogueOptionNames()).toEqual(['Faction']);
  });

  it('wählt einen spielbaren Katalog vor, auch wenn eine Bibliothek zuerst steht', () => {
    renderModal([buildSystem([libraryCatalogue, factionCatalogue])]);

    expect(catalogueSelect().value).toBe('cat-faction');
  });

  it('bietet einen Katalog ohne Bibliothekskennzeichnung weiterhin an', () => {
    renderModal([buildSystem([unflaggedCatalogue])]);

    expect(catalogueOptionNames()).toEqual(['Legacy Faction']);
    expect(catalogueSelect().value).toBe('cat-legacy');
  });

  it('deaktiviert die Auswahl, wenn das System nur Bibliothekskataloge enthält', () => {
    renderModal([buildSystem([libraryCatalogue])]);

    expect(catalogueOptionNames()).toEqual([]);
    expect(catalogueSelect().disabled).toBe(true);
  });
});

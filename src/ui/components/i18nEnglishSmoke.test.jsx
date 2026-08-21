import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RosterDashboard from './RosterDashboard';
import NewRosterModal from './editor/NewRosterModal';
import { setActiveLanguage } from '../i18n/i18nStore';

// A smoke test that central views render in English once the UI language is
// switched (ADR 0026). The global test setup pins German before every test, so
// each case opts into English explicitly and the afterEach restores the pin.
// Real icon components render fine in jsdom, so nothing is mocked here.

describe('English UI rendering', () => {
  afterEach(() => {
    setActiveLanguage('de');
  });

  it('renders the empty roster dashboard in English', () => {
    setActiveLanguage('en');
    render(<RosterDashboard rosters={[]} systems={[]} onNewRoster={() => {}} />);

    expect(screen.getByText('The armouries are empty')).toBeDefined();
    expect(screen.getByText('Raise your first army list')).toBeDefined();
  });

  it('renders the new-roster modal in English', () => {
    setActiveLanguage('en');
    render(
      <NewRosterModal isOpen onClose={() => {}} onCreate={() => {}} systems={[]} />
    );

    expect(screen.getByText('Raise a New Army')).toBeDefined();
    expect(screen.getByText('Army name')).toBeDefined();
  });
});

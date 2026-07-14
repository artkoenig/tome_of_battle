import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RulesIndexDialog from './RulesIndexDialog';

describe('RulesIndexDialog', () => {
  const defaultProps = {
    ruleName: 'Regeneration',
    url: 'https://6th.whfb.app/special-rules/regeneration?minimal=true',
    isOpen: false,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('does not render when closed', () => {
    const { container } = render(<RulesIndexDialog {...defaultProps} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when open', () => {
    render(<RulesIndexDialog {...defaultProps} isOpen={true} />);
    expect(screen.getByText('Regeneration')).toBeTruthy();
    expect(screen.getByTitle('Schließen')).toBeTruthy();
    expect(screen.getByTitle('Regeneration')).toBeTruthy();
  });

  it('renders the iframe with the correct URL', () => {
    render(<RulesIndexDialog {...defaultProps} isOpen={true} />);
    const iframe = screen.getByTitle('Regeneration');
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.getAttribute('src')).toBe('https://6th.whfb.app/special-rules/regeneration?minimal=true');
  });

  it('shows loading spinner initially', () => {
    render(<RulesIndexDialog {...defaultProps} isOpen={true} />);
    expect(screen.getByText('Lade Regeltext...')).toBeTruthy();
  });

  it('hides loading spinner after iframe loads', async () => {
    render(<RulesIndexDialog {...defaultProps} isOpen={true} />);
    const iframe = screen.getByTitle('Regeneration');
    fireEvent.load(iframe);
    await waitFor(() => {
      expect(screen.queryByText('Lade Regeltext...')).toBeNull();
    });
  });

  it('calls onClose when clicking the backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(
      <RulesIndexDialog {...defaultProps} isOpen={true} onClose={onClose} />
    );
    const overlay = container.querySelector('.modal-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the dialog content', () => {
    const onClose = vi.fn();
    render(<RulesIndexDialog {...defaultProps} isOpen={true} onClose={onClose} />);
    const header = screen.getByText('Regeneration');
    fireEvent.click(header);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when clicking the close button', () => {
    const onClose = vi.fn();
    render(<RulesIndexDialog {...defaultProps} isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByTitle('Schließen'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing Escape', () => {
    const onClose = vi.fn();
    render(<RulesIndexDialog {...defaultProps} isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape when closed', () => {
    const onClose = vi.fn();
    render(<RulesIndexDialog {...defaultProps} isOpen={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('locks body scroll when open and restores on close', () => {
    const { rerender } = render(<RulesIndexDialog {...defaultProps} isOpen={true} />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<RulesIndexDialog {...defaultProps} isOpen={false} />);
    expect(document.body.style.overflow).toBe('');
  });

  it('resets loading state when reopened', () => {
    const { rerender } = render(<RulesIndexDialog {...defaultProps} isOpen={true} />);
    const iframe = screen.getByTitle('Regeneration');
    fireEvent.load(iframe);
    expect(screen.queryByText('Lade Regeltext...')).toBeNull();

    rerender(<RulesIndexDialog {...defaultProps} isOpen={false} />);
    rerender(<RulesIndexDialog {...defaultProps} isOpen={true} />);
    expect(screen.getByText('Lade Regeltext...')).toBeTruthy();
  });
});

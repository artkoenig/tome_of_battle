import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PreviewBadge from './PreviewBadge';

const isPreviewHostMock = vi.fn();
vi.mock('../utils/previewHost.js', () => ({
  isPreviewHost: (...args) => isPreviewHostMock(...args),
}));

describe('PreviewBadge', () => {
  it('rendert das Preview-Label, wenn der Hostname als Preview erkannt wird', () => {
    isPreviewHostMock.mockReturnValue(true);
    render(<PreviewBadge />);
    expect(screen.getByText('Preview')).toBeTruthy();
  });

  it('rendert nichts, wenn der Hostname nicht als Preview erkannt wird', () => {
    isPreviewHostMock.mockReturnValue(false);
    render(<PreviewBadge />);
    expect(screen.queryByText('Preview')).toBeNull();
  });
});

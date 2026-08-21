import { describe, test, expect } from 'vitest';
import { isPreviewHost, PREVIEW_HOSTNAME } from './previewHost.js';

describe('isPreviewHost', () => {
  test('erkennt die bekannte Preproduction-Alias-URL', () => {
    expect(isPreviewHost(PREVIEW_HOSTNAME)).toBe(true);
  });

  test('erkennt die echte Produktions-Domain nicht als Preview', () => {
    expect(isPreviewHost('army-builder.vercel.app')).toBe(false);
  });

  test('erkennt andere Hostnamen (z. B. localhost) nicht als Preview', () => {
    expect(isPreviewHost('localhost')).toBe(false);
  });
});

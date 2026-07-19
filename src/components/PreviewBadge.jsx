import React from 'react';
import { isPreviewHost } from '../utils/previewHost.js';

export default function PreviewBadge() {
  if (!isPreviewHost(window.location.hostname)) return null;

  return (
    <span
      className="preview-badge"
      title="Dies ist die Preproduction-Instanz, nicht die Live-App."
    >
      Preview
    </span>
  );
}

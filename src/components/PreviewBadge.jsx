import React from 'react';
import { useTranslation } from 'react-i18next';
import { isPreviewHost } from '../utils/previewHost.js';

export default function PreviewBadge() {
  const { t } = useTranslation();
  if (!isPreviewHost(window.location.hostname)) return null;

  return (
    <span
      className="preview-badge"
      title={t('previewBadge.title')}
    >
      Preview
    </span>
  );
}

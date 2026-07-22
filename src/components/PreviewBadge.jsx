import React from 'react';
import { isPreviewHost } from '../utils/previewHost.js';
import { useTranslation } from '../i18n/useTranslation';

export default function PreviewBadge() {
  const { t } = useTranslation();
  if (!isPreviewHost(window.location.hostname)) return null;

  return (
    <span
      className="preview-badge"
      title={t('preview.title')}
    >
      Preview
    </span>
  );
}

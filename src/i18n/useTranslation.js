import { useSyncExternalStore } from 'react';
import { subscribeToLanguage, getLanguage, t } from './i18nStore';
import { changeLanguage } from './languageController';

/**
 * React binding for the i18n store. Re-renders the calling component whenever
 * the active UI language changes, so a switch takes effect immediately without
 * a reload.
 * @returns {{ t: typeof t, language: string, changeLanguage: (language: string) => void }}
 */
export function useTranslation() {
  const language = useSyncExternalStore(subscribeToLanguage, getLanguage, getLanguage);
  return { t, language, changeLanguage };
}

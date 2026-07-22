import { beforeEach } from 'vitest';
import { setActiveLanguage } from '../i18n/i18nStore';

// Global test-language pin (ADR 0026). The i18n store's default is English, and
// jsdom reports an English navigator, so without pinning every component would
// render in English and the existing German assertions would fail. Pinning to
// German before each test keeps those assertions valid; a test that exercises
// English rendering opts in explicitly by switching the language itself.
const TEST_LANGUAGE = 'de';

setActiveLanguage(TEST_LANGUAGE);

beforeEach(() => {
  setActiveLanguage(TEST_LANGUAGE);
});

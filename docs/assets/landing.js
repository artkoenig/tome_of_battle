/*
 * Bilingual (German/English) switching for the static landing page.
 *
 * The page is a plain static file with no build step and no ties to the app's
 * i18n module. English is the canonical source and lives directly in the served
 * markup, so it is never duplicated here: on load the English baseline is
 * captured from the DOM, and only the German translations are held below. A
 * missing German key therefore falls back to the English text automatically.
 *
 * Language selection on first visit follows the browser language (German when a
 * preferred language starts with "de", English otherwise). A manual choice via
 * the header toggle overrides that and is persisted locally, separate from the
 * app's own language choice.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'tob-landing-lang';
  const GERMAN = 'de';
  const ENGLISH = 'en';
  const SUPPORTED_LANGUAGES = [GERMAN, ENGLISH];

  const TEXT_ATTRIBUTE = 'data-i18n';
  const HTML_ATTRIBUTE = 'data-i18n-html';
  const ACTIVE_TOGGLE_CLASS = 'is-active';

  /** German translations for plain-text nodes, keyed by their data-i18n value. */
  const GERMAN_TEXT = Object.freeze({
    'nav-features': 'Funktionen',
    'nav-mobile': 'Mobile Ansicht',
    'nav-status': 'Projektstatus',
    'hero-badge': 'ᛉ Tabletop-Armee-Begleiter',
    'hero-subtitle':
      'Stelle deine Tabletop-Armeen mühelos zusammen, passe sie an und verwalte sie – mit sofortiger Punkteberechnung und vollem Offline-Zugriff auf jedem Gerät.',
    'hero-cta-primary': 'Roster erstellen',
    'hero-cta-secondary': 'Quellcode auf GitHub',
    'features-eyebrow': 'Von Tabletop-Spielern für Tabletop-Spieler',
    'features-title': 'Gebaut für Tempo & Komfort',
    'feature-offline-title': 'Installieren & offline nutzen',
    'feature-offline-desc':
      'Installiere die App direkt auf Smartphone oder Desktop. Öffne und bearbeite all deine Armeelisten zu 100 % offline an jedem Spieltisch.',
    'feature-catalogs-title': 'Vorinstallierte Armee-Kataloge',
    'feature-catalogs-desc':
      'Spielsysteme und Armee-Kataloge sind von Haus aus vorinstalliert – kein mühsames manuelles Einrichten, keine komplizierte Konfiguration nötig.',
    'feature-validation-title': 'Starke Regel-Validierung',
    'feature-validation-desc':
      'Ein Echtzeit-Constraint-Solver prüft beim Bauen automatisch Punktegrenzen, Kategorie-Anforderungen und Einheiten-Beschränkungen.',
    'feature-integration-title': 'Direkte 6th.whfb.app-Anbindung',
    'showcase-eyebrow': 'Für Smartphones optimiert',
    'showcase-title': 'Bereit am Spieltisch',
    'showcase-caption-1': '1. Spielsystem & Fraktion wählen',
    'showcase-caption-2': '2. Einheiten & Ausrüstung anpassen',
    'showcase-caption-3': '3. Wunden im Spielmodus verfolgen',
    'status-title': 'Transparent & Open Source',
    'status-desc':
      'Sieh dir Testabdeckung, Qualitäts-Gates, offene Issues und Repository-Statistiken in Echtzeit auf unserem automatischen Projektstatus-Dashboard an.',
    'status-cta': 'Projektstatus ansehen',
    'footer-copy': '© 2026 Tome of Battle – Open-Source-Armeebuilder für Tabletop',
    'footer-license': 'Lizenz',
    'footer-status': 'Statusbericht',
  });

  /** German translations for nodes whose content is HTML (links, line breaks). */
  const GERMAN_HTML = Object.freeze({
    'hero-title': 'Schmiede deine Legende<br>Bau deine ultimative Armee',
    'feature-integration-desc':
      'Klicke in deinen Einheitenkarten auf eine Sonderregel oder einen Gegenstand, um sofort die vollständigen offiziellen Regeltexte, Errata und Zauber auf <a href="https://6th.whfb.app/" target="_blank" rel="noopener" style="color: var(--accent-gold-bright); text-decoration: underline;">6th.whfb.app</a> zu öffnen.',
  });

  /** German translations for the document title and meta description. */
  const GERMAN_META = Object.freeze({
    title: 'Tome of Battle — Hochfantasy-Armeebuilder',
    description:
      'Tome of Battle ist ein moderner, offline-fähiger Armeebuilder für Tabletop-Wargaming-Spieler.',
  });

  const textElements = Array.from(document.querySelectorAll('[' + TEXT_ATTRIBUTE + ']'));
  const htmlElements = Array.from(document.querySelectorAll('[' + HTML_ATTRIBUTE + ']'));
  const toggleButtons = Array.from(document.querySelectorAll('[data-lang]'));
  const descriptionMeta = document.querySelector('meta[name="description"]');

  // Capture the English baseline from the served markup — the single source for
  // English, so it is not restated in the dictionaries above.
  const englishText = captureContent(textElements, TEXT_ATTRIBUTE, (el) => el.textContent);
  const englishHtml = captureContent(htmlElements, HTML_ATTRIBUTE, (el) => el.innerHTML);
  const englishMeta = Object.freeze({
    title: document.title,
    description: descriptionMeta ? descriptionMeta.getAttribute('content') : '',
  });

  function captureContent(elements, attribute, read) {
    const baseline = {};
    elements.forEach((element) => {
      baseline[element.getAttribute(attribute)] = read(element);
    });
    return baseline;
  }

  function readStoredLanguage() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function persistLanguage(language) {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Persistence is a convenience; a blocked storage must not break switching.
    }
  }

  function prefersGerman() {
    const candidates =
      navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    return candidates.some(
      (language) => typeof language === 'string' && language.toLowerCase().startsWith(GERMAN),
    );
  }

  function detectInitialLanguage() {
    const stored = readStoredLanguage();
    if (SUPPORTED_LANGUAGES.includes(stored)) return stored;
    return prefersGerman() ? GERMAN : ENGLISH;
  }

  function applyLanguage(language) {
    const isGerman = language === GERMAN;
    document.documentElement.lang = language;

    textElements.forEach((element) => {
      const key = element.getAttribute(TEXT_ATTRIBUTE);
      element.textContent = isGerman ? GERMAN_TEXT[key] ?? englishText[key] : englishText[key];
    });
    htmlElements.forEach((element) => {
      const key = element.getAttribute(HTML_ATTRIBUTE);
      element.innerHTML = isGerman ? GERMAN_HTML[key] ?? englishHtml[key] : englishHtml[key];
    });

    document.title = isGerman ? GERMAN_META.title : englishMeta.title;
    if (descriptionMeta) {
      descriptionMeta.setAttribute('content', isGerman ? GERMAN_META.description : englishMeta.description);
    }

    updateToggle(language);
  }

  function updateToggle(activeLanguage) {
    toggleButtons.forEach((button) => {
      const isActive = button.getAttribute('data-lang') === activeLanguage;
      button.classList.toggle(ACTIVE_TOGGLE_CLASS, isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function selectLanguage(language) {
    if (!SUPPORTED_LANGUAGES.includes(language)) return;
    applyLanguage(language);
    persistLanguage(language);
  }

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => selectLanguage(button.getAttribute('data-lang')));
  });

  applyLanguage(detectInitialLanguage());
})();

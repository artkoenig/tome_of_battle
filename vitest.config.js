import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Pin the UI language to German before every test so assertions written
    // against the German UI stay valid regardless of the jsdom navigator
    // language (ADR 0026).
    setupFiles: ['./src/test-utils/i18nTestSetup.js'],
    // `.claude/worktrees/` (Agenten-Harness) und `.worktrees/` (Projektkonvention)
    // liegen innerhalb des Repos und enthalten vollstaendige Arbeitskopien. Ohne
    // Ausschluss zaehlt jeder Lauf im Hauptcheckout die Testdateien aller offenen
    // Worktrees mit, wodurch jede Testzahl waehrend paralleler Arbeit wertlos wird.
    exclude: ['**/ui.test.js', 'node_modules/**', 'dist/**', '**/.claude/**', '**/.worktrees/**'],
  },
})

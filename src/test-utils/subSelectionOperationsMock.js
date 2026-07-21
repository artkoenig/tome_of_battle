import { vi } from 'vitest';

/**
 * Attrappe des Operationen-Bündels, das `useRoster` der Editor-Oberfläche
 * reicht. Komponententests prüfen damit, *welche* benannte Operation eine
 * Interaktion auslöst — statt einen Aktions-String zu vergleichen.
 */
export const createSubSelectionOperationsMock = () => ({
  addInstance: vi.fn(),
  removeInstance: vi.fn(),
  increaseCount: vi.fn(),
  decreaseCount: vi.fn()
});

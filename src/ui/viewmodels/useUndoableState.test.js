import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoableState } from './useUndoableState';

describe('useUndoableState Hook', () => {
  it('initializes with the given state and no history', () => {
    const { result } = renderHook(() => useUndoableState('a'));

    expect(result.current.state).toBe('a');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('setState updates the state and enables undo', () => {
    const { result } = renderHook(() => useUndoableState('a'));

    act(() => {
      result.current.setState('b');
    });

    expect(result.current.state).toBe('b');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('setState accepts an updater function receiving the current state', () => {
    const { result } = renderHook(() => useUndoableState(1));

    act(() => {
      result.current.setState(prev => prev + 1);
    });

    expect(result.current.state).toBe(2);
  });

  it('undo restores the previous state and enables redo', () => {
    const { result } = renderHook(() => useUndoableState('a'));

    act(() => {
      result.current.setState('b');
    });
    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toBe('a');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redo restores the state that was undone', () => {
    const { result } = renderHook(() => useUndoableState('a'));

    act(() => {
      result.current.setState('b');
    });
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toBe('b');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undo is a no-op when there is no history', () => {
    const { result } = renderHook(() => useUndoableState('a'));

    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toBe('a');
    expect(result.current.canUndo).toBe(false);
  });

  it('redo is a no-op when there is no future', () => {
    const { result } = renderHook(() => useUndoableState('a'));

    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toBe('a');
    expect(result.current.canRedo).toBe(false);
  });

  it('a new setState after undo discards the redo history', () => {
    const { result } = renderHook(() => useUndoableState('a'));

    act(() => {
      result.current.setState('b');
    });
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.setState('c');
    });

    expect(result.current.state).toBe('c');
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toBe('a');
  });

  it('supports an unbounded number of undo steps', () => {
    const { result } = renderHook(() => useUndoableState(0));

    for (let i = 1; i <= 100; i++) {
      act(() => {
        result.current.setState(i);
      });
    }

    for (let i = 100; i >= 1; i--) {
      expect(result.current.state).toBe(i);
      act(() => {
        result.current.undo();
      });
    }

    expect(result.current.state).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  it('replace updates the state without creating an undo step', () => {
    const { result } = renderHook(() => useUndoableState('a'));

    act(() => {
      result.current.setState('b');
    });
    act(() => {
      result.current.replace('b-corrected');
    });

    expect(result.current.state).toBe('b-corrected');
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });

    // Der Undo-Schritt springt zum Stand vor 'b', nicht zu 'b' selbst –
    // 'replace' hat keinen eigenen Historieneintrag erzeugt.
    expect(result.current.state).toBe('a');
  });

  it('replace does not clear an existing redo history', () => {
    const { result } = renderHook(() => useUndoableState('a'));

    act(() => {
      result.current.setState('b');
    });
    act(() => {
      result.current.undo();
    });
    act(() => {
      result.current.replace('a-corrected');
    });

    expect(result.current.canRedo).toBe(true);
    act(() => {
      result.current.redo();
    });
    expect(result.current.state).toBe('b');
  });
});

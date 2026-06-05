import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Undo/redo state container.
 * `set` accepts either a new value or an updater fn, and records a snapshot.
 * Rapid successive edits (e.g. typing) are coalesced via the `coalesce` flag.
 */
export function useHistory(initial) {
  const [present, setPresent] = useState(initial);
  const past = useRef([]);
  const future = useRef([]);
  const lastCoalesceKey = useRef(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const set = useCallback((updater, coalesceKey = null) => {
    setPresent((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next === prev) return prev;

      // Coalesce consecutive edits sharing a key (e.g. typing in one cell).
      const sameAsLast =
        coalesceKey != null && coalesceKey === lastCoalesceKey.current;
      if (!sameAsLast) {
        past.current.push(prev);
        if (past.current.length > 200) past.current.shift();
      }
      lastCoalesceKey.current = coalesceKey;
      future.current = [];
      return next;
    });
    rerender();
  }, []);

  const undo = useCallback(() => {
    setPresent((prev) => {
      if (past.current.length === 0) return prev;
      const previous = past.current.pop();
      future.current.unshift(prev);
      lastCoalesceKey.current = null;
      return previous;
    });
    rerender();
  }, []);

  const redo = useCallback(() => {
    setPresent((prev) => {
      if (future.current.length === 0) return prev;
      const next = future.current.shift();
      past.current.push(prev);
      lastCoalesceKey.current = null;
      return next;
    });
    rerender();
  }, []);

  // Break coalescing when the user pauses (so the next edit is a fresh step).
  const breakCoalesce = useCallback(() => {
    lastCoalesceKey.current = null;
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (mod && e.key.toLowerCase() === "z" && e.shiftKey) ||
        (mod && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return {
    state: present,
    set,
    undo,
    redo,
    breakCoalesce,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}

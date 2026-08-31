"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Browser-only values without a mount effect.
 *
 * `useSyncExternalStore` is the supported way to read something that exists
 * only on the client: the server snapshot renders first, then React swaps in
 * the real value without a setState-in-effect cascade.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

/** A boolean persisted in localStorage, shared across components. */
export function useLocalFlag(key: string, fallback = false): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        const stored = localStorage.getItem(key);
        return stored === null ? fallback : stored === "1";
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );

  const set = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* storage unavailable — the value simply does not persist */
      }
      emit();
    },
    [key],
  );

  return [value, set];
}

const isMacServerSnapshot = false;

/** True on Apple platforms, for rendering the right modifier key. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => isMacServerSnapshot,
  );
}

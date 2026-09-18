/* NULL · store.ts
   One tiny persisted store, used for everything the site remembers:
   preferences, the economy, the account, the open tabs. Values live in
   localStorage under `null:<key>` and React reads them through
   useSyncExternalStore, so a write anywhere re-renders everywhere without
   any provider wiring. */

import { useSyncExternalStore } from "react";

export type Patch<T> = Partial<T> | ((prev: T) => Partial<T>);

export type Store<T extends object> = {
  key: string;
  get: () => T;
  set: (patch: Patch<T>) => T;
  /** Take one key out. `set` merges, which means a key left out of a patch is
   *  kept — so a record copied, minus a key, puts that key straight back and
   *  nothing is ever actually removed. Deleting a member account needs a real
   *  removal, which is what this is. */
  del: (key: keyof T) => T;
  subscribe: (fn: () => void) => () => void;
  reset: () => void;
};

function read<T extends object>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(`null:${key}`);
    if (!raw) return initial;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return initial;
    /* shallow merge so a new field added in a later version still gets its
       default on a browser that already has older data stored */
    return { ...initial, ...(parsed as T) };
  } catch {
    return initial;
  }
}

export function createStore<T extends object>(key: string, initial: T): Store<T> {
  let state = read(key, initial);
  const subs = new Set<() => void>();

  const write = (next: T) => {
    state = next;
    try {
      localStorage.setItem(`null:${key}`, JSON.stringify(state));
    } catch {
      /* private mode or a full quota: the session still works, it just will
         not survive a reload */
    }
    subs.forEach((fn) => fn());
  };

  return {
    key,
    get: () => state,
    set(patch) {
      const part = typeof patch === "function" ? patch(state) : patch;
      write({ ...state, ...part });
      return state;
    },
    del(key) {
      const next = { ...state };
      delete next[key];
      write(next);
      return state;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
    reset() {
      write(initial);
    },
  };
}

/** Subscribe a component to a whole store. */
export function useStore<T extends object>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Subscribe a component to one derived slice, which must be a value that
 *  compares by identity (a string, a number, a boolean, or a cached object). */
export function usePick<T extends object, R>(store: Store<T>, pick: (s: T) => R): R {
  return useSyncExternalStore(
    store.subscribe,
    () => pick(store.get()),
    () => pick(store.get()),
  );
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(`null:${key}`);
  } catch {
    /* nothing to do */
  }
}

export function allKeys(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("null:")) out.push(k.slice(5));
    }
  } catch {
    /* nothing to do */
  }
  return out.sort();
}

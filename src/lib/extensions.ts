/* NULL · extensions.ts
   Add-ons. Each one declares where it draws: `nav` puts a chip in the top
   bar of the site, `page` gives it a page of its own, `overlay` floats over
   whatever is on screen. This is the list the puzzle button and the
   Extensions page both read. */

import { createStore, useStore } from "./store";

export type ExtSurface = "nav" | "page" | "overlay";

export type Extension = {
  id: string;
  name: string;
  author: string;
  version: string;
  desc: string;
  surface: ExtSurface;
  /** what the extension may touch, printed on its card */
  access: string[];
  builtin?: boolean;
};

export const EXTENSIONS: Extension[] = [
  {
    id: "clock",
    name: "Clock",
    author: "null",
    version: "1.2.0",
    desc: "The time, in the top bar, in every tab. Small, quiet, always there.",
    surface: "nav",
    access: ["read:time", "draw:nav"],
    builtin: true,
  },
  {
    id: "notes",
    name: "Scratchpad",
    author: "null",
    version: "1.0.3",
    desc: "A page of its own: notes that survive a reload and nothing else.",
    surface: "page",
    access: ["storage", "draw:page"],
    builtin: true,
  },
  {
    id: "stats",
    name: "Coin meter",
    author: "null",
    version: "0.9.1",
    desc: "A floating chip that keeps the coin count in the corner of the screen.",
    surface: "overlay",
    access: ["read:coins", "draw:overlay"],
    builtin: true,
  },
];

export type ExtState = {
  installed: string[];
  on: Record<string, boolean>;
  /** notes the Scratchpad extension keeps, keyed by page */
  notes: Record<string, string>;
};

export const extStore = createStore<ExtState>("ext", {
  installed: ["clock", "notes"],
  on: { clock: true, notes: true, stats: false },
  notes: {},
});

export function useExt(): ExtState {
  return useStore(extStore);
}

export function isOn(id: string): boolean {
  const s = extStore.get();
  return s.installed.includes(id) && s.on[id] !== false;
}

export function install(id: string) {
  const s = extStore.get();
  if (s.installed.includes(id)) return;
  extStore.set({ installed: [...s.installed, id], on: { ...s.on, [id]: true } });
}

export function uninstall(id: string) {
  const s = extStore.get();
  extStore.set({
    installed: s.installed.filter((x) => x !== id),
    on: { ...s.on, [id]: false },
  });
}

export function setOn(id: string, on: boolean) {
  extStore.set({ on: { ...extStore.get().on, [id]: on } });
}

/** Extensions that want to draw in the top bar, in the order they were made. */
export function navExtensions(): Extension[] {
  const s = extStore.get();
  return EXTENSIONS.filter((e) => e.surface === "nav" && s.installed.includes(e.id) && s.on[e.id]);
}

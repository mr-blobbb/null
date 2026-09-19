/* NULL · themes.ts
   The twenty-four palettes. Each one re-inks the page through the CSS variables
   declared in src/styles/tokens.css, so switching a theme never needs a
   component to know it happened.

   `ink` is the colour the homepage wordmark and the accent run on. It is the
   palette's identity in one value, which is why Forest turns the bottom of
   the wordmark green and Mono leaves it white. */

import { createStore, useStore } from "./store";
import type { EngineId } from "./nav";

export type PaletteId =
  | "null"
  | "midnight"
  | "rosewood"
  | "darker"
  | "forest"
  | "sunset"
  | "nord"
  | "mono"
  | "light"
  | "abyss"
  | "matcha"
  | "ember"
  | "glacier"
  | "void"
  | "peach"
  | "synthwave"
  | "slate"
  | "crimson"
  | "cobalt"
  | "sand"
  | "bubblegum"
  | "terminal"
  | "coffee"
  | "neon"
  | "custom";

export type Palette = {
  id: PaletteId;
  name: string;
  bg: string;
  ink: string;
  light: boolean;
};

export const PALETTES: Palette[] = [
  { id: "null", name: "Null", bg: "#08080a", ink: "#f4f4f5", light: false },
  { id: "midnight", name: "Midnight", bg: "#080c18", ink: "#7aa2ff", light: false },
  { id: "rosewood", name: "Rosewood", bg: "#11070a", ink: "#ff6b8b", light: false },
  { id: "darker", name: "Darker", bg: "#000000", ink: "#cfcfd6", light: false },
  { id: "forest", name: "Forest", bg: "#070d09", ink: "#7fd18b", light: false },
  { id: "sunset", name: "Sunset", bg: "#150b10", ink: "#ff9a76", light: false },
  { id: "nord", name: "Nord", bg: "#242933", ink: "#88c0d0", light: false },
  { id: "mono", name: "Mono", bg: "#0e0e0e", ink: "#ffffff", light: false },
  { id: "light", name: "Light", bg: "#f4f4f5", ink: "#101012", light: true },
  { id: "abyss", name: "Abyss", bg: "#03060d", ink: "#4dd0e1", light: false },
  { id: "matcha", name: "Matcha", bg: "#0c130d", ink: "#a8d98a", light: false },
  { id: "ember", name: "Ember", bg: "#120806", ink: "#ff7847", light: false },
  { id: "glacier", name: "Glacier", bg: "#070e12", ink: "#8fd8e8", light: false },
  { id: "void", name: "Void", bg: "#000000", ink: "#8b5cf6", light: false },
  { id: "peach", name: "Peach", bg: "#fbf1ea", ink: "#ef7f4f", light: true },
  { id: "synthwave", name: "Synthwave", bg: "#100722", ink: "#ff5fd2", light: false },
  { id: "slate", name: "Slate", bg: "#0d1117", ink: "#9db2d0", light: false },
  { id: "crimson", name: "Crimson", bg: "#140608", ink: "#ff5b6e", light: false },
  { id: "cobalt", name: "Cobalt", bg: "#050a1f", ink: "#5b8dff", light: false },
  { id: "sand", name: "Sand", bg: "#f3ece1", ink: "#8a6a3c", light: true },
  { id: "bubblegum", name: "Bubblegum", bg: "#fdeef5", ink: "#e0578f", light: true },
  { id: "terminal", name: "Terminal", bg: "#010703", ink: "#3ee07a", light: false },
  { id: "coffee", name: "Coffee", bg: "#120d0a", ink: "#c99a6b", light: false },
  { id: "neon", name: "Neon", bg: "#07090a", ink: "#c8ff3d", light: false },
  { id: "custom", name: "Custom", bg: "#0b0b0d", ink: "#c9c9d2", light: false },
];

export type CustomColors = {
  bg: string;
  bg2: string;
  ink: string;
  text: string;
  line: string;
};

/** What the background layer draws. "off" keeps the plain dotted grid. */
export type AmbientMode = "off" | "fog" | "particles" | "both";

export type Prefs = {
  palette: PaletteId;
  /** the drift behind every page (src/components/Ambient.tsx) */
  ambient: AmbientMode;
  custom: CustomColors;
  /** "1" is the light performance mode, "ultra" also stops all animation */
  perf: "" | "1" | "ultra";
  reduceMotion: boolean;
  /** the relay the fullscreen browser fetches through */
  relay: string;
  /** the cloud gaming service cloud titles stream from (src/lib/catalog.ts).
   *  Empty means the default the shelf ships with. */
  cloudBroker: string;
  /** what the address box searches with when what you typed is not an address */
  searchEngine: EngineId;
  showMeta: boolean;
  /** a tab cloak id, "smart", or "off" (src/lib/cloak.ts) */
  cloak: string;
  /** the key that hides the tab instantly: a single character, or "" for none */
  panicKey: string;
};

export const DEFAULT_CUSTOM: CustomColors = {
  bg: "#0b0b0d",
  bg2: "#101014",
  ink: "#c9c9d2",
  text: "#dcdce2",
  line: "#24242b",
};

export const prefs = createStore<Prefs>("prefs", {
  palette: "null",
  ambient: "fog",
  custom: DEFAULT_CUSTOM,
  perf: "",
  reduceMotion: false,
  relay: "wss://anura.pro/",
  cloudBroker: "",
  searchEngine: "brave",
  showMeta: true,
  cloak: "off",
  panicKey: "`",
});

/* The relay that used to be the default has gone quiet. Anybody who never
   touched the setting is still pointing at it, and now that the browser walks
   the relay list it would still work — but it would spend six seconds
   discovering a dead socket every time. Only that exact value is moved, so a
   relay somebody chose on purpose stays chosen. */
(function migrateRelay() {
  if (prefs.get().relay === "wss://wisp.mercurywork.shop/") prefs.set({ relay: "wss://anura.pro/" });
})();

export function paletteOf(id: PaletteId): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** Write a palette onto <html>. The matching rule lives in tokens.css; the
 *  custom palette has no block there, so its five colours go on inline. */
export function applyPalette(id: PaletteId) {
  const root = document.documentElement;
  const p = paletteOf(id);
  const custom = prefs.get().custom;

  root.dataset.palette = p.id;
  root.dataset.mode = p.light ? "light" : "dark";
  root.style.colorScheme = p.light ? "light" : "dark";

  const vars = ["--bg", "--bg-2", "--bg-3", "--bg-4", "--line", "--line-2", "--text", "--ac-1"];
  vars.forEach((v) => root.style.removeProperty(v));

  if (p.id === "custom") {
    root.style.setProperty("--bg", custom.bg);
    root.style.setProperty("--bg-2", custom.bg2);
    root.style.setProperty("--bg-3", mix(custom.bg2, custom.text, 0.06));
    root.style.setProperty("--bg-4", mix(custom.bg2, custom.text, 0.11));
    root.style.setProperty("--line", custom.line);
    root.style.setProperty("--line-2", mix(custom.line, custom.text, 0.22));
    root.style.setProperty("--text", custom.text);
    root.style.setProperty("--ac-1", custom.ink);
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", p.id === "custom" ? custom.bg : p.bg);
}

/** Apply the performance switches. Both are read from attributes so the
 *  stylesheet stays the single place that decides what they mean. */
export function applyPerf() {
  const root = document.documentElement;
  const p = prefs.get();
  if (p.perf) root.dataset.perf = p.perf;
  else delete root.dataset.perf;
  if (p.reduceMotion) root.dataset.motion = "off";
  else delete root.dataset.motion;
}

/** Blend two hex colours. Used to derive the two raised surface steps from a
 *  custom palette's background and text. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  const ch = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
  return `#${[ch(0), ch(1), ch(2)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** React hook: the palette currently in force. */
export function usePalette(): Palette {
  const id = useStore(prefs).palette;
  return paletteOf(id);
}

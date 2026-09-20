/* NULL · tabs.ts
   The browsing model behind the Chrome-shaped strip: a list of tabs, one of
   them active, each carrying its own back and forward stack.

   A target is a page plus optional arguments. `{ page: "proxies", arg: { url,
   ... } }` is a website loaded in the proxy window, which is how an external
   address becomes a tab; every other target is an internal null:// page. */

import { createStore, useStore } from "./store";
import { siteName } from "./favicon";
import { PAGES, type Destination, type PageId } from "./nav";
import { rememberVisit } from "./browserData";

export type Target = { page: PageId; arg?: Record<string, string> };

export type Tab = {
  id: string;
  now: Target;
  /** most recent first */
  back: Target[];
  fwd: Target[];
  /** browser-owned state for this tab, never shared with another tab */
  loading?: boolean;
  title?: string;
  favicon?: string;
  error?: string;
  nonce: number;
};

export type SplitState = {
  left: string;
  right: string;
  focus: "left" | "right";
};

export type TabsState = {
  tabs: Tab[];
  active: string;
  split: SplitState | null;
};

const FIRST: Tab = { id: "t1", now: { page: "home" }, back: [], fwd: [], nonce: 0 };

export const tabsStore = createStore<TabsState>("tabs", { tabs: [FIRST], active: "t1", split: null });

/* A stored tab list outlives any one version of NULL. A tab pointing at a
   page that no longer exists is dropped rather than crashing the shell. */
(function sanitize() {
  const st = tabsStore.get();
  const keep = (st.tabs ?? []).filter((t) => t && t.now && PAGES[t.now.page]);
  if (!keep.length) {
    tabsStore.set({ tabs: [FIRST], active: FIRST.id, split: null });
    return;
  }
  const active = keep.some((t) => t.id === st.active) ? st.active : keep[0].id;
  const split = st.split && keep.some((t) => t.id === st.split?.left) && keep.some((t) => t.id === st.split?.right) ? st.split : null;
  if (keep.length !== st.tabs.length || active !== st.active || split !== st.split) {
    tabsStore.set({ tabs: keep, active, split });
  }
})();

export function useTabs(): TabsState {
  return useStore(tabsStore);
}

function nextId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function activeTab(s?: TabsState): Tab {
  const st = s ?? tabsStore.get();
  return st.tabs.find((t) => t.id === st.active) ?? st.tabs[0] ?? FIRST;
}

/** What a tab's title bar and address bar show. */
export function describe(t: Target): { title: string; address: string; secure: boolean } {
  if (t.page === "proxies" && t.arg?.url) {
    /* the site's own name, not its hostname: a tab reads like the site it
       carries rather than like a filing system */
    return { title: siteName(t.arg.url) || "Site", address: t.arg.url, secure: t.arg.url.startsWith("https://") };
  }
  if (t.page === "player" && t.arg?.title) {
    return {
      title: t.arg.title,
      address: `null://play/${t.arg.id ?? ""}`,
      secure: true,
    };
  }
  /* A 404 keeps the address that missed, so the bar reads `null://skdjf`
     rather than pretending you are somewhere real. */
  if (t.page === "missing" && t.arg?.url) {
    return { title: "Not found", address: t.arg.url, secure: true };
  }
  const p = PAGES[t.page];
  return { title: p.name, address: p.address, secure: true };
}

/* ---------- navigation ---------- */

/** Go somewhere in the active tab. `replace` swaps the current entry instead
 *  of pushing one, which is what a redirect from /settings wants. */
export function go(target: Target, opts: { replace?: boolean; tabId?: string } = {}) {
  const st = tabsStore.get();
  const id = opts.tabId ?? st.active;
  const tabs = st.tabs.map((t) => {
    if (t.id !== id) return t;
    const clean = { title: undefined, favicon: undefined, error: undefined, loading: false };
    if (opts.replace) return { ...t, ...clean, now: target, fwd: [], nonce: t.nonce + 1 };
    return { ...t, ...clean, now: target, back: [t.now, ...t.back].slice(0, 40), fwd: [], nonce: t.nonce + 1 };
  });
  tabsStore.set({ tabs });
  if (target.page === "proxies" && target.arg?.url) rememberVisit(target.arg.url, siteName(target.arg.url));
  syncUrl(target);
}

/** Open a new tab and focus it. Reuses a tab that is already on the target
 *  so clicking a rail icon twice does not stack identical tabs. */
export function openTab(target: Target, opts: { reuse?: boolean } = {}) {
  const st = tabsStore.get();
  const key = targetKey(target);
  if (opts.reuse !== false) {
    const hit = st.tabs.find((t) => targetKey(t.now) === key);
    if (hit) {
      const split = st.split && (hit.id === st.split.left || hit.id === st.split.right) ? st.split : null;
      tabsStore.set({ active: hit.id, split });
      return hit.id;
    }
  }
  const tab: Tab = { id: nextId(), now: target, back: [], fwd: [], nonce: 0 };
  tabsStore.set({ tabs: [...st.tabs, tab], active: tab.id, split: null });
  syncUrl(target);
  return tab.id;
}

export function closeTab(id: string) {
  const st = tabsStore.get();
  if (st.tabs.length === 1) {
    /* the last tab never closes: it goes home instead */
    tabsStore.set({ tabs: [{ ...st.tabs[0], now: { page: "home" }, back: [], fwd: [], nonce: st.tabs[0].nonce + 1 }] });
    return;
  }
  const i = st.tabs.findIndex((t) => t.id === id);
  const tabs = st.tabs.filter((t) => t.id !== id);
  const active = st.active === id ? (tabs[Math.max(0, i - 1)] ?? tabs[0]).id : st.active;
  const split = st.split && st.split.left !== id && st.split.right !== id ? st.split : null;
  tabsStore.set({ tabs, active, split });
}

/** Drag a tab to a new slot. `before` is the tab it landed on: the moved tab
 *  takes that tab's place, which is what the line under the pointer promised. */
export function moveTab(id: string, before: string) {
  const st = tabsStore.get();
  const from = st.tabs.findIndex((t) => t.id === id);
  const to = st.tabs.findIndex((t) => t.id === before);
  if (from < 0 || to < 0 || from === to) return;
  const tabs = [...st.tabs];
  const [moved] = tabs.splice(from, 1);
  tabs.splice(to, 0, moved);
  tabsStore.set({ tabs });
}

export function pickTab(id: string) {
  const st = tabsStore.get();
  const split: SplitState | null = st.split
    ? id === st.split.left || id === st.split.right
      ? { ...st.split, focus: st.split.left === id ? "left" : "right" }
      : null
    : null;
  tabsStore.set({ active: id, split });
  const t = activeTab();
  syncUrl(t.now);
}

/** Pair the active tab with a fresh Home tab. The two panes are still normal
 * tabs, so their histories, loading state, and reload counters stay isolated. */
export function toggleSplit() {
  const st = tabsStore.get();
  if (st.split) {
    tabsStore.set({ split: null });
    return;
  }
  const right: Tab = { id: nextId(), now: { page: "home" }, back: [], fwd: [], nonce: 0 };
  tabsStore.set({ tabs: [...st.tabs, right], split: { left: st.active, right: right.id, focus: "left" } });
}

export function selectSplitPane(id: string) {
  const st = tabsStore.get();
  if (!st.split || (id !== st.split.left && id !== st.split.right)) return;
  pickTab(id);
}

export function goBack(tabId?: string) {
  const st = tabsStore.get();
  const id = tabId ?? st.active;
  tabsStore.set({
    tabs: st.tabs.map((t) => {
      if (t.id !== id || !t.back.length) return t;
      const [prev, ...rest] = t.back;
      return { ...t, title: undefined, favicon: undefined, error: undefined, loading: false, now: prev, back: rest, fwd: [t.now, ...t.fwd].slice(0, 40), nonce: t.nonce + 1 };
    }),
  });
}

export function goFwd(tabId?: string) {
  const st = tabsStore.get();
  const id = tabId ?? st.active;
  tabsStore.set({
    tabs: st.tabs.map((t) => {
      if (t.id !== id || !t.fwd.length) return t;
      const [next, ...rest] = t.fwd;
      return { ...t, title: undefined, favicon: undefined, error: undefined, loading: false, now: next, back: [t.now, ...t.back].slice(0, 40), fwd: rest, nonce: t.nonce + 1 };
    }),
  });
}

export function reload(tabId?: string) {
  const st = tabsStore.get();
  const id = tabId ?? st.active;
  tabsStore.set({
    tabs: st.tabs.map((t) => (t.id === id ? { ...t, nonce: t.nonce + 1 } : t)),
  });
}

export function setLoading(on: boolean, error?: string, tabId?: string) {
  const st = tabsStore.get();
  const id = tabId ?? st.active;
  tabsStore.set({
    tabs: st.tabs.map((t) => (t.id === id ? { ...t, loading: on, error } : t)),
  });
}

export function setTabMeta(patch: Pick<Tab, "title" | "favicon" | "error">, tabId?: string) {
  const st = tabsStore.get();
  const id = tabId ?? st.active;
  tabsStore.set({ tabs: st.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
}

/** Send a parsed destination to the right place: a page, a website in the
 *  browser, or the 404 that names the address that missed. Every box on the
 *  site that accepts an address ends up here, so the rule lives once. */
export function openDestination(d: Destination, tabId?: string) {
  if ("page" in d) return go({ page: d.page }, { tabId });
  if ("missing" in d) return go({ page: "missing", arg: { url: d.missing } }, { tabId });
  return go({ page: "proxies", arg: { url: d.url } }, { tabId });
}

export function targetKey(t: Target): string {
  return `${t.page}:${t.arg?.url ?? t.arg?.id ?? ""}`;
}

/** Keep the real address bar honest: every internal page is a hash route, so
 *  a reload or a shared link lands where the visitor was. */
export function syncUrl(t: Target) {
  const p = PAGES[t.page];
  let hash = `#${p.route}`;
  if (t.page === "proxies" && t.arg?.url) hash = `#/proxies?url=${encodeURIComponent(t.arg.url)}`;
  else if (t.page === "player" && t.arg?.id) {
    hash = `#/play?k=${encodeURIComponent(t.arg.kind ?? "game")}&id=${encodeURIComponent(t.arg.id)}`;
  } else if (t.page === "missing" && t.arg?.url) {
    /* a path stays the path it was — reloading it lands on the same 404. An
       internal null:// address has no path of its own, so it is carried. */
    hash = t.arg.url.startsWith("/") ? `#${t.arg.url}` : `#/404?at=${encodeURIComponent(t.arg.url)}`;
  }
  if (location.hash !== hash) {
    history.pushState(null, "", hash);
  }
}

/** Read the hash a visitor arrived on. Unknown hashes land on the 404 page. */
export function targetFromHash(hash: string): Target | null {
  const h = hash.replace(/^#/, "");
  if (!h || h === "/") return { page: "home" };
  const [path, query] = h.split("?");
  const params = new URLSearchParams(query ?? "");
  const clean = path.replace(/\/+$/, "");
  if (clean === "/proxies" && params.get("url")) {
    return { page: "proxies", arg: { url: params.get("url") as string } };
  }
  if (clean === "/play" && params.get("id")) {
    return {
      page: "player",
      arg: { kind: params.get("k") ?? "game", id: params.get("id") as string },
    };
  }
  const hit = (Object.keys(PAGES) as PageId[]).find((id) => PAGES[id].route === clean);
  if (hit && hit !== "missing") return { page: hit };
  if (clean === "/settings") return { page: "settings" };
  if (clean === "/404") {
    const at = params.get("at");
    return { page: "missing", arg: at ? { url: at } : undefined };
  }
  /* A path that matches no page is a 404 that says which path it was. This is
     the whole point of having one: anything added to the address used to show
     the homepage at that address, which is a lie the site should not tell. */
  return { page: "missing", arg: { url: clean } };
}

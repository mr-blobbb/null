/* NULL browser data: small, local-first browser records. */
import { createStore } from "./store";

export type HistoryEntry = {
  id: string;
  url: string;
  title: string;
  at: number;
};

export type Bookmark = {
  id: string;
  url: string;
  title: string;
  at: number;
};

export type Download = {
  id: string;
  url: string;
  name: string;
  at: number;
  status: "started" | "complete" | "failed";
};

export type SiteSession = {
  host: string;
  cookies: Record<string, string>;
  local: Record<string, string>;
  at: number;
};

type BrowserData = {
  history: HistoryEntry[];
  bookmarks: Bookmark[];
  downloads: Download[];
  sessions: SiteSession[];
};

export const browserData = createStore<BrowserData>("browser-data", {
  history: [],
  bookmarks: [],
  downloads: [],
  sessions: [],
});

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function rememberVisit(url: string, title = "Site") {
  const s = browserData.get();
  const next = [{ id: id("h"), url, title: title || "Site", at: Date.now() }, ...s.history.filter((x) => x.url !== url)];
  browserData.set({ ...s, history: next.slice(0, 200) });
}

export function isBookmarked(url: string): boolean {
  return browserData.get().bookmarks.some((x) => x.url === url);
}

export function toggleBookmark(url: string, title = "Site") {
  const s = browserData.get();
  const found = s.bookmarks.some((x) => x.url === url);
  browserData.set({
    ...s,
    bookmarks: found
      ? s.bookmarks.filter((x) => x.url !== url)
      : [{ id: id("b"), url, title: title || "Site", at: Date.now() }, ...s.bookmarks].slice(0, 100),
  });
}

export function startDownload(url: string, name: string): string {
  const item = { id: id("d"), url, name: name || "download", at: Date.now(), status: "started" as const };
  const s = browserData.get();
  browserData.set({ ...s, downloads: [item, ...s.downloads].slice(0, 100) });
  return item.id;
}

export function finishDownload(downloadId: string, status: Download["status"]) {
  const s = browserData.get();
  browserData.set({ ...s, downloads: s.downloads.map((x) => (x.id === downloadId ? { ...x, status } : x)) });
}

export function clearSiteData(host: string) {
  const s = browserData.get();
  browserData.set({ ...s, sessions: s.sessions.filter((x) => x.host !== host) });
}

export function clearHistory() {
  browserData.set({ ...browserData.get(), history: [] });
}

/* NULL · CtxMenu.tsx
   The site's own right-click menu.

   The browser's default menu is what a site shows when it has no opinion.
   NULL has one: the clipboard tools a text surface needs, an "open through
   the proxy" for anything that looks like a link, the page tools that are
   always worth having, and — on the music page — the things a track tile
   offers. Inside a game or the proxy window the menu is left alone: those
   pages belong to somebody else's web page, and their own menus (or no
   menu) are the right ones there. */

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Clipboard,
  ClipboardPaste,
  Copy,
  Heart,
  ListMusic,
  ListPlus,
  Maximize,
  Moon,
  Palette,
  RefreshCw,
  Shield,
  Trash2,
  EyeOff,
} from "lucide-react";

import { Sheet } from "./Sheet";
import { enqueue, music, toggleFavorite, useMusic, type Track } from "../lib/music";
import { prefs } from "../lib/themes";
import { activeTab, openTab, useTabs } from "../lib/tabs";

/** The kinds of page whose own menus win. Everything else gets NULL's. */
function ownsMenu(el: HTMLElement | null): boolean {
  return !!el?.closest(".play, .px, iframe");
}

type Row =
  | { kind: "item"; label: string; icon: React.ReactNode; run: () => void; danger?: boolean }
  | { kind: "gap" };

/** One menu, drawn from rows. Built fresh for every open so it always
 *  describes the page and the selection it was asked on. */
function rowsFor(e: MouseEvent, page: string): Row[] {
  const t = e.target as HTMLElement;
  const text = String(window.getSelection() ?? "").trim();
  const link = t.closest?.("a[href]") as HTMLAnchorElement | null;
  const rows: Row[] = [];

  /* ---------- the clipboard ---------- */
  if (text) {
    rows.push({
      kind: "item",
      label: "Copy",
      icon: <Copy />,
      run: () => navigator.clipboard?.writeText(text).catch(() => {}),
    });
  }
  const field = t.closest?.("input, textarea") as HTMLInputElement | HTMLTextAreaElement | null;
  if (field) {
    rows.push({ kind: "item", label: "Paste", icon: <ClipboardPaste />, run: () => void pasteInto(field) });
  }
  if (!text && !field) {
    rows.push({
      kind: "item",
      label: "Copy page address",
      icon: <Clipboard />,
      run: () => navigator.clipboard?.writeText(location.href).catch(() => {}),
    });
  }
  rows.push({ kind: "gap" });

  /* ---------- links go through the proxy ---------- */
  if (link) {
    const href = link.getAttribute("href") ?? "";
    if (/^(https?:)?\/\//.test(href)) {
      rows.push({
        kind: "item",
        label: "Open through the proxy",
        icon: <Shield />,
        run: () => openTab({ page: "proxies", arg: { url: href } }),
      });
      rows.push({ kind: "gap" });
    }
  }

  /* ---------- library item tools ---------- */
  const libraryTile = t.closest?.("[data-library-entry]") as HTMLElement | null;
  const libraryId = libraryTile?.getAttribute("data-library-entry");
  if (libraryId && (page === "games" || page === "apps")) {
    rows.push({
      kind: "item",
      label: "Hide this from the shelf",
      icon: <EyeOff />,
      run: () => window.dispatchEvent(new CustomEvent("null:hide-library-entry", { detail: { id: libraryId } })),
    });
    rows.push({ kind: "gap" });
  }

  /* ---------- the page's own things ---------- */
  if (page === "music") {
    const tile = t.closest?.("[data-track]") as HTMLElement | null;
    const track = tile ? findTrack(tile.dataset.track ?? "") : null;
    if (track && tile) {
      rows.push({
        kind: "item",
        label: "Add to a playlist",
        icon: <ListPlus />,
        run: () => tile.dispatchEvent(new CustomEvent("null:add", { bubbles: true })),
      });
      rows.push({
        kind: "item",
        label: music.get().favorites.some((f) => f.key === track.key) ? "Unfavourite" : "Favourite",
        icon: <Heart />,
        run: () => toggleFavorite(track),
      });
      rows.push({ kind: "item", label: "Play next", icon: <ListMusic />, run: () => enqueue(track) });
      rows.push({ kind: "gap" });
    }
  }

  rows.push({ kind: "item", label: "Back", icon: <ArrowLeft />, run: () => history.back() });
  rows.push({ kind: "item", label: "Reload page", icon: <RefreshCw />, run: () => location.reload() });
  rows.push({
    kind: "item",
    label: document.fullscreenElement ? "Leave fullscreen" : "Fullscreen",
    icon: <Maximize />,
    run: () => (document.fullscreenElement ? document.exitFullscreen() : void document.documentElement.requestFullscreen()),
  });
  rows.push({ kind: "gap" });
  rows.push({
    kind: "item",
    label: prefs.get().ambient === "off" ? "Ambient on" : "Ambient off",
    icon: <Moon />,
    run: () => prefs.set({ ambient: prefs.get().ambient === "off" ? "both" : "off" }),
  });
  rows.push({
    kind: "item",
    label: "Themes…",
    icon: <Palette />,
    run: () => document.dispatchEvent(new CustomEvent("null:settings")),
  });
  rows.push({
    kind: "item",
    label: "Clear this page's data",
    icon: <Trash2 />,
    danger: true,
    run: () => {
      if (window.confirm("Clear saved data on this browser? The page reloads after.")) location.reload();
    },
  });
  return rows;
}

/** Paste without a document.execCommand: a focused field gets what the
 *  clipboard holds. Chrome hands it over on its own permission prompt. */
async function pasteInto(field: HTMLInputElement | HTMLTextAreaElement) {
  try {
    const text = await navigator.clipboard.readText();
    const a = field.selectionStart ?? field.value.length;
    const b = field.selectionEnd ?? field.value.length;
    field.value = field.value.slice(0, a) + text + field.value.slice(b);
    field.selectionStart = field.selectionEnd = a + text.length;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
  } catch {
    /* the clipboard said no — the browser's own menu is one Esc away */
  }
}

/** The track a music tile stands for. The tile's key names it; the shelf it
 *  is on (results, favourites, queue, recent) holds the rest. */
function findTrack(key: string): Track | null {
  const s = music.get();
  for (const list of [s.favorites, s.recent, s.queue, s.order]) {
    const hit = list.find((t) => t.key === key);
    if (hit) return hit;
  }
  return null;
}

export function CtxMenu() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [add, setAdd] = useState<Track | null>(null);
  const tabs = useTabs();
  const page = activeTab(tabs).now.page;

  useEffect(() => {
    const open = (e: MouseEvent) => {
      if (ownsMenu(e.target as HTMLElement)) return;
      e.preventDefault();
      setRows(rowsFor(e, page));
      setPos(within(e.clientX, e.clientY));
    };
    const close = () => setPos(null);
    window.addEventListener("contextmenu", open);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("contextmenu", open);
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", close);
    };
  }, [page]);

  /* the tile's own + button and this menu share the playlist sheet */
  useEffect(() => {
    const ask = (e: Event) => {
      const key = (e.target as HTMLElement).dataset.track ?? "";
      setAdd(findTrack(key));
      setPos(null);
    };
    window.addEventListener("null:add" as never, ask as EventListener);
    return () => window.removeEventListener("null:add" as never, ask as EventListener);
  }, []);

  /* settings, asked for from the menu: the sheet listens for this on
     document, which keeps the menu from knowing what a sheet is */
  useEffect(() => {
    const ask = () => setPos(null);
    document.addEventListener("null:settings", ask);
    return () => document.removeEventListener("null:settings", ask);
  }, []);

  if (!pos) return null;
  return (
    <>
      <div className="ctx-veil" onMouseDown={() => setPos(null)} />
      <div className="ctx" style={{ left: pos.x, top: pos.y }} role="menu">
        {rows.map((r, i) =>
          r.kind === "gap" ? (
            <i key={i} className="ctx-gap" />
          ) : (
            <button
              key={i}
              className={`ctx-row${r.danger ? " is-bad" : ""}`}
              role="menuitem"
              onClick={() => {
                setPos(null);
                r.run();
              }}
            >
              {r.icon}
              {r.label}
            </button>
          ),
        )}
      </div>
      <PlaylistPick track={add} onClose={() => setAdd(null)} />
    </>
  );
}

/** A point on screen the menu fits inside, so a right-click in the corner
 *  opens the menu rather than closing it. */
function within(x: number, y: number): { x: number; y: number } {
  const w = 230;
  const h = 380;
  return { x: Math.min(x, window.innerWidth - w - 8), y: Math.min(y, window.innerHeight - h - 8) };
}

/** The playlist picker the music rows open. It is the page's own AddMenu
 *  shape, small enough to live here. */
function PlaylistPick({ track, onClose }: { track: Track | null; onClose: () => void }) {
  const m = useMusic();
  const [name, setName] = useState("");
  if (!track) return null;
  return (
    <Sheet open onClose={onClose} width={420} title="Add to a playlist">
      <div className="mu-add">
        <div className="mu-add-list">
          {m.playlists.map((p) => (
            <button
              key={p.id}
              className="mu-add-row"
              onClick={() => {
                music.set({
                  playlists: music.get().playlists.map((pl) =>
                    pl.id === p.id && !pl.tracks.some((t) => t.key === track.key)
                      ? { ...pl, tracks: [...pl.tracks, track] }
                      : pl,
                  ),
                });
                onClose();
              }}
            >
              <ListMusic />
              {p.name}
              <em className="tiny faint">· {p.tracks.length}</em>
            </button>
          ))}
          {m.playlists.length === 0 && <p className="tiny faint">No playlists yet.</p>}
        </div>
        <div className="mu-add-new">
          <input className="fld" value={name} placeholder="New playlist" onChange={(e) => setName(e.target.value)} />
          <button
            className="btn btn--sm btn--fill"
            onClick={() => {
              if (!name.trim()) return;
              const id = `pl_${Math.random().toString(36).slice(2, 9)}`;
              music.set({
                playlists: [
                  ...music.get().playlists,
                  { id, name: name.trim(), at: Date.now(), tracks: [track] },
                ],
              });
              onClose();
            }}
          >
            Make it
          </button>
        </div>
      </div>
    </Sheet>
  );
}

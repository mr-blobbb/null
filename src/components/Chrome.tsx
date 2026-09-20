/* NULL · Chrome.tsx
   The browser furniture: a strip of tabs on top, a toolbar under it with
   back / forward / reload, the address bar, the extension puzzle, and the
   music player.

   The address bar shows a null:// address when the tab is an internal page —
   always with a green lock, because nothing leaves the machine — and the
   real site address when the tab is a page loaded through the proxy. */

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Columns2,
  Globe,
  Lock,
  Music,
  Pause,
  Play,
  Plus,
  Puzzle,
  RotateCw,
  ShieldAlert,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";

import { faviconOf } from "../lib/favicon";
import { destinationFor, PAGES } from "../lib/nav";
import { useStore } from "../lib/store";
import { prefs } from "../lib/themes";
import {
  activeTab,
  closeTab,
  describe,
  go,
  goBack,
  goFwd,
  moveTab,
  openDestination,
  openTab,
  pickTab,
  reload,
  selectSplitPane,
  toggleSplit,
  useTabs,
} from "../lib/tabs";
import { useExt } from "../lib/extensions";
import { step, toggle, useMusic } from "../lib/music";
import { isBookmarked, toggleBookmark } from "../lib/browserData";

export function Chrome({ onSettings }: { onSettings: () => void }) {
  const state = useTabs();
  if (state.split) {
    return (
      <div className="split-chrome" aria-label="Split browser view">
        <BrowserChrome tabId={state.split.left} onSettings={onSettings} />
        <BrowserChrome tabId={state.split.right} onSettings={onSettings} />
      </div>
    );
  }
  return <BrowserChrome onSettings={onSettings} />;
}

function BrowserChrome({ onSettings, tabId }: { onSettings: () => void; tabId?: string }) {
  const state = useTabs();
  const tab = tabId ? state.tabs.find((item) => item.id === tabId) ?? activeTab(state) : activeTab(state);
  const described = describe(tab.now);
  const title = tab.title || described.title;
  const address = described.address;
  const secure = described.secure;
  const engine = useStore(prefs).searchEngine;

  const [draft, setDraft] = useState(address);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* dragging a tab into a new slot, and the beat a tab spends shrinking out
     of the row when it is closed */
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [shut, setShut] = useState<string | null>(null);

  const shutTab = (id: string) => {
    if (shut) return;
    setShut(id);
    window.setTimeout(() => {
      closeTab(id);
      setShut((s) => (s === id ? null : s));
    }, 140);
  };

  useEffect(() => {
    if (!focused) setDraft(address);
  }, [address, focused]);

  /* ⌘L / ctrl-L focuses the address bar, as it should */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tabId && state.active !== tabId) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && tab.now.page === "proxies" && tab.now.arg?.url) {
        e.preventDefault();
        toggleBookmark(tab.now.arg.url, title);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.active, tabId, tab.now.page, tab.now.arg?.url, title]);

  /* the one rule: a null:// page goes there, an address opens in the browser,
     and anything else is a search. Nothing is ever ignored. */
  function commit() {
    const parsed = destinationFor(draft, engine);
    if (!parsed) return;
    inputRef.current?.blur();
    if ("page" in parsed && parsed.page === "settings") onSettings();
    else openDestination(parsed, tabId);
  }

  return (
    <div className={tabId ? "split-chrome-pane" : "chrome-single"} onMouseDown={() => tabId && selectSplitPane(tabId)}>
      <div className="tabs" role="tablist">
        {state.tabs.filter((t) => !tabId || t.id === tabId).map((t) => {
          const describedTab = describe(t.now);
          const d = { ...describedTab, title: t.title || describedTab.title };
          const Page = PAGES[t.now.page];
          const isSite = t.now.page === "proxies" && !!t.now.arg?.url;
          const Icon = isSite ? Globe : Page.icon;
          return (
            <div
              key={t.id}
              className={`tab${t.id === state.active ? " is-on" : ""}${drag === t.id ? " is-drag" : ""}${
                drag && over === t.id && drag !== t.id ? " is-over" : ""
              }${shut === t.id ? " is-shut" : ""}`}
              role="tab"
              aria-selected={t.id === state.active}
              draggable
              onClick={() => pickTab(t.id)}
              onAuxClick={(e) => {
                if (e.button === 1) shutTab(t.id);
              }}
              onDragStart={() => setDrag(t.id)}
              onDragEnd={() => {
                setDrag(null);
                setOver(null);
              }}
              onDragOver={(e) => {
                if (!drag || drag === t.id) return;
                e.preventDefault();
                setOver(t.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag) moveTab(drag, t.id);
                setDrag(null);
                setOver(null);
              }}
            >
              {isSite ? (
                /* the site's own icon, over the globe: a favicon that will
                   not load hides itself and the globe shows through */
                <span className="tab-fav">
                  <Globe />
                  <img
                    src={t.favicon || faviconOf(t.now.arg?.url ?? "")}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(e) => e.currentTarget.remove()}
                  />
                </span>
              ) : (
                <Icon />
              )}
              <span className="tab-name">{d.title}</span>
              <button
                className="tab-x"
                aria-label="Close tab"
                onClick={(e) => {
                  e.stopPropagation();
                  shutTab(t.id);
                }}
              >
                <X />
              </button>
            </div>
          );
        })}
        <button className="tab-new" onClick={() => openTab({ page: "home" }, { reuse: false })} aria-label="New tab">
          <Plus />
        </button>
      </div>

      <div className="bar">
        <button className="bar-btn bar-btn--back" onClick={() => goBack(tabId)} disabled={!tab.back.length} aria-label="Back">
          <ArrowLeft />
        </button>
        <button className="bar-btn bar-btn--forward" onClick={() => goFwd(tabId)} disabled={!tab.fwd.length} aria-label="Forward">
          <ArrowRight />
        </button>
        <button className="bar-btn bar-btn--reload" onClick={() => reload(tabId)} aria-label="Reload">
          <RotateCw />
        </button>
        <div className="addr">
          {secure ? (
            <Lock className="lock is-safe" aria-label="Secure" />
          ) : (
            <ShieldAlert className="lock" aria-label="Not secure" />
          )}
          <input
            ref={inputRef}
            value={draft}
            spellCheck={false}
            aria-label={title}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => {
              setFocused(true);
              e.currentTarget.select();
            }}
            onBlur={() => {
              setFocused(false);
              setDraft(address);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(address);
                e.currentTarget.blur();
              }
            }}
          />
        </div>

        <div className="bar-actions" aria-label="Browser tools">
          <ExtButton onManage={onSettings} />
          <button
            className={`bar-btn${tab.now.page === "proxies" && tab.now.arg?.url && isBookmarked(tab.now.arg.url) ? " is-on" : ""}`}
            onClick={() => tab.now.page === "proxies" && tab.now.arg?.url && toggleBookmark(tab.now.arg.url, title)}
            aria-label={tab.now.page === "proxies" && tab.now.arg?.url && isBookmarked(tab.now.arg.url) ? "Remove bookmark" : "Bookmark page"}
            title="Bookmark (Ctrl+D)"
          >
            <Bookmark />
          </button>
          <button
            className={`bar-btn${state.split ? " is-on" : ""}`}
            onClick={toggleSplit}
            aria-label={state.split ? "Close split view" : "Split page"}
            title={state.split ? "Close split view" : "Split page"}
          >
            <Columns2 />
          </button>
        </div>

        <Tune />
      </div>
    </div>
  );
}

/* History, downloads, and page-info popovers were intentionally removed from
   the browser chrome. Their data remains available to the relevant pages. */
/* function BrowserPanel({ 
  kind,
  data,
  target,
  onClose,
}: {
  kind: "history" | "downloads" | "info";
  data: ReturnType<typeof browserData.get>;
  target: ReturnType<typeof activeTab>["now"];
  onClose: () => void;
}) {
  const title = kind === "history" ? "History" : kind === "downloads" ? "Downloads" : "Page information";
  return (
    <div className="browser-panel" role="dialog" aria-label={title}>
      <div className="browser-panel-head"><b>{title}</b><button className="tab-x" onClick={onClose} aria-label="Close">×</button></div>
      {kind === "history" && (data.history.length ? data.history.slice(0, 8).map((x) => <button className="browser-panel-row" key={x.id} onClick={() => { openTab({ page: "proxies", arg: { url: x.url } }); onClose(); }}><b>{x.title}</b><span>{x.url}</span></button>) : <span className="tiny faint">No visits yet.</span>)}
      {kind === "downloads" && (data.downloads.length ? data.downloads.slice(0, 8).map((x) => <button className="browser-panel-row" key={x.id} onClick={() => { openTab({ page: "proxies", arg: { url: x.url } }); onClose(); }}><b>{x.name}</b><span>{x.status}</span></button>) : <span className="tiny faint">No downloads yet.</span>)}
      {kind === "info" && <div className="browser-info"><b>{describe(target).title}</b><span>{describe(target).address}</span><span>Tab state: isolated</span><span>Transport: proxied</span></div>}
    </div>
  );
} */

function ExtButton({ onManage }: { onManage: () => void }) {
  const ext = useExt();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const installed = ext.installed;

  return (
    <div className="extwrap" ref={ref}>
      <button
        className="bar-btn bar-btn--extensions"
        onClick={() => setOpen((v) => !v)}
        aria-label="Extensions"
        aria-expanded={open}
      >
        <Puzzle />
      </button>
      {open && (
        <div className="extmenu">
          <div className="extmenu-head">
            <Puzzle />
            <span>Extensions</span>
          </div>
          {installed.length === 0 && <p className="extmenu-empty muted">Nothing installed yet.</p>}
          {installed.map((id) => (
            <button
              key={id}
              className="extmenu-row"
              onClick={() => go({ page: "extensions" })}
            >
              <span className="extmenu-dot" data-on={ext.on[id] !== false} />
              <span>{EX_NAME(id)}</span>
            </button>
          ))}
          <button
            className="extmenu-manage"
            onClick={() => {
              setOpen(false);
              go({ page: "extensions" });
            }}
          >
            Manage extensions
          </button>
        </div>
      )}
    </div>
  );
}

function EX_NAME(id: string): string {
  return id === "clock" ? "Clock" : id === "notes" ? "Scratchpad" : "Coin meter";
}

/* The mini player. It is the music page's engine, just smaller — the same
   play, step and pause — and its name is a door to that page.

   The chip at the left is whatever the track came with: the cover the
   catalogue handed back, or a bare note when nothing is playing. The title is
   on one line and gets every pixel the toolbar can spare, because a title
   that wraps out of its own pill is not a title. */
function Tune() {
  const m = useMusic();
  const title = m.now ? `${m.now.title} — ${m.now.artist}` : "Not Playing";

  return (
    <div className="tune" aria-label="Music player">
      <button
        className="tune-now"
        onClick={() => go({ page: "music" })}
        title={m.now ? `${title} — open the music page` : "Nothing playing — open the music page"}
      >
        <span className={`tune-art${m.now?.art ? " has-art" : ""}`}>
          {m.now?.art ? <img src={m.now.art} alt="" /> : <Music />}
        </span>
        <span className="tune-name">{title}</span>
      </button>
      <button aria-label="Previous track" title="Previous" onClick={() => step(-1)} disabled={!m.queue.length}>
        <SkipBack />
      </button>
      <button
        aria-label={m.playing ? "Pause" : "Play"}
        title={m.playing ? "Pause" : "Play"}
        onClick={toggle}
        disabled={!m.now && !m.queue.length}
      >
        {m.playing ? <Pause /> : <Play />}
      </button>
      <button aria-label="Next track" title="Next" onClick={() => step(1)} disabled={!m.queue.length}>
        <SkipForward />
      </button>
    </div>
  );
}
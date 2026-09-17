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
  Globe,
  Lock,
  Music,
  Pause,
  Plus,
  Puzzle,
  RotateCw,
  ShieldAlert,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";

import { PAGES, parseAddress, type PageId } from "../lib/nav";
import {
  activeTab,
  closeTab,
  describe,
  go,
  goBack,
  goFwd,
  openTab,
  pickTab,
  reload,
  useTabs,
} from "../lib/tabs";
import { navExtensions, useExt } from "../lib/extensions";
import { useEcon } from "../lib/econ";

export function Chrome({ onSettings }: { onSettings: () => void }) {
  const state = useTabs();
  const tab = activeTab(state);
  const { title, address, secure } = describe(tab.now);

  const [draft, setDraft] = useState(address);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) setDraft(address);
  }, [address, focused]);

  /* ⌘L / ctrl-L focuses the address bar, as it should */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function commit() {
    const parsed = parseAddress(draft);
    if (!parsed) return;
    inputRef.current?.blur();
    if ("page" in parsed) {
      if (parsed.page === "settings") onSettings();
      else go({ page: parsed.page });
    } else {
      go({ page: "proxies", arg: { url: parsed.url } });
    }
  }

  return (
    <>
      <div className="tabs" role="tablist">
        {state.tabs.map((t) => {
          const d = describe(t.now);
          const Page = PAGES[t.now.page];
          const Icon = t.now.page === "proxies" && t.now.arg?.url ? Globe : Page.icon;
          return (
            <div
              key={t.id}
              className={`tab${t.id === state.active ? " is-on" : ""}`}
              role="tab"
              aria-selected={t.id === state.active}
              onClick={() => pickTab(t.id)}
              onAuxClick={(e) => {
                if (e.button === 1) closeTab(t.id);
              }}
            >
              <Icon />
              <span className="tab-name">{d.title}</span>
              <button
                className="tab-x"
                aria-label="Close tab"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.id);
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
        <button className="bar-btn" onClick={goBack} disabled={!tab.back.length} aria-label="Back">
          <ArrowLeft />
        </button>
        <button className="bar-btn" onClick={goFwd} disabled={!tab.fwd.length} aria-label="Forward">
          <ArrowRight />
        </button>
        <button className="bar-btn" onClick={reload} aria-label="Reload">
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

        <NavBarExtras />
        <ExtButton onManage={onSettings} />
        <Tune />
      </div>
    </>
  );
}

function NavBarExtras() {
  const ext = useExt();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const coins = useEcon().coins;

  const active = navExtensions();
  if (!active.length) return null;

  return (
    <>
      {active.map((e) => {
        if (e.id === "clock") {
          return (
            <span className="extchip" key={e.id} title="Clock (extension)">
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          );
        }
        return (
          <span className="extchip" key={e.id} title={`${e.name} (extension)`}>
            {e.id === "stats" ? coins : e.name}
          </span>
        );
      })}
    </>
  );
}

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
        className="bar-btn"
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

/* Non-functional, as asked: the icons and the state are here so the music
   page can be dropped in behind them later without moving anything. */
function Tune() {
  return (
    <div className="tune" aria-label="Music player">
      <span className="tune-now">
        <Music />
        <span>Not Playing</span>
      </span>
      <button aria-label="Previous track" title="Previous">
        <SkipBack />
      </button>
      <button aria-label="Play" title="Play">
        <Pause />
      </button>
      <button aria-label="Next track" title="Next">
        <SkipForward />
      </button>
    </div>
  );
}

export const CHROME_PAGES: PageId[] = ["home", "games", "apps", "proxies", "shop"];

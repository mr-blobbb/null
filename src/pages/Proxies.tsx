/* NULL · Proxies.tsx
   Two things in one page: the shelf of ready-made links, and the browser that
   loads an address.

   The browser is not an iframe pointed at the target — a page cannot fetch
   another origin, and most sites refuse to be framed at all (aether.cx sends
   `x-frame-options: DENY`). So there are two roads and both end inside NULL:

     1 · the rewritten window. Ultraviolet rewrites every request in a service
         worker, the result is carried over a Wisp relay, and it fills the
         page area under the same tab bar and toolbar as everything else.
     2 · the relay reader, in src/lib/relay.ts. If a service worker cannot be
         registered, the page itself is fetched through the relay and drawn
         here. The far site is copied rather than framed, so a site that
         refuses framing never gets the chance to.

   The window starts on the first road and walks onto the second by itself
   when the first does not come up or stops drawing. Both roads are inside
   NULL; neither ever asks the visitor to go somewhere else. */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Globe,
  Loader,
  Lock,
  Radio,
  RotateCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";

import { entries } from "../lib/catalog";
import { destinationFor, ENGINES, type EngineId, type PageId } from "../lib/nav";
import { prefs } from "../lib/themes";
import { useStore } from "../lib/store";
import { ping, proxied, restart, start } from "../lib/browser";
import { prepare, read } from "../lib/relay";
import { activeTab, go, openDestination, openTab, useTabs } from "../lib/tabs";

/** The relays NULL knows about, and why those two and not twenty. Both
 *  answered a Wisp handshake and served a real page through this exact
 *  transport — a higher bar than appearing on somebody's list. A relay is the
 *  one piece of this a static host cannot provide, so it is the piece most
 *  likely to be the reason a page does not load. */
const RELAYS = [
  {
    name: "mercurywork",
    url: "wss://wisp.mercurywork.shop/",
    note: "The one NULL ships with. Speaks Wisp v1.",
  },
  {
    name: "anura",
    url: "wss://anura.pro/",
    note: "Answers both versions of Wisp.",
  },
];

/** `back` is where the escape hatch leads: a site typed into the address bar
 *  came from the proxy shelf, the movies page came from the front door. */
export function Proxies({ url, back = "proxies" }: { url?: string; back?: PageId }) {
  const p = useStore(prefs);
  if (url) return <Browser url={url} relay={p.relay} back={back} />;
  return <Shelf relay={p.relay} />;
}

/* ============================================================
   the fullscreen browser
   ============================================================ */
type Mode = "booting" | "uv" | "reader" | "failed";

function Browser({ url, relay, back }: { url: string; relay: string; back: PageId }) {
  const [mode, setMode] = useState<Mode>("booting");
  const [reason, setReason] = useState("");
  /* the page the relay read, ready to draw */
  const [sheet, setSheet] = useState("");
  /* did the rewritten window ever draw? if it has not in a dozen seconds, the
     reader takes over rather than leaving a blank pane */
  const [drew, setDrew] = useState(false);
  /* bumping this re-runs everything, which is what Try again does */
  const [attempt, setAttempt] = useState(0);
  /* The tab is the page: its address is this site's real one, the toolbar
     above reloads it (the tab's nonce), and back and forward walk its own
     history. Nothing down here repeats any of that. */
  const tabs = useTabs();
  const nonce = activeTab(tabs).nonce;

  const host = useMemo(() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }, [url]);

  /* the second road: the relay reads the page and hands it over */
  const viaRelay = useCallback(async (): Promise<boolean> => {
    const got = await read(url, relay);
    if (!got.ok) {
      setReason(got.reason);
      return false;
    }
    setSheet(prepare(got.html, url));
    setMode("reader");
    return true;
  }, [url, relay]);

  useEffect(() => {
    let alive = true;
    setMode("booting");
    setReason("");
    setSheet("");
    setDrew(false);
    (async () => {
      const b = await start(relay);
      if (!alive) return;
      if (b.ok) {
        setMode("uv");
        return;
      }
      const got = await viaRelay();
      if (!alive) return;
      if (!got) setMode("failed");
    })();
    return () => {
      alive = false;
    };
  }, [relay, attempt, url, nonce, viaRelay]);

  /* a rewritten window that never paints is a failure like any other */
  useEffect(() => {
    if (mode !== "uv" || drew) return;
    const timer = window.setTimeout(async () => {
      const got = await viaRelay();
      if (!got) {
        setReason((r) => r || "The rewritten window never drew the page.");
        setMode("failed");
      }
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [mode, drew, viaRelay]);

  /* a link inside the read page comes back here, and the window fetches it */
  useEffect(() => {
    if (mode !== "reader") return;
    const onMsg = (e: MessageEvent) => {
      const next = (e.data as { nullFrame?: string } | null)?.nullFrame;
      if (typeof next !== "string" || !next) return;
      go({ page: "proxies", arg: { url: next } });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [mode]);

  /* escape gets you out of the browser and back onto NULL */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") go({ page: back });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back]);

  const src = mode === "uv" || mode === "booting" ? proxied(url) : null;
  const leave = () => go({ page: back });

  return (
    <div className="bw">
      {mode === "booting" && (
        <div className="bw-note">
          <Loader className="px-spin" />
          <h3>Opening {host}…</h3>
          <p className="faint">
            Through the relay at <span className="mono">{relay}</span>.
          </p>
        </div>
      )}

      {(mode === "uv" || mode === "booting") && src && (
        <iframe
          key={`${nonce}-${url}`}
          className="bw-frame"
          src={src}
          title={host}
          onLoad={() => setDrew(true)}
          referrerPolicy="no-referrer"
          allow="clipboard-read; clipboard-write; fullscreen; gamepad; autoplay"
        />
      )}

      {mode === "reader" && (
        <>
          <span className="bw-mode" title="Read through the relay, drawn in a sandboxed frame">
            <Radio /> relay copy
          </span>
          <iframe
            key={`${nonce}-${url}-copy`}
            className="bw-frame"
            srcDoc={sheet}
            title={host}
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
          />
        </>
      )}

      {mode === "failed" && (
        <div className="bw-note">
          <ShieldAlert />
          <h3>{host} did not come through</h3>
          <p>{reason}</p>
          <p className="faint">
            The relay in use is <span className="mono">{relay}</span> — a WebSocket server, the
            one piece of this that a static host cannot supply. Point NULL at one you run, on
            the shelf page, and this window comes up.
          </p>
          <div className="bw-note-actions">
            <button
              className="btn btn--fill"
              onClick={() => {
                restart();
                setAttempt((n) => n + 1);
              }}
            >
              <RotateCw /> Try again
            </button>
            <button className="btn" onClick={leave}>
              <ArrowLeft /> Back to null
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   the shelf
   ============================================================ */
/** One bare handshake, so a dead relay can be told apart from a broken
 *  browser before anything else is suspected. */
function RelayCheck({ relay }: { relay: string }) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "bad">("idle");
  const [says, setSays] = useState("");

  return (
    <div className="px-check">
      <button
        className="btn btn--sm"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          setSays("knocking…");
          const r = await ping(relay);
          setState(r.ok ? "ok" : "bad");
          setSays(r.ok ? `answered in ${r.ms} ms` : `nothing there — ${r.reason}`);
        }}
      >
        <RotateCw /> Check the relay
      </button>
      {state !== "idle" && (
        <span className={`px-check-say${state === "bad" ? " is-bad" : state === "ok" ? " is-ok" : ""}`}>
          {says}
        </span>
      )}
    </div>
  );
}

function Shelf({ relay }: { relay: string }) {
  const p = useStore(prefs);
  const list = entries("proxy");
  const [draft, setDraft] = useState("");

  const open = (raw: string) => {
    const to = destinationFor(raw, p.searchEngine);
    if (!to) return;
    openDestination(to);
  };

  return (
    <div className="page page--wide">
      <div className="px-top">
        <h1 className="lb-title">Proxies</h1>
        <span className="lb-count tiny faint">{list.length} ready to open</span>
      </div>

      <form
        className="hm-search px-open"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          open(draft);
        }}
      >
        <Globe />
        <input
          value={draft}
          spellCheck={false}
          autoComplete="off"
          placeholder="Type an address, or search the web"
          aria-label="Address or search"
          onChange={(e) => setDraft(e.target.value)}
        />
      </form>

      <div className="lb-grid">
        {list.map((e) => (
          <button
            key={e.id}
            className="px-card"
            onClick={() => openTab({ page: "proxies", arg: { url: e.url ?? "" } })}
          >
            <span className="px-card-icon">
              <Globe />
            </span>
            <span className="px-card-body">
              <b>{e.name}</b>
              <em>{e.url?.replace(/^https?:\/\//, "").replace(/\/$/, "")}</em>
            </span>
            <span className={`px-status${e.status === "All Good" ? "" : " is-warn"}`}>
              {e.status === "All Good" ? <Lock /> : <TriangleAlert />}
              {e.status}
            </span>
          </button>
        ))}
      </div>

      <div className="card card--pad px-settings">
        <h3 className="set-h">The browser</h3>
        <p className="set-note">
          Every address opens inside NULL through Ultraviolet, which fetches it over the relay
          below. A relay is a WebSocket server, so it cannot be hosted on a static page: point
          this at one you run, or use the public one it ships with.
        </p>
        <div className="px-fields">
          <label className="form-row">
            <span>Wisp relay</span>
            <input
              className="fld"
              value={p.relay}
              spellCheck={false}
              onChange={(e) => {
                restart();
                prefs.set({ relay: e.target.value });
              }}
            />
          </label>
          <div className="px-relays">
            {RELAYS.map((r) => (
              <button
                key={r.url}
                className={`btn btn--sm${p.relay === r.url ? " btn--fill" : ""}`}
                title={r.note}
                onClick={() => {
                  restart();
                  prefs.set({ relay: r.url });
                }}
              >
                {p.relay === r.url ? <Check /> : null}
                {r.name}
              </button>
            ))}
          </div>
          <p className="tiny faint">
            Two public relays, both checked from here: either serves Wisp. If pages stop
            loading, the relay is usually why — the bar above names the one in use.
          </p>
          <label className="form-row">
            <span>Search engine</span>
            <select
              className="fld"
              value={p.searchEngine}
              onChange={(e) => prefs.set({ searchEngine: e.target.value as EngineId })}
            >
              {ENGINES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <RelayCheck relay={p.relay} />

        <p className="tiny faint px-note">
          Brave is the default. What you type in an address box becomes a page, an address, or a
          search on this engine — in that order.
        </p>
      </div>
    </div>
  );
}

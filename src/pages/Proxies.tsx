/* NULL · Proxies.tsx
   Two things in one page: the shelf of ready-made sites, and the fullscreen
   browser that loads an address.

   The browser is not an iframe pointed at the target — a page cannot fetch
   another origin, and most sites refuse to be framed. It is the Ultraviolet
   chain described in src/lib/browser.ts: the address is rewritten inside a
   service worker, carried over a Wisp relay, and the result fills the window.
   Nothing of NULL's own chrome stays on screen while it is open.

   Until a relay answers, the browser says so in words and offers the site in
   a real tab, which is the honest fallback rather than a blank frame. */

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  Loader,
  Lock,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";

import { entries } from "../lib/catalog";
import { destinationFor, ENGINES, type EngineId, type PageId } from "../lib/nav";
import { prefs } from "../lib/themes";
import { useStore } from "../lib/store";
import { proxied, start } from "../lib/browser";
import { go, openTab } from "../lib/tabs";

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
function Browser({ url, relay, back }: { url: string; relay: string; back: PageId }) {
  const engine = useStore(prefs).searchEngine;
  const [state, setState] = useState<"booting" | "ok" | "failed">("booting");
  const [reason, setReason] = useState("");
  const [now, setNow] = useState(url);
  const [draft, setDraft] = useState(url);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setState("booting");
    setReason("");
    start(relay).then((b) => {
      if (!alive) return;
      setState(b.ok ? "ok" : "failed");
      if (!b.reason) return;
      setReason(b.reason);
    });
    return () => {
      alive = false;
    };
  }, [relay]);

  useEffect(() => {
    setNow(url);
    setDraft(url);
    setNonce((n) => n + 1);
  }, [url]);

  /* escape gets you out of the browser and back onto NULL */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") go({ page: back });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back]);

  const src = state === "ok" ? proxied(now) : null;

  const host = useMemo(() => {
    try {
      return new URL(now).hostname.replace(/^www\./, "");
    } catch {
      return now;
    }
  }, [now]);

  const leave = () => go({ page: back });

  return (
    <div className="bw">
      <div className="bw-bar">
        <button className="bar-btn" onClick={leave} title="Back to null" aria-label="Back to null">
          <ArrowLeft />
        </button>
        <span className="bw-lock" title={now.startsWith("https://") ? "Secure" : "Not secure"}>
          {now.startsWith("https://") ? <Lock /> : <ShieldAlert />}
        </span>
        <input
          className="bw-addr"
          value={draft}
          spellCheck={false}
          aria-label="Address"
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const to = destinationFor(draft, engine);
            if (!to) return;
            if ("page" in to) {
              go({ page: to.page });
              return;
            }
            setNow(to.url);
            setNonce((n) => n + 1);
            e.currentTarget.blur();
          }}
        />
        <button
          className="bar-btn"
          aria-label="Reload"
          title="Reload"
          onClick={() => setNonce((n) => n + 1)}
        >
          <RefreshCw />
        </button>
        <button
          className="bar-btn"
          aria-label="Open in a real tab"
          title="Open in a real tab"
          onClick={() => window.open(now, "_blank", "noopener")}
        >
          <ExternalLink />
        </button>
        <span className="bw-host" title={now}>
          {host}
        </span>
      </div>

      {state === "booting" && (
        <div className="bw-note">
          <Loader className="px-spin" />
          <h3>Starting the browser…</h3>
          <p className="faint">
            Handing {host} to Ultraviolet, which fetches it through{" "}
            <span className="mono">{relay}</span>.
          </p>
        </div>
      )}

      {state === "failed" && (
        <div className="bw-note">
          <ShieldAlert />
          <h3>{host} did not come through</h3>
          <p>{reason}</p>
          <p className="faint">
            A relay is a WebSocket server, so it cannot live on a static host. Set one you run
            in Settings, or open the site in a real tab.
          </p>
          <div className="bw-note-actions">
            <button className="btn btn--fill" onClick={() => window.open(now, "_blank", "noopener")}>
              <ExternalLink /> Open {host}
            </button>
            <button className="btn" onClick={leave}>
              <ArrowLeft /> Back to null
            </button>
          </div>
        </div>
      )}

      {src && (
        <iframe
          key={nonce}
          className="bw-frame"
          src={src}
          title={host}
          referrerPolicy="no-referrer"
          allow="clipboard-read; clipboard-write; fullscreen; gamepad; autoplay"
        />
      )}
    </div>
  );
}

/* ============================================================
   the shelf
   ============================================================ */
function Shelf({ relay }: { relay: string }) {
  const p = useStore(prefs);
  const list = entries("proxy");
  const [draft, setDraft] = useState("");

  const open = (raw: string) => {
    const to = destinationFor(raw, p.searchEngine);
    if (!to) return;
    if ("page" in to) go({ page: to.page });
    else go({ page: "proxies", arg: { url: to.url } });
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
          Every address opens fullscreen through Ultraviolet, which fetches it over the relay
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
              onChange={(e) => prefs.set({ relay: e.target.value })}
            />
          </label>
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
        <p className="tiny faint px-note">
          Brave is the default. What you type in an address box becomes a page, an address, or a
          search on this engine — in that order.
        </p>
      </div>
    </div>
  );
}

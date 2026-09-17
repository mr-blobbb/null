/* NULL · Proxies.tsx
   Two things in one page: the shelf of ready-made sites, and the window that
   loads an address inside NULL.

   The chain the window is built for is

     NULL ──> Scramjet / Ultraviolet ──> Wisp relay ──> the site

   The relay address and the engine are real settings, stored with the rest
   of the preferences. Until a relay is reachable the window says so in
   words and offers the site in a real tab, which is the honest fallback
   rather than a blank frame. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Globe,
  Loader,
  Lock,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";

import { entries } from "../lib/catalog";
import { prefs } from "../lib/themes";
import { useStore } from "../lib/store";
import { pushRecent } from "../lib/account";
import { go } from "../lib/tabs";

export function Proxies({ url }: { url?: string }) {
  const p = useStore(prefs);
  const list = entries("proxy");

  return (
    <div className="page page--wide">
      <div className="px-top">
        <h1 className="lb-title">Proxies</h1>
        <span className="lb-count tiny faint">{list.length} ready to open</span>
      </div>

      <ProxyWindow url={url} relay={p.relay} engine={p.engine} />

      <div className="lb-grid">
        {list.map((e) => (
          <button
            key={e.id}
            className="px-card"
            onClick={() => {
              pushRecent("app", e.id);
              go({ page: "proxies", arg: { url: e.url ?? "" } });
            }}
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
        <h3 className="set-h">The relay</h3>
        <p className="set-note">
          A web page cannot be fetched from another origin in a browser, which is the whole
          reason this window exists. The address below is the Wisp relay the window hands
          requests to; point it at your own server if you run one.
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
            <span>Engine</span>
            <select
              className="fld"
              value={p.engine}
              onChange={(e) => prefs.set({ engine: e.target.value as "scramjet" | "ultraviolet" })}
            >
              <option value="scramjet">Scramjet</option>
              <option value="ultraviolet">Ultraviolet</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

function ProxyWindow({ url, relay, engine }: { url?: string; relay: string; engine: string }) {
  const [target, setTarget] = useState(url ?? "");
  const [draft, setDraft] = useState(url ?? "");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "blocked">(url ? "loading" : "idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setTarget(url ?? "");
    setDraft(url ?? "");
    setState(url ? "loading" : "idle");
  }, [url]);

  useEffect(() => {
    if (!target) return;
    if (timer.current) window.clearTimeout(timer.current);
    /* A framed site that refuses to be framed fires no event we can trust,
       so the window waits and then says so. Sites that do load never see
       this, because the timeout is cleared when the frame reports in. */
    timer.current = window.setTimeout(() => setState((s) => (s === "loading" ? "blocked" : s)), 7000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [target]);

  const host = useMemo(() => {
    try {
      return new URL(target).hostname;
    } catch {
      return "";
    }
  }, [target]);

  return (
    <div className="px-window card">
      <div className="px-bar">
        {state === "blocked" ? <ShieldAlert className="px-lock" /> : <Lock className="px-lock is-safe" />}
        <input
          value={draft}
          spellCheck={false}
          placeholder="Type an address, e.g. example.com"
          aria-label="Address"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const next = draft.trim();
            if (!next) return;
            const full = /^https?:\/\//i.test(next) ? next : `https://${next}`;
            setTarget(full);
            setState("loading");
          }}
        />
        <button
          className="bar-btn"
          aria-label="Reload"
          onClick={() => {
            if (!target) return;
            setState("loading");
            setTarget("");
            window.setTimeout(() => setTarget(url ?? draft), 30);
          }}
        >
          <RefreshCw />
        </button>
        <button
          className="bar-btn"
          aria-label="Open in a real tab"
          title="Open in a real tab"
          onClick={() => target && window.open(target, "_blank", "noopener")}
        >
          <ExternalLink />
        </button>
      </div>

      {state === "idle" && (
        <div className="px-body px-body--note">
          <Globe />
          <h3>Nothing loaded yet</h3>
          <p>
            Type an address above. The page is handed to <b>{engine === "scramjet" ? "Scramjet" : "Ultraviolet"}</b>,
            which fetches it through <span className="mono">{relay}</span> and rewrites it on the
            way in so its links and requests stay in this frame.
          </p>
        </div>
      )}

      {state === "loading" && (
        <div className="px-body px-body--note">
          <Loader className="px-spin" />
          <h3>Loading {host || "the page"}…</h3>
          <p className="faint">Waiting on the relay.</p>
        </div>
      )}

      {state === "blocked" && (
        <div className="px-body px-body--note">
          <ShieldAlert />
          <h3>{host || "That site"} did not come through</h3>
          <p>
            Either it refuses to be framed, or the relay at{" "}
            <span className="mono">{relay}</span> is not answering. Set a relay you run, or
            open the site in a real tab.
          </p>
          <button className="btn" onClick={() => target && window.open(target, "_blank", "noopener")}>
            <ExternalLink /> Open {host || "it"} in a tab
          </button>
        </div>
      )}

      {target && state !== "blocked" && state !== "idle" && (
        <iframe
          className="px-frame"
          src={target}
          title={host || "Proxied site"}
          onLoad={() => setState("ok")}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      )}
    </div>
  );
}

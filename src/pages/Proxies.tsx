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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Globe,
  Loader,
  Lock,
  Radio,
  RotateCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";

import { entries } from "../lib/catalog";
import { destinationFor, type PageId } from "../lib/nav";
import { prefs } from "../lib/themes";
import { useStore } from "../lib/store";
import { clientFor, proxied, restart, start } from "../lib/browser";
import { prepare, read } from "../lib/relay";
import { activeTab, go, openDestination, openTab, useTabs } from "../lib/tabs";

/** `back` is where the escape hatch leads: a site typed into the address bar
 *  came from the proxy shelf, the movies page came from the front door.
 *  `onOpenSettings` opens the sheet on the Browser pane, which is where the
 *  relay and the engine now live. */
export function Proxies({
  url,
  back = "proxies",
  onOpenSettings,
}: {
  url?: string;
  back?: PageId;
  onOpenSettings?: () => void;
}) {
  const p = useStore(prefs);
  if (url) return <Browser url={url} relay={p.relay} back={back} />;
  return <Shelf onOpenSettings={onOpenSettings} />;
}

/* ============================================================
   the fullscreen browser
   ============================================================ */
type Mode = "booting" | "uv" | "reader" | "failed";

/** A request a copied page made over the bridge in relay.ts. */
type Ask = {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
};

/** Bytes to base64 in chunks: spreading a whole megabyte into fromCharCode
 *  blows the call stack. */
function seal(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(out);
}

/** What the rewritten window is showing, when that can be read at all. The
 *  frame is same-origin only when the service worker answered, which is
 *  exactly the case worth telling apart from a page: an unreadable frame is
 *  another origin, so it is a real page and none of our business. */
function look(frame: HTMLIFrameElement | null): { ours: boolean; chars: number } | null {
  try {
    const doc = frame?.contentDocument;
    if (!doc) return null;
    const body = doc.body;
    if (!body) return { ours: false, chars: 0 };
    const ours = !!doc.querySelector(".app .rail") || !!doc.querySelector(".app .tabs");
    return { ours, chars: (body.innerText || "").trim().length };
  } catch {
    return null;
  }
}

function Browser({ url, relay, back }: { url: string; relay: string; back: PageId }) {
  const [mode, setMode] = useState<Mode>("booting");
  const [reason, setReason] = useState("");
  /* whichever relay actually carried this page — not necessarily the one the
     setting names, because the walk in browser.ts may have moved on */
  const [served, setServed] = useState(relay);
  /* the page the relay read, ready to draw */
  const [sheet, setSheet] = useState("");
  /* whichever frame is up, so the copy can be answered and the rewritten
     window can be looked at */
  const frame = useRef<HTMLIFrameElement>(null);
  /* the copy came through as an empty shell: nothing to read, nothing to
     draw, and worth saying so instead of leaving a black pane */
  const [thin, setThin] = useState(false);
  /* the first thing the copy threw. Only shown when the page is empty as
     well — a site that works is allowed to have console noise. */
  const [says, setSays] = useState("");
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
    setServed(got.relay);
    setSheet(prepare(got.html, url));
    setMode("reader");
    return true;
  }, [url, relay]);

  useEffect(() => {
    let alive = true;
    setMode("booting");
    setReason("");
    setSheet("");
    setServed(relay);
    setThin(false);
    setSays("");
    (async () => {
      const b = await start(relay);
      if (!alive) return;
      if (b.ok) {
        if (b.relay) setServed(b.relay);
        setMode("uv");
        return;
      }
      /* remember why, so a reader failure does not hide it */
      setReason(b.reason ?? "");
      const got = await viaRelay();
      if (!alive) return;
      if (!got) setMode("failed");
    })();
    return () => {
      alive = false;
    };
  }, [relay, attempt, url, nonce, viaRelay]);

  /* Is the rewritten window showing a page? It used to be judged by the
     frame's own `load` event, which fires just as happily for an error page,
     for an empty document, and for this app's router catching /uv/service/…
     and drawing null inside the frame — a window that looked loaded and
     showed nothing. So the frame is looked at instead, every 650ms: our own
     shell, or a body with nothing in it, means the worker did not answer and
     the copy road gets its turn. */
  useEffect(() => {
    if (mode !== "uv") return;
    let ticks = 0;
    const id = window.setInterval(async () => {
      ticks += 1;
      const seen = look(frame.current);

      if (seen === null) {
        window.clearInterval(id);
        return;
      }
      if (!seen.ours && seen.chars > 0) {
        window.clearInterval(id);
        return;
      }
      if (seen.ours || ticks >= 18) {
        window.clearInterval(id);
        setReason(
          (r) =>
            r ||
            (seen.ours
              ? "The service worker was not the one answering, so the frame came back as null itself."
              : "The rewritten window never drew anything."),
        );
        const got = await viaRelay();
        if (!got) setMode("failed");
      }
    }, 650);
    return () => window.clearInterval(id);
  }, [mode, viaRelay]);

  /* Anything the copy cannot fetch itself comes back here. The copy has an
     opaque origin, so its own request would go out as `Origin: null` and be
     refused by whatever checks; this window has the relay, and this is where
     the request is allowed to happen. */
  useEffect(() => {
    if (mode !== "reader") return;
    let dead = false;

    const answer = async (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const data = e.data as { nullReq?: Ask; nullSay?: { chars: number }; nullErr?: string } | null;
      if (!data) return;

      if (data.nullErr) {
        setSays((s) => s || `The page threw while it loaded: ${data.nullErr}`);
        return;
      }

      if (data.nullSay) {
        setThin(data.nullSay.chars < 60);
        return;
      }

      const req = data.nullReq;
      if (!req) return;
      const post = (msg: unknown) => {
        if (!dead) frame.current?.contentWindow?.postMessage(msg, "*");
      };

      try {
        const client = await clientFor(served);
        const res = await client.fetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body ?? undefined,
        } as RequestInit);

        const heads: [string, string][] = [];
        res.headers.forEach((v, k) => {
          /* the length and the encoding belong to this hop, not the next one */
          if (!/^(content-length|content-encoding)$/i.test(k)) heads.push([k, v]);
        });

        post({
          nullRes: {
            id: req.id,
            status: res.status,
            statusText: res.statusText,
            headers: heads,
            body: seal(await res.arrayBuffer()),
            url: res.url,
          },
        });
      } catch (err) {
        post({ nullRes: { id: req.id, error: (err as Error).message } });
      }
    };

    window.addEventListener("message", answer);
    return () => {
      dead = true;
      window.removeEventListener("message", answer);
    };
  }, [mode, served]);

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
          ref={frame}
          className="bw-frame"
          src={src}
          title={host}
          referrerPolicy="no-referrer"
          allow="clipboard-read; clipboard-write; fullscreen; gamepad; autoplay"
        />
      )}

      {mode === "reader" && (
        <>
          <span className="bw-mode" title={`Fetched by ${served} for a sandboxed copy`}>
            <Radio /> relay copy
          </span>

          {/* why this window is on its second road. It sits above the frame
              rather than over it: the point of it is to be read. */}
          {(reason || thin || says) && (
            <div className="bw-why">
              <TriangleAlert />
              <span>
                {reason || "This site came through as an empty copy."}
                {thin
                  ? " It also arrived nearly empty. Every file the copy loads for itself — its stylesheets, its scripts, its pictures — is retried over the relay, so this is usually the network refusing them rather than the copy not asking."
                  : ""}
                {thin && says ? ` ${says}` : ""}
              </span>
              <button
                className="btn btn--sm"
                onClick={() => {
                  restart();
                  setAttempt((n) => n + 1);
                }}
              >
                <RotateCw /> Try the rewritten window
              </button>
            </div>
          )}

          <iframe
            key={`${nonce}-${url}-copy`}
            ref={frame}
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
            A relay is a WebSocket server, the one piece of this a static host cannot supply, so
            NULL keeps a list of them and tries each in turn. Every one of them was quiet just
            now — either they are having a day, or this network is blocking WebSockets. The list
            is on the shelf page if you have one of your own to add.
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
function Shelf({ onOpenSettings }: { onOpenSettings?: () => void }) {
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
        {list.length
          ? list.map((e) => (
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
                <span className={`px-status${e.status === "Fine" ? "" : " is-warn"}`}>
                  {e.status === "Fine" ? <Lock /> : <TriangleAlert />}
                  {e.status}
                </span>
              </button>
            ))
          : null}
      </div>

      <p className="tiny faint px-note">
        The relay, the engine the address bar searches with, and the rest of the browser's
        plumbing live in{" "}
        <button className="linkish" onClick={() => onOpenSettings?.()}>
          Settings → Browser
        </button>
        .
      </p>
    </div>
  );
}

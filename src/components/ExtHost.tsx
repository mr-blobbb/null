/* NULL · ExtHost.tsx
   Where a Chrome extension's own page runs.

   It runs in a sandboxed frame with `allow-scripts` and nothing else, so it
   cannot reach this document, this document's storage, or this document's
   cookies — an opaque origin, which is the strongest thing a page can offer
   another page. Its `chrome.storage` calls come back here over postMessage and
   are answered from a namespaced corner of localStorage, so an extension that
   remembers a setting still remembers it, just not by itself. */

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, FileWarning, Puzzle } from "lucide-react";

import { buildPage, isLoaded, type StoreExt } from "../lib/chromeext";

const NS = "null:extstore:";

type Req = {
  nullExt: string;
  n: number;
  op: "get" | "set" | "remove" | "clear";
  args: { area?: string; keys?: unknown; items?: Record<string, unknown> };
};

function readArea(id: string, area: string): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(`${NS}${id}:${area}`) || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeArea(id: string, area: string, value: Record<string, unknown>) {
  try {
    localStorage.setItem(`${NS}${id}:${area}`, JSON.stringify(value));
  } catch {
    /* quota, or private mode. The extension keeps working for this load. */
  }
}

export function ExtHost({ ext }: { ext: StoreExt }) {
  const [page, setPage] = useState<{ url: string; title: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    /* A dormant extension is installed, not run. Its manifest asked for
       something a web page cannot give it, and starting its popup anyway
       would half-work in ways that are worse than not starting it. */
    if (!ext.runs) {
      setProblem(ext.why ?? "This extension asks for more than a web page can give it.");
      return;
    }
    if (!isLoaded(ext.id)) {
      setProblem(
        "This extension's files were not kept across the reload — NULL holds them in memory only, and it will not put a multi-megabyte package in your storage. Add the .crx again to run it.",
      );
      return;
    }
    const built = buildPage(ext.id);
    if (!built) {
      setProblem(
        ext.hasPopup
          ? "Its manifest points at a popup that is not in the package."
          : "This extension has no popup of its own — it is built to work in the background or inside other pages, and NULL has neither.",
      );
      return;
    }
    setPage(built);
    return () => URL.revokeObjectURL(built.url);
  }, [ext.id, ext.hasPopup, ext.runs, ext.why]);

  /* the storage bridge: answer whatever the frame asks for */
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as Req | undefined;
      if (!d || d.nullExt !== ext.id || typeof d.n !== "number") return;
      const reply = (value: unknown, error?: string) => {
        (e.source as Window | null)?.postMessage({ nullExtReply: d.n, value, error }, "*");
      };
      try {
        const area = d.args?.area ?? "local";
        const store = readArea(ext.id, area);
        if (d.op === "get") {
          const keys = d.args.keys;
          if (keys === null || keys === undefined) return reply(store);
          const list = Array.isArray(keys) ? (keys as string[]) : [keys as string];
          const out: Record<string, unknown> = {};
          for (const k of list) if (k in store) out[k] = store[k];
          return reply(out);
        }
        if (d.op === "set") {
          writeArea(ext.id, area, { ...store, ...(d.args.items ?? {}) });
          return reply(undefined);
        }
        if (d.op === "remove") {
          const list = Array.isArray(d.args.keys) ? (d.args.keys as string[]) : [d.args.keys as string];
          const next = { ...store };
          for (const k of list) delete next[k];
          writeArea(ext.id, area, next);
          return reply(undefined);
        }
        writeArea(ext.id, area, {});
        return reply(undefined);
      } catch (err) {
        reply(undefined, (err as Error).message);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [ext.id]);

  if (problem) {
    return (
      <div className="exhost-note">
        <span className="ex-card-icon">
          <FileWarning />
        </span>
        <p className="muted">{problem}</p>
      </div>
    );
  }

  return (
    <div className="exhost">
      <div className="exhost-bar">
        <Puzzle />
        <b>{page?.title ?? ext.name}</b>
        <span className="tiny faint">v{ext.version}</span>
      </div>
      {page ? (
        <iframe
          ref={frame}
          className="exhost-frame"
          title={`${ext.name} popup`}
          src={page.url}
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
          referrerPolicy="no-referrer"
        />
      ) : (
        <p className="exhost-note muted">Opening…</p>
      )}
      {ext.why && (
        <p className="exhost-warn tiny">
          <AlertTriangle /> {ext.why}
        </p>
      )}
    </div>
  );
}

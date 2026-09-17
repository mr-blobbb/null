/* NULL · WebStore.tsx
   Installing a Chrome extension into NULL.

   Two doors, because only one of them is reliable. A .crx file you already
   have always works: it is read in the page with no server involved. A Web
   Store id goes through the backend, which is the only party that can reach
   Google's update endpoint — the endpoint sends no CORS headers, and it also
   refuses some networks outright, in which case NULL says exactly what Google
   answered rather than blaming itself.

   There is no pretending about the other half. What an extension may do here
   is written on its card before you install it. */

import { useRef, useState } from "react";
import { Download, FileUp, Globe, Loader2, Webhook } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { cloud } from "../lib/cloud";
import { installBytes, isLoaded, uninstallExt, useChromeExt, idFor, type StoreExt } from "../lib/chromeext";
import { ExtHost } from "./ExtHost";
import { Sheet } from "./Sheet";

export function WebStore() {
  const list = useChromeExt();
  const [open, setOpen] = useState<StoreExt | null>(null);

  return (
    <section className="ex-store">
      <div className="ex-store-head">
        <h2 className="set-h">
          <Webhook /> Chrome extensions
          <span className="ex-tag tiny">runs in a sandbox</span>
        </h2>
      </div>
      <p className="set-note">
        Bring a .crx from the Chrome Web Store and NULL will read it, keep it for this session,
        and run its popup with a small stand-in for the browser APIs behind it. Extensions that
        need to watch your traffic or touch other sites install and stay dormant — the card
        says which and why.
      </p>

      <Add onDone={setOpen} />

      {list.length > 0 && (
        <div className="ex-grid ex-grid--store">
          {list.map((e) => (
            <article className={`card ex-card${e.runs ? " is-on" : ""}`} key={e.id}>
              <div className="ex-card-top">
                <span className="ex-card-icon">
                  <Globe />
                </span>
                <div>
                  <b>{e.name}</b>
                  <span className="tiny faint">
                    v{e.version} · {e.files} files
                  </span>
                </div>
                <span className={`ex-surface ${e.runs ? "ex-surface--overlay" : ""}`}>
                  {e.runs ? "runnable" : "dormant"}
                </span>
              </div>
              <p className="ex-desc">{e.desc}</p>
              {e.permissions.length + e.hosts.length > 0 && (
                <div className="ex-access">
                  {[...e.permissions, ...e.hosts].slice(0, 8).map((p) => (
                    <span className="pill" key={p}>
                      {p}
                    </span>
                  ))}
                </div>
              )}
              {e.why && <p className="tiny faint ex-store-why">{e.why}</p>}
              <div className="ex-actions">
                <button className="btn btn--sm" onClick={() => setOpen(e)}>
                  {e.runs && isLoaded(e.id) && e.hasPopup ? "Open its popup" : "Details"}
                </button>
                <button
                  className="btn btn--sm btn--icon"
                  title="Remove"
                  onClick={() => uninstallExt(e.id)}
                >
                  <Download />
                </button>
              </div>
              <p className="tiny faint">added from {e.from}</p>
            </article>
          ))}
        </div>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} width={520} title={open?.name} icon={<Globe />}>
        {open && <ExtHost ext={open} />}
      </Sheet>
    </section>
  );
}

function Add({ onDone }: { onDone: (e: StoreExt) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [id, setId] = useState("");
  const [busy, setBusy] = useState<"file" | "store" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  /** Accept either a bare id or any URL that has one in it — people paste the
   *  store link, not the id. */
  function idFrom(raw: string): string {
    const s = raw.trim();
    const hit = s.match(/([a-p]{32})/i);
    return hit ? hit[1].toLowerCase() : "";
  }

  async function fromBackend() {
    const clean = idFrom(id);
    if (!clean) return setErr("That is not a Chrome extension id — they are 32 letters, a–p.");
    const c = cloud();
    if (!c) return setErr("Fetching from the Web Store needs the backend, and this build has none.");
    setBusy("store");
    setErr(null);
    setOk(null);
    try {
      const res = await c.action(api.store.pull, { id: clean });
      if (!res.ok) throw new Error(res.reason);
      const blob = await (await fetch(res.url as string)).arrayBuffer();
      const card = await installBytes(new Uint8Array(blob), `the Web Store (${clean})`, `chrome-${clean}`);
      setOk(`${card.name} was read: ${card.files} files.`);
      setId("");
      onDone(card);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function fromFile(f: File | undefined | null) {
    if (!f) return;
    setBusy("file");
    setErr(null);
    setOk(null);
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const probe = await import("../lib/crx");
      const pack = await probe.openCrx(buf);
      const card = await installBytes(buf, `a file (${f.name})`, idFor(pack.manifest.name ?? f.name, pack.manifest.version ?? "0"));
      setOk(`${card.name} was read: ${card.files} files.`);
      onDone(card);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card card--pad ex-add">
      <div className="ex-add-row">
        <button className="btn" onClick={() => file.current?.click()} disabled={busy !== null}>
          {busy === "file" ? <Loader2 className="spin" /> : <FileUp />} Add a .crx
        </button>
        <input
          ref={file}
          type="file"
          accept=".crx,application/x-chrome-extension,application/zip"
          hidden
          onChange={(e) => void fromFile(e.target.files?.[0])}
        />

        <span className="ex-add-or tiny faint">or</span>

        <label className="lb-find ex-add-store">
          <Globe />
          <input
            value={id}
            spellCheck={false}
            placeholder="Paste a Web Store link or extension id"
            aria-label="Chrome Web Store link or id"
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void fromBackend();
            }}
          />
        </label>
        <button className="btn btn--fill" onClick={() => void fromBackend()} disabled={busy !== null || !id.trim()}>
          {busy === "store" ? <Loader2 className="spin" /> : <Download />} Fetch
        </button>
      </div>
      {err && <p className="form-err">{err}</p>}
      {ok && <p className="tiny faint">{ok}</p>}
      <p className="tiny faint">
        On a network Google will not serve, the fetch fails and says so — the .crx route always works,
        because nothing but this page has to read it.
      </p>
    </div>
  );
}

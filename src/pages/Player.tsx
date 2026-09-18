/* NULL · Player.tsx
   The window a game or an app opens in. Full width, no page chrome, one
   small bar on top with the name and the controls that matter: reload,
   fullscreen, and back to the library.

   While this page is the active tab the coin clock counts for it, which is
   what makes playing the way you earn.

   Two kinds of file end up in the frame. A local path is framed as it is. An
   https URL is a discovered game, and it gets one of two roads: a site that
   allows framing (truffled.lol and friends) is framed directly, while raw
   GitHub serves pages as text/plain — no browser will run one in a frame —
   so the page is fetched here and handed to the frame as a blob. If even the
   fetch is refused, the bar says so and the offer is a real tab. */

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Expand, ExternalLink, Gamepad2, RefreshCw } from "lucide-react";

import { find } from "../lib/catalog";
import { go } from "../lib/tabs";
import { trackPlay } from "../lib/econ";

/** raw.githubusercontent serves everything as text/plain, which browsers
 *  refuse to run; those pages must be fetched and re-served as a blob. */
const NEEDS_BLOB = /raw\.githubusercontent\.com|gist\.githubusercontent\.com/;

const isRemote = (file?: string) => !!file && /^https?:\/\//i.test(file);

export function Player({ kind, id }: { kind: string; id: string }) {
  const entry = find(kind as "game" | "app", id);
  const [nonce, setNonce] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (entry) trackPlay(entry.id);
  }, [entry?.id]);

  const open = () => {
    const f = frame.current;
    if (!f) return;
    const doc = f.contentDocument; // same-origin only; a remote game refuses
    if (doc?.documentElement?.requestFullscreen) doc.documentElement.requestFullscreen();
    else f.requestFullscreen?.();
  };

  return (
    <div className="play">
      <header className="play-bar">
        <button className="bar-btn" onClick={() => go({ page: kind === "app" ? "apps" : "games" })} aria-label="Back">
          <ArrowLeft />
        </button>
        <span className="play-name">
          <Gamepad2 />
          {entry?.name ?? "Nothing loaded"}
        </span>
        <span className="play-host mono tiny faint">{entry?.file ?? id}</span>
        <button className="bar-btn" onClick={() => setNonce((n) => n + 1)} aria-label="Reload" title="Reload">
          <RefreshCw />
        </button>
        <button className="bar-btn" onClick={open} aria-label="Fullscreen" title="Fullscreen">
          <Expand />
        </button>
      </header>

      {entry?.file ? (
        isRemote(entry.file) ? (
          <RemoteFrame key={nonce} file={entry.file} name={entry.name} />
        ) : (
          <iframe className="play-frame" src={entry.file} title={entry.name} allow="fullscreen; gamepad; autoplay" />
        )
      ) : (
        <div className="play-empty">
          <Gamepad2 />
          <h2>{entry ? `${entry.name} has no files yet` : "Nothing loaded"}</h2>
          <p>
            {entry
              ? "The catalog lists it, but there is no build to run. Add the file and point the entry at it."
              : "Open something from the library and it plays here."}
          </p>
          <button className="btn btn--fill" onClick={() => go({ page: "games" })}>
            <ArrowLeft /> Back to the library
          </button>
        </div>
      )}
    </div>
  );
}

/** A blob has no directory, so `scripts/game.js` inside a copied page has
 *  nowhere to resolve to. Pointing the page back at the folder it came from
 *  fixes every relative asset it asks for; the ones that are not in the stash
 *  are missing either way, which is the stash's business, not ours. */
function rebased(html: string, file: string): string {
  const dir = file.slice(0, file.lastIndexOf("/") + 1);
  const base = `<base href="${dir}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + base);
  return base + html;
}

/** A discovered game. Frame what allows framing; fetch the rest. */
function RemoteFrame({ file, name }: { file: string; name: string }) {
  const [blob, setBlob] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!NEEDS_BLOB.test(file)) return;
    let url: string | null = null;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(file);
        if (!res.ok) throw new Error(`it answered ${res.status}`);
        const kind = res.headers.get("content-type") ?? "text/html";
        const html = await res.text();
        url = URL.createObjectURL(new Blob([rebased(html, file)], { type: kind }));
        if (alive) setBlob(url);
      } catch (e) {
        if (alive) setProblem((e as Error).message);
      }
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  if (problem) {
    return (
      <div className="play-empty">
        <Gamepad2 />
        <h2>{name} would not load</h2>
        <p>The stash it lives on refused the request ({problem}). It may still open on its own.</p>
        <a className="btn btn--fill" href={file} target="_blank" rel="noreferrer noopener">
          <ExternalLink /> Open in a real tab
        </a>
      </div>
    );
  }

  if (NEEDS_BLOB.test(file)) {
    if (!blob) {
      return (
        <div className="play-empty">
          <Gamepad2 />
          <h2>Fetching {name}…</h2>
          <p>It lives on a stash that serves pages as text, so NULL is copying it over first.</p>
        </div>
      );
    }
    return <iframe className="play-frame" src={blob} title={name} allow="fullscreen; gamepad; autoplay" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />;
  }

  return <iframe className="play-frame" src={file} title={name} allow="fullscreen; gamepad; autoplay" />;
}

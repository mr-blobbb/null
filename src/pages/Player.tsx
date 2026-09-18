/* NULL · Player.tsx
   The window a game or an app opens in. The whole page is the game, and the
   three controls that matter — back, reload, fullscreen — float over the
   corner as one small pill so the frame gets everything else.

   While this page is the active tab the coin clock counts for it, which is
   what makes playing the way you earn.

   Two kinds of file end up in the frame. A local path is framed as it is. An
   https URL is a discovered game, and it gets one of two roads: a site that
   allows framing (truffled.lol and friends) is framed directly, while raw
   GitHub serves pages as text/plain — no browser will run one in a frame —
   so the page is fetched here and handed to the frame as a blob. The blob is
   always labelled text/html: taking the label from the response is how a
   stashed game ends up rendered as its own source code. */

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
      {/* the only chrome on the page: three controls in a pill that floats over
          the frame. The name lives in the tooltips, because the game is what
          the page is for. */}
      <header className="play-pill" title={entry ? `${entry.name}\n${entry.file ?? id}` : undefined}>
        <button
          className="play-btn"
          onClick={() => go({ page: kind === "app" ? "apps" : "games" })}
          aria-label="Back to the library"
          title={`Back to ${kind === "app" ? "apps" : "games"}`}
        >
          <ArrowLeft />
        </button>
        <button className="play-btn" onClick={() => setNonce((n) => n + 1)} aria-label="Reload" title="Reload">
          <RefreshCw />
        </button>
        <button className="play-btn" onClick={open} aria-label="Fullscreen" title="Fullscreen">
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

/** Fetch a stashed page, with one retry. Raw GitHub answers 429 when a page
 *  asks it for a dozen files at once, and a game that needs clicking twice is
 *  a game that looks broken the first time. */
async function grab(url: string): Promise<string> {
  for (let go = 0; ; go++) {
    const res = await fetch(url);
    if (res.ok) return res.text();
    if (go === 0 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 700));
      continue;
    }
    throw new Error(`it answered ${res.status}`);
  }
}

/** A blob has no directory, so `scripts/game.js` inside a copied page has
 *  nowhere to resolve to. Pointing the page back at the folder it came from
 *  fixes every relative asset it asks for; the ones that are not in the stash
 *  are missing either way, which is the stash's business, not ours.
 *
 *  A page that names a base of its own is left completely alone. Several of
 *  the stashes point theirs at a CDN that really does hold their files, and
 *  the *first* base wins — so ours would override the one that works and turn
 *  a game that played into one that cannot find its own scripts. */
function rebased(html: string, file: string): string {
  if (/<base\s/i.test(html)) return html;
  const dir = file.slice(0, file.lastIndexOf("/") + 1);
  const base = `<base href="${dir}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + base);
  return base + html;
}

/** A discovered game. Frame what allows framing; fetch the rest. */
function RemoteFrame({ file, name }: { file: string; name: string }) {
  const [blob, setBlob] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!NEEDS_BLOB.test(file)) return;
    let url: string | null = null;
    let alive = true;
    setProblem(null);
    (async () => {
      try {
        const html = await grab(file);
        /* The frame runs what the blob's type says it is, and a raw GitHub
           URL says text/plain — which is a browser faithfully printing the
           page's source at you. The type is ours to choose, so it is always
           html, whatever the stash labels its own files. */
        url = URL.createObjectURL(new Blob([rebased(html, file)], { type: "text/html;charset=utf-8" }));
        if (alive) setBlob(url);
      } catch (e) {
        if (alive) setProblem((e as Error).message);
      }
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, attempt]);

  if (problem) {
    return (
      <div className="play-empty">
        <Gamepad2 />
        <h2>{name} would not load</h2>
        <p>The stash it lives on refused the request ({problem}). It may still open on its own.</p>
        <div className="play-empty-row">
          <button className="btn" onClick={() => setAttempt((n) => n + 1)}>
            <RefreshCw /> Try again
          </button>
          <a className="btn btn--fill" href={file} target="_blank" rel="noreferrer noopener">
            <ExternalLink /> Open in a real tab
          </a>
        </div>
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

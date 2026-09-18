/* NULL · Player.tsx
   The window a game or an app opens in. The whole page is the game, and the
   three controls that matter — back, reload, fullscreen — float over the
   corner as one small pill so the frame gets everything else.

   While this page is the active tab the coin clock counts for it, which is
   what makes playing the way you earn.

   Three roads, tried in order, because no single one works everywhere:

   · **inline** — fetch the page, hand its markup to a shadow root and
     re-create its scripts so they run. No frame at all, so nothing can decide
     it is not allowed to be framed, which is what a browser refusing a
     third-party frame otherwise reads as. A host that will not answer this
     document is read through the site's own relay instead — see readPage().
   · **frame** — the honest road: the game gets its own document and no way
     into ours. Used when the stash cannot be copied, or when the copy did not
     draw.
   · **copy** — fetch the page and serve it as a blob, for hosts that hand
     html over as text/plain (raw GitHub) and for anything the frame gave up
     on.

   The inline road is the one with a price: that code is running in NULL's own
   document, so it can see what this origin keeps. It is only used for the
   public game stashes, whose pages are read as text before they are run, and
   the pill is always there to leave. */

import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowLeft, Expand, ExternalLink, Gamepad2, RefreshCw } from "lucide-react";

import { find } from "../lib/catalog";
import { go } from "../lib/tabs";
import { trackPlay } from "../lib/econ";
import { AS_TEXT, COPYABLE, mountInline, readPage, rebased } from "../lib/rungame";

/** How long a frame gets to show something before the next road is tried. A
 *  host that resets the connection never fires `load`, so this is the only way
 *  to notice — and a page that resets is exactly what a visitor reports. */
const GRACE = 3500;

const isRemote = (file?: string) => !!file && /^https?:\/\//i.test(file);

type Road = "inline" | "frame" | "copy";

function roadsFor(file: string): Road[] {
  /* raw GitHub serves html as text/plain, which no frame will run */
  if (AS_TEXT.test(file)) return ["inline", "copy"];
  /* a stash that answers a cross-origin fetch is the easiest one: read, run,
     and if that does not draw, frame it, and if that does not draw, copy it */
  if (COPYABLE.test(file)) return ["inline", "frame", "copy"];
  /* anything else is read through the site's own relay first: a frame is the
     road most likely to be refused, and the relay makes the page readable
     whether its host likes us asking or not */
  return ["inline", "frame"];
}

export function Player({ kind, id }: { kind: string; id: string }) {
  const entry = find(kind as "game" | "app", id);
  const [nonce, setNonce] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (entry) trackPlay(entry.id);
  }, [entry?.id]);

  const open = () => {
    const f = frame.current;
    const doc = f?.contentDocument; // same-origin only; a remote game refuses
    if (doc?.documentElement?.requestFullscreen) {
      doc.documentElement.requestFullscreen();
      return;
    }
    /* an inline game has no frame to ask, so the stage itself goes fullscreen */
    (f ?? stage.current)?.requestFullscreen?.();
  };

  return (
    <div className="play" ref={stage}>
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
          <RemoteGame key={nonce} file={entry.file} name={entry.name} frame={frame} />
        ) : (
          <iframe
            ref={frame}
            className="play-frame"
            src={entry.file}
            title={entry.name}
            allow="fullscreen; gamepad; autoplay"
          />
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

/* ============================================================
   a discovered game: three roads, in order
   ============================================================ */

function RemoteGame({
  file,
  name,
  frame,
}: {
  file: string;
  name: string;
  frame: RefObject<HTMLIFrameElement | null>;
}) {
  const roads = roadsFor(file);
  const [step, setStep] = useState(0);
  const [live, setLive] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const road = roads[step];

  const next = (reason: string) => {
    setWhy(reason);
    setStep((n) => n + 1);
  };

  /* a frame road has to prove itself: nothing drawn in a few seconds, and the
     next road is tried. Anything already drawn stays drawn. */
  useEffect(() => {
    if (road !== "frame" || live) return;
    const t = setTimeout(() => setStep((n) => n + 1), GRACE);
    return () => clearTimeout(t);
  }, [road, live, step]);

  if (!road) {
    return (
      <div className="play-empty">
        <Gamepad2 />
        <h2>{name} would not load</h2>
        <p>
          Every road into this one was refused{why ? ` — the last reason was: ${why}` : ""}. Some
          hosts only answer their own players, and their games still open on their own site.
        </p>
        <div className="play-empty-row">
          <button
            className="btn"
            onClick={() => {
              setWhy(null);
              setLive(false);
              setStep(0);
            }}
          >
            <RefreshCw /> Try again
          </button>
          <a className="btn btn--fill" href={file} target="_blank" rel="noreferrer noopener">
            <ExternalLink /> Open in a real tab
          </a>
        </div>
      </div>
    );
  }

  if (road === "inline") {
    return <InlineGame file={file} name={name} onFail={() => next("the page could not be read")} />;
  }

  if (road === "copy") {
    return (
      <CopiedFrame
        file={file}
        name={name}
        frame={frame}
        onLoad={() => setLive(true)}
        onFail={(reason) => next(reason)}
      />
    );
  }

  return (
    <iframe
      ref={frame}
      className="play-frame"
      src={file}
      title={name}
      onLoad={() => setLive(true)}
      referrerPolicy="no-referrer"
      allow="fullscreen; gamepad; autoplay"
    />
  );
}

/** Relative requests at runtime resolve against the document, and a copied
 *  game needs them to resolve against the stash. Put a base in while it runs,
 *  take it out when it goes. */
function useBase(file: string, active: boolean) {
  const added = useRef<HTMLBaseElement | null>(null);
  useEffect(() => {
    if (!active) return;
    const dir = file.slice(0, file.lastIndexOf("/") + 1);
    const el = document.createElement("base");
    el.href = dir;
    document.head.querySelectorAll("base").forEach((b) => b.remove());
    document.head.prepend(el);
    added.current = el;
    return () => {
      if (added.current === el) el.remove();
    };
  }, [file, active]);
}

function InlineGame({ file, name, onFail }: { file: string; name: string; onFail: (why: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /* the base is in for the whole game, not just the mount: the first thing a
     copied game does is ask for a level or a sprite, and those relative asks
     have to land on the stash, not on NULL */
  useBase(file, true);

  useEffect(() => {
    let alive = true;
    const el = host.current;
    if (!el) return;
    (async () => {
      try {
        const html = await readPage(file);
        if (!alive || !el) return;
        mountInline(el, html, file);
        if (alive) setReady(true);
      } catch (e) {
        if (!alive) return;
        setProblem((e as Error).message);
        /* a page that cannot be read is not a road at all: move on */
        onFail((e as Error).message);
      }
    })();
    return () => {
      alive = false;
      if (el.shadowRoot) el.shadowRoot.textContent = "";
    };
  }, [file]);

  if (problem) {
    return (
      <div className="play-empty">
        <Gamepad2 />
        <h2>{name} could not be read</h2>
        <p>The stash refused to hand the page over ({problem}). Trying another way in…</p>
      </div>
    );
  }

  return (
    <div className="play-inline" ref={host}>
      {!ready && (
        <div className="play-empty">
          <Gamepad2 />
          <h2>Loading {name}…</h2>
          <p>NULL is reading the game itself rather than framing it.</p>
        </div>
      )}
    </div>
  );
}

/* ---------- the copy road ----------
   For pages no frame will run: fetched, re-labelled as html and handed to a
   frame as a blob. The blob is always labelled text/html — taking the label
   from the response is how a stashed game ends up rendered as its own source
   code. A blob has no directory, so a base is injected for the assets, unless
   the page names one of its own, which wins. */
function CopiedFrame({
  file,
  name,
  frame,
  onLoad,
  onFail,
}: {
  file: string;
  name: string;
  frame: RefObject<HTMLIFrameElement | null>;
  onLoad: () => void;
  onFail: (why: string) => void;
}) {
  const [blob, setBlob] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    (async () => {
      try {
        const html = await readPage(file);
        if (!alive) return;
        url = URL.createObjectURL(new Blob([rebased(html, file)], { type: "text/html;charset=utf-8" }));
        setBlob(url);
      } catch (e) {
        if (alive) onFail((e as Error).message);
      }
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!blob) {
    return (
      <div className="play-empty">
        <Gamepad2 />
        <h2>Fetching {name}…</h2>
        <p>It lives on a stash that serves pages as text, so NULL is copying it over first.</p>
      </div>
    );
  }

  return (
    <iframe
      ref={frame}
      className="play-frame"
      src={blob}
      title={name}
      onLoad={onLoad}
      referrerPolicy="no-referrer"
      allow="fullscreen; gamepad; autoplay"
      /* a copied page came from a stranger and inherits this origin, so it is
         sandboxed without allow-same-origin: its own storage, its own files,
         no way to read anything of NULL's. */
      sandbox="allow-scripts allow-popups allow-forms allow-pointer-lock allow-modals"
    />
  );
}


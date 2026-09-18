/* NULL · Player.tsx
   The window a game or an app opens in. The whole page is the game, and the
   three controls that matter — back, reload, fullscreen — float over the
   corner as one small pill so the frame gets everything else.

   While this page is the active tab the coin clock counts for it, which is
   what makes playing the way you earn.

   Three roads, tried in order, because no single one works everywhere. Which
   one goes first is decided by what the stash answers with:

   · **frame** — the honest road, and the first one for a stash that serves
     html as html over a header that does not refuse framing (raw.githack, and
     that is what the library is mirrored through). The game gets a real
     document: its scripts find the elements they came with, its canvases,
     workers, modules and saves all work, and it has no way into ours.
   · **copy** — the page is fetched, given a <base> and served to a frame as a
     blob, so the frame never asks the far host for anything and no host can
     refuse it. This is the road for a stash that hands html over as
     text/plain, and the one that picks up a game whose host does refuse to be
     framed. A blob document is a real document too, which is why it comes
     before the last road rather than after it.
   · **inline** — the page's markup into a shadow root in this document, its
     scripts re-created so they run. No frame at all, so nothing can refuse
     it, and it is the only road left when even the relay will not hand the
     page over. Its price is real: a shadow root is not a document, so a game
     whose script opens with `document.getElementById` finds nothing. That is
     why it is last, and why a game that needs its own document is never sent
     down it.

   All three run code from a stash this site does not control, and the last one
   runs it in NULL's own document. The pill is always there to leave. */

import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowLeft, Expand, ExternalLink, Gamepad2, RefreshCw, Route } from "lucide-react";

import { find } from "../lib/catalog";
import { go } from "../lib/tabs";
import { trackPlay } from "../lib/econ";
import { AS_TEXT, baseOf, COPYABLE, mountInline, readPage, rebased } from "../lib/rungame";

/** How long a frame gets to show something before the next road is tried. A
 *  host that resets the connection never fires `load`, so this is the only way
 *  to notice — and a page that resets is exactly what a visitor reports. */
const GRACE = 3500;

const isRemote = (file?: string) => !!file && /^https?:\/\//i.test(file);

type Road = "frame" | "copy" | "inline";

function roadsFor(file: string): Road[] {
  /* raw GitHub serves html as text/plain, which no frame will run, so the
     page is copied into a frame of our own instead */
  if (AS_TEXT.test(file)) return ["copy", "inline"];
  /* the mirror the library is served through: proper types, no framing
     header, and it answers this document's own fetch, so all three roads are
     open and the most faithful one is first */
  if (COPYABLE.test(file)) return ["frame", "copy", "inline"];
  /* an unknown host is the one most likely to refuse a frame and least likely
     to let this document read it, so it is read through the site's own relay
     and handed to a frame we fill ourselves; framing it directly is the last
     thing tried */
  return ["copy", "inline", "frame"];
}

export function Player({ kind, id }: { kind: string; id: string }) {
  const entry = find(kind as "game" | "app", id);
  const [nonce, setNonce] = useState(0);
  /** bumped when a player asks for the game by another road than this one */
  const [route, setRoute] = useState(0);
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
        {/* a stash can refuse one road without refusing the next, and a frame
            that came back empty looks exactly like a game that is slow. One
            button to walk the game onto the next road is worth more than any
            amount of guessing here. */}
        {entry?.file && isRemote(entry.file) && (
          <button
            className="play-btn"
            onClick={() => setRoute((n) => n + 1)}
            aria-label="Try another way in"
            title="Try another way in"
          >
            <Route />
          </button>
        )}
        <button className="play-btn" onClick={open} aria-label="Fullscreen" title="Fullscreen">
          <Expand />
        </button>
      </header>

      {entry?.file ? (
        isRemote(entry.file) ? (
          <RemoteGame key={nonce} file={entry.file} name={entry.name} frame={frame} route={route} />
        ) : (
          <iframe
            ref={frame}
            className="play-frame"
            src={entry.file}
            title={entry.name}
            allow="fullscreen; gamepad; autoplay; pointer-lock"
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
  route,
}: {
  file: string;
  name: string;
  frame: RefObject<HTMLIFrameElement | null>;
  /** bumped by the pill to move the game on to the next road by hand */
  route: number;
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

  /* asked for by hand: wrap round, so a road that did not draw can be looked
     at again once the others have had their turn */
  useEffect(() => {
    if (!route) return;
    setLive(false);
    setWhy("another road, asked for by hand");
    setStep((n) => (n + 1) % roads.length);
  }, [route]);

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
      /* pointer-lock is the one of these a cross-origin frame does not inherit:
         without it an fps game cannot capture the mouse */
      allow="fullscreen; gamepad; autoplay; pointer-lock"
    />
  );
}

/* Relative requests at runtime resolve against the document, and a copied game
   has to ask for its level files somewhere that is not NULL. The base goes in
   for the whole game, not just the mount: the first thing most of them do is
   ask for a sprite or a level, and those asks have to land on the stash.

   Which stash is not always the one the page came from — several of these
   games name their own base and point it at an asset CDN that really does hold
   their files. So the base comes out of the page itself (see baseOf), and it
   goes in before the scripts do, because a script that fetches on its first
   line resolves against the document as it is at that moment. */
function InlineGame({ file, name, onFail }: { file: string; name: string; onFail: (why: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let base: HTMLBaseElement | null = null;
    const el = host.current;
    if (!el) return;
    (async () => {
      try {
        const html = await readPage(file);
        if (!alive) return;
        /* written straight into the document rather than left to a re-render:
           the scripts are created in the very next line, and one of them may
           fetch before that render ever happens */
        base = document.createElement("base");
        base.href = baseOf(html, file);
        document.head.querySelectorAll("base").forEach((b) => b.remove());
        document.head.prepend(base);
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
      if (base && document.head.querySelector("base") === base) base.remove();
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
      allow="fullscreen; gamepad; autoplay; pointer-lock"
      /* a copied page came from a stranger and inherits this origin, so it is
         sandboxed without allow-same-origin: its own storage, its own files,
         no way to read anything of NULL's. */
      sandbox="allow-scripts allow-popups allow-forms allow-pointer-lock allow-modals"
    />
  );
}


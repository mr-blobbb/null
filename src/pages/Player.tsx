/* NULL · Player.tsx
   The window a game or an app opens in. The whole page is the game, and the
   three controls that matter — back, reload, fullscreen — float over the
   corner as one small pill so the frame gets everything else.

   While this page is the active tab the coin clock counts for it, which is
   what makes playing the way you earn.

   Three roads, tried in order, because no single one works everywhere. Which
   one goes first is decided by what the stash answers with:

   · **copy** — the page is fetched, given a <base> so its own files resolve
     back to the stash, and handed to a frame as a blob. It is first, and not
     because of MIME types: this is the road that **never navigates to the
     stash**. A filtered network — a school agent, an extension, an enterprise
     policy — blocks by URL, and what it blocks is the navigation, which is why
     a game in a frame comes back as "this page has been blocked by Chrome"
     rather than as a game. A frame holding a blob document was never sent to
     that URL at all, so there is nothing there to block. It is also still a
     real document, which is the other half of the point: a game's scripts find
     the elements they came with.
   · **inline** — the page's markup into a shadow root in this document, its
     scripts re-created so they run. Nothing is framed and nothing is navigated
     to, so nothing can refuse it — but a shadow root is not a document, so a
     game whose script opens with `document.getElementById` finds nothing. That
     is the whole reason it sits behind the copy road and not in front of it.
   · **frame** — the honest road, and now the last one: the game gets its own
     document, its own origin, its real storage and workers. It is what a game
     that checks where it is running needs. It is also the road that asks the
     network for a URL, so on a filtered network it is the one that fails.

   All three run code from a stash this site does not control, and the last one
   runs it in NULL's own document. The pill is always there to leave, and its
   route button walks the game on to the next road when a road is not enough. */

import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowLeft, Cloud, Expand, ExternalLink, Gamepad2, RefreshCw, Route, TriangleAlert } from "lucide-react";

import { CloudSaves } from "../components/CloudSaves";
import { find } from "../lib/catalog";
import { go } from "../lib/tabs";
import { trackPlay } from "../lib/econ";
import { AS_TEXT, baseOf, mountInline, readPage, rebased, withShim } from "../lib/rungame";

/** How long a frame gets to show something before the next road is tried. A
 *  host that resets the connection never fires `load`, so this is the only way
 *  to notice — and a page that resets is exactly what a visitor reports. */
const GRACE = 3500;

const isRemote = (file?: string) => !!file && /^https?:\/\//i.test(file);

type Road = "frame" | "copy" | "inline";

function roadsFor(file: string): Road[] {
  /* raw GitHub serves html as text/plain, so a frame handed that URL shows its
     own source code — there is nothing for the frame road to offer */
  return AS_TEXT.test(file) ? ["copy", "inline"] : ["copy", "inline", "frame"];
}

export function Player({ kind, id }: { kind: string; id: string }) {
  const entry = find(kind as "game" | "app", id);
  /** an entry can ask to be read before it starts — see games/README.txt */
  const [read, setRead] = useState(false);
  const [nonce, setNonce] = useState(0);
  /** bumped when a player asks for the game by another road than this one */
  const [route, setRoute] = useState(0);
  /** the save slots, drawn over the game rather than beside it */
  const [cloud, setCloud] = useState(false);
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
        {entry?.url && !entry?.file && (
          <button
            className="play-btn"
            onClick={() => setRoute((n) => n + 1)}
            aria-label="Try another way in"
            title="Try another way in"
          >
            <Route />
          </button>
        )}
        {/* the saves of whatever is open, on the account rather than the
            machine: the same progress at school and at home */}
        {entry && (
          <button
            className={`play-btn${cloud ? " is-on" : ""}`}
            onClick={() => setCloud((v) => !v)}
            aria-label="Cloud saves"
            title="Cloud saves"
          >
            <Cloud />
          </button>
        )}
        <button className="play-btn" onClick={open} aria-label="Fullscreen" title="Fullscreen">
          <Expand />
        </button>
      </header>

      {cloud && entry && (
        <aside className="play-cloud">
          <CloudSaves
            game={entry.id}
            name={entry.name}
            frame={entry.file ? frame : undefined}
            onRestored={() => setNonce((n) => n + 1)}
          />
        </aside>
      )}

      {entry?.warning && !read ? (
        <div className="play-empty">
          <TriangleAlert />
          <h2>{entry.warning.title}</h2>
          <p>{entry.warning.body}</p>
          <div className="play-empty-row">
            <button className="btn" onClick={() => go({ page: kind === "app" ? "apps" : "games" })}>
              <ArrowLeft /> Back to the library
            </button>
            <button className="btn btn--fill" onClick={() => setRead(true)}>
              Continue to {entry.name}
            </button>
          </div>
        </div>
      ) : entry?.file ? (
        isRemote(entry.file) ? (
          entry.url ? (
            /* a cloud title: the file is the service's player page, which NULL
               frames like any other game. The `url` beside it is the same
               service in a real tab — the honest place to go when the stream
               refuses to be framed, which is what the route button does. */
            <CloudGame
              key={nonce}
              file={entry.file}
              url={entry.url}
              name={entry.name}
              frame={frame}
              route={route}
            />
          ) : (
            <RemoteGame key={nonce} file={entry.file} name={entry.name} frame={frame} route={route} />
          )
        ) : (
          <iframe
            ref={frame}
            className="play-frame"
            src={entry.file}
            title={entry.name}
            allow="fullscreen; gamepad; autoplay; pointer-lock"
          />
        )
      ) : entry?.url ? (
        /* a cloud title: named, pictured, browsable, and not a file anywhere.
           The service that streams it is the only place it can be played, so
           the card hands over to the service rather than pretending. */
        <div className="play-empty">
          <Cloud />
          <h2>{entry.name} is streamed, not downloaded</h2>
          <p>
            Cloud titles run on a service that holds the licence and brokers every session, so
            there is nothing here to copy into a frame. Opening the service is where it plays.
          </p>
          <div className="play-empty-row">
            <button className="btn" onClick={() => go({ page: "games" })}>
              <ArrowLeft /> Back to the library
            </button>
            <a className="btn btn--fill" href={entry.url} target="_blank" rel="noreferrer noopener">
              <ExternalLink /> Open the cloud service
            </a>
          </div>
        </div>
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
           mountInline appends the page's scripts before returning, and a boot
           script that fetches on its first line resolves against whatever the
           document points at *that moment*. So the base is committed (and a
           layout pass spent) before the loader is called — scripts appended
           under a missing or half-written base is how pages come back black,
           or as a pile of ReferenceErrors. */
        base = document.createElement("base");
        base.href = baseOf(html, file);
        document.head.querySelectorAll("base").forEach((b) => b.remove());
        document.head.prepend(base);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        if (!alive) return;
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
  const loaded = useRef(false);

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    (async () => {
      try {
        const html = await readPage(file);
        if (!alive) return;
        /* the storage shim goes in ahead of the page: a sandboxed copy has no
           origin, so `localStorage` throws on first touch, and a game that
           reads its save on boot threw before it drew — the black and white
           screens. The shim answers instead, in memory. */
        url = URL.createObjectURL(new Blob([withShim(rebased(html, file))], { type: "text/html;charset=utf-8" }));
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

  useEffect(() => {
    if (!blob) return;
    loaded.current = false;
    const timer = window.setTimeout(() => {
      if (!loaded.current) onFail("the copied game document did not finish loading");
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [blob, onFail]);

  if (!blob) {
    return (
      <div className="play-empty">
        <Gamepad2 />
        <h2>Fetching {name}…</h2>
        <p>NULL is copying the authorized game files into an isolated player.</p>
      </div>
    );
  }

  return (
    <iframe
      ref={frame}
      className="play-frame"
      src={blob}
      title={name}
      onLoad={() => {
        loaded.current = true;
        onLoad();
      }}
      referrerPolicy="no-referrer"
      allow="fullscreen; gamepad; autoplay; pointer-lock"
      /* Unity/WebGL engines need a normal origin for WASM workers, asset
         fetches, and storage. The sandbox still blocks top navigation and
         access to the parent document. */
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock allow-modals"
    />
  );
}

/* ---------- the cloud road ----------
   A cloud title has no files to copy: what plays is the service's own player
   page, which negotiates the session and draws the stream. So there is one
   road — frame the page — and a plain frame at that, no sandbox and no
   blob: a WebRTC player needs its own origin, its workers and its storage
   to talk to the signalling server.

   The grace clock still runs. If the page draws nothing — a service that
   refuses frames, or one that is down — the frame is swapped for the card
   that offers the service in a real tab, which is the honest fallback the
   `url` field on the entry is there for. */
function CloudGame({
  file,
  url,
  name,
  frame,
  route,
}: {
  file: string;
  url: string;
  name: string;
  frame: RefObject<HTMLIFrameElement | null>;
  route: number;
}) {
  const [live, setLive] = useState(false);
  /* bumped by the grace clock: past it, the offer to open the service replaces the frame */
  const [cold, setCold] = useState(false);

  /* asked for by hand: wrap round, same as the remote roads do */
  useEffect(() => {
    if (!route) return;
    setCold(false);
    setLive(false);
  }, [route]);

  useEffect(() => {
    if (live || cold) return;
    const t = setTimeout(() => setCold(true), GRACE * 2);
    return () => clearTimeout(t);
  }, [live, cold]);

  if (cold) {
    return (
      <div className="play-empty">
        <Cloud />
        <h2>{name} could not start</h2>
        <p>
          The cloud service did not answer inside the frame — it may be busy, down, or refusing to be
          framed. Sessions are served in turns, so trying again in a moment is sometimes all it needs.
        </p>
        <div className="play-empty-row">
          <button
            className="btn"
            onClick={() => {
              setCold(false);
              setLive(false);
            }}
          >
            <RefreshCw /> Try again
          </button>
          <a className="btn btn--fill" href={url} target="_blank" rel="noreferrer noopener">
            <ExternalLink /> Open the cloud service
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {!live && (
        <div className="play-empty play-empty--veil">
          <Cloud />
          <h2>Waking {name}…</h2>
          <p>The cloud service is finding a machine and putting your game on it. This takes a moment.</p>
        </div>
      )}
      <iframe
        key={`${file}#${route}`}
        ref={frame}
        className="play-frame"
        src={file}
        title={name}
        onLoad={() => setLive(true)}
        referrerPolicy="no-referrer"
        /* gamepad, pointer-lock and autoplay are the ones a streamed game
           actually needs; the service's own page asks for the mic itself */
        allow="fullscreen; gamepad; autoplay; pointer-lock"
      />
    </>
  );
}


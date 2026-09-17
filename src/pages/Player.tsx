/* NULL · Player.tsx
   The window a game or an app opens in. Full width, no page chrome, one
   small bar on top with the name and the controls that matter: reload,
   fullscreen, and back to the library.

   While this page is the active tab the coin clock counts for it, which is
   what makes playing the way you earn. */

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Expand, Gamepad2, RefreshCw } from "lucide-react";

import { find } from "../lib/catalog";
import { go } from "../lib/tabs";
import { trackPlay } from "../lib/econ";

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
    const doc = f.contentDocument;
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
        <iframe
          key={nonce}
          ref={frame}
          className="play-frame"
          src={entry.file}
          title={entry.name}
          allow="fullscreen; gamepad; autoplay"
        />
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

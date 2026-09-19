/* NULL · Cover.tsx
   The square on a card, and what to do when there is no picture in it.

   Artwork comes from someone else's server, and on a filtered network that
   server is often the problem: a school filter decides whole hosts are not to
   be asked, and every cover on the shelf goes grey at once. So an entry can
   carry several addresses for the same picture (see thumbsOf), and this tries
   them in turn — the first one that loads is the one kept.

   Two more rules the shelf lives by:

   · a picture is asked for only when its tile is near the viewport. A few
     thousand <img loading="lazy"> tags are a few thousand requests the
     browser schedules the moment they exist, which is the lag the shelf
     used to open with; gating the mount behind an IntersectionObserver
     with a screen of margin is what keeps a long shelf smooth.
   · an entry with no artwork anywhere is drawn as a square with its name
     in it. A shelf where half the tiles are broken-image glyphs reads as a
     broken site; the same shelf with tiles carrying initials reads as a
     shelf. */

import { useEffect, useRef, useState } from "react";
import { Gamepad2 } from "lucide-react";

import type { Entry } from "../lib/catalog";

/** Every address this entry's artwork might be at, best first. Empty means
 *  the shelf should treat the tile as artless (see hasArt). */
export function thumbsOf(e: Entry): string[] {
  if (e.thumbs?.length) return e.thumbs;
  return e.thumb ? [e.thumb] : [];
}

/** Does this entry have any artwork at all? Cheap — no request involved. */
export function hasArt(e: Entry): boolean {
  return thumbsOf(e).length > 0;
}

/** One or two letters out of a name, for the drawn square. */
function mark(name: string): string {
  const words = name.split(/[\s:_-]+/).filter((w) => /[a-z0-9]/i.test(w));
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Where the stripes lean. Same game, same square, every time. */
function lean(id: string): number {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) % 360;
  return n;
}

/** How close a tile has to be to the viewport before its picture mounts. */
const NEAR = "800px";

export function Cover({
  entry,
  icon: Icon = Gamepad2,
}: {
  entry: Entry;
  icon?: typeof Gamepad2;
}) {
  const [step, setStep] = useState(0);
  const [near, setNear] = useState(false);
  const box = useRef<HTMLElement>(null);
  const art = thumbsOf(entry);
  const src = art[step];

  /* the picture is not even in the tree until its tile is close to being
     seen — the observer is what a few-thousand-tile shelf does instead of
     letting the browser schedule every request up front */
  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (rows) => {
        if (rows.some((r) => r.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: NEAR },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, entry.id]);

  if (!src) return <Drawn entry={entry} icon={Icon} innerRef={box as React.RefObject<HTMLSpanElement>} />;

  return (
    <img
      ref={box as React.RefObject<HTMLImageElement>}
      src={near ? src : undefined}
      data-src={src}
      alt=""
      /* only a tile that has been near the viewport asks the network */
      loading={near ? "lazy" : undefined}
      decoding="async"
      /* no referrer: a stash that hotlink-checks would otherwise refuse every
         icon this shelf asks it for */
      referrerPolicy="no-referrer"
      onError={() => setStep((n) => n + 1)}
    />
  );
}

/** The square with nothing in it but the game's own name. */
function Drawn({
  entry,
  icon: Icon,
  innerRef,
}: {
  entry: Entry;
  icon: typeof Gamepad2;
  innerRef: React.RefObject<HTMLSpanElement | null>;
}) {
  return (
    <span
      ref={innerRef}
      className="tile-art"
      style={{ ["--lean" as string]: `${lean(entry.id)}deg` }}
      aria-hidden="true"
    >
      <b>{mark(entry.name)}</b>
      <Icon />
    </span>
  );
}

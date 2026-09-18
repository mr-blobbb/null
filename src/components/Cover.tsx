/* NULL · Cover.tsx
   The square on a card, and what to do when there is no picture in it.

   Artwork comes from someone else's server, and on a filtered network that
   server is often the problem: a school filter decides whole hosts are not to
   be asked, and every cover on the shelf goes grey at once. So an entry can
   carry several addresses for the same picture (see thumbsOf), and this tries
   them in turn — the first one that loads is the one kept.

   When every one of them is refused there is still a card to look at: the name
   is drawn into the square instead, in the site's own colours, from a mark made
   out of the game's own letters. A shelf where half the tiles are broken-image
   glyphs reads as a broken site; the same shelf with a tile carrying the game's
   initial reads as a shelf. */

import { useState } from "react";
import { Gamepad2 } from "lucide-react";

import type { Entry } from "../lib/catalog";

/** Every address this entry's artwork might be at, best first. */
export function thumbsOf(e: Entry): string[] {
  if (e.thumbs?.length) return e.thumbs;
  return e.thumb ? [e.thumb] : [];
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

export function Cover({
  entry,
  icon: Icon = Gamepad2,
}: {
  entry: Entry;
  icon?: typeof Gamepad2;
}) {
  const [step, setStep] = useState(0);
  const art = thumbsOf(entry);
  const src = art[step];

  if (!src) return <Drawn entry={entry} icon={Icon} />;

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      /* no referrer: a stash that hotlink-checks would otherwise refuse every
         icon this shelf asks it for */
      referrerPolicy="no-referrer"
      onError={() => setStep((n) => n + 1)}
    />
  );
}

/** The square with nothing in it but the game's own name. */
function Drawn({ entry, icon: Icon }: { entry: Entry; icon: typeof Gamepad2 }) {
  return (
    <span className="tile-art" style={{ ["--lean" as string]: `${lean(entry.id)}deg` }} aria-hidden="true">
      <b>{mark(entry.name)}</b>
      <Icon />
    </span>
  );
}

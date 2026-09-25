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
import {
  Archive,
  BookOpen,
  Bot,
  Brain,
  Calculator,
  Camera,
  ChartSpline,
  ChefHat,
  Clapperboard,
  Code,
  Crown,
  Dices,
  FileText,
  Film,
  Flame,
  Gamepad2,
  GraduationCap,
  Hash,
  HardDrive,
  Images,
  Joystick,
  Keyboard,
  Mail,
  MessageCircle,
  MessagesSquare,
  Music,
  Music2,
  Palette,
  Plus,
  Radio,
  Send,
  Shapes,
  Sparkles,
  Store,
  Swords,
  Video,
  type LucideIcon,
} from "lucide-react";

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

/* ---------- the apps shelf's own marks ----------
   The apps page is a list of other people's front doors, and every one of
   them is a site with a mark the visitor has already seen a hundred times.
   Drawing the shape in the site's own colour is what makes the shelf
   readable at a glance; a square of initials for YouTube next to a square of
   initials for Twitch is a shelf nobody can scan.

   These are the drawn shapes from the icon set — the brands' own logos are
   not in it, and a redrawn logo is a trademark argument, so what is here is
   a shape and a colour that reads as the right door with the name beside it.
   Anything not in the table keeps the drawn square below. */
const APP_MARKS: Record<string, { icon: LucideIcon; color: string }> = {
  youtube: { icon: Video, color: "#ff4d4d" },
  github: { icon: Code, color: "#c9c9d2" },
  spotify: { icon: Music, color: "#4fcf7e" },
  discord: { icon: MessageCircle, color: "#7b86ff" },
  reddit: { icon: MessagesSquare, color: "#ff7043" },
  x: { icon: Hash, color: "#e8e8ee" },
  instagram: { icon: Camera, color: "#ff5f9e" },
  tiktok: { icon: Music2, color: "#5fd6d6" },
  twitch: { icon: Radio, color: "#a678ff" },
  netflix: { icon: Film, color: "#ff4d5e" },
  primevideo: { icon: Clapperboard, color: "#4fc3f7" },
  crunchyroll: { icon: Sparkles, color: "#ff9a5c" },
  roblox: { icon: Shapes, color: "#ff6b6b" },
  steam: { icon: Gamepad2, color: "#8fd0ff" },
  epic: { icon: Store, color: "#c6c6c6" },
  chess: { icon: Crown, color: "#d3a86a" },
  lichess: { icon: Swords, color: "#b3b8c2" },
  coolmath: { icon: Plus, color: "#7fd1ae" },
  poki: { icon: Dices, color: "#ff8a8a" },
  itch: { icon: Joystick, color: "#ff7b7b" },
  crazygames: { icon: Flame, color: "#f4c95d" },
  monkeytype: { icon: Keyboard, color: "#e8cf6a" },
  wikipedia: { icon: BookOpen, color: "#d5d5de" },
  archive: { icon: Archive, color: "#8fd8e8" },
  gmail: { icon: Mail, color: "#ff6b5e" },
  docs: { icon: FileText, color: "#7aa2ff" },
  classroom: { icon: GraduationCap, color: "#5fd68c" },
  drive: { icon: HardDrive, color: "#f2c94c" },
  gemini: { icon: Brain, color: "#a6b8ff" },
  chatgpt: { icon: Bot, color: "#63d6b0" },
  telegram: { icon: Send, color: "#6cc7f5" },
  pinterest: { icon: Images, color: "#ff5a76" },
  imgur: { icon: Images, color: "#5fd6a6" },
  photopea: { icon: Palette, color: "#4fd6d0" },
  desmos: { icon: ChartSpline, color: "#7fb6ff" },
  cyberchef: { icon: ChefHat, color: "#dcdce6" },
};

/** The mark an entry wears, if it has one. Games are all drawn squares: there
 *  are thousands of them and no two share a mark to draw. */
export function markOf(e: Entry): { icon: LucideIcon; color: string } | undefined {
  return e.kind === "app" ? APP_MARKS[e.id] : undefined;
}

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
  const brand = markOf(entry);
  const Brand = brand?.icon;
  return (
    <span
      ref={innerRef}
      className={`tile-art${Brand ? " tile-art--app" : ""}`}
      style={{ ["--lean" as string]: `${lean(entry.id)}deg` }}
      aria-hidden="true"
    >
      {/* a door with its own mark on it, or a square of the name */}
      {Brand ? (
        <span className="tile-brand" style={{ color: brand.color }}>
          <Brand />
        </span>
      ) : (
        <b>{mark(entry.name)}</b>
      )}
      {!Brand && <Icon />}
    </span>
  );
}

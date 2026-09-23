/* NULL · art.tsx
   The artwork the shop sells. The picture shelves are real files, kept beside
   their listings in src/lib/shopAssets.ts: a decoration is a square of art
   laid over the round picture, a profile effect is a transparent overlay that
   dresses the whole card. The pieces the shop used to draw are still here for
   anyone wearing one from before.

   Everything loops and is silent: the clips are muted and carry no audio
   track of their own, and nothing else makes a sound — only CSS keyframes
   and the art's own frames.

   The class names here are animated in src/styles/shop.css. */

import { useRef, useState, type CSSProperties } from "react";

import { useAccount } from "./account";
import { NullFace } from "./brand";
import type { ShopItem } from "./econ";
import { avatarAsset, effectAsset } from "./shopAssets";

const VB = "0 0 100 100";

function Svg({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox={VB} className="art-svg" style={style} aria-hidden="true">
      {children}
    </svg>
  );
}

/* ---------- avatar decorations ----------
   Drawn over the picture, inside its round frame. The frame is a little
   wider than the picture (`inset: -13%` in the stylesheet) so rings and
   orbiting things read as a halo around the face instead of a lid on it. */
/* The two decorations that are real clips rather than drawings, in
   public/decor (see its README for where they came from). */
const FACE_CLIP: Record<string, string> = {
  chroma: "avatar-chroma.mp4",
  ember: "avatar-ember.mp4",
};

export function AvatarArt({ id, still }: { id: string | null | undefined; still?: boolean }) {
  if (!id) return null;
  /* A decoration from the shelf: a square of art sized to 135% of the
     picture and centred on it, which is the box it is drawn for. `still`
     asks for the resting frame — chat wears it until the pointer comes near,
     and the moving twin fades in on hover (see shop.css and community.css). */
  const deco = avatarAsset(id);
  if (deco) {
    return (
      <span className={`art art--deco${still ? "" : " is-live"}`}>
        <img className="deco-img deco-still" src={deco.still} alt="" loading="lazy" draggable={false} />
        <img className="deco-img deco-move" src={deco.moving} alt="" loading="lazy" draggable={false} />
      </span>
    );
  }
  const clip = FACE_CLIP[id];
  if (clip) {
    return (
      <span className="art art--clip">
        <FaceVideo file={clip} still={still} />
      </span>
    );
  }
  switch (id) {
    case "orbit":
      return (
        <span className="art art--avatar art-orbit">
          <Svg>
            <circle cx="50" cy="50" r="46" className="art-ring" />
            <circle cx="50" cy="50" r="37" className="art-ring faint" />
            <circle cx="50" cy="3.5" r="4.5" className="art-bead" />
          </Svg>
          <span className="art-turn art-orbit-in">
            <Svg>
              <circle cx="50" cy="9" r="2.6" className="art-bead dim" />
              <circle cx="50" cy="91" r="2.6" className="art-bead dim" />
            </Svg>
          </span>
        </span>
      );

    case "halo":
      return (
        <span className="art art--avatar art-halo">
          <Svg>
            <circle cx="50" cy="50" r="47" className="art-ring glow" />
            <g className="art-drift">
              <circle cx="50" cy="50" r="47" className="art-arc cut" />
            </g>
          </Svg>
        </span>
      );

    case "eclipse":
      return (
        <span className="art art--avatar art-eclipse">
          <Svg>
            <circle cx="50" cy="50" r="46" className="art-ring faint" />
            <circle cx="50" cy="4" r="9" className="art-moon-glow" />
            <circle cx="50" cy="4" r="9" className="art-moon" />
          </Svg>
        </span>
      );

    case "stardust":
      return (
        <span className="art art--avatar">
          <Svg>
            <circle cx="50" cy="50" r="46" className="art-ring faint" />
            <g className="art-drift">
              {[
                [50, 4],
                [96, 50],
                [50, 96],
                [4, 50],
              ].map(([x, y], i) => (
                /* the group holds the position, the path does the twinkling:
                   a CSS animation would otherwise replace the translate */
                <g key={i} transform={`translate(${x} ${y})`}>
                  <path
                    className={`art-spark d${i}`}
                    d="M0 -6.5 L1.7 -1.7 L6.5 0 L1.7 1.7 L0 6.5 L-1.7 1.7 L-6.5 0 L-1.7 -1.7 Z"
                  />
                </g>
              ))}
            </g>
            <g className="art-drift back">
              {[
                [76, 24],
                [76, 76],
                [24, 76],
                [24, 24],
              ].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="2.4" className={`art-twinkle d${i}`} />
              ))}
            </g>
          </Svg>
        </span>
      );

    case "prism":
      return (
        <span className="art art--avatar art-prism">
          <i className="art-prism-in" />
        </span>
      );

    case "signal":
      return (
        <span className="art art--avatar">
          <Svg>
            {[10, 30, 50, 70, 90].map((y, i) => (
              <rect key={i} x="0" y={y} width="100" height="4" className={`art-scan d${i}`} />
            ))}
            <circle cx="50" cy="50" r="46" className="art-ring rim" />
          </Svg>
        </span>
      );

    case "solar":
      return (
        <span className="art art--avatar art-spin">
          <Svg>
            <circle cx="50" cy="50" r="46" className="art-ring faint" />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="70 300"
              className="art-arc hot"
            />
            <circle cx="96" cy="50" r="4" className="art-bead" />
          </Svg>
        </span>
      );

    case "rift":
      return (
        <span className="art art--avatar">
          <Svg>
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              strokeWidth="2"
              strokeDasharray="18 26"
              className="art-spin art-arc cool"
            />
            <circle
              cx="50"
              cy="50"
              r="39"
              fill="none"
              strokeWidth="2"
              strokeDasharray="10 32"
              className="art-spin-back art-arc cool"
            />
            <g className="art-drift back">
              <circle cx="50" cy="11" r="2.8" className="art-bead" />
            </g>
          </Svg>
        </span>
      );

    case "pulse":
      return (
        <span className="art art--avatar">
          <Svg>
            <circle cx="50" cy="50" r="46" className="art-ring rim" />
            {[0, 1, 2].map((i) => (
              <circle key={i} cx="50" cy="50" r="46" className={`art-wave d${i}`} />
            ))}
          </Svg>
        </span>
      );

    /* Two ellipses on one centre: the vertical and the horizontal, turning
       opposite ways, which is what makes it read as a gyroscope rather than
       as two rings lying flat. */
    case "meridian":
      return (
        <span className="art art--avatar">
          <Svg>
            <circle cx="50" cy="50" r="46" className="art-ring faint" />
            <ellipse cx="50" cy="50" rx="46" ry="15" className="art-spin art-arc cool" />
            <ellipse cx="50" cy="50" rx="15" ry="46" className="art-spin-back art-arc cool" />
            <circle cx="96" cy="50" r="3" className="art-bead" />
          </Svg>
        </span>
      );

    /* The bars are wider than the frame on purpose: a tear that starts and
       ends inside the circle reads as a mistake, one running off both edges
       reads as a signal breaking. */
    case "glitch":
      return (
        <span className="art art--avatar">
          <Svg>
            <circle cx="50" cy="50" r="46" className="art-ring rim" />
            {[18, 34, 56, 74].map((y, i) => (
              <rect key={i} x="-20" y={y} width="140" height="4" rx="2" className={`art-tear d${i}`} />
            ))}
          </Svg>
        </span>
      );

    /* a wedge behind the bead, so the bead has a direction */
    case "comet":
      return (
        <span className="art art--avatar">
          <Svg>
            <circle cx="50" cy="50" r="46" className="art-ring faint" />
            <g className="art-drift fast">
              <path className="art-tail" d="M50 5 L43.5 16 L56.5 16 Z" />
              <circle cx="50" cy="5" r="4" className="art-bead" />
            </g>
          </Svg>
        </span>
      );

    case "ash":
      return (
        <span className="art art--avatar">
          <Svg>
            <circle cx="50" cy="50" r="46" className="art-ring faint" />
            {[
              [22, 26],
              [70, 18],
              [40, 62],
              [82, 66],
              [30, 84],
              [62, 44],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="1.8" className={`art-flake d${i}`} />
            ))}
          </Svg>
        </span>
      );

    default:
      return null;
  }
}

/* ---------- profile effects ----------
   Whole-card backgrounds, drawn behind everything the card says.

   Every piece is positioned in percentages, so a background stretches to
   the card and stays in proportion at any size, the same way `cover` crops
   a photograph: nothing squashes, and the composition is the same on a
   104px shop tile and on the full profile card.

   Each one ends with a tint layer held at a fixed weight, which is what
   keeps the text over it readable no matter how busy the motion gets. */
/* one honeycomb cell, as the six points of a pointy-top hexagon */
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

/* the honeycomb the wall is built from: four rows, offset row by row */
const CELLS = (() => {
  const r = 9;
  const out: { x: number; y: number }[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 7; col++) {
      out.push({
        x: 6 + col * r * 1.74 + (row % 2 ? r * 0.87 : 0),
        y: 6 + row * r * 1.5,
      });
    }
  }
  return out;
})();

const EFFECTS: Record<string, () => React.ReactNode> = {
  /* rain, a roof, and a cat that has decided the roof is fine */
  rainy: () => [
    <i key="sky" className="fx-sky" />,
    <i key="moon" className="fx-moon" />,
    <i key="hill" className="fx-hill" />,
    ...[0, 1, 2, 3].map((i) => <i key={`t${i}`} className={`fx-tree d${i}`} />),
    <i key="roof" className="fx-roof" />,
    <i key="cat" className="fx-cat" />,
    ...Array.from({ length: 22 }, (_, i) => (
      <i
        key={`r${i}`}
        className="fx-streak"
        style={{ left: `${(i * 4.6) % 100}%`, animationDelay: `${(i % 8) * 0.16}s` }}
      />
    )),
    <i key="water" className="fx-water" />,
  ],

  /* block terrain, a sun, and one cloud on a very long journey */
  blocks: () => [
    <i key="sky" className="fx-sky" />,
    <i key="sun" className="fx-blocksun" />,
    <i key="c0" className="fx-cloudpuff d0" />,
    <i key="c1" className="fx-cloudpuff d1" />,
    ...[0, 1, 2, 3, 4, 5].map((i) => <i key={i} className={`fx-block b${i}`} />),
    <i key="sweep" className="fx-sweep" />,
  ],

  /* a dark wall of hexagons, lighting up in turn */
  hex: () => (
    <svg className="fx-svg" viewBox="0 0 110 54" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {CELLS.map((c, i) => (
        <polygon
          key={i}
          className="fx-cell"
          points={hexPoints(c.x, c.y, 9)}
          style={{ animationDelay: `${(i % 7) * 0.42}s` }}
        />
      ))}
    </svg>
  ),

  /* dust crossing the card: the specks only twinkle, the field they sit in
     does the travelling, so nothing needs to know how tall the card is */
  drift: () => [
    <span key="field" className="fx-field">
      {Array.from({ length: 34 }, (_, i) => (
        <i
          key={i}
          className="fx-mote"
          style={{
            left: `${(i * 31) % 100}%`,
            top: `${(i * 61) % 100}%`,
            animationDelay: `${(i % 12) * 0.7}s`,
          }}
        />
      ))}
    </span>,
  ],

  /* television snow: specks that light up where they are and never travel */
  static: () => [
    ...Array.from({ length: 90 }, (_, i) => (
      <i
        key={`n${i}`}
        className="fx-noise"
        style={{
          left: `${(i * 29) % 100}%`,
          top: `${(i * 47) % 100}%`,
          animationDelay: `${(i % 9) * 0.11}s`,
        }}
      />
    )),
    <i key="creep" className="fx-snowcreep" />,
  ],

  /* a channel with nothing on it */
  crt: () => [
    <i key="lines" className="fx-lines" />,
    <i key="bar" className="fx-bar" />,
    <i key="glow" className="fx-crtglow" />,
  ],

  /* bands of light, breathing over the card */
  aurora: () => [
    <i key="b0" className="fx-band b0" />,
    <i key="b1" className="fx-band b1" />,
    <i key="b2" className="fx-band b2" />,
  ],

  /* ash coming down, turning as it falls — the one effect here that falls the
     whole height of the card, so it moves in percentages and not in pixels */
  ashfall: () => [
    ...Array.from({ length: 26 }, (_, i) => (
      <i
        key={`a${i}`}
        className="fx-petal"
        style={{
          left: `${(i * 7.7) % 100}%`,
          animationDelay: `${(i % 10) * 0.42}s`,
          animationDuration: `${7 + (i % 5)}s`,
        }}
      />
    )),
  ],

  /* a ringed disk over a sky full of stars */
  galaxy: () => [
    ...Array.from({ length: 26 }, (_, i) => (
      <i
        key={`s${i}`}
        className="fx-star"
        style={{
          left: `${(i * 37) % 100}%`,
          top: `${(i * 53) % 100}%`,
          animationDelay: `${(i % 11) * 0.47}s`,
        }}
      />
    )),
    <i key="disk" className="fx-disk" />,
  ],
};

/** The wrapper class each effect owns, so the stylesheet can find it. */
const EFFECT_CLASS: Record<string, string> = {
  rainy: "fx-rainy",
  blocks: "fx-blocks",
  hex: "fx-hex",
  galaxy: "fx-galaxy",
  drift: "fx-drift",
  static: "fx-static",
  crt: "fx-crt",
  aurora: "fx-aurora",
  ashfall: "fx-ashfall",
};

/** The real clip behind each background, in public/decor (see its README for
 *  where they came from). The drawing above is what shows if one is missing. */
const EFFECT_VIDEO: Record<string, string> = {
  rainy: "card-rainy.mp4",
  blocks: "card-voxel.mp4",
  hex: "card-hex.mp4",
  galaxy: "card-galaxy.mp4",
};

/** public/ is served from the site root and every route is a hash on the same
 *  document, so a relative path lands on the file in dev and on any host. */
function decor(file: string): string {
  return `decor/${file}`;
}

/* A clip used as a background: muted, looping, and never a sound. The `poster`
   is deliberately absent so the drawing underneath shows until the first
   frame is decoded, and stays if the file cannot be played at all. */
function CardVideo({ file }: { file: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <video
      className="fx-video"
      src={decor(file)}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      disablePictureInPicture
      onError={() => setFailed(true)}
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}

/* A clip used as a face overlay. These clips are effects on a black field, so
   the stylesheet screens them over the picture: black disappears, the glow
   stays. `object-fit: cover` in a round, clipped box is what makes one sit
   centred on the face at any size — the shop tile and the profile alike. */
function FaceVideo({ file, still }: { file: string; still?: boolean }) {
  const [failed, setFailed] = useState(false);
  const el = useRef<HTMLVideoElement>(null);
  if (failed) return null;
  return (
    <video
      ref={el}
      className="art-video"
      src={decor(file)}
      /* a room full of loops is a room you cannot read. `still` asks for a
         decoration that rests on its first frame until the pointer is on the
         thing it decorates — the CSS can pause a drawing, but a clip has to be
         told, which is why this one prop exists. */
      autoPlay={!still}
      onMouseEnter={() => el.current?.play().catch(() => {})}
      onMouseLeave={() => el.current?.pause()}
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      onError={() => setFailed(true)}
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}

export function EffectArt({ id }: { id: string | null | undefined }) {
  /* An overlay from the shelf: transparent art that dresses the whole card —
     picture, banner and words alike. The wrapper positions it; the card it
     lands on decides whether it sits over the words (share, chat, profile)
     or behind them. */
  const deco = effectAsset(id);
  if (deco) {
    return (
      <span className="fx fx--deco">
        <img className="fx-deco" src={deco.url} alt="" loading="lazy" draggable={false} />
      </span>
    );
  }
  const draw = id ? EFFECTS[id] : undefined;
  const clip = id ? EFFECT_VIDEO[id] : undefined;
  if (!id || !draw) return null;
  return (
    <span className={`fx ${EFFECT_CLASS[id]}`}>
      {draw()}
      {clip && <CardVideo file={clip} />}
      <i className="fx-tint" />
    </span>
  );
}

/** The round picture a decoration sits on: the player's own face when they
 *  have one, NULL's own face when they do not. */
function Face() {
  const me = useAccount();
  return (
    <span className="avbox-face">
      {me.pfp ? <img src={me.pfp} alt="" /> : <NullFace />}
    </span>
  );
}

/** One name tag, drawn once and worn everywhere: on the shelf card, the
 *  profile, the share card, the member list and the chat. A tag's colour is
 *  its own, so this is the only place that decides how a chip is painted. */
export function TagChip({ item }: { item: ShopItem }) {
  return (
    <span
      className={`tagchip${item.art ? ` tagchip--${item.art}` : ""}`}
      /* the colour goes on as background-color, not the `background`
         shorthand: a shorthand here would reset background-image and wipe
         out the finishes that draw one (the stripes, the static). --tag
         lets a finish lean on the chip's own colour rather than the ink
         chosen to sit on top of it. */
      style={{ backgroundColor: item.color, color: item.ink ?? "#0b0b0d", "--tag": item.color } as CSSProperties}
      /* the one finish that redraws the name needs the name to redraw it */
      data-name={item.art === "cursed" ? item.name : undefined}
    >
      {item.glyph && <b className="tag-glyph">{item.glyph}</b>}
      {item.name}
    </span>
  );
}

/** The little preview drawn on a shop card. */
export function PreviewArt({ item }: { item: ShopItem }) {
  if (item.shelf === "tag") {
    return <TagChip item={item} />;
  }
  if (item.shelf === "avatar") {
    return (
      <span className="avbox">
        <Face />
        <AvatarArt id={item.id} />
      </span>
    );
  }
  return (
    <span className="fxbox">
      <EffectArt id={item.id} />
    </span>
  );
}

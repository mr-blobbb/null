/* NULL · art.tsx
   The artwork the shop sells. Most pieces are drawn rather than downloaded:
   an animated SVG that takes its colours from the palette, so a decoration
   looks right in Forest and in Light without a second asset. A few are real
   clips from public/decor, which is the only reason a <video> appears here.

   Every piece loops forever and is silent by construction: the clips are
   muted and carry no audio track of their own, and nothing else is a file at
   all, only CSS keyframes.

   The class names here are animated in src/styles/shop.css. */

import { useState, type CSSProperties } from "react";

import { useAccount } from "./account";
import { NullFace } from "./brand";
import type { ShopItem } from "./econ";

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

export function AvatarArt({ id }: { id: string | null | undefined }) {
  if (!id) return null;
  const clip = FACE_CLIP[id];
  if (clip) {
    return (
      <span className="art art--clip">
        <FaceVideo file={clip} />
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
function FaceVideo({ file }: { file: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <video
      className="art-video"
      src={decor(file)}
      autoPlay
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

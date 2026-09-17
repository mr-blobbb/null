/* NULL · art.tsx
   The artwork the shop sells. Each piece is drawn rather than downloaded:
   an animated SVG that takes its colours from the palette, so a decoration
   looks right in Forest and in Light without a second asset.

   Every piece loops forever and is silent by construction: there is no
   <video>, no <audio> and no file to fetch, only CSS keyframes, so a
   decoration can never come with sound attached.

   The class names here are animated in src/styles/shop.css. */

import type { CSSProperties } from "react";
import { UserRound } from "lucide-react";

import { useAccount } from "./account";
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
export function AvatarArt({ id }: { id: string | null | undefined }) {
  if (!id) return null;
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
const EFFECTS: Record<string, () => React.ReactNode> = {
  doves: () =>
    [0, 1, 2].map((i) => (
      <svg key={i} viewBox="0 0 40 20" className={`fx-dove d${i}`} aria-hidden="true">
        <path d="M2 14 Q10 2 20 10 Q30 2 38 14" fill="none" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )),

  glitch: () =>
    Array.from({ length: 7 }, (_, i) => <i key={i} className={`fx-bar d${i}`} />),

  duckpond: () => [
    ...[
      [14, 12],
      [46, 7],
      [78, 15],
    ].map(([x, y], i) => (
      <i key={`l${i}`} className={`fx-lily d${i}`} style={{ left: `${x}%`, top: `${y}%` }} />
    )),
    <span key="b0" className="fx-beam b0" />,
    <span key="b1" className="fx-beam b1" />,
    <span key="b2" className="fx-beam b2" />,
  ],

  rainfall: () =>
    Array.from({ length: 26 }, (_, i) => (
      <i
        key={i}
        className="fx-drop"
        style={{ left: `${(i * 3.9) % 100}%`, animationDelay: `${(i % 7) * 0.23}s` }}
      />
    )),

  embers: () =>
    Array.from({ length: 18 }, (_, i) => (
      <i
        key={i}
        className="fx-ember"
        style={{ left: `${(i * 5.6) % 100}%`, animationDelay: `${(i % 9) * 0.44}s` }}
      />
    )),

  aurora: () => [0, 1, 2].map((i) => <i key={i} className={`fx-band d${i}`} />),
};

/** The wrapper class each effect has always used, kept for the stylesheet. */
const EFFECT_CLASS: Record<string, string> = {
  doves: "fx-doves",
  glitch: "fx-glitch",
  duckpond: "fx-pond",
  rainfall: "fx-rain",
  embers: "fx-embers",
  aurora: "fx-aurora",
};

export function EffectArt({ id }: { id: string | null | undefined }) {
  const draw = id ? EFFECTS[id] : undefined;
  if (!id || !draw) return null;
  return (
    <span className={`fx ${EFFECT_CLASS[id]}`}>
      {draw()}
      <i className="fx-tint" />
    </span>
  );
}

/** The round picture a decoration sits on: the player's own face when they
 *  have one, a silhouette when they do not. */
function Face() {
  const me = useAccount();
  return (
    <span className="avbox-face">
      {me.pfp ? <img src={me.pfp} alt="" /> : <UserRound />}
    </span>
  );
}

/** The little preview drawn on a shop card. */
export function PreviewArt({ item }: { item: ShopItem }) {
  if (item.shelf === "tag") {
    return (
      <span className="tagchip" style={{ background: item.color, color: "#0b0b0d" }}>
        {item.name}
      </span>
    );
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

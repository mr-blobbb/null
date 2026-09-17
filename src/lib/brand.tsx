/* NULL · brand.tsx
   The face. A 16×16 pixel tile: a rounded square, a ring, two tall eyes and a
   mouth, in five greys. It is the site's icon, the default picture, and the
   thing the error screen shows when something falls over.

   This is the same map `public/favicon.svg` and the PNG app icons are drawn
   from. Keep the three in step — they are one mark in three places, and a
   favicon that disagrees with the avatar looks like a mistake. */

const PALETTE = ["#0b0b0e", "#2b2b33", "#3d3d47", "#4a4a55", "#08080a"] as const;

/** 0 tile · 1 ring · 2 face · 3 face lighter · 4 eyes and mouth */
const ROWS = [
  "0000000000000000",
  "0011111111111100",
  "0122222222222210",
  "0123333333333210",
  "0123222222223210",
  "0123222222223210",
  "0123244224423210",
  "0123244224423210",
  "0123244224423210",
  "0123222222223210",
  "0123222222223210",
  "0123244444443210",
  "0123222222223210",
  "0122222222222210",
  "0011111111111100",
  "0000000000000000",
];

/** The tile the map is clipped to, so the mark is a rounded square rather
 *  than a hard-edged one. Rounded here rather than by the map so the corners
 *  stay round at every size. */
const TILE = "M4 0 H12 A4 4 0 0 1 16 4 V12 A4 4 0 0 1 12 16 H4 A4 4 0 0 1 0 12 V4 A4 4 0 0 1 4 0 Z";

/** Rows merged into runs, so the face is a couple of dozen rects rather than
 *  256 of them. */
const RUNS: { x: number; y: number; w: number; c: number }[] = [];
ROWS.forEach((row, y) => {
  let x = 0;
  while (x < row.length) {
    const c = Number(row[x]);
    let w = 1;
    while (x + w < row.length && Number(row[x + w]) === c) w++;
    RUNS.push({ x, y, w, c });
    x += w;
  }
});

const CLIP = "nf-tile";

/** The face, as an image: fills whatever box it is given. */
export function NullFace({ className = "nf" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <clipPath id={CLIP}>
        <path d={TILE} />
      </clipPath>
      <g clipPath={`url(#${CLIP})`}>
        {RUNS.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={PALETTE[r.c]} />
        ))}
      </g>
    </svg>
  );
}

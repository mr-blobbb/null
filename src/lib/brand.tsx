/* NULL · brand.tsx
   The face. A 16×16 pixel tile in five greys: the site's icon, and what a
   profile wears until someone picks a picture of their own.

   It is the same map the favicon is drawn from (public/favicon.svg). Both are
   pixel art on purpose — one tile, crisp edges, no gradients — which is what
   makes it read as NULL's mark rather than a placeholder glyph. Keep the two
   in step if the face ever changes. */

const PALETTE = ["#0e0e13", "#33333d", "#4f4f5a", "#202027", "#63636f"] as const;

/** 0 edge · 1 frame · 2 face · 3 eyes and mouth · 4 highlight */
const ROWS = [
  "0000000000000000",
  "0111111111111110",
  "0122222222222210",
  "0124222222222210",
  "0122222222222210",
  "0122332222332210",
  "0122332222332210",
  "0122332222332210",
  "0122222222222210",
  "0123333333333210",
  "0123333333333210",
  "0122222222222210",
  "0122222422222210",
  "0122222222222210",
  "0111111111111110",
  "0000000000000000",
];

/** Rows merged into the fewest rectangles, so the avatar is a handful of
 *  elements instead of 256. */
const RECTS: { x: number; y: number; w: number; c: number }[] = [];
ROWS.forEach((row, y) => {
  let x = 0;
  while (x < row.length) {
    const c = Number(row[x]);
    let w = 1;
    while (x + w < row.length && Number(row[x + w]) === c) w++;
    RECTS.push({ x, y, w, c });
    x += w;
  }
});

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
      <rect width="16" height="16" fill={PALETTE[0]} />
      {RECTS.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={PALETTE[r.c]} />
      ))}
    </svg>
  );
}

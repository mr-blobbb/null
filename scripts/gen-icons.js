/* NULL — gen-icons.js
   Rasterizes the NULL mark (the same design as public/favicon.svg: a rounded
   dark tile with a white ring + slash) into the PNG sizes a PWA manifest
   needs. Pure Node — no canvas, no network: pixels are computed directly and
   encoded as PNG with zlib.

   Run with: bun run icons   (or node scripts/gen-icons.js) */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public");

/* ---------- PNG encoding ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- geometry (all in 0..1 unit space) ---------- */
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.min(1, Math.max(0, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function mix(dst, i, r, g, b, a) {
  if (a <= 0) return;
  const src = [r, g, b];
  const outA = a + (dst[i + 3] / 255) * (1 - a);
  for (let k = 0; k < 3; k++) {
    const d = dst[i + k] / 255;
    const v = outA > 0 ? (src[k] / 255 * a + d * (dst[i + 3] / 255) * (1 - a)) / outA : 0;
    dst[i + k] = Math.round(Math.min(1, Math.max(0, v)) * 255);
  }
  dst[i + 3] = Math.round(outA * 255);
}

/* Draw the NULL tile. `maskable` fills the whole square (no rounded corners)
   and shrinks the mark into the safe zone so OS masks never clip it. */
function drawIcon(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 3; // supersamples per axis
  const pad = maskable ? 0.2 : 0; // safe-zone inset for maskable icons
  const scale = 1 - pad * 2;

  const bg = [0x0b, 0x0b, 0x0d];
  const line = [0xf4, 0xf4, 0xf5];

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let rect = 0;
      let border = 0;
      let ring = 0;
      let slash = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const area = 1 / (SS * SS);

          /* tile + faint edge border */
          const outer = maskable || inRoundRect(x, y, 0, 0, 1, 1, 0.234);
          const inner = maskable || inRoundRect(x, y, 0.016, 0.016, 0.984, 0.984, 0.218);
          if (outer) rect += area;
          if (outer && !inner) border += area;
          /* mark (ring + slash), centered, scaled into the safe zone */
          const cx = 0.5;
          const cy = 0.5;
          const r = 0.242 * scale;
          const w = 0.086 * scale;
          const d = Math.hypot(x - cx, y - cy);
          if (Math.abs(d - r) <= w / 2) ring += area;
          const a = { x: 0.5 - r * 0.62, y: 0.5 - r * 0.62 };
          const b = { x: 0.5 + r * 0.62, y: 0.5 + r * 0.62 };
          if (distToSegment(x, y, a.x, a.y, b.x, b.y) <= (w / 2) * 0.98) slash += area;
        }
      }

      const i = (py * size + px) * 4;
      mix(rgba, i, bg[0], bg[1], bg[2], maskable ? 1 : rect);
      if (!maskable && border > 0) mix(rgba, i, 0xff, 0xff, 0xff, border * 0.14);
      if (ring > 0) mix(rgba, i, line[0], line[1], line[2], ring);
      if (slash > 0) mix(rgba, i, line[0], line[1], line[2], slash);
    }
  }
  return encodePng(size, size, rgba);
}

fs.mkdirSync(OUT, { recursive: true });
const targets = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
];
targets.forEach(([name, size, maskable]) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, drawIcon(size, maskable));
  console.log("wrote " + path.relative(ROOT, file) + " (" + size + "x" + size + ")");
});

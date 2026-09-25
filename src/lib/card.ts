/* NULL · card.ts
   The share card, painted onto a canvas so it can leave the browser as a file.
   Nothing is uploaded anywhere: the canvas is drawn here and handed back, as a
   PNG for a still and as a GIF that loops for one that moves. Either way the
   file works offline, because nothing left the machine to make it.

   It is drawn rather than screenshotted. A screenshot would need the whole DOM
   rasterised; this draws the same card from the same values, so it comes out
   the right size every time. What cannot be drawn from values is the art — the
   animated pictures and clips are already playing on the page, so the painter
   takes the frame that is on screen and the gif takes a different one each
   time round.

   Three entry points, one painter:

   · `paintCard` — the card, once, at full size.
   · `cardPng`  — the same, as a data URL.
   · `cardGif`  — the card again on a clock, so the decoration and the effect
                  move in the file the way they move on the page. */

import type { NameStyle } from "./account";
import { encodeGif, type GifFrame } from "./gif";

export type CardInput = {
  name: string;
  handle: string;
  bio: string;
  joined: number;
  banner: string;
  pfp: string | null;
  owner: boolean;
  /** the name tags worn, in the order they were put on */
  tags: { name: string; color?: string; ink?: string; glyph?: string }[];
  nameStyle: NameStyle;
  favorites: number;
  coins: number;
  /** the short member id the chat card prints, when there is one */
  id?: string;
  /** the effect clip, if the player is wearing one and it is playing */
  video?: HTMLVideoElement | null;
  /** the whole-card overlay, read from the <img> already playing on the page */
  fx?: HTMLImageElement | null;
  /** the square decoration around the picture, likewise */
  deco?: HTMLImageElement | null;
  /** the resolved family of the name, so the card and the page agree */
  font?: string;
};

/** The palette the card is drawn in: the page's own, so a forest card is
 *  green and a light card is pale. */
type Ink = { bg: string; text: string; dim: string; line: string; ac1: string };

function ink(): Ink {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string, fallback: string) => s.getPropertyValue(n).trim() || fallback;
  return {
    bg: v("--bg", "#0b0b0d"),
    text: v("--text", "#f4f4f5"),
    dim: v("--dim", "#a1a1aa"),
    line: v("--line", "#26262b"),
    ac1: v("--ac-1", "#7aa2ff"),
  };
}

/* ---------- the shape ----------
   Two cards, and the same drawing for both. A card wearing an overlay is the
   portrait the art is: 45:88, so the overlay lands on its rim instead of being
   cropped into it. Without one it is the wide card it has always been.

   Every measurement below is in the painting's own pixels — the portrait one
   is drawn at twice the size a card is on screen, so a measurement here and a
   measurement in profile.css are the same number times two. */
type Shape = {
  W: number;
  H: number;
  pad: number;
  /** the band of banner across the top */
  banner: number;
  /** the picture, and how much of it hangs over the banner */
  face: number;
  over: number;
  mark: number;
  addr: number;
  name: number;
  handle: number;
  bio: number;
  fact: number;
  label: number;
  /** the box the facts sit in */
  box: number;
  button: number;
  gap: number;
};

const PORTRAIT: Shape = {
  W: 900,
  H: 1760,
  pad: 72,
  banner: 306,
  face: 216,
  over: 108,
  mark: 54,
  addr: 23,
  name: 44,
  handle: 25,
  bio: 28,
  fact: 26,
  label: 17,
  box: 136,
  button: 56,
  gap: 26,
};

const WIDE: Shape = {
  W: 1200,
  H: 760,
  pad: 72,
  banner: 258,
  face: 176,
  over: 88,
  mark: 46,
  addr: 21,
  name: 58,
  handle: 22,
  bio: 24,
  fact: 23,
  label: 15,
  box: 118,
  button: 46,
  gap: 22,
};

/** Every colour in a CSS value, in order. A gradient string, a plain hex, or
 *  nothing at all — the banner may be an image, and that is handled apart. */
function colorsIn(css: string): string[] {
  return css.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b|rgba?\([^)]*\)/gi) ?? [];
}

/** The picture inside a `url(...)` banner, if that is what the banner is. */
function photoIn(banner: string): string | null {
  return banner.includes("url(") ? (/url\((['"]?)(.*?)\1\)/.exec(banner)?.[2] ?? null) : null;
}

/** A palette colour at a given alpha, whether it arrives as a hex or as an
 *  rgb()/rgba() string. A custom palette writes its own variables, so both
 *  shapes turn up. */
function fade(color: string, a: number): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((x) => x + x).join("") : hex[1];
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  const rgb = /rgba?\(([^)]+)\)/i.exec(color);
  if (rgb) {
    const p = rgb[1].split(",").map((s) => s.trim());
    return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${a})`;
  }
  return color;
}

/** The banner sweep, drawn across the band it is given. */
function bannerPaint(ctx: CanvasRenderingContext2D, banner: string, fallback: Ink, w: number, h: number) {
  const found = colorsIn(banner);
  if (found.length === 0) return fallback.ac1;
  const g = ctx.createLinearGradient(0, 0, w, h);
  found.forEach((c, i) => g.addColorStop(found.length === 1 ? 1 : i / (found.length - 1), c));
  return g;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** cover, the way `object-fit: cover` does it: fill the box, crop the rest. */
function cover(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > max && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

/** A tag, or anything else that reads as a small stamp: a pill that takes the
 *  size of its own words. Returns its width so a row can lay them out. */
function pill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { fill: string; ink: string; font: string; pad?: number; border?: string; h?: number },
) {
  ctx.font = opts.font;
  const pad = opts.pad ?? 14;
  const h = opts.h ?? 34;
  const w = ctx.measureText(text.toUpperCase()).width + pad * 2;
  roundRect(ctx, x, y, w, h, h * 0.28);
  ctx.fillStyle = opts.fill;
  ctx.fill();
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = opts.ink;
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), x + pad, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return w;
}

/* ---------- what to fetch first ----------
   The card is drawn once for a PNG and twenty-five times for a gif. Fetching
   the same two pictures twenty-five times would be twenty-five times the wait
   for exactly the same pixels, so the painter takes them as an argument. */

export type CardAssets = {
  face: HTMLImageElement | null;
  banner: HTMLImageElement | null;
};

export async function loadCard(input: CardInput): Promise<CardAssets> {
  const photo = photoIn(input.banner);
  return {
    face: input.pfp ? await loadImage(input.pfp) : null,
    banner: photo ? await loadImage(photo) : null,
  };
}

/* ---------- the drawing ---------- */

function shapeOf(input: CardInput): Shape {
  return input.fx ? PORTRAIT : WIDE;
}

/** Draw the card onto the canvas it is given, scaled if asked. Synchronous on
 *  purpose: the gif calls it once per frame and cannot wait on anything. */
export function drawCard(
  input: CardInput,
  assets: CardAssets,
  canvas: HTMLCanvasElement,
  scale = 1,
): HTMLCanvasElement {
  const S = shapeOf(input);
  const { W, H } = S;
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const k = ink();

  /* the card itself, so the rounded corners are the only thing outside it */
  ctx.fillStyle = k.bg;
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.fill();

  ctx.save();
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.clip();

  /* the banner, as the band the page draws rather than the whole card: the
     words sit in it, and the room below is the effect's */
  ctx.fillStyle = bannerPaint(ctx, input.banner, k, W, S.banner);
  ctx.fillRect(0, 0, W, S.banner);
  if (assets.banner) {
    try {
      ctx.globalCompositeOperation = "source-over";
      cover(ctx, assets.banner, assets.banner.naturalWidth, assets.banner.naturalHeight, 0, 0, W, S.banner);
    } catch {
      /* a remote banner taints the canvas: the gradient stands in */
    }
  }

  /* the effect clip, screened over the banner exactly as the page composites
     it: black in the clip disappears, the glow stays */
  const vid = input.video;
  if (vid && vid.readyState >= 2 && vid.videoWidth) {
    ctx.globalCompositeOperation = "screen";
    cover(ctx, vid, vid.videoWidth, vid.videoHeight, 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }

  /* the seam under the banner, drawn where the page draws it: a soft shadow
     rather than a hard line, so a bright banner does not look pasted on */
  const seam = ctx.createLinearGradient(0, S.banner - S.pad, 0, S.banner);
  seam.addColorStop(0, fade(k.bg, 0));
  seam.addColorStop(1, fade(k.bg, 0.55));
  ctx.fillStyle = seam;
  ctx.fillRect(0, S.banner - S.pad, W, S.pad);

  /* the mark in the corner, and the address it lives at */
  ctx.fillStyle = k.text;
  ctx.font = `700 ${S.mark}px ui-rounded, "Nunito", system-ui, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 0.92;
  ctx.fillText("null", S.pad, S.pad + S.mark * 0.8);
  ctx.globalAlpha = 1;
  ctx.font = `500 ${S.addr}px ui-monospace, monospace`;
  ctx.fillStyle = k.dim;
  const addr = "null://me";
  ctx.fillText(addr, W - S.pad - ctx.measureText(addr).width, S.pad + S.addr * 0.8);

  /* the picture, hanging over the seam, with whatever they wear around it */
  const r = S.face / 2;
  const px = S.pad;
  const py = S.banner - S.over;
  const cx = px + r;
  const cy = py + r;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = k.line;
  ctx.fillRect(px, py, S.face, S.face);
  if (assets.face) cover(ctx, assets.face, assets.face.naturalWidth, assets.face.naturalHeight, px, py, S.face, S.face);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = k.bg;
  ctx.lineWidth = 7;
  ctx.stroke();

  /* the decoration around the picture: its square art at 135% of the circle,
     centred on it — the box the art is drawn for, corners and all */
  const deco = input.deco;
  if (deco && deco.complete && deco.naturalWidth) {
    const box = S.face * 1.35;
    ctx.drawImage(deco, cx - box / 2, cy - box / 2, box, box);
  }

  /* the name and the handle, sitting with the bottom of the picture */
  const nameX = px + S.face + S.gap * 1.2;
  const bottom = py + S.face;
  const style = input.nameStyle;
  ctx.font = `700 ${S.name}px ${input.font || "ui-rounded, system-ui, sans-serif"}`;
  if (style.mode === "gradient") {
    const g = ctx.createLinearGradient(nameX, bottom - S.name, nameX + S.name * 7, bottom);
    g.addColorStop(0, style.c1);
    g.addColorStop(1, style.c2);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = style.c1;
  }
  if (style.glow) {
    ctx.shadowColor = style.glowColor;
    ctx.shadowBlur = 26;
  }
  const handleY = bottom - 6;
  ctx.fillText(input.name.slice(0, 26), nameX, handleY - S.handle - 14);
  ctx.shadowBlur = 0;
  ctx.font = `500 ${S.handle}px ui-monospace, monospace`;
  ctx.fillStyle = k.dim;
  ctx.fillText(`@${input.handle} · online`, nameX, handleY);

  /* the badges, where the chat card puts them: under the name, above the
     picture's bottom edge. Drawn upward from that edge so a card with four of
     them grows the same way a card with one does. */
  const pills: { text: string; fill: string; ink: string; border?: string }[] = [];
  if (input.owner) pills.push({ text: "OWNER", fill: fade(k.bg, 0.8), ink: k.text, border: k.text });
  for (const tag of input.tags) {
    /* the glyph is part of the tag, so it is painted too — the canvas has none
       of the CSS finishes a chip can wear, but the symbol is text */
    pills.push({
      text: tag.glyph ? `${tag.glyph} ${tag.name}` : tag.name,
      fill: tag.color ?? k.ac1,
      ink: tag.ink ?? "#0b0b0d",
    });
  }
  if (pills.length) {
    const badgeH = 34;
    let bx = nameX;
    const by = bottom - badgeH;
    for (const p of pills) {
      bx += pill(ctx, p.text, bx, by, {
        fill: p.fill,
        ink: p.ink,
        border: p.border,
        font: `800 ${badgeH * 0.44}px system-ui, sans-serif`,
        h: badgeH,
      }) + 10;
    }
  }

  /* the bio, line breaks and all */
  ctx.font = `400 ${S.bio}px system-ui, sans-serif`;
  ctx.fillStyle = k.text;
  const bioMax = W - S.pad * 2;
  let y = bottom + S.gap + S.bio;
  for (const line of wrap(ctx, input.bio || "No bio yet.", bioMax).slice(0, 4)) {
    ctx.fillText(line, S.pad, y);
    y += S.bio * 1.34;
  }

  /* the facts, in the box the chat card keeps them in. Four to a row on a card
     this size, which is the two-by-two the page draws at half the pixels. */
  const facts: { label: string; value: string }[] = [];
  if (input.id) facts.push({ label: "member id", value: `#${input.id}` });
  facts.push({ label: "joined", value: new Date(input.joined || Date.now()).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) });
  facts.push({ label: "favorites", value: String(input.favorites) });
  facts.push({ label: "coins", value: input.coins.toLocaleString() });

  const boxY = y + S.gap * 0.2;
  const boxW = W - S.pad * 2;
  ctx.fillStyle = fade(k.line, 0.5);
  roundRect(ctx, S.pad, boxY, boxW, S.box, 22);
  ctx.fill();
  ctx.strokeStyle = k.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  const cell = boxW / facts.length;
  facts.forEach((f, i) => {
    const at = S.pad + cell * i + cell * 0.28;
    ctx.font = `700 ${S.label}px ui-monospace, monospace`;
    ctx.fillStyle = k.dim;
    ctx.fillText(f.label.toUpperCase(), at, boxY + S.box * 0.38);
    ctx.font = `600 ${S.fact}px ui-monospace, monospace`;
    ctx.fillStyle = k.text;
    ctx.fillText(f.value, at, boxY + S.box * 0.72);
  });

  /* the row of things a visitor can do, at the foot of the card: the buttons
     themselves are the page's business, but a card that leaves the site should
     say they are there */
  const buttonY = input.fx ? H - S.pad - S.button : boxY + S.box + S.gap;
  const buttonFont = `700 ${S.button * 0.32}px system-ui, sans-serif`;
  let bxx = S.pad;
  bxx +=
    pill(ctx, "Gift", bxx, buttonY, {
      fill: "transparent",
      ink: k.dim,
      border: k.line,
      font: buttonFont,
      pad: S.button * 0.55,
      h: S.button,
    }) + 12;
  bxx +=
    pill(ctx, "Follow", bxx, buttonY, {
      fill: k.text,
      ink: k.bg,
      font: buttonFont,
      pad: S.button * 0.9,
      h: S.button,
    }) + 12;
  pill(ctx, "Block", bxx, buttonY, {
    fill: "transparent",
    ink: k.dim,
    border: k.line,
    font: buttonFont,
    pad: S.button * 0.55,
    h: S.button,
  });

  /* the whole-card overlay, last of the art: it dresses the card over the
     words as well, exactly as it sits on the page */
  const fx = input.fx;
  if (fx && fx.complete && fx.naturalWidth) {
    cover(ctx, fx, fx.naturalWidth, fx.naturalHeight, 0, 0, W, H);
  }

  ctx.restore();

  /* the edge, so the card reads as a surface on any page it lands on */
  roundRect(ctx, 1, 1, W - 2, H - 2, 33);
  ctx.strokeStyle = k.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  return canvas;
}

/** The card, at full size. */
export async function paintCard(input: CardInput): Promise<HTMLCanvasElement> {
  return drawCard(input, await loadCard(input), document.createElement("canvas"));
}

/** Paint it and hand back a PNG data URL. */
export async function cardPng(input: CardInput): Promise<string> {
  const c = await paintCard(input);
  return c.toDataURL("image/png");
}

/* ---------- the looping one ----------
   The art on a card moves in real time: an animated picture is on whatever
   frame it is on, and no script can ask it which. So the frames are taken
   apart in time — the painter runs again every eight hundredths of a second,
   and whatever the art has moved to in the meantime is what lands in the
   file. Twenty-five of them is two seconds, which is long enough for the
   loops this art came with and short enough to encode in the browser. */
const GIF_FRAMES = 25;
/** hundredths of a second; also the gap between two frames being taken */
const GIF_DELAY = 8;
const GIF_TICKS = GIF_DELAY * 10;

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** A gif's worth of bytes, as a data URL. The chunks are there because a
 *  megabyte handed to String.fromCharCode in one call is a stack overflow. */
function dataUrl(bytes: Uint8Array): string {
  let raw = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    raw += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:image/gif;base64,${btoa(raw)}`;
}

export async function cardGif(input: CardInput, opts: { frames?: number } = {}): Promise<string> {
  const frames = Math.max(2, opts.frames ?? GIF_FRAMES);
  const assets = await loadCard(input);
  /* half the size of the painted card: a gif is for sharing, and every pixel
     of it is paid for on every frame */
  const width = input.fx ? PORTRAIT.W / 2.5 : WIDE.W / 2;
  const S = shapeOf(input);
  const scale = width / S.W;
  const height = Math.round(S.H * scale);
  const canvas = document.createElement("canvas");
  const shots: GifFrame[] = [];

  for (let i = 0; i < frames; i++) {
    drawCard(input, assets, canvas, scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("the card would not paint");
    shots.push({ pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data, delayCs: GIF_DELAY });
    if (i < frames - 1) await wait(GIF_TICKS);
  }

  return dataUrl(encodeGif(shots, canvas.width, height));
}

/* NULL · card.ts
   The share card, painted onto a canvas so it can leave the browser as a
   file. Nothing is uploaded anywhere: the canvas is drawn here and handed
   back as a PNG data URL, which is why a downloaded card works offline.

   It is drawn rather than screenshotted. A screenshot would need the whole
   DOM rasterised; this draws the same card from the same values, so it comes
   out the right size every time and the effect clip can be drawn straight
   from the <video> that is already playing on the page. */

import type { NameStyle } from "./account";

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

/** Every colour in a CSS value, in order. A gradient string, a plain hex, or
 *  nothing at all — the banner may be an image, and that is handled apart. */
function colorsIn(css: string): string[] {
  return css.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b|rgba?\([^)]*\)/gi) ?? [];
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

/** The banner sweep, drawn across the card it is given. */
function bannerPaint(ctx: CanvasRenderingContext2D, banner: string, fallback: Ink, w: number, h: number) {
  const found = colorsIn(banner);
  if (found.length === 0) return fallback.ac1;
  const g = ctx.createLinearGradient(0, 0, w, h * 0.9);
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

function pill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { fill: string; ink: string; font: string; pad?: number; border?: string },
) {
  ctx.font = opts.font;
  const pad = opts.pad ?? 14;
  const w = ctx.measureText(text.toUpperCase()).width + pad * 2;
  const h = 34;
  roundRect(ctx, x, y, w, h, 8);
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
  return w;
}

/** Draw the card. Returns the canvas so the caller decides what to do with
 *  it: a data URL for a download, or nothing at all. */
export async function paintCard(input: CardInput): Promise<HTMLCanvasElement> {
  /* The card's shape: with an overlay on, the art's own (45:88) so the art
     lands edge to edge with nothing cropped; without one, the wide card it
     has always been. */
  const W = input.fx ? 900 : 1200;
  const H = input.fx ? 1760 : 760;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const k = ink();

  /* the card itself, so the rounded corners are the only thing outside it */
  ctx.fillStyle = k.bg;
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.fill();

  ctx.save();
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.clip();

  /* the banner, then the effect clip screened over it, exactly as the page
     composites them: black in the clip disappears, the glow stays */
  ctx.fillStyle = bannerPaint(ctx, input.banner, k, W, H);
  ctx.fillRect(0, 0, W, H);

  const photo = input.banner.includes("url(") ? /url\((['"]?)(.*?)\1\)/.exec(input.banner)?.[2] : null;
  if (photo) {
    const img = await loadImage(photo);
    if (img) {
      try {
        ctx.globalCompositeOperation = "source-over";
        cover(ctx, img, img.naturalWidth, img.naturalHeight, 0, 0, W, H);
      } catch {
        /* a remote banner taints the canvas: the gradient stands in */
      }
    }
  }

  const vid = input.video;
  if (vid && vid.readyState >= 2 && vid.videoWidth) {
    ctx.globalCompositeOperation = "screen";
    cover(ctx, vid, vid.videoWidth, vid.videoHeight, 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  }

  /* the scrim: clear across the art, heavier where the words are */
  const scrim = ctx.createLinearGradient(0, 0, 0, H);
  scrim.addColorStop(0, "rgba(0,0,0,0.05)");
  scrim.addColorStop(0.46, fade(k.bg, 0.18));
  scrim.addColorStop(1, fade(k.bg, 0.95));
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  /* the mark, in the corner, and the address it lives at */
  ctx.fillStyle = k.text;
  ctx.font = '700 40px ui-rounded, "Nunito", system-ui, sans-serif';
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 0.92;
  ctx.fillText("null", 46, 74);
  ctx.globalAlpha = 1;
  ctx.font = "500 20px ui-monospace, monospace";
  ctx.fillStyle = k.dim;
  const addr = "null://me";
  ctx.fillText(addr, W - 46 - ctx.measureText(addr).width, 70);

  /* the picture, with whatever they wear around it */
  const px = 76;
  const py = H - 300;
  const pr = 76;
  const face = input.pfp ? await loadImage(input.pfp) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(px + pr, py + pr, pr, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = k.line;
  ctx.fillRect(px, py, pr * 2, pr * 2);
  if (face) cover(ctx, face, face.naturalWidth, face.naturalHeight, px, py, pr * 2, pr * 2);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(px + pr, py + pr, pr, 0, Math.PI * 2);
  ctx.strokeStyle = k.text;
  ctx.lineWidth = 4;
  ctx.stroke();

  /* the decoration around the picture: its square art at 135% of the circle,
     centred on it — the box the art is drawn for, corners and all */
  const deco = input.deco;
  if (deco && deco.complete && deco.naturalWidth) {
    const box = pr * 2 * 1.35;
    ctx.drawImage(deco, px + pr - box / 2, py + pr - box / 2, box, box);
  }

  /* the name, in the colour or gradient they chose, and the handle under it */
  const style = input.nameStyle;
  ctx.font = `700 58px ${input.font || 'ui-rounded, system-ui, sans-serif'}`;
  if (style.mode === "gradient") {
    const g = ctx.createLinearGradient(px + pr * 2 + 34, py - 20, px + pr * 2 + 380, py + 60);
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
  const nameX = px + pr * 2 + 34;
  ctx.fillText(input.name.slice(0, 26), nameX, py + 44);
  ctx.shadowBlur = 0;

  ctx.font = "500 22px ui-monospace, monospace";
  ctx.fillStyle = k.dim;
  ctx.fillText(`@${input.handle}`, nameX, py + 78);

  /* the badges: the owner's, which cannot be bought, and a shop tag */
  let cx = nameX;
  if (input.owner) {
    cx += pill(ctx, "OWNER", cx, py + 94, {
      fill: fade(k.bg, 0.8),
      ink: k.text,
      font: "800 15px system-ui, sans-serif",
      border: k.text,
    }) + 10;
  }
  for (const tag of input.tags) {
    /* the glyph is part of the tag, so it is painted too — the canvas has
       none of the CSS finishes a chip can wear, but the symbol is text */
    const label = tag.glyph ? `${tag.glyph} ${tag.name}` : tag.name;
    cx += pill(ctx, label, cx, py + 94, {
      fill: tag.color ?? k.ac1,
      ink: tag.ink ?? "#0b0b0d",
      font: "800 15px system-ui, sans-serif",
    }) + 10;
  }

  /* the bio, line breaks and all. The baseline is set again here because the
     pills above centre their text, and it would carry over. */
  ctx.textBaseline = "alphabetic";
  ctx.font = "400 24px system-ui, sans-serif";
  ctx.fillStyle = k.text;
  const lines = wrap(ctx, input.bio || "No bio yet.", W - 140 - (px + pr * 2 + 34)).slice(0, 4);
  lines.forEach((l, i) => ctx.fillText(l, nameX, py + 168 + i * 32));

  /* the footer: when they joined, and what the card is worth */
  const when = new Date(input.joined || Date.now()).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  ctx.font = "500 20px ui-monospace, monospace";
  ctx.fillStyle = k.dim;
  const foot = `joined ${when} · ${input.favorites} favorites · ${input.coins.toLocaleString()} coins`;
  ctx.fillText(foot, 46, H - 52);

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

  return c;
}

/** Paint it and hand back a PNG data URL. */
export async function cardPng(input: CardInput): Promise<string> {
  const c = await paintCard(input);
  return c.toDataURL("image/png");
}

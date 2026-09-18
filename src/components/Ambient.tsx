/* NULL · Ambient.tsx
   The air behind the page: two slow drifts, drawn on one canvas.

   · **fog** — a handful of very large, very faint blobs of the palette's
     accent, moving at under a pixel a frame. It is the whole background
     rather than a decoration on it, so it is drawn at the accent's colour at
     around four percent, which is enough to read as depth and not enough to
     compete with text.
   · **particles** — small dots rising, each with its own speed. A slow
     blizzard, and the reason a dark theme does not look like a dead screen.

   Both are NULL's own drawing. Nothing is fetched, nothing is a library, and
   the whole thing is one canvas that is 1.5x the window at most: a
   background that costs frames is a background that has to go, so the loop
   stops the moment the tab is hidden and never starts at all in the
   performance modes. What is left on screen in those modes is a single
   static frame, which is what a still background should be. */

import { useEffect, useRef } from "react";

import { prefs, usePalette } from "../lib/themes";
import { useStore } from "../lib/store";

type Blob = { x: number; y: number; r: number; vx: number; vy: number; a: number };
type Speck = { x: number; y: number; r: number; vy: number; vx: number; ph: number };

/** How many of each. Tuned by eye: more fog stops being fog and becomes soup,
 *  and past eighty specks the eye cannot follow any of them. */
const FOG_N = 6;
const SPECKS = 70;

export function Ambient() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mode = useStore(prefs).ambient;
  const perf = useStore(prefs).perf;
  const reduceMotion = useStore(prefs).reduceMotion;
  const palette = usePalette();

  /* the palette is a dependency on purpose: a new palette means new colours,
     and the cheap way to get them is to build the scene again */
  useEffect(() => {
    const el = canvas.current;
    if (!el || mode === "off") return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const root = document.documentElement;
    const css = getComputedStyle(root);
    const accent = (css.getPropertyValue("--ac-1") || "#f4f4f5").trim();
    const light = root.dataset.mode === "light";
    const fog = mode === "fog" || mode === "both";
    const specks = mode === "particles" || mode === "both";
    /* the performance switch and the motion switch both mean the same thing
       here: draw it once and leave it alone */
    const still = !!perf || reduceMotion;

    let w = 0;
    let h = 0;
    const blobs: Blob[] = [];
    const dots: Speck[] = [];

    const size = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      el.width = Math.floor(w * dpr);
      el.height = Math.floor(h * dpr);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const build = () => {
      blobs.length = 0;
      dots.length = 0;
      const base = Math.min(w, h);
      if (fog) {
        for (let i = 0; i < FOG_N; i++) {
          const r = base * (0.32 + Math.random() * 0.28);
          blobs.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r,
            vx: (Math.random() - 0.5) * 0.22,
            vy: (Math.random() - 0.5) * 0.18,
            a: 0.03 + Math.random() * 0.03,
          });
        }
      }
      if (specks) {
        for (let i = 0; i < SPECKS; i++) {
          dots.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 0.6 + Math.random() * 1.5,
            vy: 0.06 + Math.random() * 0.22,
            vx: (Math.random() - 0.5) * 0.08,
            ph: Math.random() * Math.PI * 2,
          });
        }
      }
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      /* on a dark palette the layers add up and the fog reads as light in the
         air; on a light one they have to stay subtractive or it washes out */
      ctx.globalCompositeOperation = light ? "source-over" : "lighter";

      if (fog) {
        for (const b of blobs) {
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
          g.addColorStop(0, hexA(accent, b.a));
          g.addColorStop(0.55, hexA(accent, b.a * 0.45));
          g.addColorStop(1, hexA(accent, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (specks) {
        ctx.fillStyle = hexA(accent, light ? 0.16 : 0.3);
        for (const d of dots) {
          const tw = 0.55 + 0.45 * Math.sin(t / 1400 + d.ph);
          ctx.globalAlpha = tw;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const step = (t: number) => {
      /* fog wraps around the edges rather than bouncing off them: a blob that
         reverses is a blob the eye catches reversing */
      for (const b of blobs) {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < -b.r) b.x = w + b.r;
        if (b.x > w + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = h + b.r;
        if (b.y > h + b.r) b.y = -b.r;
      }
      for (const d of dots) {
        d.y -= d.vy;
        d.x += d.vx;
        if (d.y < -4) {
          d.y = h + 4;
          d.x = Math.random() * w;
        }
        if (d.x < -4) d.x = w + 4;
        if (d.x > w + 4) d.x = -4;
      }
      draw(t);
    };

    size();
    build();
    draw(0);

    let raf = 0;
    let stopped = true;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      step(t);
    };
    const start = () => {
      if (stopped || still) return;
      stopped = false;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };

    const onResize = () => {
      size();
      build();
      draw(0);
      if (!still) start();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisible);
    if (document.visibilityState === "visible") start();

    return () => {
      stop();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mode, palette.id, perf, reduceMotion]);

  if (mode === "off") return null;
  return <canvas className="ambient" ref={canvas} aria-hidden="true" />;
}

/** A colour at an alpha. The palette gives hex, and canvas wants either a
 *  full colour or four channels, so the hex is unpacked here — including the
 *  three-digit form, because a palette is written by hand and half of them
 *  are shortcuts. */
function hexA(hex: string, a: number): string {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 6) {
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  /* named colours, rgb(), and anything else: hand it back and let the canvas
     decide, with the alpha applied through the global one */
  return hex;
}

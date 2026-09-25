/* NULL · gif.ts
   A GIF89a writer. One job: turn a stack of canvas frames into the bytes of a
   file that plays again by itself.

   It is written here rather than pulled in because the card is the only thing
   that wants one, and the parts of the format it actually needs are small: a
   palette chosen from the frames (median cut), the frames mapped onto that
   palette, and the runs of pixels that come out of LZW. Everything above this
   file works in RGBA and knows none of it.

   Two details worth knowing while reading this:

   · Slot 0 of the palette is the empty space. A card has round corners and the
     pixels outside them are transparent, so one slot is spent on that and the
     frames keep their shape instead of filling the corners with a colour.
   · A delay is counted in hundredths of a second, because that is the unit the
     format has. A browser reads anything under two as a tenth, so the card
     asks for eight.

   Nothing here touches the DOM: give it pixels and it gives back bytes, which
   is what makes it testable against a real decoder (see smoke-gif.test.ts). */

export type GifFrame = {
  /** the frame, RGBA, width × height × 4 — what getImageData hands over */
  pixels: Uint8ClampedArray;
  /** how long the frame stays up, in hundredths of a second */
  delayCs: number;
};

/** 256 entries: one for the empty corners, 255 for what is drawn. */
const SLOTS = 256;
const TRANSPARENT = 0;
const COLORS = SLOTS - 1;
/** LZW works in symbols of at most eight bits, so the table is the whole 256. */
const CODE_SIZE = 8;

/* ---------- the palette ----------
   Median cut. Every colour in every frame is a point in a box; the box with
   the widest spread is split through the middle of that channel, again and
   again, until there are as many boxes as colours. Each box then averages to
   the colour it contributes. It is not the best palette in the world, but it
   is the right one for a card: mostly greys, with the few colours the banner
   brought. */

/** The channel a box is widest in, and how wide. */
function widest(samples: Uint8Array, order: Uint32Array, from: number, to: number) {
  let lo0 = 255;
  let lo1 = 255;
  let lo2 = 255;
  let hi0 = 0;
  let hi1 = 0;
  let hi2 = 0;
  for (let i = from; i < to; i++) {
    const at = order[i] * 3;
    const r = samples[at];
    const g = samples[at + 1];
    const b = samples[at + 2];
    if (r < lo0) lo0 = r;
    if (r > hi0) hi0 = r;
    if (g < lo1) lo1 = g;
    if (g > hi1) hi1 = g;
    if (b < lo2) lo2 = b;
    if (b > hi2) hi2 = b;
  }
  let channel = 0;
  let range = hi0 - lo0;
  if (hi1 - lo1 > range) {
    channel = 1;
    range = hi1 - lo1;
  }
  if (hi2 - lo2 > range) {
    channel = 2;
    range = hi2 - lo2;
  }
  return { channel, range };
}

/** Split a box through the middle of one channel. */
function split(samples: Uint8Array, order: Uint32Array, from: number, to: number, channel: number) {
  const slice = Array.from(order.subarray(from, to));
  slice.sort((a, b) => samples[a * 3 + channel] - samples[b * 3 + channel]);
  order.set(slice, from);
}

/** The palette: `want` colours, RGB, one after another. */
function paletteOf(frames: GifFrame[], want: number): Uint8Array {
  /* Sample the frames rather than reading every pixel: the palette is a
     summary, and every sixty-fourth pixel summarises it just as well. */
  const total = frames.reduce((n, f) => n + f.pixels.length / 4, 0);
  const stride = Math.max(1, Math.floor(total / 16384));
  const samples: number[] = [];
  for (const f of frames) {
    const n = f.pixels.length / 4;
    for (let i = 0; i < n; i += stride) {
      const p = i * 4;
      if (f.pixels[p + 3] < 128) continue; // the corners are not part of it
      samples.push(f.pixels[p], f.pixels[p + 1], f.pixels[p + 2]);
    }
  }
  if (!samples.length) samples.push(0, 0, 0);

  const table = Uint8Array.from(samples);
  const count = table.length / 3;
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;

  let boxes: { from: number; to: number }[] = [{ from: 0, to: count }];
  while (boxes.length < want) {
    let pick = -1;
    let best = 0;
    let channel = 0;
    for (let b = 0; b < boxes.length; b++) {
      if (boxes[b].to - boxes[b].from < 2) continue;
      const w = widest(table, order, boxes[b].from, boxes[b].to);
      if (w.range > best) {
        best = w.range;
        pick = b;
        channel = w.channel;
      }
    }
    /* every box is a single colour already: more boxes would only repeat it */
    if (pick < 0 || best === 0) break;
    const { from, to } = boxes[pick];
    split(table, order, from, to, channel);
    const half = from + Math.floor((to - from) / 2);
    boxes = [...boxes.slice(0, pick), { from, to: half }, { from: half, to }, ...boxes.slice(pick + 1)];
  }

  const pal = new Uint8Array(want * 3);
  boxes.forEach((box, i) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let s = box.from; s < box.to; s++) {
      const at = order[s] * 3;
      r += table[at];
      g += table[at + 1];
      b += table[at + 2];
    }
    const n = Math.max(1, box.to - box.from);
    pal[i * 3] = Math.round(r / n);
    pal[i * 3 + 1] = Math.round(g / n);
    pal[i * 3 + 2] = Math.round(b / n);
  });
  /* a short palette is filled out with its own last colour rather than zeroes */
  for (let i = boxes.length; i < want; i++) {
    pal[i * 3] = pal[(boxes.length - 1) * 3];
    pal[i * 3 + 1] = pal[(boxes.length - 1) * 3 + 1];
    pal[i * 3 + 2] = pal[(boxes.length - 1) * 3 + 2];
  }
  return pal;
}

/** The nearest palette colour to one pixel. Green counts double, because the
 *  eye reads a wrong green as a wrong picture and a wrong blue as a shade. */
function nearest(pal: Uint8Array, r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < COLORS; i++) {
    const at = i * 3;
    const dr = r - pal[at];
    const dg = g - pal[at + 1];
    const db = b - pal[at + 2];
    const d = dr * dr * 2 + dg * dg * 4 + db * db;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** One frame, as palette indexes. The answers are remembered for every 15-bit
 *  colour, which is what keeps this from being the slow part of the export. */
function indexes(pixels: Uint8ClampedArray, pal: Uint8Array, cache: Int16Array): Uint8Array {
  const n = pixels.length / 4;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (pixels[p + 3] < 128) {
      out[i] = TRANSPARENT;
      continue;
    }
    const r = pixels[p];
    const g = pixels[p + 1];
    const b = pixels[p + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let hit = cache[key];
    if (hit < 0) {
      hit = nearest(pal, r, g, b);
      cache[key] = hit;
    }
    /* slot 0 belongs to the corners, so the drawn colours start at one */
    out[i] = hit + 1;
  }
  return out;
}

/* ---------- the bytes ---------- */

/** A growing buffer with the four shapes this format writes in. */
class Out {
  private buf = new Uint8Array(1 << 16);
  private at = 0;

  private room(n: number) {
    if (this.at + n <= this.buf.length) return;
    let size = this.buf.length;
    while (size < this.at + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.at));
    this.buf = next;
  }

  byte(v: number) {
    this.room(1);
    this.buf[this.at++] = v & 0xff;
  }
  /** every number in the format is little-endian, sixteen bits where it counts */
  le16(v: number) {
    this.room(2);
    this.buf[this.at++] = v & 0xff;
    this.buf[this.at++] = (v >> 8) & 0xff;
  }
  ascii(s: string) {
    this.room(s.length);
    for (let i = 0; i < s.length; i++) this.buf[this.at++] = s.charCodeAt(i);
  }
  bytes(a: Uint8Array) {
    this.room(a.length);
    this.buf.set(a, this.at);
    this.at += a.length;
  }
  done(): Uint8Array {
    return this.buf.slice(0, this.at);
  }
}

/** One frame's pixels, as LZW, cut into the 255-byte blocks the format wants.
 *
 *  The dictionary is kept as a plain table rather than a Map: it is at most
 *  4096 codes of 256 symbols, which is a megabyte of Int32Array and far faster
 *  to look through than anything with hashing in it. A miss is both an emitted
 *  code and a new entry, which is the whole of LZW. */
function lzw(indices: Uint8Array, out: Out) {
  out.byte(CODE_SIZE);
  const clear = 1 << CODE_SIZE;
  const end = clear + 1;
  let size = CODE_SIZE + 1;
  let next = clear + 2;
  const dict = new Int32Array(4096 * 256).fill(-1);

  let bits = 0;
  let held = 0;
  let used = 0;
  const block = new Uint8Array(255);
  const flush = () => {
    if (!used) return;
    out.byte(used);
    out.bytes(block.subarray(0, used));
    used = 0;
  };
  const push = (code: number) => {
    bits |= code << held;
    held += size;
    while (held >= 8) {
      block[used++] = bits & 0xff;
      bits >>>= 8;
      held -= 8;
      if (used === 255) flush();
    }
  };

  push(clear);
  if (indices.length) {
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const at = prefix * 256 + k;
      const seen = dict[at];
      if (seen >= 0) {
        prefix = seen;
        continue;
      }
      push(prefix);
      if (next < 4096) {
        dict[at] = next++;
        /* The reader builds its table one code behind this one, so the code
           size grows as soon as this table is one past what it can hold. Get
           this wrong and every frame after the first 500 codes is rubbish. */
        if (next > 1 << size && size < 12) size++;
      } else {
        push(clear);
        dict.fill(-1);
        next = clear + 2;
        size = CODE_SIZE + 1;
      }
      prefix = k;
    }
    push(prefix);
  }
  push(end);
  if (held > 0) {
    block[used++] = bits & 0xff;
    if (used === 255) flush();
  }
  flush();
  out.byte(0); // the empty block that closes the image data
}

/** The whole file: frames in, bytes out. The frames must all be the same size
 *  as the picture they are given with, which is the one thing a caller can get
 *  wrong. */
export function encodeGif(frames: GifFrame[], width: number, height: number): Uint8Array {
  if (!frames.length) throw new Error("gif: there is nothing to draw");
  const need = width * height * 4;
  for (const f of frames) {
    if (f.pixels.length !== need) throw new Error("gif: a frame is not the size of the picture");
  }

  const pal = paletteOf(frames, COLORS);
  const table = new Uint8Array(SLOTS * 3);
  table.set(pal, 3); // slot 0 stays black; it is never drawn

  const out = new Out();
  out.ascii("GIF89a");
  out.le16(width);
  out.le16(height);
  out.byte(0xf7); // a full 256-colour table, present, unsorted
  out.byte(TRANSPARENT);
  out.byte(0); // square pixels
  out.bytes(table);

  /* the extension that makes it loop rather than play once */
  out.byte(0x21);
  out.byte(0xff);
  out.byte(11);
  out.ascii("NETSCAPE2.0");
  out.byte(3);
  out.byte(1);
  out.le16(0); // nought means forever
  out.byte(0);

  const cache = new Int16Array(1 << 15).fill(-1);
  for (const f of frames) {
    out.byte(0x21);
    out.byte(0xf9);
    out.byte(4);
    /* clear the frame before the next one, and let slot 0 show through */
    out.byte((2 << 2) | 1);
    out.le16(Math.max(2, Math.round(f.delayCs)));
    out.byte(TRANSPARENT);
    out.byte(0);
    out.byte(0x2c);
    out.le16(0);
    out.le16(0);
    out.le16(width);
    out.le16(height);
    out.byte(0); // no local table, not interlaced
    lzw(indexes(f.pixels, pal, cache), out);
  }

  out.byte(0x3b);
  return out.done();
}

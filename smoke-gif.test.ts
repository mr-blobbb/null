/* The looping card, checked against a decoder that is not ours.

   A hand-written GIF writer is exactly the kind of thing that looks right and
   writes rubbish: LZW has an off-by-one in it — when the code size grows — and
   getting that one wrong breaks every frame after the first few hundred codes
   without raising anything. So the frames written here are read back with
   libvips, through sharp, and the pixels are compared with the ones that went
   in. sharp reads GIFs the same way a browser does, so a file that survives
   this is a file that plays. */

import { expect, test } from "bun:test";
import sharp from "sharp";

import { encodeGif, type GifFrame } from "./src/lib/gif";

const W = 96;
const H = 64;

/** A dark frame with one white square on it, at a different place each frame:
 *  enough colour to need a palette, and enough motion for a decoder to have to
 *  get the second frame right rather than repeat the first. */
function square(step: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      const inSquare = x >= step * 20 && x < step * 20 + 20 && y >= 20 && y < 40;
      const v = inSquare ? 245 : 12;
      px[p] = v;
      px[p + 1] = inSquare ? 245 : 16;
      px[p + 2] = inSquare ? 250 : 24;
      px[p + 3] = 255;
    }
  }
  return px;
}

const frames: GifFrame[] = [0, 1, 2].map((i) => ({ pixels: square(i), delayCs: 8 }));

/** Read a frame back out of the written file, as RGB rows. */
async function readBack(bytes: Uint8Array) {
  const buf = Buffer.from(bytes);
  const meta = await sharp(buf, { animated: true }).metadata();
  const { data, info } = await sharp(buf, { animated: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { meta, data, info };
}

test("the file is a looping gif of every frame that went in", async () => {
  const bytes = encodeGif(frames, W, H);
  expect(String.fromCharCode(...bytes.slice(0, 6))).toBe("GIF89a");

  const { meta } = await readBack(bytes);
  expect(meta.format).toBe("gif");
  expect(meta.width).toBe(W);
  /* a reader hands back the frames stacked, so the height it reports is all of
     them: three frames of 64 is 192. A browser un-stacks them. */
  expect(meta.height).toBe(H * 3);
  expect(meta.pages).toBe(3);
  /* nought means forever, and a delay of eight hundredths on every frame */
  expect(meta.loop).toBe(0);
  expect(meta.delay).toEqual([80, 80, 80]);
});

test("the pixels come back the way they went in", async () => {
  const bytes = encodeGif(frames, W, H);
  const { data, info } = await readBack(bytes);
  const channels = info.channels;
  const page = W * H * channels;
  expect(data.length).toBe(page * 3);

  /* the square is where it was put, in each frame, and the background is dark:
     a decoder reads a moving square only if the code table crossed its growth
     points correctly */
  for (let f = 0; f < 3; f++) {
    const at = (y: number, x: number) => {
      const p = f * page + (y * W + x) * channels;
      return [data[p], data[p + 1], data[p + 2]];
    };
    const inside = at(30, f * 20 + 10);
    expect(inside[0]).toBeGreaterThan(200);
    /* where the square was in the frame before: dark, which is the thing a
       broken code-size step gets wrong — a decoder that has lost its table
       smears the first frame over all of them */
    if (f > 0) expect(at(30, (f - 1) * 20 + 10)[0]).toBeLessThan(60);
    expect(at(2, 2)[0]).toBeLessThan(60);
  }
});

test("a frame of the wrong size is refused rather than written", () => {
  expect(() => encodeGif([{ pixels: new Uint8ClampedArray(4), delayCs: 8 }], W, H)).toThrow(
    /not the size/,
  );
  expect(() => encodeGif([], W, H)).toThrow(/nothing to draw/);
});

test("a flat frame still writes a readable palette", async () => {
  /* a card with nothing moving on it is a real case: the export still has to
     produce a file, and one colour is one entry rather than an empty table */
  const flat: GifFrame = { pixels: new Uint8ClampedArray(W * H * 4).fill(128), delayCs: 8 };
  for (let i = 3; i < flat.pixels.length; i += 4) flat.pixels[i] = 255;
  const bytes = encodeGif([flat, flat], W, H);
  const { meta, data } = await readBack(bytes);
  expect(meta.pages).toBe(2);
  expect(Math.abs(data[0] - 128)).toBeLessThan(12);
});

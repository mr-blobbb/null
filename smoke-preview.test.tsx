/* The card, the preview editor, and the files the shelf points at.

   Two things are checked here that nothing else can check without a browser.
   The card is rendered to markup, so a broken preview editor is a failing
   test rather than a blank sheet; and every piece of art the shelf names is
   checked against the folder it is supposed to be in, because a shop card
   pointing at a file that is not there is exactly the fault this release is
   about: the art used to come from somebody else's host and a filter took it,
   and the fix only holds while the names and the files agree. */

import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createElement } from "react";

/* the shims have to exist before anything is imported — the account and the
   shop both read localStorage as they load */
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};

const { renderToStaticMarkup } = await import("react-dom/server");
const { ShareCard } = await import("./src/components/ShareCard");
const { AVATAR_ASSETS, EFFECT_ASSETS } = await import("./src/lib/shopAssets");

/* createElement rather than JSX so the props can stay loose in one place:
   every call below is a card with a couple of things changed */
type Props = Partial<Parameters<typeof ShareCard>[0]>;
const draw = (props: Props) =>
  renderToStaticMarkup(createElement(ShareCard, { open: true, onClose: () => {}, ...props }));

test("a closed card draws nothing", () => {
  expect(draw({ open: false })).toBe("");
});

test("the editor is the card plus the four things it changes", () => {
  const html = draw({ editing: true });
  expect(html).toContain("card-ed");
  expect(html).toContain("Name");
  expect(html).toContain("Name style");
  expect(html).toContain("Banner");
  expect(html).toContain("Save to my card");
  expect(html).toContain("Revert");
  /* every font a name can wear is offered, because the choice is the point */
  expect(html).toContain("Press Start 2P");
  /* and it is a preview: nothing on it is a link out or a copy of one */
  expect(html).not.toContain("Copy link");
});

test("the share card is still the share card", () => {
  const html = draw({});
  expect(html).toContain("Copy link");
  expect(html).toContain("Download PNG");
  expect(html).not.toContain("card-ed");
});

test("a previewed piece is the local file the shelf names", () => {
  const fx = draw({ editing: true, preview: { shelf: "effect", id: "fx-celestial" } });
  expect(fx).toContain("share--fx");
  expect(fx).toContain("decor/shop/fx/celestial.png");

  const face = draw({ editing: true, preview: { shelf: "avatar", id: "pfp-orbital" } });
  expect(face).toContain("decor/shop/pfp/orbital.png");

  /* a tag is worn instead of the pile, so a preview of one is not a preview
     of the rest */
  const tag = draw({ editing: true, preview: { shelf: "tag", id: "tstar" } });
  expect(tag).toContain("tagchip");
});

test("every file the shelf names is in the folder it names", () => {
  const off = [
    ...AVATAR_ASSETS.flatMap((a) => [a.moving, a.still]),
    ...EFFECT_ASSETS.map((e) => e.url),
  ];
  expect(off.length).toBe(AVATAR_ASSETS.length * 2 + EFFECT_ASSETS.length);
  for (const url of off) {
    /* no host of any kind: a resource the page has to go somewhere else for
       is the thing that was blocked */
    expect(url.startsWith("decor/shop/")).toBe(true);
    expect(existsSync(`public/${url}`)).toBe(true);
  }
});

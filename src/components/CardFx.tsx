/* NULL · CardFx.tsx
   A whole-card profile overlay for a card that draws its own markup.

   The share card can put the overlay inside itself — it owns every layer it
   has. The chat's pop-out cannot reasonably be asked to: it is a scroll
   container with a banner, a hanging picture, a word layer and a stack of
   buttons, and none of those should have to know that the shop exists.

   So the overlay is not inserted into the card. The card's own `::after`
   paints it, and this is what tells that pseudo-element which picture to
   paint: one custom property, handed down through a wrapper that generates no
   box of its own. The class on the wrapper is also how the card is told to
   take the shape the art was drawn for, since CSS cannot ask a variable what
   it holds.

   Assets measure 450×880 — see src/lib/shopAssets.ts for how that was
   settled — so `background-size: 100% 100%` on a card of that ratio is an
   exact fit rather than a crop. */

import type { ReactNode } from "react";

import { effectAsset } from "../lib/shopAssets";

export function CardFx({
  effect,
  children,
}: {
  /** the shelf id of the effect being worn, if there is one */
  effect?: string | null;
  children: ReactNode;
}) {
  const fx = effectAsset(effect);
  return (
    <span
      className={`card-fx${fx ? " is-on" : ""}`}
      /* `none` rather than leaving it unset: a card that came from under a
         card wearing an overlay must not inherit the last one */
      style={{ ["--card-fx" as string]: fx ? `url("${fx.url}")` : "none" }}
    >
      {children}
    </span>
  );
}

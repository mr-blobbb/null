/* NULL · ShareCard.tsx
   The card a profile turns into when it leaves the site.

   This is where the profile effects went: instead of being painted behind
   the live profile — where a wide looping clip is squashed into a strip and
   tinted until nothing of it shows — the effect is the background of this
   one card, at the size it was made for, with the words sitting in the part
   that is kept clear for them.

   Download paints the same card onto a canvas (src/lib/card.ts) and hands
   back a PNG. Nothing is uploaded anywhere.

   The same card is what the Shop's preview shows, with one piece swapped in:
   `preview` wears an item instead of what is equipped, so you can look at a
   decoration on your own card before paying for it. Nothing about either use
   touches the server — the card is drawn from this browser's account and
   shop state, and the preview works signed out and offline. */

import { useRef, useState } from "react";
import { BadgeCheck, Coins, Copy, Crown, Download, Eye, Trophy } from "lucide-react";

import { nameStyleCss, useAccount } from "../lib/account";
import { itemsOf, useEcon, type Shelf } from "../lib/econ";
import { isOwner, OWNER_TAG } from "../lib/owner";
import { cardPng } from "../lib/card";
import { effectAsset } from "../lib/shopAssets";
import { AvatarArt, EffectArt, TagChip } from "../lib/art";
import { NullFace } from "../lib/brand";
import { Sheet } from "./Sheet";

export function ShareCard({
  open,
  onClose,
  preview,
}: {
  open: boolean;
  onClose: () => void;
  /** an item to wear for this card only, from the Shop's preview */
  preview?: { shelf: Shelf; id: string } | null;
}) {
  const me = useAccount();
  const eco = useEcon();
  const card = useRef<HTMLDivElement>(null);
  const nameEl = useRef<HTMLHeadingElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const owner = isOwner(me.user);
  /* what the card wears: normally the equipped set, and in a preview the one
     piece that was asked for instead of it */
  const avatar = preview?.shelf === "avatar" ? preview.id : eco.equipped.avatar;
  const effect = preview?.shelf === "effect" ? preview.id : eco.equipped.effect;
  const tagIds = preview?.shelf === "tag" ? [preview.id] : eco.equipped.tags;
  const tags = itemsOf(tagIds);
  /* the overlay, when they are wearing one: it dresses the whole card, and
     the card takes its shape so nothing of it is cropped away */
  const overlay = effectAsset(effect);

  const say = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(null), 2400);
  };

  const download = async () => {
    setBusy(true);
    try {
      /* the frames already playing on this card, so the PNG is painted with
         the same frame the eye is looking at */
      const first = (...sels: string[]) => {
        for (const sel of sels) {
          const el = card.current?.querySelector<HTMLImageElement>(sel);
          if (el?.complete && el.naturalWidth) return el;
        }
        return null;
      };
      const png = await cardPng({
        name: me.name || me.user || "someone",
        handle: me.user ?? "",
        bio: me.bio,
        joined: me.joined,
        banner: me.banner,
        pfp: me.pfp,
        owner,
        tags: tags.map((t) => ({ name: t.name, color: t.color, ink: t.ink, glyph: t.glyph })),
        nameStyle: me.nameStyle,
        favorites: me.favorites.length,
        coins: eco.coins,
        /* the clip already playing on this card, drawn frame by frame */
        video: card.current?.querySelector("video") ?? null,
        fx: first(".share-fx img"),
        deco: first(".share-pic .art--deco .deco-move", ".share-pic .art--deco .deco-still"),
        font: nameEl.current ? getComputedStyle(nameEl.current).fontFamily : undefined,
      });
      const a = document.createElement("a");
      a.href = png;
      a.download = `null-${(me.user ?? "card").toLowerCase()}.png`;
      a.click();
      say("Saved.");
    } catch {
      say("The card would not paint.");
    }
    setBusy(false);
  };

  return (
    <Sheet open={open} onClose={onClose} title={preview ? "Preview" : "Share card"} width={640}>
      <p className="muted tiny">
        {preview
          ? "Your card as it would look wearing this. Nothing is bought and nothing is sent anywhere — the card is drawn on this machine."
          : "This is your card at full size — banner and effect included. Downloading it paints a PNG here in the browser; nothing is uploaded."}
      </p>

      <div className={`share${overlay ? " share--fx" : ""}`} ref={card}>
        <span className="share-bg">
          <span className="share-banner" style={{ background: me.banner }} />
          {/* the older drawn effects live behind the words, settled by their
              own scrim; the overlays below dress the whole card instead */}
          {effect && !overlay && (
            <span className="fx-clear">
              <EffectArt id={effect} />
            </span>
          )}
        </span>

        <span className="share-mark">null</span>
        <span className="share-addr">null://me</span>

        <div className="share-id">
          <span className="share-pic">
            {me.pfp ? <img src={me.pfp} alt="" /> : <NullFace />}
            <AvatarArt id={avatar} />
          </span>

          <div className="share-txt">
            {/* the badge is beside the name, never inside it: the name can be
                a gradient cut out of its own text, which eats the icon */}
            <div className="share-name-row">
              {/* somebody looking at this from the shop may not have signed
                  in at all, and a card with a nameless line above an empty
                  @handle is not a preview of anything */}
              <h3 ref={nameEl} className="share-name" style={nameStyleCss(me.nameStyle)}>
                {me.name || me.user || "someone"}
              </h3>
              {owner && <BadgeCheck className="pf-verified" aria-label="Owner" />}
            </div>
            <span className="share-handle">{me.user ? `@${me.user}` : "not signed in"}</span>

            <div className="share-tags">
              {owner && (
                <span className="tagchip tagchip--owner" title={OWNER_TAG.note}>
                  <Crown />
                  {OWNER_TAG.name}
                </span>
              )}
              {tags.map((t) => (
                <TagChip key={t.id} item={t} />
              ))}
            </div>
          </div>
        </div>

        <p className={`share-bio${me.bio?.trim() ? "" : " is-empty"}`}>{me.bio || "No bio yet."}</p>

        <div className="share-foot">
          <span>
            joined{" "}
            {new Date(me.joined || Date.now()).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span className="share-dot">∙</span>
          <span>
            <Trophy /> {me.favorites.length} favorites
          </span>
          <span className="share-dot">∙</span>
          <span>
            <Coins /> {eco.coins.toLocaleString()}
          </span>
        </div>

        {overlay && (
          <span className="share-fx">
            <EffectArt id={effect} />
          </span>
        )}
      </div>

      <div className="share-actions">
        {preview ? (
          <span className="share-preview-note tiny faint">
            <Eye /> A preview only. Wear it from the shelf when you own it.
          </span>
        ) : (
          <button
            className="btn"
            onClick={() => {
              navigator.clipboard?.writeText(`${location.origin}${location.pathname}#/profile`);
              say("Link copied.");
            }}
          >
            <Copy /> Copy link
          </button>
        )}
        <button className="btn btn--fill" onClick={download} disabled={busy}>
          <Download /> {busy ? "Painting…" : "Download PNG"}
        </button>
      </div>

      {note && <p className="tiny faint share-note">{note}</p>}
    </Sheet>
  );
}

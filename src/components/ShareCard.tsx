/* NULL · ShareCard.tsx
   The card a profile turns into when it leaves the site, and the card the
   shop shows when you want to look before you buy.

   It is drawn the way the chat draws a profile card, because that is the
   question this card answers: what does somebody else see when they open you?
   Banner, the picture hanging over the seam, the name and the tags, what you
   wrote, the numbers, and the row of things a visitor can do — with the shop's
   effect behind all of it, at the size it was made for instead of squashed
   into a strip.

   Two other uses ride on the same card. `preview` wears one piece off the
   shelf instead of what is equipped, so the shop can show you a decoration on
   your own card before you pay for it. `editing` turns the sheet into the
   profile editor: name, picture, banner and name style are drawn from a
   draft, so what you are looking at is what you would be saving. Neither use
   touches the server — the card is this browser's account and shop state.

   Download paints the card in src/lib/card.ts: a PNG for a still, and a GIF
   that loops for the copy that moves. Nothing is uploaded anywhere. */

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Camera,
  Check,
  CircleSlash,
  Copy,
  Crown,
  Download,
  Eye,
  Film,
  Gift,
  RotateCcw,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";

import {
  account,
  BANNER_SWATCHES,
  NAME_FONTS,
  nameStyleCss,
  useAccount,
  type NameStyle,
} from "../lib/account";
import { itemsOf, useEcon, type Shelf } from "../lib/econ";
import { isOwner, OWNER_TAG } from "../lib/owner";
import { cardGif, cardPng } from "../lib/card";
import { effectAsset } from "../lib/shopAssets";
import { AvatarArt, EffectArt, TagChip } from "../lib/art";
import { NullFace } from "../lib/brand";
import { memberId } from "./LineParts";
import { Sheet } from "./Sheet";

type Draft = { name: string; bio: string; pfp: string | null; banner: string; nameStyle: NameStyle };

export function ShareCard({
  open,
  onClose,
  preview,
  editing = false,
}: {
  open: boolean;
  onClose: () => void;
  /** an item to wear for this card only, from the Shop's preview */
  preview?: { shelf: Shelf; id: string } | null;
  /** the sheet becomes the editor: the card is drawn from a draft */
  editing?: boolean;
}) {
  const me = useAccount();
  const eco = useEcon();
  const card = useRef<HTMLDivElement>(null);
  const nameEl = useRef<HTMLHeadingElement>(null);
  const [note, setNote] = useState<string | null>(null);
  /* null, or which of the two files is being painted */
  const [busy, setBusy] = useState<"png" | "gif" | null>(null);

  const owner = isOwner(me.user);
  /* The draft starts from the account every time the sheet opens — the sheet
     unmounts when it closes, which is what keeps it from going stale while
     you are off changing something else. */
  const [draft, setDraft] = useState<Draft>(() => ({
    name: me.name,
    bio: me.bio,
    pfp: me.pfp,
    banner: me.banner,
    nameStyle: me.nameStyle,
  }));

  /* Opening the sheet takes the card as it is now. The draft cannot be built
     once at mount, because this component stays mounted between openings and
     something may have changed on the profile page in the meantime. */
  useEffect(() => {
    if (!open) return;
    setDraft({ name: me.name, bio: me.bio, pfp: me.pfp, banner: me.banner, nameStyle: me.nameStyle });
  }, [open]);

  /* what the card wears: normally the equipped set, and in a preview the one
     piece that was asked for instead of it */
  const avatar = preview?.shelf === "avatar" ? preview.id : eco.equipped.avatar;
  const effect = preview?.shelf === "effect" ? preview.id : eco.equipped.effect;
  const tagIds = preview?.shelf === "tag" ? [preview.id] : eco.equipped.tags;
  const tags = itemsOf(tagIds);
  /* the overlay, when they are wearing one: it dresses the whole card, and
     the card takes its shape so nothing of it is cropped away */
  const overlay = effectAsset(effect);

  /* the four fields the editor can change, read from the draft while editing
     and straight off the account otherwise */
  const shown = editing ? draft : { name: me.name, bio: me.bio, pfp: me.pfp, banner: me.banner, nameStyle: me.nameStyle };
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify({
    name: me.name,
    bio: me.bio,
    pfp: me.pfp,
    banner: me.banner,
    nameStyle: me.nameStyle,
  });

  const say = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(null), 3200);
  };

  const revert = () => {
    setDraft({ name: me.name, bio: me.bio, pfp: me.pfp, banner: me.banner, nameStyle: me.nameStyle });
    say("Back to your card.");
  };

  const save = () => {
    account.set({
      name: draft.name.trim().slice(0, 24),
      bio: draft.bio.slice(0, 400),
      pfp: draft.pfp,
      banner: draft.banner,
      nameStyle: draft.nameStyle,
    });
    say("Saved to your card.");
  };

  const download = async (kind: "png" | "gif") => {
    setBusy(kind);
    try {
      /* the art already playing on this card, so the file is painted with the
         same frames the eye is looking at rather than with the first ones */
      const first = (...sels: string[]) => {
        for (const sel of sels) {
          const el = card.current?.querySelector<HTMLImageElement>(sel);
          if (el?.complete && el.naturalWidth) return el;
        }
        return null;
      };
      const input = {
        name: shown.name || me.user || "someone",
        handle: me.user ?? "",
        bio: shown.bio,
        joined: me.joined,
        banner: shown.banner,
        pfp: shown.pfp,
        owner,
        tags: tags.map((t) => ({ name: t.name, color: t.color, ink: t.ink, glyph: t.glyph })),
        nameStyle: shown.nameStyle,
        favorites: me.favorites.length,
        coins: eco.coins,
        id: me.user ? memberId(me.user) : undefined,
        /* the clip already playing on this card, drawn frame by frame */
        video: card.current?.querySelector("video") ?? null,
        fx: first(".share-fx img"),
        deco: first(".share-pic .art--deco .deco-move", ".share-pic .art--deco .deco-still"),
        font: nameEl.current ? getComputedStyle(nameEl.current).fontFamily : undefined,
      };
      const href = kind === "gif" ? await cardGif(input) : await cardPng(input);
      const a = document.createElement("a");
      a.href = href;
      a.download = `null-${(me.user ?? "card").toLowerCase()}.${kind}`;
      a.click();
      say(kind === "gif" ? "Saved. It plays again by itself." : "Saved.");
    } catch {
      say(kind === "gif" ? "The card would not record." : "The card would not paint.");
    }
    setBusy(null);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Preview" : "Share card"}
      width={editing ? 860 : 700}
      className="sheet--card"
    >
      <p className="muted tiny">
        {editing
          ? "Your card, laid out the way the chat shows it to somebody else. Change the picture, the banner, the name or the way the name is written and it appears straight away — nothing is sent anywhere, and Save is what makes it yours."
          : "This is your card at full size — banner, decoration and effect included. Downloading it paints the file here in the browser, and the GIF loops; nothing is uploaded."}
      </p>

      <div className={editing ? "carded" : undefined}>
        <div className={`share${overlay ? " share--fx" : ""}`} ref={card}>
          <span className="share-bg">
            <span className="share-banner" style={{ background: shown.banner }} />
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
              {shown.pfp ? <img src={shown.pfp} alt="" /> : <NullFace />}
              <AvatarArt id={avatar} />
              <i className="share-on" />
            </span>

            <div className="share-txt">
              {/* the badge is beside the name, never inside it: the name can be
                  a gradient cut out of its own text, which eats the icon */}
              <div className="share-name-row">
                {/* somebody looking at this from the shop may not have signed
                    in at all, and a card with a nameless line above an empty
                    @handle is not a preview of anything */}
                <h3 ref={nameEl} className="share-name" style={nameStyleCss(shown.nameStyle)}>
                  {shown.name || me.user || "someone"}
                </h3>
                {owner && <BadgeCheck className="pf-verified" aria-label="Owner" />}
              </div>

              <div className="share-handle">
                {me.user ? `@${me.user}` : "not signed in"}
                <em className="share-presence">online</em>
              </div>

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

            {/* What a visitor is offered. Spans rather than buttons on purpose:
                it is your own card, so there is nobody on the other end of a
                message — this is the shape of the thing, not the thing. */}
            <div className="share-acts" aria-hidden="true">
              <span className="btn btn--sm">Message</span>
            </div>
          </div>

          <p className={`share-bio${shown.bio?.trim() ? "" : " is-empty"}`}>{shown.bio || "No bio yet."}</p>

          <div className="share-facts">
            {me.user && <ShareFact label="member id" value={`#${memberId(me.user)}`} />}
            <ShareFact
              label="joined"
              value={new Date(me.joined || Date.now()).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            />
            <ShareFact label="favorites" value={String(me.favorites.length)} />
            <ShareFact label="coins" value={eco.coins.toLocaleString()} />
          </div>

          <div className="share-decide" aria-hidden="true">
            <span className="btn btn--sm btn--icon">
              <Gift />
            </span>
            <span className="btn btn--sm btn--fill share-follow">
              <UserPlus />
              Follow
            </span>
            <span className="btn btn--sm btn--icon">
              <CircleSlash />
            </span>
          </div>

          {overlay && (
            <span className="share-fx">
              <EffectArt id={effect} />
            </span>
          )}
        </div>

        {editing && <CardEditor draft={draft} set={set} onRevert={revert} onSave={save} dirty={dirty} />}
      </div>

      <div className="share-actions">
        {editing ? (
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
        <button className="btn" onClick={() => download("png")} disabled={busy !== null}>
          <Download /> {busy === "png" ? "Painting…" : "Download PNG"}
        </button>
        <button className="btn btn--fill" onClick={() => download("gif")} disabled={busy !== null}>
          <Film /> {busy === "gif" ? "Recording…" : "Download GIF"}
        </button>
      </div>

      {note && <p className="tiny faint share-note">{note}</p>}
      {busy === "gif" && (
        <p className="tiny faint share-note">The card is being recorded frame by frame. Leave it on screen for a moment.</p>
      )}
    </Sheet>
  );
}

/** One line of the facts box, drawn the way the chat card draws its own. */
function ShareFact({ label, value }: { label: string; value: string }) {
  return (
    <span className="share-fact">
      <i>{label}</i>
      <b>{value}</b>
    </span>
  );
}

/* ============================================================
   the editor
   The same four things the profile page edits, in the order you notice
   them: what it is called, what it looks like, what is behind it, and how
   the name is written. Everything lands in one write when Save is pressed,
   so a card you have half changed is never the card on your account.
   ============================================================ */
function CardEditor({
  draft,
  set,
  onRevert,
  onSave,
  dirty,
}: {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  onRevert: () => void;
  onSave: () => void;
  dirty: boolean;
}) {
  const style = draft.nameStyle;
  const pick = (patch: Partial<NameStyle>) => set({ nameStyle: { ...style, ...patch } });

  /* a picture or a banner dropped in is read here and kept as a data URL:
     it never leaves the browser, which is the same deal the profile makes */
  const readImage = (file: File | undefined, take: (url: string) => void) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => take(String(fr.result));
    fr.readAsDataURL(file);
  };

  return (
    <div className="card-ed">
      <label className="form-row">
        <span>Name</span>
        <input
          className="fld"
          value={draft.name}
          maxLength={24}
          placeholder="whatever you want to be called"
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>

      <label className="form-row">
        <span>Bio</span>
        <textarea
          className="fld fld--area"
          rows={2}
          value={draft.bio}
          maxLength={400}
          placeholder="a line about you"
          onChange={(e) => set({ bio: e.target.value })}
        />
      </label>

      <p className="pf-label">Picture</p>
      <div className="card-ed-row">
        <label className="btn btn--sm">
          <Camera /> Upload
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => readImage(e.target.files?.[0], (url) => set({ pfp: url }))}
          />
        </label>
        {draft.pfp && (
          <button className="btn btn--sm" onClick={() => set({ pfp: null })}>
            <Trash2 /> Use NULL's face
          </button>
        )}
      </div>

      <p className="pf-label">Banner</p>
      <div className="swatchgrid">
        {BANNER_SWATCHES.map((c) => (
          <button
            key={c}
            className="swatch"
            style={{ background: `linear-gradient(135deg, ${c}, #2e2e33)` }}
            onClick={() => set({ banner: `linear-gradient(135deg, ${c} 0%, #2e2e33 100%)` })}
            aria-label={c}
          />
        ))}
      </div>
      <div className="card-ed-row">
        <input
          className="fld"
          value={draft.banner}
          spellCheck={false}
          placeholder="#6272a4 or a CSS gradient"
          aria-label="Banner"
          onChange={(e) => set({ banner: e.target.value })}
        />
        <label className="btn btn--sm">
          <Upload />
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) =>
              readImage(e.target.files?.[0], (url) => set({ banner: `url(${url}) center 50% / cover no-repeat` }))
            }
          />
        </label>
      </div>

      <p className="pf-label">Name style</p>
      <div className="card-ed-row">
        <button className={`seg${style.mode === "solid" ? " is-on" : ""}`} onClick={() => pick({ mode: "solid" })}>
          Solid
        </button>
        <button
          className={`seg${style.mode === "gradient" ? " is-on" : ""}`}
          onClick={() => pick({ mode: "gradient" })}
        >
          Gradient
        </button>
        <input
          type="color"
          value={style.c1}
          aria-label="Name colour"
          onChange={(e) => pick({ c1: e.target.value })}
        />
        {style.mode === "gradient" && (
          <input
            type="color"
            value={style.c2}
            aria-label="Second colour"
            onChange={(e) => pick({ c2: e.target.value })}
          />
        )}
        <label className="check">
          <input type="checkbox" checked={style.glow} onChange={(e) => pick({ glow: e.target.checked })} />
          Glow
        </label>
        {style.glow && (
          <input
            type="color"
            value={style.glowColor}
            aria-label="Glow colour"
            onChange={(e) => pick({ glowColor: e.target.value })}
          />
        )}
      </div>

      <label className="form-row">
        <span>Font</span>
        <select className="fld" value={style.font} onChange={(e) => pick({ font: e.target.value })}>
          {NAME_FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>

      <div className="card-ed-row card-ed-row--end">
        <button className="btn btn--sm" onClick={onRevert} disabled={!dirty}>
          <RotateCcw /> Revert
        </button>
        <button className="btn btn--sm btn--fill" onClick={onSave} disabled={!dirty}>
          <Check /> Save to my card
        </button>
      </div>
    </div>
  );
}

/* NULL · Members.tsx
   Everyone who has joined NULL — as far as this browser can honestly know.

   There is no server and no account database, so the list is the accounts
   that have actually signed in here, with the owner pinned on top. The page
   says so rather than implying a directory it cannot have.

   A member is shown the same way the profile page shows you: their banner,
   their picture with whatever they wear on it, their name in its own colour,
   their tags and their bio. Clicking one opens the whole card. */

import { useState } from "react";
import { BadgeCheck, Coins, Crown, Star, Trophy, UserRound } from "lucide-react";

import { useMembers, type Member } from "../lib/members";
import { isOwner, OWNER_TAG } from "../lib/owner";
import { nameStyleCss } from "../lib/account";
import { itemOf } from "../lib/econ";
import { AvatarArt, EffectArt } from "../lib/art";
import { Sheet } from "../components/Sheet";

export function Members() {
  const list = useMembers();
  const [open, setOpen] = useState<Member | null>(null);

  return (
    <div className="page">
      <div className="lb-top">
        <h1 className="lb-title">Members</h1>
        <span className="lb-count tiny faint">
          {list.length} {list.length === 1 ? "account" : "accounts"} on this browser
        </span>
      </div>

      <p className="lede">
        NULL has no server, so there is no wider directory to show: this is every account
        that has signed in on this browser, with the owner first. Sign in on the profile
        page and your card appears here.
      </p>

      {list.length === 0 ? (
        <div className="card card--pad mb-empty">
          <p>Nobody yet. The first account to sign in here shows up on this page.</p>
        </div>
      ) : (
        <div className="mb-grid">
          {list.map((m) => (
            <Card key={m.user} m={m} onOpen={() => setOpen(m)} />
          ))}
        </div>
      )}

      <Sheet
        open={!!open}
        onClose={() => setOpen(null)}
        width={560}
        title={open ? open.name : ""}
        icon={<UserRound />}
      >
        {open && <Full m={open} />}
      </Sheet>
    </div>
  );
}

/** The tag chips a member wears: the owner's, which no shop item can buy, and
 *  whatever they picked up on the shelf. */
function Tags({ m }: { m: Member }) {
  const tag = itemOf(m.wearing.tag);
  if (!m.owner && !tag) return null;
  return (
    <span className="mb-tags">
      {m.owner && (
        <span className="tagchip tagchip--owner" title={OWNER_TAG.note}>
          <Crown />
          {OWNER_TAG.name}
        </span>
      )}
      {tag && (
        <span className="tagchip" style={{ background: tag.color, color: "#0b0b0d" }}>
          {tag.name}
        </span>
      )}
    </span>
  );
}

function Born({ joined }: { joined: number }) {
  return (
    <span className="mb-born">
      joined{" "}
      {new Date(joined || Date.now()).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}
    </span>
  );
}

function Card({ m, onOpen }: { m: Member; onOpen: () => void }) {
  return (
    <button className={`mb-card${m.owner ? " is-owner" : ""}`} onClick={onOpen}>
      <span className="mb-banner" style={{ background: m.banner }} />
      <span className="mb-body">
        <span className="mb-pic">
          {m.pfp ? <img src={m.pfp} alt="" /> : <UserRound />}
          <AvatarArt id={m.wearing.avatar} />
        </span>
        <span className="mb-txt">
          {/* the badge is beside the name, never inside it: the name can be a
              gradient cut out of its own text, which eats the icon */}
          <span className="mb-name-row">
            <span className="mb-name" style={nameStyleCss(m.nameStyle)}>
              {m.name}
            </span>
            {m.owner && <BadgeCheck className="pf-verified" aria-label="Owner" />}
          </span>
          <span className="mb-handle">@{m.user}</span>
          <Tags m={m} />
        </span>
      </span>
    </button>
  );
}

/** The whole card, as it reads on their own profile page. */
function Full({ m }: { m: Member }) {
  const tag = itemOf(m.wearing.tag);
  const owner = isOwner(m.user);
  return (
    <div className="mb-full">
      <div className="mb-full-hero">
        {m.wearing.effect && (
          <span className="fx-clear">
            <EffectArt id={m.wearing.effect} />
          </span>
        )}
        <span className="mb-full-banner" style={{ background: m.banner }} />
        <span className="mb-full-pic">
          {m.pfp ? <img src={m.pfp} alt="" /> : <UserRound />}
          <AvatarArt id={m.wearing.avatar} />
        </span>
      </div>

      <div className="mb-name-row mb-name-row--lg">
        <h3 className="mb-full-name" style={nameStyleCss(m.nameStyle)}>
          {m.name}
        </h3>
        {owner && <BadgeCheck className="pf-verified" aria-label="Owner" />}
      </div>
      <span className="mb-handle">@{m.user}</span>
      <Tags m={m} />

      <p className="mb-full-bio">{m.bio || "No bio yet."}</p>

      <div className="mb-full-foot">
        <Born joined={m.joined} />
        <span className="mb-stat">
          <Trophy /> {m.wearing.effect ? m.wearing.effect : "no effect"}
        </span>
        <span className="mb-stat">
          <Star /> {tag ? tag.name : "no tag"}
        </span>
        <span className="mb-stat">
          <Coins /> {m.wearing.avatar ? m.wearing.avatar : "no decoration"}
        </span>
      </div>

      <p className="tiny faint mb-note">
        Last seen on this browser {new Date(m.seen).toLocaleString()}.
      </p>
    </div>
  );
}

/* NULL · Members.tsx
   Everyone who has joined NULL.

   With a server this is a real directory: every machine that has ever signed
   an account in writes its card here, and the list is all of them, live. With
   no server it falls back to the accounts this browser has seen, and says so,
   because a page that claims to know everyone and does not is worse than a
   page that admits its limits.

   A member is shown the way the profile page shows you: their banner, their
   picture with whatever they wear on it, their name in its own colour, their
   tags and their bio. */

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { BadgeCheck, Coins, Crown, Star, Trophy, UserRound } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import { useMembers, type Member } from "../lib/members";
import { cloudOn } from "../lib/cloud";
import { isOwner, OWNER_TAG } from "../lib/owner";
import { nameStyleCss, type NameStyle } from "../lib/account";
import { itemOf } from "../lib/econ";
import { AvatarArt, EffectArt } from "../lib/art";
import { NullFace } from "../lib/brand";
import { Sheet } from "../components/Sheet";

export function Members() {
  if (!cloudOn()) return <Local why="NULL has no server reachable from this build" />;
  return (
    <Guard what="the member list" fallback={<Local why="the server could not be reached just now" />}>
      <Cloud />
    </Guard>
  );
}

/* ---------- the two sources ---------- */

/** Live, from the deployment. */
function Cloud() {
  const rows = useQuery(api.members.list);
  const local = useMembers();

  const list = useMemo(() => {
    if (!rows) return local;
    const seen = new Set(rows.map((r) => r.user.toLowerCase()));
    const remote: Member[] = rows.map((r) => ({
      user: r.user,
      name: r.name,
      bio: r.bio,
      banner: r.banner,
      pfp: r.pfp,
      joined: r.joined,
      nameStyle: parseStyle(r.nameStyle),
      wearing: r.wearing,
      owner: r.owner || isOwner(r.user),
      coins: r.coins,
      seen: r.seen,
    }));
    /* The card on this machine is at least as fresh as the one on the server,
       so it wins for accounts it already knows. */
    const mine = local.filter((m) => !seen.has(m.user.toLowerCase()));
    return [...remote, ...mine].sort((a, b) => {
      if (a.owner !== b.owner) return a.owner ? -1 : 1;
      return a.joined - b.joined;
    });
  }, [rows, local]);

  return <Board list={list} live={rows !== undefined} />;
}

/** Only what this browser has seen. */
function Local({ why }: { why: string }) {
  const list = useMembers();
  return <Board list={list} live={false} why={why} />;
}

function parseStyle(raw: string): NameStyle {
  try {
    const v = JSON.parse(raw || "{}");
    return typeof v === "object" && v ? (v as NameStyle) : ({} as NameStyle);
  } catch {
    return {} as NameStyle;
  }
}

/* ---------- the board ---------- */

function Board({ list, live, why }: { list: Member[]; live: boolean; why?: string }) {
  const [open, setOpen] = useState<Member | null>(null);

  return (
    <div className="page">
      <div className="lb-top">
        <h1 className="lb-title">Members</h1>
        <span className="lb-count tiny faint">
          {list.length} {list.length === 1 ? "account" : "accounts"}
          {live ? " · live" : why ? ` · ${why}` : ""}
        </span>
      </div>

      <p className="lede">
        {live
          ? "Every account that has signed in anywhere, newest card each. Sign in on the profile page and yours joins them."
          : "This is every account that has signed in on this browser, with the owner first. With a server reachable this list becomes everybody's."}
      </p>

      {list.length === 0 ? (
        <div className="card card--pad mb-empty">
          <p>Nobody yet. The first account to sign in shows up on this page.</p>
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
          {m.pfp ? <img src={m.pfp} alt="" /> : <NullFace />}
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
          {m.pfp ? <img src={m.pfp} alt="" /> : <NullFace />}
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
          <Coins /> {(m.coins ?? 0).toLocaleString()}
        </span>
        <span className="mb-stat">
          <Star /> {tag ? tag.name : "no tag"}
        </span>
        <span className="mb-stat">
          <Trophy /> {m.wearing.effect ?? "no effect"}
        </span>
      </div>
    </div>
  );
}

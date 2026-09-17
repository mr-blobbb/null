/* NULL · Richest.tsx
   The five fattest coin purses on NULL.

   Coins only come from time on the site, so this is not a list of people who
   spent money — it is a list of people who were here. That is a better board
   than the alternative, and it is why the page says so out loud.

   Rank 1 gets the only filled row. Everything else is a line of text with a
   number in front of it, because five rows do not need five medals. */

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { Coins, Trophy } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import { useMembers, type Member } from "../lib/members";
import { cloudOn } from "../lib/cloud";
import { isOwner } from "../lib/owner";
import { nameStyleCss, type NameStyle } from "../lib/account";
import { AvatarArt } from "../lib/art";
import { NullFace } from "../lib/brand";
import { go } from "../lib/tabs";

const SHOWN = 5;

export function Richest() {
  if (!cloudOn()) return <Local why="this build has no server reachable" />;
  return (
    <Guard what="the leaderboard" fallback={<Local why="the server could not be reached just now" />}>
      <Cloud />
    </Guard>
  );
}

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
    return [...remote, ...local.filter((m) => !seen.has(m.user.toLowerCase()))];
  }, [rows, local]);
  return <Board list={list} live={rows !== undefined} />;
}

function Local({ why }: { why: string }) {
  return <Board list={useMembers()} live={false} why={why} />;
}

function parseStyle(raw: string): NameStyle {
  try {
    const v = JSON.parse(raw || "{}");
    return typeof v === "object" && v ? (v as NameStyle) : ({} as NameStyle);
  } catch {
    return {} as NameStyle;
  }
}

function Board({ list, live, why }: { list: Member[]; live: boolean; why?: string }) {
  const ranked = useMemo(
    () => [...list].sort((a, b) => (b.coins ?? 0) - (a.coins ?? 0)).slice(0, SHOWN),
    [list],
  );
  const top = ranked[0]?.coins ?? 0;

  return (
    <div className="page">
      <div className="lb-top">
        <h1 className="lb-title">Richest</h1>
        <span className="lb-count tiny faint">
          top {SHOWN}
          {live ? " · live" : why ? ` · ${why}` : ""}
        </span>
      </div>

      <p className="lede">
        Coins come from time on NULL and nothing else — three a minute, plus a milestone every
        fifteen. So this is a list of who was here longest, not who paid the most. Nobody can.
      </p>

      {ranked.length === 0 || top === 0 ? (
        <div className="card card--pad mb-empty">
          <p>No one has any coins yet. Play something for a few minutes and take the top spot.</p>
        </div>
      ) : (
        <ol className="rich-list">
          {ranked.map((m, i) => (
            <li key={m.user} className={`rich-row${i === 0 ? " is-top" : ""}`}>
              <span className="rich-rank">
                {i === 0 ? <Trophy aria-label="First" /> : i + 1}
              </span>
              <span className="rich-pic">
                {m.pfp ? <img src={m.pfp} alt="" /> : <NullFace />}
                <AvatarArt id={m.wearing.avatar} />
              </span>
              <span className="rich-mid">
                <span className="rich-name" style={nameStyleCss(m.nameStyle)}>
                  {m.name}
                </span>
                <span className="rich-bar" aria-hidden="true">
                  <i style={{ width: `${top ? Math.max(4, Math.round(((m.coins ?? 0) / top) * 100)) : 4}%` }} />
                </span>
              </span>
              <span className="rich-dot">∙</span>
              <span className="rich-coins">
                <Coins /> {(m.coins ?? 0).toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="nf-actions">
        <button className="btn" onClick={() => go({ page: "users" })}>
          See every member
        </button>
        <button className="btn btn--fill" onClick={() => go({ page: "shop" })}>
          Spend your coins
        </button>
      </div>
    </div>
  );
}

/* NULL · Members.tsx
   Everyone who has joined NULL, with the tools a community needs.

   The search box is small and does a lot: bare words search name, handle and
   bio, @handle matches one exact username, role: and is: and has: and after:/
   before: filter. Filters combine with AND; repeating one widens it. The ?
   beside the box spells all of that out, because a search this sharp deserves
   a manual it can point at.

   Clicking a member opens their card — banner, picture half in and half out,
   name, handle, bio — with the staff tag row, the follow button, the report
   flag, and, when the owner is looking, the grant and ban tools. */

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  BadgeCheck,
  Ban,
  CircleHelp,
  Coins,
  Copy,
  Crown,
  Flag,
  Search,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
} from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import { CloudDown } from "../lib/outage";
import { useMembers, type Member } from "../lib/members";
import { cloudOn } from "../lib/cloud";
import { isOwner, OWNER_TAG } from "../lib/owner";
import { nameStyleCss, type NameStyle } from "../lib/account";
import { itemsOf } from "../lib/econ";
import { AvatarArt, TagChip } from "../lib/art";
import { NullFace } from "../lib/brand";
import { Sheet } from "../components/Sheet";
import { useAccount } from "../lib/account";
import { machine } from "../lib/cloud";
import { roleOf, REPORT_REASONS } from "../lib/staff";

type CloudMember = Member & {
  roles: string[];
  online: boolean;
  views: number;
  banned: boolean;
  activity: { kind: string; name: string; detail: string } | null;
  activityVisible: string;
};

export function Members() {
  if (!cloudOn()) return <Local why="NULL has no server reachable from this build" />;
  return (
    <Guard what="Members" fallback={(err) => <CloudDown what="Members" key={err.message} />}>
      <Cloud />
    </Guard>
  );
}

function Cloud() {
  const rows = useQuery(api.members.list);
  const local = useMembers();
  const me = useAccount();

  const list = useMemo((): CloudMember[] => {
    if (!rows) return local as CloudMember[];
    const seen = new Set(rows.map((r: any) => r.user.toLowerCase()));
    const remote: CloudMember[] = rows.map((r: any) => ({
      user: r.user,
      name: r.name,
      bio: r.bio,
      banner: r.banner,
      pfp: r.pfp,
      joined: r.joined,
      nameStyle: parseStyle(r.nameStyle),
      wearing: { avatar: r.wearing.avatar, effect: r.wearing.effect, tags: r.wearing.tags },
      owner: r.owner || isOwner(r.user),
      roles: r.roles ?? [],
      online: r.online,
      views: r.views ?? 0,
      banned: r.banned,
      activity: r.activity ?? null,
      activityVisible: r.activityVisible ?? "everyone",
      coins: r.coins,
      seen: 0,
    }));
    const mine = (local as CloudMember[]).filter((m) => !seen.has(m.user.toLowerCase()));
    return [...remote, ...mine].sort((a, b) => {
      if (a.owner !== b.owner) return a.owner ? -1 : 1;
      return a.joined - b.joined;
    });
  }, [rows, local]);

  const iAmOwner = isOwner(me.user);
  const myRoles: string[] = list.find((m) => m.user === (me.user ?? "").toLowerCase())?.roles ?? [];
  const staff = iAmOwner || myRoles.length > 0;

  return <Board list={list} live={rows !== undefined} staff={staff} owner={iAmOwner} />;
}

function Local({ why }: { why: string }) {
  const list = useMembers();
  return <Board list={list as CloudMember[]} live={false} why={why} staff={false} owner={false} />;
}

function parseStyle(raw: string): NameStyle {
  try {
    const v = JSON.parse(raw || "{}");
    return typeof v === "object" && v ? (v as NameStyle) : ({} as NameStyle);
  } catch {
    return {} as NameStyle;
  }
}

/* ============================================================
   the search language
   ============================================================ */

type Query = {
  words: string[]; // bare words, all must hit
  handles: string[]; // @exact
  roles: string[]; // role:x — any of these
  online: boolean | null;
  hasBio: boolean | null;
  hasRole: boolean | null;
  plus: boolean | null;
  after: number | null;
  before: number | null;
};

const EMPTY_Q: Query = {
  words: [], handles: [], roles: [], online: null, hasBio: null, hasRole: null, plus: null, after: null, before: null,
};

export function parseQuery(raw: string): Query {
  const q: Query = { ...EMPTY_Q, words: [], handles: [], roles: [] };
  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    const lower = t.toLowerCase();
    const roleHit = lower.match(/^role:(.+)$/);
    if (roleHit) {
      q.roles.push(roleHit[1].replace(/"/g, ""));
      continue;
    }
    if (lower === "is:online") { q.online = true; continue; }
    if (lower === "is:offline") { q.online = false; continue; }
    if (lower === "is:plus") { q.plus = true; continue; }
    if (lower === "is:free") { q.plus = false; continue; }
    if (lower === "has:bio") { q.hasBio = true; continue; }
    if (lower === "no:bio") { q.hasBio = false; continue; }
    if (lower === "has:role" || lower === "has:roles") { q.hasRole = true; continue; }
    if (lower === "no:role" || lower === "no:roles") { q.hasRole = false; continue; }
    const after = lower.match(/^after:(\d{4}-\d{2}-\d{2})$/);
    if (after) { q.after = Date.parse(after[1]) || null; continue; }
    const before = lower.match(/^before:(\d{4}-\d{2}-\d{2})$/);
    if (before) { q.before = Date.parse(before[1]) || null; continue; }
    if (t.startsWith("@")) { q.handles.push(t.slice(1).toLowerCase()); continue; }
    q.words.push(lower);
  }
  return q;
}

function matches(m: CloudMember, q: Query): boolean {
  for (const w of q.words) {
    const hay = `${m.name} ${m.user} ${m.bio}`.toLowerCase();
    if (!hay.includes(w)) return false;
  }
  for (const h of q.handles) if (m.user.toLowerCase() !== h) return false;
  if (q.roles.length) {
    const roles = [m.owner ? "owner" : "", ...(m as CloudMember).roles ?? []];
    if (!q.roles.some((r) => roles.some((have) => have.includes(r)))) return false;
  }
  if (q.online !== null && (m as CloudMember).online !== q.online) return false;
  if (q.hasBio !== null && !!m.bio.trim() !== q.hasBio) return false;
  if (q.hasRole !== null && (((m as CloudMember).roles?.length ?? 0) > 0 || m.owner) !== q.hasRole) return false;
  if (q.after !== null && m.joined < q.after) return false;
  if (q.before !== null && m.joined >= q.before) return false;
  return true;
}

const HELP_ROWS: [string, string][] = [
  ["@TheRealMrBlob", "That exact handle — no substring matches"],
  ["role:mod", "Holds a role whose name contains \"mod\""],
  ["role:\"junior mod\"", "Quote values that contain spaces"],
  ["has:role / no:role", "Has any role at all, or none"],
  ["is:online / is:offline", "Current presence"],
  ["has:bio / no:bio", "Wrote a bio, or didn't"],
  ["after:2025-01-01", "Joined after a date"],
  ["before:2025-06-01", "Joined before a date"],
];

function SearchHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="mb-helpcard">
      <p className="mb-help-lead">
        Filters combine with AND. Repeat one to widen it — <code>role:mod role:admin</code> matches either. Bare
        words search name, handle and bio; <code>@handle</code> matches one exact username.
      </p>
      <div className="mb-help-rows">
        {HELP_ROWS.map(([k, v]) => (
          <div className="mb-help-row" key={k}>
            <code>{k}</code>
            <span>{v}</span>
          </div>
        ))}
      </div>
      <p className="tiny faint">Role and presence filters need you to be logged in.</p>
      <button className="sheet-x mb-help-x" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}

/* ============================================================
   the board
   ============================================================ */

function Board({
  list,
  live,
  why,
  staff,
  owner,
}: {
  list: CloudMember[];
  live: boolean;
  why?: string;
  staff: boolean;
  owner: boolean;
}) {
  const me = useAccount();
  const [raw, setRaw] = useState("");
  const [help, setHelp] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const q = useMemo(() => parseQuery(raw), [raw]);
  const shown = useMemo(() => list.filter((m) => matches(m, q)), [list, q]);

  return (
    <div className="page">
      <div className="lb-top">
        <h1 className="lb-title">Members</h1>
        <span className="lb-count tiny faint">
          {list.length} {list.length === 1 ? "member" : "members"}
          {live ? " · live" : why ? ` · ${why}` : ""}
        </span>
      </div>

      <div className="mb-searchrow">
        <label className="lb-find mb-find">
          <Search />
          <input
            value={raw}
            spellCheck={false}
            placeholder="Name, handle, bio, or role:mod is:online"
            aria-label="Search members"
            onChange={(e) => setRaw(e.target.value)}
          />
        </label>
        <button className={`mb-help${help ? " is-on" : ""}`} onClick={() => setHelp((v) => !v)} aria-label="Search help">
          <CircleHelp />
        </button>
      </div>
      {help && <SearchHelp onClose={() => setHelp(false)} />}

      {shown.length === 0 ? (
        <div className="card card--pad mb-empty">
          <p>
            {list.length === 0
              ? "Nobody yet. The first account to sign in shows up on this page."
              : `Nobody matches ${raw ? `“${raw}”` : "that"}.`}
          </p>
        </div>
      ) : (
        <div className="mb-grid">
          {shown.map((m) => (
            <Card key={m.user} m={m} onOpen={() => setOpen(m.user)} />
          ))}
        </div>
      )}

      {open && (
        <Sheet open onClose={() => setOpen(null)} width={480} title="">
          <MemberCardFull user={open} me={me} list={list} staff={staff} owner={owner} />
        </Sheet>
      )}
    </div>
  );
}

/* ---------- the small card ---------- */

function Card({ m, onOpen }: { m: CloudMember; onOpen: () => void }) {
  return (
    <button className={`mb-card${m.owner ? " is-owner" : ""}`} onClick={onOpen}>
      <span className="mb-banner" style={{ background: m.banner }} />
      <span className="mb-body">
        <span className="mb-pic">
          {m.pfp ? <img src={m.pfp} alt="" /> : <NullFace />}
          <AvatarArt id={m.wearing.avatar} />
        </span>
        <span className="mb-txt">
          <span className="mb-name-row">
            {m.online && <i className="mb-online" title="Online" />}
            <span className="mb-name" style={nameStyleCss(m.nameStyle)}>
              {m.name}
            </span>
            <StaffTags m={m} />
            {m.owner && <BadgeCheck className="pf-verified" aria-label="Owner" />}
          </span>
          <span className="mb-handle">@{m.user}</span>
        </span>
      </span>
    </button>
  );
}

/** Only the staff-grade tags show on the board and the card: OWNER, ADMIN,
 *  MOD and the verified tick. Shop tags are a profile thing, not a badge. */
function StaffTags({ m }: { m: CloudMember }) {
  return (
    <span className="mb-stafftags">
      {m.owner && (
        <span className="tagchip tagchip--owner" title={OWNER_TAG.note}>
          <Crown />
          {OWNER_TAG.name}
        </span>
      )}
      {(m.roles ?? []).map((r) => {
        const t = roleOf(r);
        if (!t) return null;
        return (
          <span
            key={r}
            className="tagchip"
            title={t.note}
            style={{ backgroundColor: t.color, color: t.ink }}
          >
            <b className="tag-glyph">{t.glyph}</b>
            {t.name}
          </span>
        );
      })}
    </span>
  );
}

/* ---------- the full card ---------- */

function MemberCardFull({
  user,
  me,
  list,
  staff,
  owner,
}: {
  user: string;
  me: ReturnType<typeof useAccount>;
  list: CloudMember[];
  staff: boolean;
  owner: boolean;
}) {
  const view = useQuery(api.members.card, { user }) as
    | (CloudMember & { wearing: { avatar: string | null; effect: string | null; tags: string[] } })
    | undefined
    | null;
  const graph = useQuery(
    api.members.graph,
    me.user ? { user: (me.user as string).replace(/^@/, "") } : "skip",
  ) as { following: string[]; followers: string[]; friends: string[] } | undefined;
  const doFollow = useMutation(api.members.setFollow);
  const doReport = useMutation(api.members.report);
  const doBan = useMutation(api.members.ban);
  const doUnban = useMutation(api.members.unban);
  const doRoles = useMutation(api.members.setRoles);
  const countView = useMutation(api.members.view);

  const m = view ?? list.find((x) => x.user.toLowerCase() === user.toLowerCase());
  const [copied, setCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [banOpen, setBanOpen] = useState(false);
  const [banKind, setBanKind] = useState<"account" | "machine">("account");
  const [banReason, setBanReason] = useState("");
  const [note, setNote] = useState<string | null>(null);

  /* one view per open, and never your own */
  useMemo(() => {
    if (m && me.user && m.user !== (me.user as string).replace(/^@/, "").toLowerCase()) {
      countView({ user: m.user, by: (me.user as string).replace(/^@/, "") }).catch(() => {
        /* the count is decoration; a dead server must not unmount the card */
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.user]);

  if (!m) {
    return <p className="muted tiny">That member is not on the server.</p>;
  }

  const handle = m.user;
  const following = !!graph && graph.following.includes(handle);
  const friend = !!graph && graph.friends.includes(handle);
  const mine = me.user && handle === (me.user as string).replace(/^@/, "").toLowerCase();

  const copyId = () => {
    /* a stable, shareable id for this member, derived from the handle — the
       same on every machine that looks them up */
    let h = 0x811c9dc5;
    for (const c of handle) {
      h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
    }
    const hex = h.toString(16).padStart(8, "0");
    const id = `${hex.slice(0, 8)}-1a27-470e-a4a8-${hex.slice(0, 12).padEnd(12, "0")}`;
    navigator.clipboard?.writeText(id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="mb-profile">
      <div className="mb-profile-banner" style={{ background: m.banner }} />
      <div className="mb-profile-pic">
        {m.pfp ? <img src={m.pfp} alt="" /> : <NullFace />}
        <AvatarArt id={m.wearing.avatar} />
        <i className={`mb-presence${m.online ? " is-on" : ""}`} title={m.online ? "Online" : "Offline"} />
      </div>

      <div className="mb-profile-head">
        <h3 className="mb-profile-name" style={nameStyleCss(m.nameStyle)}>
          {m.name}
        </h3>
        <StaffTags m={m} />
        {m.owner && <BadgeCheck className="pf-verified" aria-label="Owner" />}
      </div>
      <div className="mb-profile-handle">
        <span>@{handle}</span>
        <button className="mb-copy" onClick={copyId} title="Copy member id">
          <Copy />
          {copied ? "copied" : ""}
        </button>
      </div>

      <p className={`mb-profile-bio${m.bio.trim() ? "" : " is-empty"}`}>{m.bio.trim() || "No bio"}</p>

      <div className="mb-profile-meta">
        <span className="tiny faint">
          joined{" "}
          {new Date(m.joined || Date.now()).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span className="mb-stat">
          <Coins /> {(m.coins ?? 0).toLocaleString()}
        </span>
        <span className="tiny faint">{m.views ?? 0} views</span>
        {m.banned && <span className="tagchip" style={{ backgroundColor: "#ff5d5d", color: "#fff" }}>BANNED</span>}
      </div>

      <div className="mb-profile-actions">
        {!mine && me.user && (
          <button
            className="btn btn--sm"
            disabled={doFollow === undefined}
            onClick={async () => {
              try {
                await doFollow({ by: (me.user as string).replace(/^@/, ""), user: handle, on: !following });
                setNote(following ? "Unfollowed." : friend ? "Followed back — you two can DM now." : "Followed.");
              } catch (e) {
                setNote((e as Error).message.replace(/^.*?Error: /, ""));
              }
            }}
          >
            {following ? <UserMinus /> : <UserPlus />}
            {following ? "Unfollow" : "Follow"}
          </button>
        )}
        {friend && (
          <span className="mb-friendchip tiny">
            <UserCheck /> friends — you can DM
          </span>
        )}
        {!mine && (
          <button className="btn btn--sm mb-flag" onClick={() => setReportOpen((v) => !v)} title="Report this member">
            <Flag /> Report
          </button>
        )}
      </div>

      {reportOpen && (
        <div className="mb-report">
          <select className="fld" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button
            className="btn btn--sm btn--fill"
            onClick={async () => {
              try {
                await doReport({
                  user: handle,
                  by: (me.user ?? "anonymous").replace(/^@/, ""),
                  reason,
                });
                setReportOpen(false);
                setNote("Reported. The staff will see it.");
              } catch (e) {
                setNote((e as Error).message.replace(/^.*?Error: /, ""));
              }
            }}
          >
            Send report
          </button>
        </div>
      )}

      {staff && !mine && (
        <div className="mb-modtools">
          <span className="tiny faint">
            <ShieldCheck /> staff tools
          </span>
          {owner && (
            <button
              className="btn btn--sm"
              onClick={async () => {
                try {
                  const next = m.roles?.includes("mod") ? [] : ["mod"];
                  await doRoles({ by: (me.user as string).replace(/^@/, ""), claimed: owner, user: handle, roles: next });
                  setNote(next.length ? "Given MOD." : "Role removed.");
                } catch (e) {
                  setNote((e as Error).message.replace(/^.*?Error: /, ""));
                }
              }}
            >
              {m.roles?.includes("mod") ? "Remove MOD" : "Grant MOD"}
            </button>
          )}
          {m.banned ? (
            <button
              className="btn btn--sm"
              onClick={async () => {
                try {
                  await doUnban({ by: (me.user as string).replace(/^@/, ""), claimed: owner, user: handle });
                  setNote("Unbanned.");
                } catch (e) {
                  setNote((e as Error).message.replace(/^.*?Error: /, ""));
                }
              }}
            >
              Unban
            </button>
          ) : (
            <button className="btn btn--sm btn--bad" onClick={() => setBanOpen((v) => !v)}>
              <Ban /> Ban
            </button>
          )}
        </div>
      )}

      {banOpen && (
        <div className="mb-report">
          <div className="row">
            <label className="check">
              <input
                type="radio"
                checked={banKind === "account"}
                onChange={() => setBanKind("account")}
              />{" "}
              Account ban
            </label>
            <label className="check">
              <input
                type="radio"
                checked={banKind === "machine"}
                onChange={() => setBanKind("machine")}
              />{" "}
              Machine ban (this browser, forever)
            </label>
          </div>
          <input
            className="fld"
            placeholder="Why — they will be told"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
          />
          <button
            className="btn btn--sm btn--bad"
            disabled={!banReason.trim()}
            onClick={async () => {
              try {
                await doBan({
                  by: (me.user as string).replace(/^@/, ""),
                  claimed: owner,
                  user: handle,
                  kind: banKind,
                  reason: banReason.trim(),
                });
                setBanOpen(false);
                setNote(banKind === "machine" ? "The browser is banned." : "Account banned.");
              } catch (e) {
                setNote((e as Error).message.replace(/^.*?Error: /, ""));
              }
            }}
          >
            Ban
          </button>
        </div>
      )}

      {note && <p className="tiny faint mb-note">{note}</p>}
    </div>
  );
}

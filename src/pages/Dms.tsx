/* NULL · Dms.tsx
   Messages, laid out the way a messaging app lays them out: who you have been
   talking to down the left, the conversation on the right, one box at the
   bottom that sends.

   Nothing here is a second kind of message. The rows are the same `dms` table
   the chat pop-out reads and a send goes through the same mutation; what this
   page adds is the shape a list of conversations needs — every thread you are
   already in, most recent first, who is online beside their name, and what
   arrived since you last had that thread open.

   A conversation is opened by picking it, or by typing a name into the box:
   anybody in the directory who you have no thread with yet is offered as a
   first message rather than as a new page. A gift that landed while you were
   away still shows itself once, from whoever sent it, before it takes its
   place in the thread. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CircleSlash, MessagesSquare, Search, Send, Trash2, X } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import { GiftButton, GiftCard, GiftPop, useGiftRows } from "../components/GiftBox";
import { parseStyle } from "../components/LineParts";
import { RoleChip, VerifiedMark } from "../components/RoleMark";
import { useAccount, nameStyleCss, type NameStyle } from "../lib/account";
import { AvatarArt } from "../lib/art";
import { NullFace } from "../lib/brand";
import { machine, cloudOn } from "../lib/cloud";
import { freshPending, markSeen, type Gift as GiftRow } from "../lib/gift";
import { Markdown } from "../lib/md";
import { useBlocked } from "../lib/members";
import { CloudDown } from "../lib/outage";
import { createStore, useStore } from "../lib/store";
import { go } from "../lib/tabs";

/** One conversation, as the server summarises it. */
type Thread = { other: string; at: number; last: string };

/** One row of the directory, which is where names and pictures come from. */
type Person = {
  user: string;
  name: string;
  pfp: string | null;
  nameStyle: string;
  roles: string[];
  verified: boolean;
  owner: boolean;
  online: boolean;
  wearing: { avatar?: string | null };
};

/** One message, or the id of the last thread this browser had open. The stamp
 *  is per browser and per handle, because "unread" is a thing a machine knows
 *  and a server does not. */
const opened = createStore<{ at: Record<string, number> }>("dmseen", { at: {} });

export function Dms() {
  if (!cloudOn()) {
    return (
      <div className="page">
        <div className="lb-top">
          <h1 className="lb-title">Messages</h1>
          <span className="lb-count tiny faint">offline</span>
        </div>
        <div className="card card--pad">
          <p>
            Messages live on the server, and this build cannot reach one. Everything else on NULL
            still works — the rail, the shop, your profile — it is only the shared part that needs
            somewhere to share through.
          </p>
        </div>
      </div>
    );
  }
  return (
    <Guard
      what="Messages"
      fallback={(err) => <CloudDown what="Messages" err={err} key={err.message} />}
    >
      <Inbox />
    </Guard>
  );
}

function Inbox() {
  const me = useAccount();
  const handle = (me.user ?? "").replace(/^@/, "").toLowerCase();
  const people = useQuery(api.members.list) as Person[] | undefined;

  const [open, setOpen] = useState<string | null>(null);

  const who = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people ?? []) map.set(p.user.toLowerCase(), p);
    return map;
  }, [people]);

  if (!handle) {
    return (
      <div className="page">
        <div className="lb-top">
          <h1 className="lb-title">Messages</h1>
          <span className="lb-count tiny faint">signed out</span>
        </div>
        <div className="card card--pad dms-note">
          <MessagesSquare />
          <div>
            <b>Messages need a name</b>
            <p className="faint tiny">
              Pick a handle and the conversations follow you between tabs, phones and machines —
              signing in does not lose them, and signing out does not hand them to anybody else.
            </p>
          </div>
          <button className="btn btn--fill" onClick={() => go({ page: "profile" })}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--flush dms">
      {/* ---------- the list ---------- */}
      <aside className="dms-side">
        <div className="dms-side-head">
          <MessagesSquare />
          <span>Messages</span>
        </div>

        <DmRail me={handle} active={open} onOpen={setOpen} />

        <p className="dms-side-foot tiny faint">
          <CircleSlash /> Blocking somebody hides their half of every thread, here and in the chat.
        </p>
      </aside>

      {/* ---------- the conversation ---------- */}
      <section className="dms-main">
        {open ? (
          <Thread
            key={open}
            other={open}
            me={me}
            person={who.get(open.toLowerCase())}
            onClose={() => setOpen(null)}
          />
        ) : (
          <div className="dms-empty">
            <NullFace />
            <h3>Pick a conversation</h3>
            <p className="faint tiny">Find somebody in the box on the left, or in the member list.</p>
            <button className="btn btn--sm" onClick={() => go({ page: "users" })}>
              The member list
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================
   the conversation rail
   ============================================================

   Everything you are talking to, newest first, plus the box that starts
   something new. It asks the server for its own rows, which is what makes it
   safe to draw inside the chat page as well as here: nothing is passed in
   but the account it belongs to. */

function DmRail({
  me,
  active,
  onOpen,
}: {
  me: string;
  active: string | null;
  onOpen: (user: string) => void;
}) {
  const threads = useQuery(api.members.dmList, me ? { me } : "skip") as Thread[] | undefined;
  const people = useQuery(api.members.list) as Person[] | undefined;
  const [find, setFind] = useState("");
  const seen = useStore(opened).at;

  const who = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people ?? []) map.set(p.user.toLowerCase(), p);
    return map;
  }, [people]);

  const nameOf = (user: string) => who.get(user.toLowerCase())?.name || user;
  const rows = threads ?? [];
  const q = find.trim().toLowerCase().replace(/^@/, "");
  const matches = (user: string) =>
    !q || user.toLowerCase().includes(q) || nameOf(user).toLowerCase().includes(q);

  const shown = rows.filter((t) => matches(t.other));
  /* anybody you have no thread with, which is what starting one means */
  const started = q
    ? (people ?? [])
        .filter((p) => p.user.toLowerCase() !== me && matches(p.user))
        .filter((p) => !rows.some((t) => t.other.toLowerCase() === p.user.toLowerCase()))
        .slice(0, 5)
    : [];

  return (
    <>
      <label className="dms-find">
        <Search />
        <input
          value={find}
          spellCheck={false}
          placeholder="Find or start a conversation"
          aria-label="Find or start a conversation"
          onChange={(e) => setFind(e.target.value)}
        />
        {find && (
          <button className="dms-find-x" onClick={() => setFind("")} aria-label="Clear">
            <X />
          </button>
        )}
      </label>

      <div className="dms-list">
        {started.length > 0 && (
          <>
            <span className="dms-label tiny faint">Start something</span>
            {started.map((p) => (
              <button
                key={p.user}
                className="dms-row"
                onClick={() => {
                  onOpen(p.user.toLowerCase());
                  setFind("");
                }}
              >
                <Pic person={p} small />
                <span className="dms-txt">
                  <b>{p.name || p.user}</b>
                  <em>@{p.user}</em>
                </span>
                <span className="dms-meta">
                  <i>write</i>
                </span>
              </button>
            ))}
          </>
        )}

        {shown.length > 0 && started.length > 0 && (
          <span className="dms-label tiny faint">Already talking</span>
        )}

        {shown.map((t) => {
          const person = who.get(t.other.toLowerCase());
          const unread = t.at > (seen[t.other.toLowerCase()] ?? 0);
          return (
            <button
              key={t.other}
              className={`dms-row${active === t.other ? " is-on" : ""}${unread ? " is-new" : ""}`}
              onClick={() => onOpen(t.other)}
            >
              <Pic person={person} user={t.other} small />
              <span className="dms-txt">
                <b style={styleOf(person)}>
                  {person?.name || t.other}
                  {person?.verified && <VerifiedMark small />}
                </b>
                <em>{t.last}</em>
              </span>
              <span className="dms-meta">
                <i>{when(t.at)}</i>
                {unread && <span className="dms-new" title="Not read yet" />}
              </span>
            </button>
          );
        })}

        {shown.length === 0 && started.length === 0 && (
          <p className="dms-none tiny faint">
            {q
              ? "Nobody by that name, and no conversation with them. The member list has everybody who has signed in."
              : "No conversations yet. Type a name above and the first message is the hard one."}
          </p>
        )}
      </div>
    </>
  );
}

/* ============================================================
   one conversation
   ============================================================ */

/** The conversation panel, exported for the chat page: there it takes the
 *  place of the channel feed when the page is switched to DMS, so a DM and a
 *  room read the same way. */
export function DmPanel({
  other,
  me,
  onBack,
}: {
  other: string;
  me: ReturnType<typeof useAccount>;
  onBack?: () => void;
}) {
  const people = useQuery(api.members.list) as Person[] | undefined;
  const person = (people ?? []).find((p) => p.user.toLowerCase() === other.toLowerCase());
  return <Thread other={other} me={me} person={person} onClose={onBack ?? (() => {})} />;
}

/** The conversation rail, exported for the chat page's sidebar: the same list
 *  this page keeps, fed by its own subscriptions. */
export function DmRailExport({
  me,
  active,
  onOpen,
}: {
  me: string;
  active: string | null;
  onOpen: (user: string) => void;
}) {
  return <DmRail me={me} active={active} onOpen={onOpen} />;
}

function Thread({
  other,
  me,
  person,
  onClose,
}: {
  other: string;
  me: ReturnType<typeof useAccount>;
  person: Person | undefined;
  onClose: () => void;
}) {
  const handle = (me.user ?? "").replace(/^@/, "");
  const rows = useQuery(api.members.dmThread, { me: handle, other }) as
    | { id: string; body: string; at: number; from: string; image: string | null }[]
    | undefined;
  const doSend = useMutation(api.members.dmSend);
  const doRemove = useMutation(api.members.dmRemove);
  const doClear = useMutation(api.members.dmClear);
  const blocked = useBlocked();
  const visible = (rows ?? []).filter((r) => !blocked.includes(r.from.trim().toLowerCase()));

  /* the exchange as one stream: words and the things that changed hands */
  const gifts = useGiftRows(me.user);
  const between = (gifts ?? []).filter(
    (g) =>
      ((g.from === handle && g.to === other) || (g.from === other && g.to === handle)) &&
      !blocked.includes(g.from),
  );
  const [pop, setPop] = useState<GiftRow | null>(null);

  useEffect(() => {
    const fresh = freshPending(between);
    if (!fresh) return;
    markSeen(fresh.id);
    setPop(fresh);
  }, [gifts]);

  /* reading it is what makes it read: the stamp is this browser's own, taken
     from the last line it has actually seen */
  const newest = rows?.length ? rows[rows.length - 1].at : 0;
  useEffect(() => {
    if (!newest) return;
    opened.set({ at: { ...opened.get().at, [other.toLowerCase()]: newest } });
  }, [newest, other]);

  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows?.length, between.length]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setErr(null);
    void doSend({ by: handle, to: other, body, machine })
      .then(() => setDraft(""))
      .catch((e) => setErr((e as Error).message.replace(/^.*?Error: /, "")));
  };

  /* taking a line back: the server checks whose it was, and the subscription
     does the rest — every device watching this thread loses the row at once */
  const remove = (id: string) => {
    setErr(null);
    void doRemove({ id: id as never, by: handle }).catch((e) =>
      setErr((e as Error).message.replace(/^.*?Error: /, "")),
    );
  };

  /* the whole conversation, gone from the server: both ends, every device.
     Asked twice, because a thread with years in it is not something a
     mis-click should be able to take. */
  const [sure, setSure] = useState(false);
  useEffect(() => {
    if (!sure) return;
    const t = setTimeout(() => setSure(false), 4000);
    return () => clearTimeout(t);
  }, [sure]);
  const clearAll = () => {
    if (!sure) {
      setSure(true);
      return;
    }
    setErr(null);
    void doClear({ me: handle, other })
      .then(() => setSure(false))
      .catch((e) => setErr((e as Error).message.replace(/^.*?Error: /, "")));
  };

  /* words and exchanges, oldest first, with the day written once where the
     day changes — the same thing every messaging app does, for the same
     reason: a timestamp on every line is noise */
  const stream = [
    ...visible.map((r) => ({
      at: r.at,
      id: r.id,
      from: r.from,
      say: r as typeof r | null,
      gift: null as GiftRow | null,
    })),
    ...between.map((g) => ({ at: g.at, id: g.id, from: g.from, say: null, gift: g })),
  ].sort((p, q) => p.at - q.at);

  return (
    <>
      <header className="dms-head">
        <Pic person={person} user={other} />
        <div className="dms-head-txt">
          <b style={styleOf(person)}>
            {person?.name || other}
            {person?.verified && <VerifiedMark small />}
          </b>
          <span className="tiny faint">
            @{other}
            {person?.online ? " · here now" : ""}
            {person && !person.online ? " · away" : ""}
          </span>
          <span className="dms-head-tags">
            {person?.owner && <span className="tagchip tagchip--owner">owner</span>}
            {(person?.roles ?? []).map((r) => (
              <RoleChip key={r} role={r} />
            ))}
          </span>
        </div>
        <div className="dms-head-actions">
          <GiftButton user={other} me={me.user} className="btn btn--sm" label="Gift" />
          <button
            className={`btn btn--sm${sure ? " btn--bad" : ""}`}
            onClick={clearAll}
            title={
              sure
                ? "Press again — this deletes the whole thread for both of you"
                : "Delete the whole conversation"
            }
          >
            <Trash2 />
            {sure ? "Sure?" : ""}
          </button>
          <button className="btn btn--sm" onClick={onClose} title="Close this conversation">
            <X />
          </button>
        </div>
      </header>

      <div className="dms-log" ref={box}>
        {stream.map((row, i) => {
          const before = stream[i - 1];
          const mine = row.from === handle;
          const newDay = !before || dayOf(before.at) !== dayOf(row.at);
          /* a run of lines from one person gets the picture once */
          const same = !!before && !newDay && before.from === row.from;
          return (
            <div key={row.id} className="dms-group">
              {newDay && <span className="dms-day tiny faint">{dayOf(row.at)}</span>}
              <div className={`dms-line${mine ? " is-mine" : ""}`}>
                <span className="dms-gutter">
                  {!mine && !same && <Pic person={person} user={other} small />}
                </span>
                {row.gift ? (
                  <GiftCard gift={row.gift} me={handle} />
                ) : (
                  <p className="dms-bubble" title={full(row.at)}>
                    {row.say!.image && <img src={row.say!.image} alt="" />}
                    <Markdown body={row.say!.body} packs />
                    {row.say!.from === handle && (
                      <button
                        className="dms-del"
                        title="Delete this message"
                        aria-label="Delete this message"
                        onClick={() => remove(row.say!.id)}
                      >
                        <Trash2 />
                      </button>
                    )}
                    <i className="dms-time tiny faint">{when(row.at)}</i>
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {rows && rows.length === 0 && between.length === 0 && (
          <p className="dms-start tiny faint">
            Nothing here yet. Whatever you say first is a first impression — no pressure.
          </p>
        )}
        {rows && rows.length > 0 && visible.length !== rows.length && (
          <p className="dms-start tiny faint">
            <CircleSlash /> {rows.length - visible.length} hidden — you blocked @{other}.
          </p>
        )}
      </div>

      <div className="dms-compose">
        <input
          className="ch-input"
          value={draft}
          placeholder={`Message @${other}`}
          spellCheck={false}
          aria-label={`Message @${other}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <GiftButton user={other} me={me.user} className="ch-icon" label="" />
        <button className="ch-send" onClick={send} disabled={!draft.trim()} title="Send">
          <Send />
        </button>
      </div>
      {err && <p className="form-err tiny dms-err">{err}</p>}

      {pop && <GiftPop gift={pop} me={handle} other={other} onClose={() => setPop(null)} />}
    </>
  );
}

/* ============================================================
   the small parts
   ============================================================ */

/** Somebody's picture: what they uploaded, a decoration over it, and a dot
 *  when they are here. A handle with no row in the directory still gets a
 *  face, so a conversation is never a name in a void. */
function Pic({ person, user, small }: { person?: Person; user?: string; small?: boolean }) {
  const who = person?.user ?? user ?? "";
  return (
    <span className={`dms-pic${small ? " dms-pic--sm" : ""}`} title={who ? `@${who}` : ""}>
      {person?.pfp ? <img src={person.pfp} alt="" /> : <NullFace />}
      <AvatarArt id={person?.wearing?.avatar ?? null} still />
      <i className={`dms-dot${person?.online ? " is-on" : ""}`} aria-hidden="true" />
    </span>
  );
}

function styleOf(person: Person | undefined): React.CSSProperties {
  return person ? nameStyleCss(parseStyle(person.nameStyle) as NameStyle) : {};
}

function when(at: number): string {
  const d = new Date(at);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date(now.getTime() - 86_400_000).toDateString()) return "yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function dayOf(at: number): string {
  const d = new Date(at);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "today";
  if (d.toDateString() === new Date(now.getTime() - 86_400_000).toDateString()) return "yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function full(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

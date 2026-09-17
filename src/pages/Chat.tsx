/* NULL · Chat.tsx
   The rooms, laid out the way a chat window is supposed to be.

   A sidebar of threads down the left, the log down the right, and the box at
   the bottom. The owner gets two extra buttons in the thread header — clear
   the room, or bin it — because a room with no broom in it is a room you stop
   reading.

   The filter runs twice: here, so the box can show you what a message will
   look like before you press enter, and on the server, which is the one that
   actually decides. A client-side filter is a favour, not a lock — anyone can
   edit the copy running in their browser — so the server keeps its own and
   this one is only here to avoid the surprise.

   Signed out, you can read. That is on purpose: a room you have to join
   before you can see whether it is worth joining is not a room. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  BadgeCheck,
  Bot,
  Crown,
  Eraser,
  Hash,
  MessageCircle,
  Plus,
  Send,
  Smile,
  Trash2,
  X,
} from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import { cloud, cloudOn, machine } from "../lib/cloud";
import { useAccount } from "../lib/account";
import { isOwner, OWNER_TAG } from "../lib/owner";
import { itemOf } from "../lib/econ";
import { screen } from "../lib/filter";
import { Rich } from "../lib/rich";
import { go } from "../lib/tabs";

type Row = {
  id: string;
  user: string;
  name: string;
  body: string;
  at: number;
  owner: boolean;
  tag: string | null;
  machine: string;
  bot: boolean;
};

type Room = { slug: string; name: string; topic: string; at: number; general: boolean };

export function Chat() {
  if (!cloudOn()) {
    return (
      <div className="page">
        <div className="lb-top">
          <h1 className="lb-title">Chat</h1>
          <span className="lb-count tiny faint">offline</span>
        </div>
        <div className="card card--pad">
          <p>
            The rooms live on the server, and this build cannot reach one. Everything else on
            NULL still works — the rail, the shop, your profile — it is only the shared part
            that needs somewhere to share through.
          </p>
        </div>
      </div>
    );
  }
  return (
    <Guard what="the chat rooms">
      <Rooms />
    </Guard>
  );
}

function Rooms() {
  const me = useAccount();
  const rooms = useQuery(api.chat.threads) as Room[] | undefined;
  const [slug, setSlug] = useState("general");
  const [making, setMaking] = useState(false);

  /* a thread that vanished under you — because the owner binned it — puts you
     back in the first room rather than in an empty one with an error in it */
  const here = useMemo(() => {
    if (!rooms) return null;
    return rooms.find((r) => r.slug === slug) ?? rooms[0];
  }, [rooms, slug]);

  useEffect(() => {
    if (here && here.slug !== slug) setSlug(here.slug);
  }, [here, slug]);

  const mine = me.user ? (me.user as string).replace(/^@/, "") : "";
  const owner = isOwner(me.user);

  return (
    <div className="page page--flush ch">
      <aside className="ch-side">
        <div className="ch-side-head">
          <MessageCircle />
          <span>Rooms</span>
          {owner && (
            <button
              className="ch-icon"
              onClick={() => setMaking(true)}
              title="New thread"
              aria-label="New thread"
            >
              <Plus />
            </button>
          )}
        </div>

        <nav className="ch-list" aria-label="Threads">
          {(rooms ?? [{ slug: "general", name: "general", topic: "", at: 0, general: true }]).map((r) => (
            <button
              key={r.slug}
              className={`ch-room${r.slug === slug ? " is-on" : ""}`}
              onClick={() => setSlug(r.slug)}
              title={r.topic || r.name}
            >
              <Hash />
              <span>{r.name}</span>
            </button>
          ))}
        </nav>

        <p className="ch-side-foot tiny faint">
          <Bot /> Type <code>$help</code> in any room and Null Bot answers. It knows who is here
          and who is rich; it does not make things up.
        </p>
      </aside>

      <section className="ch-main">
        <header className="ch-head">
          <span className="ch-hash">
            <Hash />
          </span>
          <div className="ch-head-txt">
            <b>{here?.name ?? "general"}</b>
            <span className="tiny faint">{here?.topic || "the room every visitor starts in"}</span>
          </div>
          {owner && here && (
            <span className="ch-tools">
              <button
                className="ch-icon"
                title="Clear this room"
                onClick={() => void manage("clear", here.slug, mine, owner)}
              >
                <Eraser />
              </button>
              {!here.general && (
                <button
                  className="ch-icon is-bad"
                  title="Delete this thread"
                  onClick={() => void manage("drop", here.slug, mine, owner)}
                >
                  <Trash2 />
                </button>
              )}
            </span>
          )}
        </header>

        <Feed slug={here?.slug ?? "general"} />
      </section>

      {making && (
        <NewThread
          onClose={() => setMaking(false)}
          onMade={(s) => setSlug(s)}
          user={mine}
          owner={owner}
        />
      )}
    </div>
  );
}

/** Owner tools, in one place so the two buttons read the same. */
async function manage(kind: "clear" | "drop", slug: string, user: string, owner: boolean) {
  const c = cloud();
  if (!c) return;
  try {
    if (kind === "clear") await c.mutation(api.chat.clearThread, { slug, user, owner });
    else await c.mutation(api.chat.dropThread, { slug, user, owner });
  } catch {
    /* the server refuses in words the page cannot improve on; the room just
       stays as it was */
  }
}

function Feed({ slug }: { slug: string }) {
  const posts = useQuery(api.chat.recent, { thread: slug }) as Row[] | undefined;
  const send = useMutation(api.chat.send);
  const me = useAccount();

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const feed = useRef<HTMLDivElement>(null);

  /* A query that never answers leaves the room saying "knocking…" forever,
     which reads like NULL is broken rather than like the server is. */
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (posts !== undefined) return;
    const id = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(id);
  }, [posts, slug]);

  const said = useMemo(() => screen(draft), [draft]);
  const signedIn = !!me.user;

  /* the room scrolls itself to the newest line. Switching rooms always jumps
     to the bottom; staying put does it only when the log grew, so nobody is
     yanked out of the backlog while reading it */
  const before = useRef(0);
  useEffect(() => {
    const el = feed.current;
    if (!el) return;
    const grew = (posts?.length ?? 0) > before.current;
    before.current = posts?.length ?? 0;
    if (grew || el.scrollTop + el.clientHeight > el.scrollHeight - 120) el.scrollTop = el.scrollHeight;
  }, [posts?.length]);

  useEffect(() => {
    setDraft("");
    setNote(null);
    before.current = 0;
  }, [slug]);

  async function post() {
    const text = said.clean.trim();
    if (!text || busy || !signedIn) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await send({
        user: (me.user as string).replace(/^@/, ""),
        name: me.name || (me.user as string),
        body: text,
        owner: isOwner(me.user),
        tag: tagId(),
        machine,
        thread: slug,
      });
      setDraft("");
      if (res && res.caught?.length) setNote("Some of that was starred out.");
    } catch (e) {
      setNote((e as Error).message.replace(/^.*?Error: /, ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="ch-feed" ref={feed}>
        {posts === undefined && (
          <p className="ch-empty muted">
            {slow
              ? "The room is not answering. It lives on the server, so if that is down, nobody can talk until it is back."
              : "Knocking…"}
          </p>
        )}
        {posts && posts.length === 0 && (
          <p className="ch-empty muted">
            #{slug} is empty. Say the first thing, or type <code>$help</code>.
          </p>
        )}
        {posts?.map((m, i) => (
          <Line key={m.id} m={m} mine={m.machine === machine} prev={posts[i - 1]} />
        ))}
      </div>

      <div className="ch-box">
        {signedIn ? (
          <>
            <textarea
              className="ch-input"
              value={draft}
              rows={1}
              placeholder={`Message #${slug}`}
              spellCheck
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void post();
                }
              }}
            />
            <button
              className="btn btn--fill ch-send"
              onClick={() => void post()}
              disabled={busy || !said.clean.trim()}
            >
              <Send /> {busy ? "Sending" : "Send"}
            </button>
          </>
        ) : (
          <div className="ch-locked">
            <Smile />
            <span>Sign in to talk — reading is open to anyone.</span>
            <button className="btn btn--fill" onClick={() => go({ page: "profile" })}>
              Go to profile
            </button>
          </div>
        )}
      </div>

      {(note || said.caught.length > 0) && (
        <p className="ch-note tiny faint">
          {note ?? `${said.caught.length} word${said.caught.length === 1 ? "" : "s"} will be starred out.`}
        </p>
      )}
    </>
  );
}

function tagId(): string | null {
  try {
    const raw = localStorage.getItem("null:econ");
    if (!raw) return null;
    const eq = JSON.parse(raw)?.equipped;
    return typeof eq?.tag === "string" ? eq.tag : null;
  } catch {
    return null;
  }
}

/** How far apart two messages have to be before the header repeats. Five
 *  minutes is what Discord uses, and it is right: close enough that a
 *  conversation groups, far enough that a gap shows. */
const GROUP_MS = 5 * 60 * 1000;

function Line({ m, mine, prev }: { m: Row; mine: boolean; prev?: Row }) {
  const tag = itemOf(m.tag);
  const time = new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const owner = m.owner || isOwner(m.user);
  const same = !!prev && prev.user === m.user && prev.bot === m.bot && m.at - prev.at < GROUP_MS;

  return (
    <div
      className={`say${mine ? " is-mine" : ""}${owner ? " is-owner" : ""}${m.bot ? " is-bot" : ""}${
        same ? " is-grouped" : ""
      }`}
    >
      <span className="say-pic" aria-hidden="true">
        {m.bot ? <Bot /> : (m.name || "?").slice(0, 1).toUpperCase()}
      </span>

      <div className="say-main">
        <span className="say-head">
          <span className="say-name">{m.name}</span>
          {owner && <BadgeCheck className="pf-verified" aria-label="Owner" />}
          {owner && (
            <span className="tagchip tagchip--owner" title={OWNER_TAG.note}>
              <Crown />
              {OWNER_TAG.name}
            </span>
          )}
          {m.bot && <span className="say-badge">bot</span>}
          {tag && (
            <span className="tagchip" style={{ background: tag.color, color: "#0b0b0d" }}>
              {tag.name}
            </span>
          )}
          <span className="say-at">{time}</span>
        </span>
        <span className="say-body">
          <Rich body={m.body} />
        </span>
      </div>
    </div>
  );
}

/** The owner's new-thread prompt. A sheet would cover the sidebar the thread
 *  is about to appear in, so this one sits inside the page. */
function NewThread({
  onClose,
  onMade,
  user,
  owner,
}: {
  onClose: () => void;
  onMade: (slug: string) => void;
  user: string;
  owner: boolean;
}) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const make = async () => {
    if (!name.trim()) {
      setErr("Give it a name.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const c = cloud();
      if (!c) throw new Error("no server reachable");
      const slug = (await c.mutation(api.chat.newThread, { name, topic, user, owner })) as string;
      onMade(slug);
      onClose();
    } catch (e) {
      setErr((e as Error).message.replace(/^.*?Error: /, ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ch-make">
      <div className="ch-make-card">
        <div className="ch-make-head">
          <Hash />
          <b>New thread</b>
          <button className="sheet-x" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <label className="form-row">
          <span>Name</span>
          <input
            className="fld"
            value={name}
            autoFocus
            placeholder="e.g., high scores"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void make();
            }}
          />
        </label>
        <label className="form-row">
          <span>Topic (optional)</span>
          <input
            className="fld"
            value={topic}
            placeholder="one line under the name"
            onChange={(e) => setTopic(e.target.value)}
          />
        </label>
        {err && <p className="form-err">{err}</p>}
        <div className="form-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--fill" onClick={() => void make()} disabled={busy}>
            {busy ? "Making…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

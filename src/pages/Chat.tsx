/* NULL · Chat.tsx
   The community, Discord-shaped because that shape is simply right: channels
   down the left, the log in the middle, who is here down the right.

   What a message carries now: the author's face and decoration, their name in
   its own style, their tags, the time, and the line itself — which may hold
   reactions, a reply stub, an image, @mentions and, for staff, the full
   markdown set. Members get bold, italics, underline and numbered lists, and
   a word cap. Staff skip the filter entirely — enforced on the server, where
   it actually counts.

   Reading is open. Talking needs an account, and the server refuses a banned
   one before it ever stores a word. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  BadgeCheck,
  Bot,
  Copy,
  CornerUpLeft,
  Crown,
  Flag,
  Hash,
  Image as ImageIcon,
  MessageCircle,
  Plus,
  Reply,
  Send,
  Smile,
  Speaker,
  Trash2,
  Volume2,
  X,
} from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import { cloud, cloudOn, machine } from "../lib/cloud";
import { useAccount, nameStyleCss } from "../lib/account";
import { isOwner, OWNER_TAG } from "../lib/owner";
import { itemsOf, useEcon } from "../lib/econ";
import { AvatarArt, TagChip } from "../lib/art";
import { screen } from "../lib/filter";
import { Markdown } from "../lib/md";
import { go } from "../lib/tabs";
import { roleOf } from "../lib/staff";
import { NullFace } from "../lib/brand";
import { Sheet } from "../components/Sheet";

type Row = {
  id: string;
  user: string;
  name: string;
  body: string;
  at: number;
  owner: boolean;
  roles: string[];
  tags: string[];
  avatar: string | null;
  machine: string;
  bot: boolean;
  image: string | null;
  replyTo: string | null;
  reactions: Record<string, number>;
  mentions: string[];
  everyone: boolean;
  md: string;
};

type Channel = {
  slug: string;
  name: string;
  topic: string;
  kind: string;
  gate: string | null;
  fixed: boolean;
};

type MemberRow = {
  user: string;
  name: string;
  pfp: string | null;
  online: boolean;
  owner: boolean;
  roles: string[];
};

/** The sidebar is drawn from the same table the server enforces: the Info
 *  shelves read as shelves, the voice room reads with a speaker. */
function ChannelIcon({ ch }: { ch: Channel }) {
  if (ch.kind === "voice") return <Volume2 />;
  if (ch.gate === "staff") return <Speaker />;
  return <Hash />;
}

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
  const eco = useEcon();
  const channels = useQuery(api.chat.threads) as Channel[] | undefined;
  const members = useQuery(api.members.list) as MemberRow[] | undefined;
  const [slug, setSlug] = useState("general");
  const [profileFor, setProfileFor] = useState<string | null>(null);
  const [dmWith, setDmWith] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const here = useMemo(
    () => (channels ?? []).find((c) => c.slug === slug) ?? (channels ?? [])[0],
    [channels, slug],
  );

  const iAmOwner = isOwner(me.user);
  const myRow = members?.find(
    (m) => m.user === (me.user ?? "").replace(/^@/, "").toLowerCase(),
  );
  const myRoles = myRow?.roles ?? [];
  const staff = iAmOwner || myRoles.length > 0;

  const handle = (me.user ?? "").replace(/^@/, "").toLowerCase();

  const online = (members ?? []).filter((m) => m.online);
  const offline = (members ?? []).filter((m) => !m.online);

  return (
    <div className="page page--flush ch">
      {/* ---------- channels ---------- */}
      <aside className="ch-side">
        <div className="ch-side-head">
          <MessageCircle />
          <span>Channels</span>
        </div>

        <nav className="ch-list" aria-label="Channels">
          {(channels ?? []).map((c) => (
            <button
              key={c.slug}
              className={`ch-room${c.slug === here?.slug ? " is-on" : ""}`}
              onClick={() => setSlug(c.slug)}
              title={c.topic || c.name}
            >
              <ChannelIcon ch={c} />
              <span>{c.name}</span>
            </button>
          ))}
        </nav>

        <p className="ch-side-foot tiny faint">
          <Bot /> Type <code>$help</code> in any room and Null Bot answers.
        </p>
      </aside>

      {/* ---------- the room ---------- */}
      <section className="ch-main">
        <header className="ch-head">
          <span className="ch-hash">
            <ChannelIcon ch={here ?? { kind: "text", gate: null } as Channel} />
          </span>
          <div className="ch-head-txt">
            <b>#{here?.name ?? "general"}</b>
            <span className="tiny faint">{here?.topic ?? ""}</span>
          </div>
          <label className="ch-search">
            <input
              value={search}
              spellCheck={false}
              placeholder="Search messages"
              aria-label="Search messages"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {iAmOwner && here && !here.fixed && <ClearRoom slug={here.slug} me={handle} />}
        </header>

        <Feed
          slug={here?.slug ?? "general"}
          channels={channels}
          staff={staff}
          search={search}
          onProfile={setProfileFor}
        />
      </section>

      {/* ---------- members ---------- */}
      <aside className="ch-members">
        <div className="ch-mgroup">
          <span className="ch-mhead tiny faint">
            OWNER — {members?.filter((m) => m.owner).length ?? 0}
          </span>
          {(members ?? [])
            .filter((m) => m.owner)
            .map((m) => (
              <MemberBtn key={m.user} m={m} onOpen={() => setProfileFor(m.user)} />
            ))}
          <span className="ch-mhead tiny faint">
            ADMIN — {members?.filter((m) => !m.owner && m.roles?.includes("admin")).length ?? 0}
          </span>
          {(members ?? [])
            .filter((m) => !m.owner && m.roles?.includes("admin"))
            .map((m) => (
              <MemberBtn key={m.user} m={m} onOpen={() => setProfileFor(m.user)} />
            ))}
          <span className="ch-mhead tiny faint">
            MOD — {members?.filter((m) => !m.owner && m.roles?.includes("mod")).length ?? 0}
          </span>
          {(members ?? [])
            .filter((m) => !m.owner && m.roles?.includes("mod"))
            .map((m) => (
              <MemberBtn key={m.user} m={m} onOpen={() => setProfileFor(m.user)} />
            ))}
          <span className="ch-mhead tiny faint">ONLINE — {online.length}</span>
          {online
            .filter((m) => !m.owner && !(m.roles?.length ?? 0))
            .map((m) => (
              <MemberBtn key={m.user} m={m} onOpen={() => setProfileFor(m.user)} />
            ))}
          <span className="ch-mhead tiny faint">OFFLINE — {offline.length}</span>
          {offline
            .filter((m) => !m.owner && !(m.roles?.length ?? 0))
            .map((m) => (
              <MemberBtn key={m.user} m={m} dim onOpen={() => setProfileFor(m.user)} />
            ))}
        </div>
      </aside>

      {profileFor && (
        <ProfilePopout
          user={profileFor}
          onClose={() => setProfileFor(null)}
          onDm={(u) => {
            setProfileFor(null);
            setDmWith(u);
          }}
          staff={staff}
          owner={iAmOwner}
        />
      )}

      {dmWith && me.user && (
        <Sheet open onClose={() => setDmWith(null)} title={`DM — @${dmWith}`} width={480}>
          <DmThread other={dmWith} me={me} />
        </Sheet>
      )}
    </div>
  );
}

function MemberBtn({ m, dim, onOpen }: { m: MemberRow; dim?: boolean; onOpen: () => void }) {
  const staffRole = (m.roles ?? [])[0];
  const t = staffRole ? roleOf(staffRole) : null;
  return (
    <button className={`ch-member${dim ? " is-dim" : ""}`} onClick={onOpen} title={m.name}>
      <span className="ch-member-pic">
        {m.pfp ? <img src={m.pfp} alt="" /> : <NullFace />}
        <AvatarArt id={null} />
        <i className={`ch-presence${m.online ? " is-on" : ""}`} />
      </span>
      <span className="ch-member-name">{m.name}</span>
      {m.owner && <BadgeCheck className="pf-verified" aria-label="Owner" />}
      {t && !m.owner && (
        <span className="tagchip" style={{ backgroundColor: t.color, color: t.ink }}>
          {t.name}
        </span>
      )}
    </button>
  );
}

/* ============================================================
   the feed
   ============================================================ */

function Feed({
  slug,
  channels,
  staff,
  search,
  onProfile,
}: {
  slug: string;
  channels?: Channel[];
  staff: boolean;
  search: string;
  onProfile: (u: string) => void;
}) {
  const posts = useQuery(api.chat.recent, { thread: slug }) as Row[] | undefined;
  const send = useMutation(api.chat.send);
  const me = useAccount();
  const eco = useEcon();

  const authors = useMemo(
    () => [...new Set((posts ?? []).map((m) => m.user.trim().toLowerCase()))].filter(Boolean).sort(),
    [posts],
  );
  const pics = useQuery(api.members.pictures, { users: authors });
  const faces = useMemo(() => {
    const map = new Map<string, { pfp: string | null; avatar: string | null; nameStyle: string }>();
    for (const p of pics ?? []) {
      if (p && typeof p.user === "string")
        map.set(p.user.trim().toLowerCase(), { pfp: p.pfp, avatar: p.avatar, nameStyle: "" });
    }
    return map;
  }, [pics]);

  const handle = (me.user ?? "").replace(/^@/, "").toLowerCase();
  const signedIn = !!me.user;

  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [reply, setReply] = useState<Row | null>(null);
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const said = useMemo(() => screen(draft, staff), [draft, staff]);

  /* typing: tell the room, once every few seconds while keys are moving */
  const doTyping = useMutation(api.chat.typing);
  const lastPing = useRef(0);
  useEffect(() => {
    if (!signedIn || !draft.trim()) return;
    const now = Date.now();
    if (now - lastPing.current < 2500) return;
    lastPing.current = now;
    void doTyping({ thread: slug, user: handle, name: me.name || handle }).catch(() => {});
  }, [draft, signedIn, slug, handle, me.name, doTyping]);

  const typists = (useQuery(api.chat.typists, { thread: slug, exclude: handle }) as
    | { user: string; name: string }[]
    | undefined) ?? [];

  /* scroll to the newest line, without yanking anyone reading the backlog */
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
    setReply(null);
    before.current = 0;
  }, [slug]);

  const filtered = useMemo(() => {
    if (!search.trim()) return posts;
    const needle = search.trim().toLowerCase();
    return (posts ?? []).filter((m) => m.body.toLowerCase().includes(needle));
  }, [posts, search]);

  async function post() {
    const text = said.clean.trim();
    if ((!text && !image) || busy || !signedIn) return;
    setBusy(true);
    setNote(null);
    try {
      const res = (await send({
        user: handle,
        name: me.name || handle,
        body: text,
        owner: isOwner(me.user),
        tags: tagIds(),
        machine,
        thread: slug,
        image: image ?? undefined,
        replyTo: reply?.id,
      })) as { caught?: string[] | null } | null;
      setDraft("");
      setImage(null);
      setReply(null);
      if (res && res.caught?.length) setNote("Some of that was starred out.");
    } catch (e) {
      setNote((e as Error).message.replace(/^.*?Error: /, ""));
    } finally {
      setBusy(false);
    }
  }

  const channel = channels?.find((c) => c.slug === slug);
  const canPostHere = signedIn && !(channel?.gate === "staff" && !staff);

  return (
    <>
      <div className="ch-feed" ref={feed}>
        {posts === undefined && <p className="ch-empty muted">Knocking…</p>}
        {posts && posts.length === 0 && (
          <p className="ch-empty muted">#{slug} is empty. Say the first thing, or type <code>$help</code>.</p>
        )}
        {filtered?.map((m, i) => {
          const who = m.user.trim().toLowerCase();
          const own = who === handle;
          return (
            <Line
              key={m.id}
              m={m}
              mine={own}
              prev={filtered[i - 1]}
              face={faces.get(who)}
              fallbackPic={own ? me.pfp : null}
              fallbackAvatar={own ? eco.equipped.avatar : null}
              staff={staff}
              onProfile={onProfile}
              onReply={() => setReply(m)}
              onEmoji={() => setEmojiFor(emojiFor === m.id ? null : m.id)}
            />
          );
        })}
      </div>

      {typists.length > 0 && (
        <p className="ch-typing tiny faint">
          {typists.length === 1
            ? `${typists[0].name} is typing…`
            : typists.length === 2
              ? `${typists[0].name} and ${typists[1].name} are typing…`
              : `${typists.length} people are typing…`}
        </p>
      )}

      <div className="ch-box">
        {reply && (
          <div className="ch-replybar">
            <Reply />
            <span>
              replying to <b>{reply.name}</b>
            </span>
            <button className="ch-icon" onClick={() => setReply(null)} aria-label="Cancel reply">
              <X />
            </button>
          </div>
        )}
        {canPostHere ? (
          <>
            <div className="ch-boxrow">
              <button className="ch-tool" title="Add an image" onClick={() => fileRef.current?.click()}>
                <ImageIcon />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fr = new FileReader();
                  fr.onload = () => {
                    const url = String(fr.result);
                    /* a chat image is a flavour, not an album: small enough
                       to ride along with the message */
                    if (url.length > 280_000) {
                      setNote("That image is too big for chat — 200KB or so is the ceiling.");
                      return;
                    }
                    setImage(url);
                  };
                  fr.readAsDataURL(f);
                }}
              />
              <textarea
                className="ch-input"
                value={draft}
                rows={1}
                placeholder={`Message #${slug}`}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void post();
                  }
                }}
              />
              <button className="ch-tool" title="Send" onClick={() => void post()} disabled={busy || (!said.clean.trim() && !image)}>
                <Send />
              </button>
            </div>
            {image && (
              <div className="ch-imgprev">
                <img src={image} alt="" />
                <button className="ch-icon" onClick={() => setImage(null)} aria-label="Remove image">
                  <X />
                </button>
              </div>
            )}
          </>
        ) : signedIn ? (
          <div className="ch-locked">
            <Speaker />
            <span>You don't have permission to post in #{slug}. Only staff can post them.</span>
          </div>
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

function tagIds(): string[] {
  try {
    const raw = localStorage.getItem("null:econ");
    if (!raw) return [];
    const eq = JSON.parse(raw)?.equipped;
    if (Array.isArray(eq?.tags)) return eq.tags.filter((t: unknown) => typeof t === "string");
    return typeof eq?.tag === "string" ? [eq.tag] : [];
  } catch {
    return [];
  }
}

/* ---------- one line ---------- */

const GROUP_MS = 5 * 60 * 1000;

function Line({
  m,
  mine,
  prev,
  face,
  fallbackPic,
  fallbackAvatar,
  staff,
  onProfile,
  onReply,
  onEmoji,
}: {
  m: Row;
  mine: boolean;
  prev?: Row;
  face?: { pfp: string | null; avatar: string | null; nameStyle: string };
  fallbackPic: string | null;
  fallbackAvatar: string | null;
  staff: boolean;
  onProfile: (u: string) => void;
  onReply: () => void;
  onEmoji: () => void;
}) {
  const tags = itemsOf(m.tags);
  const time = new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const owner = m.owner || isOwner(m.user);
  const same = !!prev && prev.user === m.user && prev.bot === m.bot && m.at - prev.at < GROUP_MS;
  const pic = face?.pfp ?? fallbackPic ?? null;
  const avatar = face?.avatar ?? fallbackAvatar ?? null;

  return (
    <div
      className={`say${mine ? " is-mine" : ""}${owner ? " is-owner" : ""}${m.bot ? " is-bot" : ""}${
        same ? " is-grouped" : ""
      }`}
    >
      <span className="say-pic" aria-hidden="true">
        {!same && (
          <button className="say-picbtn" onClick={() => onProfile(m.user)} title={m.name}>
            {m.bot ? <Bot /> : pic ? <img src={pic} alt="" /> : (m.name || "?").slice(0, 1).toUpperCase()}
            {!m.bot && <AvatarArt id={avatar} />}
          </button>
        )}
      </span>

      <div className="say-main">
        {!same && (
          <span className="say-head">
            <button className="say-name" style={nameStyleCss({} as never)} onClick={() => onProfile(m.user)}>
              {m.name}
            </button>
            {owner && <BadgeCheck className="pf-verified" aria-label="Owner" />}
            {owner && (
              <span className="tagchip tagchip--owner" title={OWNER_TAG.note}>
                <Crown />
                {OWNER_TAG.name}
              </span>
            )}
            {m.roles?.filter((r) => r !== "owner").map((r) => {
              const t = roleOf(r);
              if (!t) return null;
              return (
                <span key={r} className="tagchip" title={t.note} style={{ backgroundColor: t.color, color: t.ink }}>
                  <b className="tag-glyph">{t.glyph}</b>
                  {t.name}
                </span>
              );
            })}
            {m.bot && <span className="say-badge">bot</span>}
            {tags.map((t) => (
              <TagChip key={t.id} item={t} />
            ))}
            <span className="say-at">{time}</span>
          </span>
        )}

        {m.replyTo && <ReplyStub id={m.replyTo} onProfile={onProfile} />}

        <span className={`say-body${m.everyone ? " is-everyone" : ""}`}>
          <Markdown body={m.body} staff={m.md === "staff"} />
          {m.body.includes("@") && <Mentions body={m.body} />}
        </span>

        {m.image && (
          <span className="say-image">
            <img src={m.image} alt="" loading="lazy" />
          </span>
        )}

        {Object.keys(m.reactions ?? {}).length > 0 && (
          <span className="say-reacts">
            {Object.entries(m.reactions).map(([e, n]) => (
              <button key={e} className="say-react" onClick={onEmoji} title={e}>
                {e} <b>{n}</b>
              </button>
            ))}
          </span>
        )}

        <span className="say-hover">
          <button className="say-hbtn" title="Add reaction" onClick={onEmoji}>
            <Smile />
          </button>
          <button className="say-hbtn" title="Reply" onClick={onReply}>
            <Reply />
          </button>
          {!mine && (
            <button
              className="say-hbtn"
              title="Report"
              onClick={() => {
                const why = window.prompt("What happened?");
                if (!why) return;
                void cloud()?.mutation(api.members.report, { user: m.user, by: "chat", reason: why, message: m.id });
              }}
            >
              <Flag />
            </button>
          )}
          {mine && <DeleteBtn id={m.id} />}
        </span>

        {m.mentions?.includes("everyone") && (
          <span className="say-ping">everyone was pinged</span>
        )}
      </div>
    </div>
  );
}

function DeleteBtn({ id }: { id: string }) {
  const drop = useMutation(api.chat.drop);
  return (
    <button
      className="say-hbtn is-bad"
      title="Delete message"
      onClick={() => void drop({ id, by: (localStorage.getItem("null:account") ? JSON.parse(localStorage.getItem("null:account") as string).user ?? "" : ""), owner: false }).catch(() => {})}
    >
      <Trash2 />
    </button>
  );
}

function ReplyStub({ id, onProfile }: { id: string; onProfile: (u: string) => void }) {
  const target = useQuery(api.chat.messageById, { id }) as Row | null | undefined;
  if (!target) return <span className="say-reply faint tiny">replying to a gone message</span>;
  return (
    <span className="say-reply tiny">
      <CornerUpLeft />
      <button className="linkish" onClick={() => onProfile(target.user)}>
        {target.name}
      </button>
      <span className="say-reply-body">{target.body.slice(0, 90)}</span>
    </span>
  );
}

/** @handle in a body gets the mention tint. Done after the markdown pass so
 *  the words stay readable either way. */
function Mentions({ body }: { body: string }) {
  const hits = body.match(/@[a-z0-9._-]{3,20}|@everyone/gi) ?? [];
  if (!hits.length) return null;
  return (
    <span className="say-mentionlist" aria-hidden="true">
      {hits.slice(0, 4).map((h) => (
        <em key={h}>{h}</em>
      ))}
    </span>
  );
}

/** Owner-only: wipe a made thread. The fixed channels are not touchable and
 *  the server says so too, so the button simply never appears for them. */
function ClearRoom({ slug, me }: { slug: string; me: string }) {
  const clear = useMutation(api.chat.clearThread);
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="ch-icon"
      title="Clear this room"
      aria-label="Clear this room"
      disabled={busy}
      onClick={() => {
        if (!window.confirm(`Clear every message in #${slug}?`)) return;
        setBusy(true);
        clear({ slug, user: me, owner: isOwner(me) })
          .then(() => setBusy(false))
          .catch(() => setBusy(false));
      }}
    >
      <Trash2 />
    </button>
  );
}

/* ============================================================
   the profile popout
   ============================================================ */

function ProfilePopout({
  user,
  onClose,
  onDm,
  staff,
  owner,
}: {
  user: string;
  onClose: () => void;
  onDm: (u: string) => void;
  staff: boolean;
  owner: boolean;
}) {
  const me = useAccount();
  const card = useQuery(api.members.card, { user }) as any;
  const graph = useQuery(
    api.members.graph,
    me.user ? { user: (me.user as string).replace(/^@/, "") } : "skip",
  ) as { following: string[]; followers: string[]; friends: string[] } | undefined;
  const doFollow = useMutation(api.members.setFollow);
  const doReport = useMutation(api.members.report);
  const doBan = useMutation(api.members.ban);
  const countView = useMutation(api.members.view);

  const [followed, setFollowed] = useState<boolean | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (card && me.user && card.user !== (me.user as string).replace(/^@/, "").toLowerCase()) {
      void countView({ user: card.user, by: (me.user as string).replace(/^@/, "") });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.user]);

  if (!card) return null;

  const handle = card.user;
  const mine = me.user && handle === (me.user as string).replace(/^@/, "").toLowerCase();
  const friend = followed !== null ? false : !!graph?.friends.includes(handle);

  return (
    <div className="ch-pop-veil" onMouseDown={onClose} role="presentation">
      <div className="ch-pop" onMouseDown={(e) => e.stopPropagation()} role="dialog">
        <div className="ch-pop-banner" style={{ background: card.banner }} />
        <button className="sheet-x ch-pop-x" onClick={onClose} aria-label="Close">
          <X />
        </button>

        <div className="ch-pop-pic">
          {card.pfp ? <img src={card.pfp} alt="" /> : <NullFace />}
          <AvatarArt id={card.wearing?.avatar ?? null} />
          <i className={`ch-presence${card.online ? " is-on" : ""}`} />
        </div>

        <h3 className="ch-pop-name" style={nameStyleCss(card.nameStyle ?? {})}>
          {card.name}
        </h3>
        <span className="ch-pop-handle">
          @{handle}
          <button
            className="mb-copy"
            onClick={() => {
              let h = 0x811c9dc5;
              for (const c of handle) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
              navigator.clipboard?.writeText(
                `${h.toString(16).padStart(8, "0")}-1a27-470e-a4a8-${handle}`,
              );
              setNote("Member id copied.");
            }}
            title="Copy member id"
          >
            <Copy />
          </button>
        </span>

        <div className="ch-pop-meta tiny faint">
          <span>
            joined{" "}
            {new Date(card.joined || Date.now()).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span>·</span>
          <span>{card.views ?? 0} views</span>
          {card.online && (
            <>
              <span>·</span>
              <span className="ch-pop-online">in chat</span>
            </>
          )}
        </div>

        <p className={`ch-pop-bio${card.bio?.trim() ? "" : " is-empty"}`}>{card.bio?.trim() || "No bio"}</p>

        <div className="ch-pop-actions">
          {!mine && me.user && (
            <>
              <button
                className="btn btn--sm btn--fill"
                onClick={async () => {
                  try {
                    await doFollow({
                      by: (me.user as string).replace(/^@/, ""),
                      user: handle,
                      on: !(graph?.following.includes(handle) ?? false),
                    });
                    setNote(graph?.following.includes(handle) ? "Unfollowed." : "Followed.");
                  } catch (e) {
                    setNote((e as Error).message.replace(/^.*?Error: /, ""));
                  }
                }}
              >
                <Smile /> {graph?.following.includes(handle) ? "Unfollow" : "Add friend"}
              </button>
              {friend && (
                <button className="btn btn--sm" onClick={() => onDm(handle)}>
                  Message
                </button>
              )}
              <button
                className="btn btn--sm btn--icon"
                title="Block"
                onClick={() => setNote("Blocking is a local mute for now — the room-wide version comes with real accounts.")}
              >
                🚫
              </button>
              <button
                className="btn btn--sm btn--icon"
                title="Report"
                onClick={async () => {
                  const why = window.prompt("What happened?");
                  if (!why) return;
                  try {
                    await doReport({ user: handle, by: (me.user ?? "anon").replace(/^@/, ""), reason: why });
                    setNote("Reported.");
                  } catch (e) {
                    setNote((e as Error).message.replace(/^.*?Error: /, ""));
                  }
                }}
              >
                <Flag />
              </button>
            </>
          )}
          {staff && !mine && (
            <button
              className="btn btn--sm btn--bad"
              onClick={async () => {
                const why = window.prompt("Ban reason — they will be told");
                if (!why) return;
                try {
                  await doBan({
                    by: (me.user as string).replace(/^@/, ""),
                    claimed: owner,
                    user: handle,
                    kind: "account",
                    reason: why,
                  });
                  setNote("Banned.");
                } catch (e) {
                  setNote((e as Error).message.replace(/^.*?Error: /, ""));
                }
              }}
            >
              <Crown /> Ban
            </button>
          )}
        </div>

        {note && <p className="tiny faint">{note}</p>}
      </div>
    </div>
  );
}

/* ============================================================
   DMs
   ============================================================ */

function DmThread({ other, me }: { other: string; me: ReturnType<typeof useAccount> }) {
  const rows = useQuery(api.members.dmThread, {
    me: (me.user as string).replace(/^@/, ""),
    other,
  }) as { id: string; body: string; at: number; from: string; image: string | null }[] | undefined;
  const doSend = useMutation(api.members.dmSend);

  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="dm">
      <div className="dm-log">
        {(rows ?? []).map((r) => (
          <p key={r.id} className={`dm-line${r.from === (me.user as string).replace(/^@/, "") ? " is-mine" : ""}`}>
            {r.image && <img src={r.image} alt="" />}
            {r.body}
          </p>
        ))}
        {rows && rows.length === 0 && <p className="tiny faint">No messages yet. Say something.</p>}
      </div>
      <div className="dm-box">
        <input
          className="fld"
          value={draft}
          placeholder={`Message @${other}`}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              void doSend({
                by: (me.user as string).replace(/^@/, ""),
                to: other,
                body: draft,
                machine,
              })
                .then(() => setDraft(""))
                .catch((e2) => setErr((e2 as Error).message.replace(/^.*?Error: /, "")));
            }
          }}
        />
      </div>
      {err && <p className="form-err tiny">{err}</p>}
    </div>
  );
}

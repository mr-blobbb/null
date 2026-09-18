/* NULL · Chat.tsx
   The community, Discord-shaped because that shape is simply right: the
   channels down the left, the log in the middle, who is here down the right.

   The channels are shelved rather than listed flat: Rules stands alone, the
   Info shelves are what staff post and everybody reads, Social is everybody.
   The shelves come open, because a sidebar you have to unfold before you can
   see the rooms is a sidebar that wasted a click.

   What a message carries: the author's face and decoration, their name in its
   own style, their tags, the time, and the line itself — which may hold
   reactions, a reply stub, an image, @mentions and, for staff, the full
   markdown set. Members get bold, italics, underline and numbered lists, and a
   word cap. Staff skip the filter entirely — enforced on the server, where it
   actually counts.

   Reading is open. Talking needs an account, and the server refuses a banned
   one before it ever stores a word. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  BadgeCheck,
  Bot,
  Check,
  ChevronDown,
  CircleSlash,
  Copy,
  CornerUpLeft,
  Crown,
  Film,
  Flag,
  Hash,
  Image as ImageIcon,
  MessageCircle,
  Music2,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Speaker,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  X,
} from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import { cloudOn, machine } from "../lib/cloud";
import { CloudDown } from "../lib/outage";
import { useAccount, nameStyleCss, type NameStyle } from "../lib/account";
import { isOwner, OWNER_TAG } from "../lib/owner";
import { itemsOf, useEcon } from "../lib/econ";
import { toggleBlock, useBlocked } from "../lib/members";
import { AvatarArt, TagChip } from "../lib/art";
import { screen } from "../lib/filter";
import { Markdown } from "../lib/md";
import { go } from "../lib/tabs";
import { REPORT_REASONS, roleOf } from "../lib/staff";
import { NullFace } from "../lib/brand";
import { Sheet } from "../components/Sheet";
import { useMusic, type Track } from "../lib/music";

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
  bio: string;
  pfp: string | null;
  nameStyle: string;
  online: boolean;
  owner: boolean;
  roles: string[];
  wearing: { avatar: string | null; effect: string | null; tags: string[] };
};

type Face = { pfp: string | null; avatar: string | null; nameStyle: string };

type Flags = {
  open: number;
  total: number;
  reasons: { id: string; by: string; reason: string; at: number; fromChat: boolean }[];
};

/* ---------- the shelves ----------
   The server owns the channel list; this only decides which dropdown draws a
   channel, and anything the owner makes by hand lands at the bottom. */
const INFO_SHELF = ["announcements", "updates", "links", "staff-shitpost"];
const SOCIAL_SHELF = ["general", "member-shitpost", "advertise", "share-links", "general-voice"];

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
    <Guard what="Chat" fallback={(err) => <CloudDown what="Chat" key={err.message} />}>
      <Rooms />
    </Guard>
  );
}

function Rooms() {
  const me = useAccount();
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
  const handle = (me.user ?? "").replace(/^@/, "").toLowerCase();
  const myRow = (members ?? []).find((m) => m.user === handle);
  const staff = iAmOwner || (myRow?.roles?.length ?? 0) > 0;

  return (
    <div className="page page--flush ch">
      {/* ---------- channels ---------- */}
      <aside className="ch-side">
        <div className="ch-side-head">
          <MessageCircle />
          <span>Channels</span>
        </div>

        <RoomList channels={channels} current={here?.slug ?? slug} onPick={setSlug} />

        <p className="ch-side-foot tiny faint">
          <Bot /> Type <code>$help</code> in any room and Null Bot answers.
        </p>
      </aside>

      {/* ---------- the room ---------- */}
      <section className="ch-main">
        <header className="ch-head">
          <span className="ch-hash">
            <ChannelIcon ch={here ?? ({ kind: "text", gate: null } as Channel)} />
          </span>
          <div className="ch-head-txt">
            <b>{here?.kind === "voice" ? here.name : `#${here?.name ?? "general"}`}</b>
            <span className="tiny faint">{here?.topic ?? ""}</span>
          </div>
          <label className="ch-find">
            <Search />
            <input
              value={search}
              spellCheck={false}
              placeholder="Search messages"
              aria-label="Search messages"
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="ch-find-x" onClick={() => setSearch("")} aria-label="Clear search">
                <X />
              </button>
            )}
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
      <MemberRail members={members} me={handle} onOpen={setProfileFor} />

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
          me={handle}
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

/* ============================================================
   the channel list
   ============================================================ */

function RoomList({
  channels,
  current,
  onPick,
}: {
  channels?: Channel[];
  current: string;
  onPick: (slug: string) => void;
}) {
  /* both shelves come open: the rooms are the point of the page */
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const list = channels ?? [];

  const rules = list.find((c) => c.slug === "rules");
  const info = list.filter((c) => INFO_SHELF.includes(c.slug));
  const social = list.filter((c) => SOCIAL_SHELF.includes(c.slug));
  /* owner-made rooms, which are nobody's shelf but their own */
  const made = list.filter(
    (c) => !c.fixed && !INFO_SHELF.includes(c.slug) && !SOCIAL_SHELF.includes(c.slug),
  );

  const room = (c: Channel) => (
    <button
      key={c.slug}
      className={`ch-room${c.slug === current ? " is-on" : ""}`}
      onClick={() => onPick(c.slug)}
      title={c.topic || c.name}
    >
      <ChannelIcon ch={c} />
      <span>{c.name}</span>
      {c.gate === "staff" && <i className="ch-lock" title="Staff post here" />}
    </button>
  );

  const shelf = (id: string, label: string, icon: React.ReactNode, rooms: Channel[]) => {
    if (!rooms.length) return null;
    const open = !closed[id];
    return (
      <div className="ch-shelf">
        <button
          className={`ch-shelf-head${open ? " is-open" : ""}`}
          aria-expanded={open}
          onClick={() => setClosed((s) => ({ ...s, [id]: open }))}
        >
          {icon}
          <span>{label}</span>
          <b className="ch-shelf-n tiny faint">{rooms.length}</b>
          <ChevronDown className="ch-chev" />
        </button>
        {open && <div className="ch-shelf-body">{rooms.map(room)}</div>}
      </div>
    );
  };

  return (
    <nav className="ch-list" aria-label="Channels">
      {rules && <div className="ch-shelf ch-shelf--solo">{room(rules)}</div>}
      {shelf("info", "Info", <Speaker />, info)}
      {shelf("social", "Social", <MessageCircle />, social)}
      {made.length > 0 && shelf("made", "Rooms", <Hash />, made)}
    </nav>
  );
}

/* ============================================================
   the member rail
   ============================================================ */

function MemberRail({
  members,
  me,
  onOpen,
}: {
  members?: MemberRow[];
  me: string;
  onOpen: (user: string) => void;
}) {
  const blockedNow = useBlocked();
  const all = members ?? [];
  const owner = all.filter((m) => m.owner);
  const staff = all.filter((m) => !m.owner && (m.roles?.length ?? 0) > 0);
  const plain = all.filter((m) => !m.owner && !(m.roles?.length ?? 0));
  const online = plain.filter((m) => m.online);
  const offline = plain.filter((m) => !m.online);

  /* every heading is drawn even at zero: "ONLINE — 0" is information, and a
     heading that vanishes is a heading you have to guess the state of */
  const group = (label: string, rows: MemberRow[], dim?: boolean) => (
    <>
      <span className={`ch-mhead${dim ? " is-dim" : ""}`}>
        {label} <b>— {rows.length}</b>
      </span>        {rows.map((m) => (
          <MemberBtn
            key={m.user}
            m={m}
            me={m.user === me}
            blocked={blockedNow.includes(m.user)}
            dim={dim}
            onOpen={() => onOpen(m.user)}
          />
        ))}
    </>
  );

  return (
    <aside className="ch-members">
      <div className="ch-members-head">
        <Users />
        <span>Members</span>
        <b className="tiny faint">{all.length}</b>
      </div>
      <div className="ch-mgroup">
        {all.length === 0 ? (
          <p className="ch-empty tiny faint">Nobody has signed in yet.</p>
        ) : (
          <>
            {group("OWNER", owner)}
            {group("STAFF", staff)}
            {group("ONLINE", online)}
            {group("OFFLINE", offline, true)}
          </>
        )}
      </div>
    </aside>
  );
}

function MemberBtn({
  m,
  me,
  blocked,
  dim,
  onOpen,
}: {
  m: MemberRow;
  me: boolean;
  blocked?: boolean;
  dim?: boolean;
  onOpen: () => void;
}) {
  const role = (m.roles ?? [])[0];
  const t = role ? roleOf(role) : null;
  return (
    <button
      className={`ch-member${dim ? " is-dim" : ""}${m.online ? " is-on" : ""}${
        blocked ? " is-blocked" : ""
      }`}
      onClick={onOpen}
      title={blocked ? `@${m.user} — blocked. Their lines are hidden here.` : `@${m.user}`}
    >
      <span className="ch-member-pic">
        {m.pfp ? <img src={m.pfp} alt="" /> : <NullFace />}
        <AvatarArt id={m.wearing?.avatar ?? null} still />
        <i className={`ch-dot${m.online ? " is-on" : ""}`} aria-hidden="true" />
      </span>
      <span className="ch-member-txt">
        <b className="ch-member-name" style={nameStyleCss(parseStyle(m.nameStyle))}>
          {m.name || m.user}
          {m.owner && <BadgeCheck className="ch-verified" aria-label="Owner" />}
          {me && <i className="ch-you">you</i>}
        </b>
        <span className="ch-member-at">@{m.user}</span>
      </span>
      {blocked && (
        <span className="ch-member-blocked" title="Blocked">
          <CircleSlash />
        </span>
      )}
      {t && !blocked && (
        <span className="tagchip ch-member-tag" title={t.note} style={{ backgroundColor: t.color, color: t.ink }}>
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
  const doReact = useMutation(api.chat.react);
  const me = useAccount();
  const eco = useEcon();
  const mus = useMusic();
  /* the people this browser is ignoring. Their lines never reach the feed. */
  const blockedNow = useBlocked();

  const authors = useMemo(
    () => [...new Set((posts ?? []).map((m) => m.user.trim().toLowerCase()))].filter(Boolean).sort(),
    [posts],
  );
  const pics = useQuery(api.members.pictures, { users: authors });
  const faces = useMemo(() => {
    const map = new Map<string, Face>();
    for (const p of pics ?? []) {
      if (p && typeof p.user === "string")
        map.set(p.user.trim().toLowerCase(), { pfp: p.pfp, avatar: p.avatar, nameStyle: p.nameStyle ?? "" });
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
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<Row | null>(null);
  const [tool, setTool] = useState<null | "gif" | "music" | "emoji">(null);
  const [gifUrl, setGifUrl] = useState("");
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

  const typists =
    (useQuery(api.chat.typists, { thread: slug, exclude: handle }) as
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
    setReactFor(null);
    setTool(null);
    before.current = 0;
  }, [slug]);

  /* what actually gets drawn: blocked authors dropped first, then the search
     run over what is left. The count of what was dropped is kept, because a
     room that silently loses messages is a room you cannot trust. */
  const shown = useMemo(() => {
    const all = posts ?? [];
    const keep = all.filter((m) => !blockedNow.includes(m.user.trim().toLowerCase()));
    const needle = search.trim().toLowerCase();
    const list = needle
      ? keep.filter((m) => m.body.toLowerCase().includes(needle) || m.name.toLowerCase().includes(needle))
      : keep;
    return { list, hidden: all.length - keep.length };
  }, [posts, search, blockedNow]);

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

  const react = (id: string, emoji: string) => {
    setReactFor(null);
    void doReact({ id, emoji, by: handle, machine, owner: isOwner(me.user) }).catch((e) =>
      setNote((e as Error).message.replace(/^.*?Error: /, "")),
    );
  };

  const channel = channels?.find((c) => c.slug === slug);
  const canPostHere = signedIn && !(channel?.gate === "staff" && !staff);

  const closeTools = () => {
    setTool(null);
    setReactFor(null);
  };

  return (
    <>
      <div className="ch-feed" ref={feed}>
        {posts === undefined && <p className="ch-empty muted">Knocking…</p>}
        {posts && posts.length === 0 && (
          <p className="ch-empty muted">
            {channel?.kind === "voice" ? (
              <>
                #{slug} is the voice room, and the voice part is still to come. It reads and takes
                text like any other room meanwhile.
              </>
            ) : (
              <>
                #{slug} is empty. Say the first thing, or type <code>$help</code>.
              </>
            )}
          </p>
        )}
        {shown.hidden > 0 && (
          <p className="ch-blockednote tiny faint">
            <CircleSlash /> {shown.hidden} message{shown.hidden === 1 ? "" : "s"} from someone you
            blocked {shown.hidden === 1 ? "is" : "are"} hidden here.
          </p>
        )}
        {shown.list.length === 0 && posts && posts.length > 0 && search && (
          <p className="ch-empty muted">
            Nothing in #{slug} matches “{search}”.
          </p>
        )}
        {shown.list.map((m, i) => {
          const who = m.user.trim().toLowerCase();
          const own = who === handle;
          const face = faces.get(who);
          return (
            <Line
              key={m.id}
              m={m}
              mine={own}
              prev={shown.list[i - 1]}
              face={face}
              fallbackPic={own ? me.pfp : null}
              fallbackAvatar={own ? eco.equipped.avatar : null}
              fallbackStyle={own ? JSON.stringify(me.nameStyle ?? {}) : ""}
              staff={staff}
              reactor={reactFor === m.id}
              onProfile={onProfile}
              onReply={() => setReply(m)}
              onReact={() => setReactFor(reactFor === m.id ? null : m.id)}
              onPickEmoji={(e) => react(m.id, e)}
              onReport={() => setReportFor(m)}
              onDelete={() => setReactFor(null)}
              onProblem={setNote}
              me={handle}
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
        {(tool || reactFor) && <div className="ch-scrim" onMouseDown={closeTools} role="presentation" />}

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
              <div className="ch-tools">
                <button
                  className="ch-tool"
                  title="Add an image"
                  onClick={() => {
                    closeTools();
                    fileRef.current?.click();
                  }}
                >
                  <ImageIcon />
                </button>
                <button
                  className={`ch-tool${tool === "gif" ? " is-on" : ""}`}
                  title="Add a GIF by link"
                  onClick={() => setTool(tool === "gif" ? null : "gif")}
                >
                  <Film />
                </button>
                <button
                  className={`ch-tool${tool === "music" ? " is-on" : ""}`}
                  title="Say what you are listening to"
                  onClick={() => setTool(tool === "music" ? null : "music")}
                >
                  <Music2 />
                </button>
                <button
                  className={`ch-tool${tool === "emoji" ? " is-on" : ""}`}
                  title="Emoji"
                  onClick={() => setTool(tool === "emoji" ? null : "emoji")}
                >
                  <Smile />
                </button>
              </div>

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
                  e.target.value = "";
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

              <button
                className="ch-send"
                title="Send"
                onClick={() => void post()}
                disabled={busy || (!said.clean.trim() && !image)}
              >
                <Send />
              </button>
            </div>

            {tool === "emoji" && (
              <div className="ch-toolpop ch-toolpop--emoji">
                <span className="ch-toolpop-head tiny faint">Emoji</span>
                <div className="ch-emojigrid">
                  {EMOJI.map((e) => (
                    <button key={e} className="ch-emojibtn" onClick={() => setDraft((d) => d + e)}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tool === "gif" && (
              <div className="ch-toolpop">
                <span className="ch-toolpop-head tiny faint">A GIF, by link</span>
                <p className="tiny faint">
                  Paste the address of a GIF — NULL stores the link, not the file, so nothing is
                  copied twice.
                </p>
                <div className="ch-toolpop-row">
                  <input
                    className="fld"
                    value={gifUrl}
                    spellCheck={false}
                    placeholder="https://…/something.gif"
                    onChange={(e) => setGifUrl(e.target.value)}
                  />
                  <button
                    className="btn btn--sm btn--fill"
                    disabled={!/^https?:\/\/.+/i.test(gifUrl.trim())}
                    onClick={() => {
                      setImage(gifUrl.trim());
                      setGifUrl("");
                      setTool(null);
                    }}
                  >
                    Add
                  </button>
                </div>
                {gifUrl && /^https?:\/\/.+/i.test(gifUrl) && (
                  <img className="ch-toolpop-prev" src={gifUrl} alt="" />
                )}
              </div>
            )}

            {tool === "music" && (
              <div className="ch-toolpop">
                <span className="ch-toolpop-head tiny faint">Listening to</span>
                {mus.now ? (
                  <>
                    <MusicRow
                      track={mus.now}
                      label="now"
                      onPick={(t) => {
                        setDraft((d) => (d ? `${d} ` : "") + trackLine(t));
                        setTool(null);
                      }}
                    />
                    {mus.recent.filter((t) => t.key !== mus.now?.key).length > 0 && (
                      <span className="ch-toolpop-head tiny faint">Recently played</span>
                    )}
                  </>
                ) : (
                  <p className="tiny faint">
                    Nothing is playing. Open Music, and whatever is on will be here to share.
                  </p>
                )}
                {mus.recent
                  .filter((t) => t.key !== mus.now?.key)
                  .slice(0, 4)
                  .map((t) => (
                    <MusicRow
                      key={t.key}
                      track={t}
                      onPick={(pick) => {
                        setDraft((d) => (d ? `${d} ` : "") + trackLine(pick));
                        setTool(null);
                      }}
                    />
                  ))}
                {!mus.now && mus.recent.length === 0 && (
                  <button className="btn btn--sm" onClick={() => go({ page: "music" })}>
                    <Music2 /> Open Music
                  </button>
                )}
              </div>
            )}

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

      {reportFor && (
        <ReportBox
          row={reportFor}
          me={handle || "anonymous"}
          signedIn={signedIn}
          onClose={() => setReportFor(null)}
        />
      )}
    </>
  );
}

/** What a shared track reads as in the room. Text, not an embed: the chat has
 *  one place to put a picture and no place to put a player. */
function trackLine(t: Track): string {
  return `♫ ${t.title} — ${t.artist}`;
}

function MusicRow({
  track,
  label,
  onPick,
}: {
  track: Track;
  label?: string;
  onPick: (t: Track) => void;
}) {
  return (
    <button className="ch-musicro" onClick={() => onPick(track)} title={trackLine(track)}>
      <span className="ch-musicro-art">
        {track.art ? <img src={track.art} alt="" /> : <Music2 />}
      </span>
      <span className="ch-musicro-txt">
        <b>{track.title}</b>
        <span className="tiny faint">{track.artist}</span>
      </span>
      {label && <i className="ch-musicro-tag">{label}</i>}
      <span className="ch-musicro-add" aria-hidden="true">
        <Plus />
      </span>
    </button>
  );
}

/* One row of the pickers. The first ten are what a message's own bar offers,
   because a reaction bar that needs scrolling is a reaction bar nobody uses. */
const EMOJI = [
  "😂", "🔥", "💀", "😭", "👀", "❤️", "👍", "🤡", "🙏", "💯",
  "🎉", "😎", "🤔", "🫡", "😤", "🥶", "🗿", "✨", "😴", "🥲",
];

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

/** A name's styling travels as the JSON the profile page stores it in. */
function parseStyle(raw: string): NameStyle {
  try {
    const v = JSON.parse(raw || "{}");
    return typeof v === "object" && v ? (v as NameStyle) : ({} as NameStyle);
  } catch {
    return {} as NameStyle;
  }
}

/** The id the profile page copies, kept as the same string it has always been:
 *  the first eight hex digits are what the card prints. */
function memberId(handle: string): string {
  let h = 0x811c9dc5;
  for (const c of handle) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
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
  fallbackStyle,
  staff,
  reactor,
  onProfile,
  onReply,
  onReact,
  onPickEmoji,
  onReport,
  onDelete,
  onProblem,
  me,
}: {
  m: Row;
  mine: boolean;
  prev?: Row;
  face?: Face;
  fallbackPic: string | null;
  fallbackAvatar: string | null;
  fallbackStyle: string;
  staff: boolean;
  reactor: boolean;
  onProfile: (u: string) => void;
  onReply: () => void;
  onReact: () => void;
  onPickEmoji: (emoji: string) => void;
  onReport: () => void;
  onDelete: () => void;
  onProblem: (why: string) => void;
  me: string;
}) {
  const tags = itemsOf(m.tags);
  const time = new Date(m.at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const owner = m.owner || isOwner(m.user);
  const same = !!prev && prev.user === m.user && prev.bot === m.bot && m.at - prev.at < GROUP_MS;
  const pic = face?.pfp ?? fallbackPic ?? null;
  const avatar = face?.avatar ?? fallbackAvatar ?? null;
  const style = parseStyle(face?.nameStyle || fallbackStyle);

  return (
    <div
      className={`say${mine ? " is-mine" : ""}${owner ? " is-owner" : ""}${m.bot ? " is-bot" : ""}${
        same ? " is-grouped" : ""
      }`}
    >
      {/* the bar rides the top of the line and only shows up under the pointer */}
      <div className="ch-bar">
        <button className="ch-hbtn" title="Add a reaction" onClick={onReact}>
          <Smile />
        </button>
        <button className="ch-hbtn" title="Reply" onClick={onReply}>
          <Reply />
        </button>
        {!mine && (
          <button className="ch-hbtn" title="Report" onClick={onReport}>
            <Flag />
          </button>
        )}
        {/* staff can take down anyone's line, which is the whole point of
            having staff. Your own words are always yours to remove. */}
        {(mine || staff) && (
          <DeleteBtn
            id={m.id}
            by={me}
            owner={staff}
            onGone={onDelete}
            onProblem={onProblem}
            mine={mine}
          />
        )}
      </div>

      {reactor && (
        <div className="ch-reactor">
          {EMOJI.slice(0, 10).map((e) => (
            <button key={e} className="ch-reactor-btn" onClick={() => onPickEmoji(e)}>
              {e}
            </button>
          ))}
        </div>
      )}

      <span className="say-pic" aria-hidden="true">
        {!same && (
          <button className="say-picbtn" onClick={() => onProfile(m.user)} title={m.name}>
            {m.bot ? <Bot /> : pic ? <img src={pic} alt="" /> : (m.name || "?").slice(0, 1).toUpperCase()}
            {!m.bot && <AvatarArt id={avatar} still />}
          </button>
        )}
      </span>

      <div className="say-main">
        {!same && (
          <span className="say-head">
            <button className="say-name" style={nameStyleCss(style)} onClick={() => onProfile(m.user)}>
              {m.name}
            </button>
            {owner && <BadgeCheck className="say-verified" aria-label="Owner" />}
            {owner && (
              <span className="tagchip tagchip--owner" title={OWNER_TAG.note}>
                <Crown />
                {OWNER_TAG.name}
              </span>
            )}
            {m.roles
              ?.filter((r) => r !== "owner")
              .map((r) => {
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
              <button key={e} className="say-react" onClick={() => onPickEmoji(e)} title={e}>
                {e} <b>{n}</b>
              </button>
            ))}
          </span>
        )}

        {m.mentions?.includes("everyone") && staff && (
          <span className="say-ping">everyone was pinged</span>
        )}
      </div>
    </div>
  );
}

function DeleteBtn({
  id,
  by,
  owner,
  mine,
  onGone,
  onProblem,
}: {
  id: string;
  by: string;
  owner: boolean;
  mine: boolean;
  onGone: () => void;
  onProblem: (why: string) => void;
}) {
  const drop = useMutation(api.chat.drop);
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="ch-hbtn is-bad"
      title={mine ? "Delete message" : "Delete this message (staff)"}
      disabled={busy}
      onClick={() => {
        onGone();
        setBusy(true);
        drop({ id, by, owner })
          /* a delete that quietly does nothing is the reason this button was
             reported broken: the server's answer goes on screen now */
          .catch((e) => onProblem((e as Error).message.replace(/^.*?Error: /, "")))
          .finally(() => setBusy(false));
      }}
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
   reporting a line
   ============================================================ */

function ReportBox({
  row,
  me,
  signedIn,
  onClose,
}: {
  row: Row;
  me: string;
  signedIn: boolean;
  onClose: () => void;
}) {
  const doReport = useMutation(api.members.report);
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    if (!why.trim() || busy) return;
    if (!signedIn) {
      setErr("Sign in first — a report with no name is a report nobody can ask about.");
      return;
    }
    setBusy(true);
    try {
      await doReport({ user: row.user, by: me, reason: why.trim(), message: row.id });
      setDone(true);
    } catch (e) {
      setErr((e as Error).message.replace(/^.*?Error: /, ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ch-veil" onMouseDown={onClose} role="presentation">
      <div className="ch-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Report a message">
        <div className="ch-modal-head">
          <Flag className="ch-modal-flag" />
          <b>Report {row.name}</b>
          <button className="ch-icon" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>

        {done ? (
          <>
            <p className="ch-modal-line">
              Thank you — that is with the staff now. They will read it, and the flag stays on
              @{row.user} until one of them has.
            </p>
            <div className="ch-modal-foot">
              <button className="btn btn--fill" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="ch-modal-line tiny faint">
              A person reads this, so say what happened in your own words.
            </p>

            <div className="ch-quote">
              <b>{row.name}</b>
              <span>{row.body.slice(0, 220) || (row.image ? "a picture" : "")}</span>
            </div>

            <div className="ch-why">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  className={`chip${why === r ? " is-on" : ""}`}
                  onClick={() => setWhy(r === "Something else" ? "" : r)}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              className="ch-whybox fld"
              rows={4}
              value={why}
              spellCheck={false}
              placeholder="What happened? Be specific — which message, and why it matters."
              onChange={(e) => setWhy(e.target.value.slice(0, 400))}
            />

            {err && <p className="form-err tiny">{err}</p>}

            <div className="ch-modal-foot">
              <span className="tiny faint ch-modal-count">{why.length}/400</span>
              <button className="btn" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn--fill" disabled={!why.trim() || busy} onClick={() => void send()}>
                <Flag /> Send report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   the profile card
   ============================================================ */

function ProfilePopout({
  user,
  onClose,
  onDm,
  staff,
  owner,
  me,
}: {
  user: string;
  onClose: () => void;
  onDm: (u: string) => void;
  staff: boolean;
  owner: boolean;
  me: string;
}) {
  const card = useQuery(api.members.card, { user }) as any;
  const graph = useQuery(
    api.members.graph,
    me ? { user: me } : "skip",
  ) as { following: string[]; followers: string[]; friends: string[] } | undefined;
  /* the flag is only handed to staff: the server answers null for anyone else,
     which is what keeps a report between the reporter and the moderators */
  const flags = useQuery(
    api.members.reports,
    staff ? { user, by: me, claimed: owner } : "skip",
  ) as Flags | null | undefined;
  const doFollow = useMutation(api.members.setFollow);
  const doReport = useMutation(api.members.report);
  const doBan = useMutation(api.members.ban);
  const doUnban = useMutation(api.members.unban);
  const handleFlag = useMutation(api.members.handleReport);
  const countView = useMutation(api.members.view);

  const [note, setNote] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const [reporting, setReporting] = useState(false);
  const [banned, setBanned] = useState<boolean | null>(null);
  /* the local ignore list, read through the store so the rest of the room
     reacts the moment it changes */
  const blockedNow = useBlocked();

  useEffect(() => {
    if (card && me && card.user !== me) void countView({ user: card.user, by: me });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.user]);

  if (!card) return null;

  const handle = card.user;
  const mine = me === handle;
  const ignored = blockedNow.includes(handle);
  const following = graph?.following.includes(handle) ?? false;
  const isBanned = banned ?? card.banned === true;
  const openFlags = flags?.open ?? 0;

  const report = async () => {
    if (!why.trim()) return;
    try {
      await doReport({ user: handle, by: me || "anonymous", reason: why.trim() });
      setNote("Reported. The staff can see the flag now.");
      setReporting(false);
      setWhy("");
    } catch (e) {
      setNote((e as Error).message.replace(/^.*?Error: /, ""));
    }
  };

  const ban = async () => {
    const reason = window.prompt("Ban reason — they will be told");
    if (!reason) return;
    try {
      await doBan({ by: me, claimed: owner, user: handle, kind: "account", reason });
      setBanned(true);
      setNote("Banned.");
    } catch (e) {
      setNote((e as Error).message.replace(/^.*?Error: /, ""));
    }
  };

  return (
    <div className="ch-veil" onMouseDown={onClose} role="presentation">
      <div
        className={`ch-pop${openFlags > 0 ? " is-flagged" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${card.name} — profile`}
      >
        <div className="ch-pop-banner" style={{ background: card.banner || undefined }}>
          {openFlags > 0 && (
            <span className="ch-pop-flag" title={`${openFlags} open report${openFlags === 1 ? "" : "s"}`}>
              <Flag />
              {openFlags}
            </span>
          )}
          <button className="ch-icon ch-pop-x" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>

        <div className="ch-pop-body">
          <div className="ch-pop-avatar">
            <span className="ch-pop-pic">
              {card.pfp ? <img src={card.pfp} alt="" /> : <NullFace />}
              <AvatarArt id={card.wearing?.avatar ?? null} still />
              <i className={`ch-dot ch-dot--big${card.online ? " is-on" : ""}`} />
            </span>

            {!mine && me && !ignored && (
              <div className="ch-pop-actions">
                <button
                  className="btn btn--sm"
                  title={`Send @${handle} a direct message`}
                  onClick={() => onDm(handle)}
                >
                  Message
                </button>
              </div>
            )}
          </div>

          <h3 className="ch-pop-name" style={nameStyleCss(parseStyle(card.nameStyle ?? ""))}>
            {card.name}
            {card.owner && <BadgeCheck className="ch-verified" aria-label="Owner" />}
            {isBanned && <i className="ch-pop-banned">banned</i>}
          </h3>

          <div className="ch-pop-handle">
            @{handle}
            <button
              className="mb-copy"
              onClick={() => {
                navigator.clipboard?.writeText(`${memberId(handle)}-1a27-470e-a4a8-${handle}`);
                setNote("Member id copied.");
              }}
              title="Copy member id"
            >
              <Copy />
            </button>
            <span className={`ch-pop-presence${card.online ? " is-on" : ""}`}>
              {card.online ? "online" : "offline"}
            </span>
          </div>

          <div className="ch-pop-tags">
            {card.owner && (
              <span className="tagchip tagchip--owner" title={OWNER_TAG.note}>
                <Crown />
                {OWNER_TAG.name}
              </span>
            )}
            {(card.roles ?? []).map((r: string) => {
              const t = roleOf(r);
              if (!t) return null;
              return (
                <span key={r} className="tagchip" title={t.note} style={{ backgroundColor: t.color, color: t.ink }}>
                  <b className="tag-glyph">{t.glyph}</b>
                  {t.name}
                </span>
              );
            })}
            {itemsOf(card.wearing?.tags ?? []).map((t) => (
              <TagChip key={t.id} item={t} />
            ))}
          </div>

          <p className={`ch-pop-bio${card.bio?.trim() ? "" : " is-empty"}`}>
            {card.bio?.trim() || "No bio yet."}
          </p>

          <div className="ch-pop-facts">
            <Fact label="member id" value={`#${memberId(handle)}`} mono />
            <Fact
              label="joined"
              value={new Date(card.joined || Date.now()).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            />
            <Fact label="views" value={String(card.views ?? 0)} />
            <Fact label="coins" value={(card.coins ?? 0).toLocaleString()} />
            <Fact label="friends" value={String(graph?.friends.length ?? 0)} />
            <Fact label="following" value={String(graph?.following.length ?? 0)} />
          </div>

          {staff && flags && openFlags > 0 && (
            <div className="ch-flags">
              <span className="ch-flags-head">
                <Flag /> {openFlags} open report{openFlags === 1 ? "" : "s"} — review and decide
              </span>
              <ul className="ch-flags-list">
                {flags.reasons.map((r) => (
                  <li key={r.id}>
                    <b>{r.reason}</b>
                    <span className="tiny faint">
                      @{r.by}
                      {r.fromChat ? " · from a message" : ""} ·{" "}
                      {new Date(r.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <button
                      className="btn btn--sm btn--ghost"
                      onClick={() =>
                        void handleFlag({ by: me, claimed: owner, id: r.id })
                          .then(() => setNote("Marked handled."))
                          .catch(() => {})
                      }
                    >
                      Dismiss
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* the two things you can decide about a person: follow them, or
              stop seeing them */}
          {!mine && me && (
            <div className="ch-pop-decide">
              <button
                className={`btn ch-pop-follow${following ? "" : " btn--fill"}`}
                onClick={async () => {
                  try {
                    await doFollow({ by: me, user: handle, on: !following });
                    setNote(following ? "Unfollowed." : "Followed.");
                  } catch (e) {
                    setNote((e as Error).message.replace(/^.*?Error: /, ""));
                  }
                }}
              >
                {following ? <><Check /> Following</> : <><UserPlus /> Follow</>}
              </button>
              <button
                className={`btn btn--icon ch-pop-block${ignored ? " is-on" : ""}`}
                title={ignored ? `Stop ignoring @${handle}` : `Block @${handle} — their lines stop showing here`}
                aria-pressed={ignored}
                onClick={() => {
                  const now = toggleBlock(handle);
                  setNote(
                    now
                      ? "Blocked. Their lines and their side of a DM are hidden on this browser."
                      : "Unblocked.",
                  );
                }}
              >
                <CircleSlash />
              </button>
            </div>
          )}

          <div className="ch-pop-foot">
            {!mine && me && !reporting && (
              <button className="btn btn--sm btn--icon" title="Report" onClick={() => setReporting(true)}>
                <Flag />
              </button>
            )}
            {reporting && (
              <div className="ch-pop-report">
                <textarea
                  className="fld"
                  rows={2}
                  value={why}
                  spellCheck={false}
                  placeholder="Why are you reporting them?"
                  onChange={(e) => setWhy(e.target.value.slice(0, 400))}
                />
                <button className="btn btn--sm" onClick={() => setReporting(false)}>
                  Cancel
                </button>
                <button className="btn btn--sm btn--fill" disabled={!why.trim()} onClick={() => void report()}>
                  Report
                </button>
              </div>
            )}
            {staff && !mine && (
              isBanned ? (
                <button
                  className="btn btn--sm"
                  onClick={() =>
                    void doUnban({ by: me, claimed: owner, user: handle })
                      .then(() => {
                        setBanned(false);
                        setNote("Unbanned.");
                      })
                      .catch((e) => setNote((e as Error).message.replace(/^.*?Error: /, "")))
                  }
                >
                  Unban
                </button>
              ) : (
                <button className="btn btn--sm btn--bad ch-pop-ban" onClick={() => void ban()}>
                  <Crown /> Ban
                </button>
              )
            )}
          </div>

          {note && <p className="ch-pop-note tiny faint">{note}</p>}
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <span className="ch-fact">
      <i>{label}</i>
      <b className={mono ? "mono" : ""}>{value}</b>
    </span>
  );
}

/* ============================================================
   DMs
   ============================================================ */

function DmThread({ other, me }: { other: string; me: ReturnType<typeof useAccount> }) {
  const handle = (me.user ?? "").replace(/^@/, "");
  const rows = useQuery(api.members.dmThread, { me: handle, other }) as
    | { id: string; body: string; at: number; from: string; image: string | null }[]
    | undefined;
  const doSend = useMutation(api.members.dmSend);
  /* blocking somebody hides their half of the conversation, which is the only
     half this browser can honestly refuse to show */
  const blockedNow = useBlocked();
  const visible = (rows ?? []).filter((r) => !blockedNow.includes(r.from.trim().toLowerCase()));

  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows?.length]);

  const send = () => {
    if (!draft.trim()) return;
    void doSend({ by: handle, to: other, body: draft, machine })
      .then(() => setDraft(""))
      .catch((e) => setErr((e as Error).message.replace(/^.*?Error: /, "")));
  };

  return (
    <div className="dm">
      <div className="dm-log" ref={box}>
        {visible.map((r) => (
          <p key={r.id} className={`dm-line${r.from === handle ? " is-mine" : ""}`}>
            {r.image && <img src={r.image} alt="" />}
            {r.body}
          </p>
        ))}
        {rows && rows.length === 0 && (
          <p className="tiny faint dm-hello">No messages yet. Say something.</p>
        )}
        {rows && rows.length > 0 && visible.length !== rows.length && (
          <p className="tiny faint dm-hello">
            <CircleSlash /> {rows.length - visible.length} hidden — you blocked @{other}.
          </p>
        )}
      </div>
      <div className="dm-box">
        <input
          className="ch-input"
          value={draft}
          placeholder={`Message @${other}`}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button className="ch-send" onClick={send} disabled={!draft.trim()} title="Send">
          <Send />
        </button>
      </div>
      {err && <p className="form-err tiny">{err}</p>}
    </div>
  );
}

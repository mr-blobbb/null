/* NULL · LineParts.tsx
   The small pieces a message is built out of, kept together because they are
   the same kind of thing: something that renders inside the stream and knows
   nothing about the room around it.

   They were in Chat.tsx until that page passed the size where a single file
   stays readable — the row, the composer, the rail, the card and every piece
   under a line were all one module. The page keeps the room; the furniture
   lives here.

   The three helpers below are the odd ones out, and they are here for the
   same reason the rest are: what a line was sent with is read off an older
   browser's storage, and only the row ever asks. */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, CornerUpLeft, Music2, Plus, Trash2 } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Guard } from "./Guard";
import { countOf, myChoice, totalVotes, type Poll as PollData } from "../lib/vote";
import { type NameStyle } from "../lib/account";
import { type Track } from "../lib/music";

/* ---------- a shared track ---------- */

/** What a shared track reads as in the room. Text, not an embed: the chat has
 *  one place to put a picture and no place to put a player. */
export function trackLine(t: Track): string {
  return `♫ ${t.title} — ${t.artist}`;
}

export function MusicRow({
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

/* ---------- reading what a line was sent with ---------- */

export function tagIds(): string[] {
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
export function parseStyle(raw: string): NameStyle {
  try {
    const v = JSON.parse(raw || "{}");
    return typeof v === "object" && v ? (v as NameStyle) : ({} as NameStyle);
  } catch {
    return {} as NameStyle;
  }
}

/** The id the profile page copies, kept as the same string it has always been:
 *  the first eight hex digits are what the card prints. */
export function memberId(handle: string): string {
  let h = 0x811c9dc5;
  for (const c of handle) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/* ---------- a staff vote ----------
   Two or more little boxes under the message that asked the question. The
   tally is drawn once you have picked something — until then the boxes are
   just choices, because seeing which way the room is leaning is not voting.
   A second tap on your own choice takes it back. */
export function Poll({ poll, me, onVote }: { poll: PollData; me: string; onVote: (option: string) => void }) {
  const total = totalVotes(poll);
  const mine = myChoice(poll, me);

  return (
    <div className="poll">
      <span className="poll-title">{poll.title}</span>
      <div className="poll-opts">
        {poll.options.map((o) => {
          const n = countOf(poll, o.id);
          const pct = total ? Math.round((n / total) * 100) : 0;
          const picked = mine === o.id;
          return (
            <button
              key={o.id}
              className={`poll-opt${picked ? " is-mine" : ""}${mine ? " is-tallied" : ""}`}
              onClick={() => onVote(o.id)}
              title={picked ? "Take your vote back" : `Vote for “${o.text}”`}
            >
              {/* the fill is the bar: how much of the room picked this one */}
              {mine && <span className="poll-fill" style={{ width: `${pct}%` }} aria-hidden="true" />}
              <span className="poll-txt">{o.text}</span>
              {mine && <b className="poll-pct">{pct}%</b>}
              {picked && <Check className="poll-tick" />}
            </button>
          );
        })}
      </div>
      <span className="poll-foot tiny faint">
        {total === 0 ? "No votes yet" : `${total} vote${total === 1 ? "" : "s"}`}
        {mine ? " · tap yours again to take it back" : " · one vote each"}
      </span>
    </div>
  );
}

/* ---------- the controls on a line ---------- */

export function DeleteBtn({
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

/* The stub asks the server for the line it points at. That is one extra query
   per reply, and a query the deployment may not know about yet — a page that
   is newer than the server it is talking to. A missing function is a thrown
   error, a thrown error during render takes the room with it, so the stub has
   its own wall: worst case it reads "replying to a line it cannot fetch". */
export function ReplyStub({ id, onProfile }: { id: string; onProfile: (u: string) => void }) {
  return (
    <Guard what="Reply" fallback={<span className="say-reply faint tiny">replying to a line</span>}>
      <ReplyTarget id={id} onProfile={onProfile} />
    </Guard>
  );
}

/** Just the three fields the stub reads, so this file does not need the whole
 *  message row the page keeps. */
type ReplyRow = { user: string; name: string; body: string };

function ReplyTarget({ id, onProfile }: { id: string; onProfile: (u: string) => void }) {
  const target = useQuery(api.chat.messageById, { id }) as ReplyRow | null | undefined;
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
export function Mentions({ body }: { body: string }) {
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

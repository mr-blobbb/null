/* NULL · FriendsPanel.tsx
   The friends list, on the account page.

   A friends list is three lists wearing one hat, and the order matters: the
   requests waiting on you come first, because somebody is waiting on an
   answer; then the friends themselves, here ones above away ones; then the
   requests you have out, which need nothing from anybody but time.

   Adding somebody is by handle, because a handle is what NULL has: there is
   no email and no address book, and inventing one to make a search box feel
   modern would be inventing a reason to collect it. */

import { useState } from "react";
import {
  Handshake,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { USER_RULE, useAccount, nameStyleCss } from "../lib/account";
import {
  acceptFriend,
  askFriend,
  declineFriend,
  dropFriend,
  isHere,
  lastSeen,
  useGraph,
  type Brief,
} from "../lib/friends";
import { NullFace } from "../lib/brand";
import { parseStyle } from "./LineParts";

export function FriendsPanel({ onOpen }: { onOpen?: (user: string) => void }) {
  const me = useAccount();
  const graph = useGraph(me.user);
  const [who, setWho] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const handle = (me.user ?? "").toLowerCase();

  const ask = async () => {
    const name = who.trim().replace(/^@/, "").toLowerCase();
    if (!name) return;
    if (!USER_RULE.test(name)) {
      setNote("Handles are 3–20 letters, numbers, dots, dashes or underscores.");
      return;
    }
    if (name === handle) {
      setNote("That is you.");
      return;
    }
    setBusy(name);
    await askFriend(handle, name);
    setBusy(null);
    setWho("");
    setNote(`Asked @${name}. They will see it the next time they open the chat.`);
  };

  const act = async (fn: (a: string, b: string) => Promise<unknown>, user: string) => {
    setBusy(user);
    await fn(handle, user);
    setBusy(null);
  };

  const here = graph.friends.filter((f) => isHere(f.seen) || f.online);
  const away = graph.friends.filter((f) => !isHere(f.seen) && !f.online);

  const row = (f: Brief, kind: "friend" | "in" | "out") => (
    <div className={`ac-row${kind === "in" ? " ac-row--ask" : ""}`} key={`${kind}-${f.user}`}>
      <span className="ac-pic">
        {f.pfp ? <img src={f.pfp} alt="" /> : <NullFace />}
        <i className={`ac-dot${isHere(f.seen) || f.online ? " is-on" : ""}`} aria-hidden="true" />
      </span>
      <span className="ac-txt">
        <button onClick={() => onOpen?.(f.user)} style={nameStyleCss(parseStyle(f.nameStyle))}>
          {f.name || f.user}
        </button>
        <em>
          @{f.user} ·{" "}
          {kind === "in"
            ? "asked to be friends"
            : kind === "out"
              ? "waiting on them"
              : isHere(f.seen)
                ? "here now"
                : lastSeen(f.seen)}
        </em>
      </span>
      <span className="ac-acts">
        {kind === "in" && (
          <>
            <button
              className="ac-btn ac-btn--ok"
              title="Accept"
              disabled={busy === f.user}
              onClick={() => void act(acceptFriend, f.user)}
            >
              <UserCheck />
            </button>
            <button
              className="ac-btn ac-btn--no"
              title="Not now"
              disabled={busy === f.user}
              onClick={() => void act(declineFriend, f.user)}
            >
              <X />
            </button>
          </>
        )}
        {kind === "friend" && (
          <button
            className="ac-btn ac-btn--no"
            title="Unfriend"
            disabled={busy === f.user}
            onClick={() => void act(dropFriend, f.user)}
          >
            <UserMinus />
          </button>
        )}
        {kind === "out" && (
          <button
            className="ac-btn ac-btn--no"
            title="Take the request back"
            disabled={busy === f.user}
            onClick={() => void act(dropFriend, f.user)}
          >
            <X />
          </button>
        )}
      </span>
    </div>
  );

  return (
    <div className="ac-panel">
      <div className="ac-head">
        <Handshake />
        <b>Friends</b>
        <span className="ac-count">
          {graph.friends.length} {graph.friends.length === 1 ? "friend" : "friends"}
          {graph.incoming.length ? ` · ${graph.incoming.length} waiting on you` : ""}
        </span>
      </div>

      <div className="ac-add">
        <input
          className="fld"
          value={who}
          spellCheck={false}
          autoComplete="off"
          placeholder="@handle"
          onChange={(e) => setWho(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ask();
          }}
        />
        <button className="btn btn--sm" disabled={!who.trim() || !!busy} onClick={() => void ask()}>
          <UserPlus /> Ask
        </button>
      </div>

      {note && <p className="ac-note">{note}</p>}

      {graph.incoming.length > 0 && (
        <div className="ac-list">
          <span className="ac-head tiny faint">
            <Users /> Requests waiting on you
          </span>
          {graph.incoming.map((f) => row(f, "in"))}
        </div>
      )}

      <div className="ac-list">
        {here.map((f) => row(f, "friend"))}
        {away.map((f) => row(f, "friend"))}
        {graph.friends.length === 0 && (
          <p className="ac-empty">
            No friends yet. Ask somebody by handle — two people asking each other is what a
            friendship is here.
          </p>
        )}
      </div>

      {graph.outgoing.length > 0 && (
        <div className="ac-list">
          <span className="ac-head tiny faint">
            <Sparkles /> Asked, still waiting
          </span>
          {graph.outgoing.map((f) => row(f, "out"))}
        </div>
      )}
    </div>
  );
}

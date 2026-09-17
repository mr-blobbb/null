/* NULL · Chat.tsx
   One room, everybody in it.

   The filter runs twice: here, so the box can show you what a message will
   look like before you press enter, and on the server, which is the one that
   actually decides. A client-side filter is a favour, not a lock — anyone can
   edit the copy running in their browser — so the server keeps its own and
   this one is only here to avoid the surprise.

   Signed out, you can read. That is on purpose: a room you have to join
   before you can see whether it is worth joining is not a room. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BadgeCheck, Crown, MessageCircle, Send, Smile } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import { cloudOn, machine } from "../lib/cloud";
import { useAccount } from "../lib/account";
import { isOwner, OWNER_TAG } from "../lib/owner";
import { itemOf } from "../lib/econ";
import { screen } from "../lib/filter";
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
};

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
            The room lives on the server, and this build cannot reach one. Everything else on
            NULL still works — the rail, the shop, your profile — it is only the shared room
            that needs somewhere to share through.
          </p>
        </div>
      </div>
    );
  }
  return (
    <Guard what="the chat room">
      <Room />
    </Guard>
  );
}

function Room() {
  const posts = useQuery(api.chat.recent) as Row[] | undefined;
  const send = useMutation(api.chat.send);
  const me = useAccount();

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const feed = useRef<HTMLDivElement>(null);

  /* A query that never answers leaves the room saying "knocking…" forever,
     which reads like NULL is broken rather than like the server is. After a
     few seconds it says which it is instead. */
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (posts !== undefined) return;
    const id = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(id);
  }, [posts]);

  const said = useMemo(() => screen(draft), [draft]);

  /* the room scrolls itself to the newest line, but only while you are already
     at the bottom — yanking someone out of the backlog is the rudest thing a
     chat can do */
  useEffect(() => {
    const el = feed.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [posts?.length]);

  const signedIn = !!me.user;

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
    <div className="page page--chat">
      <div className="lb-top">
        <h1 className="lb-title">Chat</h1>
        <span className="lb-count tiny faint">
          <MessageCircle /> one room · {posts ? `${posts.length} recent` : "connecting…"}
        </span>
      </div>

      <div className="chat card">
        <div className="chat-feed" ref={feed}>
          {posts === undefined && (
            <p className="chat-empty muted">
              {slow ? "The room is not answering. It lives on the server, so if that is down, nobody can talk until it is back." : "Knocking…"}
            </p>
          )}
          {posts && posts.length === 0 && (
            <p className="chat-empty muted">Nobody has said anything yet. Be the first.</p>
          )}
          {posts?.map((m) => (
            <Line key={m.id} m={m} mine={m.machine === machine} />
          ))}
        </div>

        <div className="chat-box">
          {signedIn ? (
            <>
              <textarea
                className="chat-input"
                value={draft}
                rows={1}
                placeholder="Say something…"
                spellCheck
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void post();
                  }
                }}
              />
              <button className="btn btn--fill chat-send" onClick={() => void post()} disabled={busy || !said.clean.trim()}>
                <Send /> {busy ? "Sending" : "Send"}
              </button>
            </>
          ) : (
            <div className="chat-locked">
              <Smile />
              <span>Sign in to talk — reading is open to anyone.</span>
              <button className="btn btn--fill" onClick={() => go({ page: "profile" })}>
                Go to profile
              </button>
            </div>
          )}
        </div>

        {(note || said.caught.length > 0) && (
          <p className="chat-note tiny faint">
            {note ?? `${said.caught.length} word${said.caught.length === 1 ? "" : "s"} will be starred out.`}
          </p>
        )}
      </div>
    </div>
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

function Line({ m, mine }: { m: Row; mine: boolean }) {
  const tag = itemOf(m.tag);
  const time = new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const owner = m.owner || isOwner(m.user);

  return (
    <div className={`say${mine ? " is-mine" : ""}${owner ? " is-owner" : ""}`}>
      <span className="say-head">
        <span className="say-name">{m.name}</span>
        {owner && <BadgeCheck className="pf-verified" aria-label="Owner" />}
        {owner && (
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
        <span className="say-at">{time}</span>
      </span>
      <span className="say-body">{m.body}</span>
    </div>
  );
}

/* NULL · Appeals.tsx
   The two ends of a punishment: the part where the person answers it, and the
   part where staff read the answers.

   Reports and bans have existed for a while and both of them only accuse.
   This is the return path. An appeal is one long message, it can be filed by
   anybody about anything, and it never unlocks anything by itself — a person
   reads it and decides. Granting lifts the ban in the same write as the
   decision, so there is never a moment where the paperwork says yes and the
   door is still shut.

   The third piece here is the log: every one of those decisions, newest
   first, for staff. It is append-only on the server, which is the only thing
   that makes a log worth reading. */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  FileText,
  Gavel,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { api } from "../../convex/_generated/api";
import { cloudOn } from "../lib/cloud";
import { isOwner } from "../lib/owner";
import { useAccount } from "../lib/account";

/* ============================================================
   the member's side
   ============================================================ */

type Appeal = {
  id: string;
  kind: string;
  body: string;
  at: number;
  status: string;
  by: string | null;
  note: string | null;
  decidedAt: number | null;
};

export function AppealBox() {
  const me = useAccount();
  const handle = (me.user ?? "").toLowerCase();
  const mine = useQuery(
    api.appeals.mine,
    cloudOn() && handle ? { user: handle } : "skip",
  ) as { banned: boolean; banReason: string | null; machineBanned: boolean; appeals: Appeal[] } | undefined;
  const file = useMutation(api.appeals.file);
  const [body, setBody] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!handle) return null;

  const open = (mine?.appeals ?? []).find((a) => a.status === "open");

  const send = async () => {
    setBusy(true);
    setNote(null);
    try {
      await file({ user: handle, kind: mine?.machineBanned ? "machine" : "account", body });
      setBody("");
      setNote("Filed. Staff will see it in the queue.");
    } catch (e) {
      setNote((e as Error).message.replace(/^.*?Error: /, ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ac-panel">
      <div className="ac-head">
        <Gavel />
        <b>Appeals</b>
        {mine?.banned && (
          <span className="ac-count">
            <TriangleAlert /> you are {mine.machineBanned ? "browser-banned" : "banned"}
          </span>
        )}
      </div>

      {mine?.banReason && <p className="ac-note">The reason on file: {mine.banReason}</p>}

      {mine?.appeals.length ? (
        <div className="ac-list">
          {mine.appeals.map((a) => (
            <div className="ac-row" key={a.id}>
              <span className="ac-txt">
                <b>
                  {a.status === "open" ? "waiting on staff" : a.status === "granted" ? "granted" : "denied"}
                </b>
                <span>
                  {new Date(a.at).toLocaleString()} · {a.kind}
                </span>
                <em>{a.body.slice(0, 140)}</em>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {open ? (
        <p className="ac-empty">
          You already have an appeal waiting. One at a time — a pile of them is not a stronger case,
          just a slower queue.
        </p>
      ) : (
        <div className="ap-box">
          <textarea
            value={body}
            maxLength={1500}
            spellCheck={false}
            placeholder="Say what actually happened, and what you would like done about it. Staff read these in order."
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="ac-head">
            <span className="ac-spacer" />
            <button className="btn btn--sm btn--fill" disabled={busy || body.trim().length < 12} onClick={() => void send()}>
              <FileText /> File an appeal
            </button>
          </div>
        </div>
      )}

      {note && <p className="ac-note">{note}</p>}
    </div>
  );
}

/* ============================================================
   staff: the queue
   ============================================================ */

type QueueRow = {
  id: string;
  user: string;
  name: string;
  kind: string;
  body: string;
  at: number;
  status: string;
  by: string | null;
  note: string | null;
  decidedAt: number | null;
  banReason: string | null;
  stillBanned: boolean;
};

export function AppealQueue() {
  const me = useAccount();
  const handle = (me.user ?? "").toLowerCase();
  const owner = isOwner(me.user);
  const rows = useQuery(
    api.appeals.queue,
    cloudOn() && handle ? { by: handle, claimed: owner } : "skip",
  ) as { open: QueueRow[]; decided: QueueRow[] } | undefined;
  const decide = useMutation(api.appeals.decide);
  const [why, setWhy] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!rows) return null;

  const act = async (id: string, granted: boolean) => {
    setBusy(id);
    try {
      await decide({ by: handle, claimed: owner, id, granted, note: why[id] });
      setNote(granted ? "Granted. The ban is lifted." : "Denied.");
    } catch (e) {
      setNote((e as Error).message.replace(/^.*?Error: /, ""));
    } finally {
      setBusy(null);
    }
  };

  const card = (r: QueueRow) => (
    <div className={`ap-card is-${r.status}`} key={r.id}>
      <div className="ap-card-head">
        <b>@{r.user}</b>
        <span className="tiny faint">
          {r.kind} appeal · {new Date(r.at).toLocaleString()}
          {r.stillBanned ? " · still banned" : ""}
        </span>
      </div>
      {r.banReason && <span className="tiny faint">On file: {r.banReason}</span>}
      <p>{r.body}</p>
      {r.status === "open" ? (
        <div className="ap-card-foot">
          <input
            className="fld"
            value={why[r.id] ?? ""}
            spellCheck={false}
            placeholder="a line back to them (optional)"
            onChange={(e) => setWhy((w) => ({ ...w, [r.id]: e.target.value }))}
          />
          <span className="ac-spacer" />
          <button className="btn btn--sm btn--fill" disabled={busy === r.id} onClick={() => void act(r.id, true)}>
            <ShieldCheck /> Grant
          </button>
          <button className="btn btn--sm btn--bad" disabled={busy === r.id} onClick={() => void act(r.id, false)}>
            Deny
          </button>
        </div>
      ) : (
        <span className="ap-decided">
          {r.status === "granted" ? "granted" : "denied"} by @{r.by}
          {r.decidedAt ? ` · ${new Date(r.decidedAt).toLocaleString()}` : ""}
          {r.note ? ` · “${r.note}”` : ""}
        </span>
      )}
    </div>
  );

  return (
    <div className="ac-panel">
      <div className="ac-head">
        <Gavel />
        <b>Appeals</b>
        <span className="ac-count">
          {rows.open.length} waiting
          {rows.decided.length ? ` · ${rows.decided.length} decided` : ""}
        </span>
      </div>
      {rows.open.length === 0 && rows.decided.length === 0 && <p className="ac-empty">Nothing to read.</p>}
      <div className="ap-queue">{[...rows.open, ...rows.decided].map(card)}</div>
      {note && <p className="ac-note">{note}</p>}
    </div>
  );
}

/* ============================================================
   staff: the log
   ============================================================ */

type LogRow = {
  id: string;
  by: string;
  action: string;
  user: string;
  detail: string;
  at: number;
};

export function AuditLog() {
  const me = useAccount();
  const handle = (me.user ?? "").toLowerCase();
  const owner = isOwner(me.user);
  const rows = useQuery(
    api.audit.log,
    cloudOn() && handle ? { by: handle, claimed: owner, limit: 120 } : "skip",
  ) as LogRow[] | undefined;

  /* not staff, or no server: the panel simply is not there */
  if (!rows || rows.length === 0) return null;

  return (
    <div className="ac-panel">
      <div className="ac-head">
        <ScrollText />
        <b>Staff log</b>
        <span className="ac-count">{rows.length} entries</span>
      </div>
      <div className="audit">
        {rows.map((r) => (
          <div className="audit-row" key={r.id}>
            <span className="audit-act">{r.action.replace(/-/g, " ")}</span>
            <span className="audit-who">@{r.user || "—"}</span>
            <span className="audit-why">{r.detail}</span>
            <span className="audit-at">{new Date(r.at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

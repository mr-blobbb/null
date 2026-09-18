/* NULL · ReportBox.tsx
   Reporting one message, in the reporter's own words.

   It lived in Chat.tsx until the chat page grew past what a single file should
   hold. Nothing about it is chat-specific beyond the line it points at, and
   keeping the reason box here means the reasons and the card that offers them
   are read together.

   A report is filed against a person and quotes a message, so the staff can
   see what was actually said rather than take anybody's word for it. */

import { useState } from "react";
import { useMutation } from "convex/react";
import { Flag, X } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { REPORT_REASONS } from "../lib/staff";

/** The one line this card needs: who wrote it, what they said, and the id the
 *  staff can be pointed at. A message carries more than this; it does not
 *  matter here. */
export type Reportable = {
  id: string;
  user: string;
  name: string;
  body: string;
  image: string | null;
};

export function ReportBox({
  row,
  me,
  signedIn,
  onClose,
}: {
  row: Reportable;
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

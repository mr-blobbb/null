/* NULL · StaffRoles.tsx
   The owner's one decision about a person: hand them a staff tag, or take it
   back.

   It is one component because "who is staff" is one question, and it should
   not be answered differently depending on which card you happened to open —
   the small card over the chat rooms and the full card on the members board
   both use this.

   The server re-checks the claim on the write (`members.setRoles`), so the
   buttons being hidden for everybody else is a convenience and not the rule:
   a browser that mints the mutation by hand is refused anyway. */

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import { STAFF_TAGS } from "../lib/staff";

export function StaffRoles({
  user,
  roles,
  by,
  owner,
  note,
  mine,
}: {
  /** the handle being decided about, without the @ */
  user: string;
  /** what they hold right now */
  roles: string[];
  /** the owner's own handle */
  by: string;
  owner: boolean;
  /** where a line about what happened goes, on whichever card this sits in */
  note: (line: string) => void;
  /** their own card: nobody grants themselves a role */
  mine?: boolean;
}) {
  const doRoles = useMutation(api.members.setRoles);
  const [busy, setBusy] = useState(false);

  if (!owner || mine) return null;

  const held = new Set(roles.map((r) => r.toLowerCase()));

  /** The whole set is sent every time, because that is what the server takes:
   *  one role toggled, the rest as they were. */
  const toggle = async (role: string) => {
    const next = STAFF_TAGS.map((t) => t.role).filter((r) => (r === role ? !held.has(role) : held.has(r)));
    setBusy(true);
    try {
      await doRoles({ by, claimed: owner, user, roles: next });
      const gone = !held.has(role);
      const t = STAFF_TAGS.find((x) => x.role === role);
      note(
        next.length
          ? `${gone ? "Took back" : "Made them"} ${t?.name ?? role.toUpperCase()} — they now hold ${next
              .map((r) => r.toUpperCase())
              .join(" and ")}.`
          : `Took back ${t?.name ?? role.toUpperCase()}. They hold no staff role now.`,
      );
    } catch (e) {
      note((e as Error).message.replace(/^.*?Error: /, ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sr">
      <span className="sr-head tiny faint">
        <ShieldCheck /> staff roles
      </span>
      <div className="sr-row">
        {STAFF_TAGS.map((t) => {
          const has = held.has(t.role);
          return (
            <button
              key={t.role}
              className="btn btn--sm sr-btn"
              style={has ? { backgroundColor: t.color, borderColor: t.color, color: t.ink } : undefined}
              title={has ? `Take ${t.name} back from @${user}` : `${t.note} — grant it to @${user}`}
              aria-pressed={has}
              disabled={busy}
              onClick={() => void toggle(t.role)}
            >
              <b className="tag-glyph">{t.glyph}</b>
              {has ? `${t.name} — take back` : `Make ${t.name}`}
            </button>
          );
        })}
      </div>
      <p className="sr-note tiny faint">
        A role is what shows next to their name in the rooms and on this card. Staff can post in the
        announcement rooms, take down any message, and see reports.
      </p>
    </div>
  );
}

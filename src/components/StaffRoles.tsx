/* NULL · StaffRoles.tsx
   The owner's one decision about a person: what they are here.

   It is one component because "who is staff" is one question, and it should
   not be answered differently depending on which card you happened to open —
   the small card over the chat rooms and the full card on the members board
   both use this.

   The server re-checks the claim on every write (`members.setRoles`,
   `members.setVerified`), so the buttons being hidden for everybody else is a
   convenience and not the rule: a browser that mints the mutation by hand is
   refused anyway. */

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useMutation } from "convex/react";

import { api } from "../../convex/_generated/api";
import { STAFF_TAGS, VERIFIED } from "../lib/staff";
import { RoleMark } from "./RoleMark";

export function StaffRoles({
  user,
  roles,
  verified,
  by,
  owner,
  note,
  mine,
}: {
  /** the handle being decided about, without the @ */
  user: string;
  /** what they hold right now */
  roles: string[];
  verified: boolean;
  /** the owner's own handle */
  by: string;
  owner: boolean;
  /** where a line about what happened goes, on whichever card this sits in */
  note: (line: string) => void;
  /** their own card: nobody grants themselves a role */
  mine?: boolean;
}) {
  const doRoles = useMutation(api.members.setRoles);
  const doVerified = useMutation(api.members.setVerified);
  const [busy, setBusy] = useState(false);

  if (!owner || mine) return null;

  const held = new Set(roles.map((r) => r.toLowerCase()));

  /** The whole set is sent every time, because that is what the server takes:
   *  one role toggled, the rest as they were. Roles from an older list that
   *  the server still knows about ride along untouched. */
  const toggleRole = async (role: string) => {
    const keep = [...held].filter((r) => !STAFF_TAGS.some((t) => t.role === r));
    const next = [...STAFF_TAGS.map((t) => t.role).filter((r) => (r === role ? !held.has(r) : held.has(r))), ...keep];
    const t = STAFF_TAGS.find((x) => x.role === role);
    setBusy(true);
    try {
      await doRoles({ by, claimed: owner, user, roles: next });
      const nowHeld = next.filter((r) => STAFF_TAGS.some((t2) => t2.role === r));
      note(
        nowHeld.length
          ? `${held.has(role) ? "Took back" : "Made them"} ${t?.name ?? role.toUpperCase()}. They hold ${nowHeld
              .map((r) => r.toUpperCase())
              .join(", ")}.`
          : `Took back ${t?.name ?? role.toUpperCase()}. They hold no staff role now.`,
      );
    } catch (e) {
      note((e as Error).message.replace(/^.*?Error: /, ""));
    } finally {
      setBusy(false);
    }
  };

  const toggleVerified = async () => {
    setBusy(true);
    try {
      await doVerified({ by, claimed: owner, user, on: !verified });
      note(verified ? "The circle is gone." : "Verified — a circle beside their name.");
    } catch (e) {
      note((e as Error).message.replace(/^.*?Error: /, ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sr">
      <span className="sr-head tiny faint">
        <ShieldCheck /> roles
      </span>
      <div className="sr-row">
        {STAFF_TAGS.map((t) => {
          const has = held.has(t.role);
          return (
            <button
              key={t.role}
              className="btn btn--sm sr-btn"
              style={has ? { backgroundColor: t.color, borderColor: t.color, color: t.ink } : undefined}
              title={has ? `Take ${t.name} back from @${user}` : `${t.note} — give it to @${user}`}
              aria-pressed={has}
              disabled={busy}
              onClick={() => void toggleRole(t.role)}
            >
              <RoleMark icon={t.icon} />
              {t.name}
            </button>
          );
        })}
        <button
          className="btn btn--sm sr-btn"
          style={verified ? { backgroundColor: VERIFIED.color, borderColor: VERIFIED.color, color: VERIFIED.ink } : undefined}
          title={verified ? `Take the circle off @${user}` : `${VERIFIED.note} — put it on @${user}`}
          aria-pressed={verified}
          disabled={busy}
          onClick={() => void toggleVerified()}
        >
          <RoleMark icon="verified" />
          VERIFIED
        </button>
      </div>
      <p className="sr-note tiny faint">
        A role is what shows beside their name in the rooms and on this card. Staff can post in the
        announcement rooms, take down any message and see reports. The circle is only a mark — it
        lets them do nothing.
      </p>
    </div>
  );
}

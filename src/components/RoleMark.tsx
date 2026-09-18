/* NULL · RoleMark.tsx
   One staff role, drawn the same way everywhere it appears: a line in a room,
   the rail, the members board, a profile card, and the owner's own control.

   It is one component because a role is one thing. When ADMIN was a wrench in
   the rooms and a star on the board, the same person looked like two people.

   `verified` rides along here as well: it is not a role — it grants nobody
   anything — but it is handed out from the same control and drawn at the same
   size, so it would be strange to have it painted somewhere else. */

import { BadgeCheck, Code, Crown, Heart, Link, Rocket, Wrench } from "lucide-react";

import { roleOf, VERIFIED, type RoleIcon } from "../lib/staff";

const ICONS: Record<RoleIcon, typeof Wrench> = {
  wrench: Wrench,
  rocket: Rocket,
  heart: Heart,
  code: Code,
  link: Link,
  crown: Crown,
};

/** Just the glyph, for the control that hands roles out. */
export function RoleMark({ icon }: { icon: RoleIcon | "verified" }) {
  if (icon === "verified") return <BadgeCheck />;
  const Icon = ICONS[icon] ?? Wrench;
  return <Icon />;
}

/** One chip: a role's own colour, its icon, its name. A role nobody has heard
 *  of draws nothing rather than an empty box. */
export function RoleChip({ role, className = "" }: { role: string; className?: string }) {
  const t = roleOf(role);
  if (!t) return null;
  return (
    <span
      className={`tagchip${className ? ` ${className}` : ""}`}
      title={t.note}
      style={{ backgroundColor: t.color, color: t.ink }}
    >
      <b className="tag-glyph">
        <RoleMark icon={t.icon} />
      </b>
      {t.name}
    </span>
  );
}

/** The circle beside a name, and nothing else. */
export function VerifiedMark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`tag-verified${small ? " tag-verified--sm" : ""}`}
      role="img"
      aria-label="Verified"
      title={VERIFIED.note}
    >
      <BadgeCheck />
    </span>
  );
}

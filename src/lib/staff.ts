/* NULL · staff.ts
   What a role looks like, and who counts as staff.

   OWNER is the account itself and nothing on this page can produce it. The
   rest are granted by the owner, carried on the member row, drawn as a chip
   next to a name, and checked server-side on every write that matters — being
   staff is not a claim the browser gets to make.

   Each role carries its own colour, and the icon is named rather than imported
   here so this file stays data: the components that draw a chip are the ones
   that know what a wrench looks like. */

export type Role = "admin" | "beta" | "partner" | "dev" | "linker" | "coowner";

/** An icon name, resolved by whoever draws it. */
export type RoleIcon = "wrench" | "rocket" | "heart" | "code" | "link" | "crown";

export const STAFF_TAGS: {
  role: Role;
  name: string;
  note: string;
  color: string;
  ink: string;
  icon: RoleIcon;
}[] = [
  {
    role: "admin",
    name: "ADMIN",
    note: "Runs the place day to day: bans, reports, and the rooms.",
    color: "#ff6ec7",
    ink: "#1c0714",
    icon: "wrench",
  },
  {
    role: "coowner",
    name: "CO-OWNER",
    note: "The owner's second. Everything the owner can do, except decide alone.",
    color: "#ffd76e",
    ink: "#231a04",
    icon: "crown",
  },
  {
    role: "dev",
    name: "DEV",
    note: "Writes the site. Ships the games, the apps and the rooms.",
    color: "#6ea8ff",
    ink: "#04101f",
    icon: "code",
  },
  {
    role: "beta",
    name: "BETA",
    note: "Here from the early builds, and tries things before they are finished.",
    color: "#5fd8c4",
    ink: "#04201c",
    icon: "rocket",
  },
  {
    role: "linker",
    name: "LINKER",
    note: "Keeps the catalog honest — the games, the apps and the links.",
    color: "#b48cff",
    ink: "#140627",
    icon: "wrench",
  },
  {
    role: "partner",
    name: "PARTNER",
    note: "Works with NULL from outside it.",
    color: "#ff6f61",
    ink: "#210604",
    icon: "heart",
  },
];

/** Where a role sits in the pecking order. A line has room for one chip, so
 *  the highest wins — and a role from an older list sinks below the current
 *  ones rather than being mistaken for one of them. */
export function roleRank(role: string): number {
  const key = role.toLowerCase();
  const i = STAFF_TAGS.findIndex((t) => t.role === key);
  if (i >= 0) return i;
  const j = LEGACY.findIndex((t) => t.key === key);
  return j >= 0 ? STAFF_TAGS.length + j : 99;
}

/* ---------- the quiet one ----------
   Verified is not a role: it is one circle next to a name, granted the same
   way and drawn the same way, but it says nothing about what somebody may do.
   Rows written when this site only had admins and mods keep their MOD chip —
   it is not offered any more, and it is not taken away by somebody editing an
   unrelated role either. */
export const VERIFIED = {
  key: "verified",
  name: "VERIFIED",
  note: "Marked as real. The circle next to their name.",
  color: "#8fb8ff",
  ink: "#061124",
};

const LEGACY: { key: string; name: string; note: string; color: string; ink: string; icon: RoleIcon }[] = [
  {
    key: "mod",
    name: "MOD",
    note: "Keeps the rooms civil. A role from before the list above.",
    color: "#9a8cff",
    ink: "#100c22",
    icon: "wrench",
  },
];

/** The chip for a role key, from the list, the legacy list, or verified. */
export function roleOf(role: string) {
  const key = role.toLowerCase();
  return STAFF_TAGS.find((t) => t.role === key) ?? LEGACY.find((t) => t.key === key) ?? null;
}

/** Every key the owner may hand out, in the order the control draws them. */
export const GRANTABLE: string[] = STAFF_TAGS.map((t) => t.role);

/** Owner plus anyone carrying a role. */
export function isStaffUser(user: string | null | undefined, roles: string[] = [], owner = false): boolean {
  if (owner || (user && user.toLowerCase() === "therealmrblob")) return true;
  return roles.length > 0;
}

/** The report reasons the flag button offers. */
export const REPORT_REASONS = [
  "Spam or advertising",
  "Harassment",
  "Inappropriate profile or image",
  "Impersonation",
  "Ban evasion",
  "Something else",
];

/* NULL · staff.ts
   What a role looks like, and who counts as staff.

   The owner's tag is its own thing and always has been — nothing on the shelf
   can produce it. The staff roles sit beside it: ADMIN and MOD, granted by the
   owner, carried on the member row, and checked server-side on every write
   that matters. */

export type Role = "admin" | "mod";

export const STAFF_TAGS: { role: Role; name: string; note: string; color: string; ink: string; glyph: string }[] = [
  { role: "admin", name: "ADMIN", note: "Runs the place with the owner.", color: "#ff6ec7", ink: "#1c0714", glyph: "🛠" },
  { role: "mod", name: "MOD", note: "Keeps the rooms civil.", color: "#9a8cff", ink: "#100c22", glyph: "🛠" },
];

export function roleOf(role: string) {
  return STAFF_TAGS.find((t) => t.role === role);
}

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

/* NULL · owner.ts
   One handle on NULL owns the place. The two strings that make it up are not
   written down here in the clear: the name is stored scrambled and the
   password is not stored at all, only a digest of it. Unscrambling is only a
   few lines of arithmetic, so this hides the credential from a casual read of
   the bundle — it does not secure it, and it is not pretending to.

   Being the owner is worth two things: every shelf item without paying, and
   a tag no shop item can buy. */

const MIX = 0x5d;

/** Unscramble one stored constant. The shift moves with the position, so the
 *  same letter twice in a row does not scramble the same way twice. */
function unseal(sealed: string): string {
  const bin = atob(sealed);
  let out = "";
  for (let i = 0; i < bin.length; i++) {
    out += String.fromCharCode(bin.charCodeAt(i) ^ ((MIX + i * 29) & 0xff));
  }
  return out;
}

/** The same idea as the account digest: a fast hash, not cryptography. It
 *  exists so the password itself is never in this file. */
function hash(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x1000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = (Math.imul(b + c, 33) ^ (b >>> 13)) >>> 0;
  }
  return `${a.toString(36)}-${b.toString(36)}`;
}

const HANDLE = unseal("CRLy5rSPZ2U3IBPz2w==");
const PASS = unseal("LQ322OGDJhk9Bgf6zqY=");

/** The owner's handle, in the casing it should read as on the site. */
export const OWNER = HANDLE;

/** The tag that only this account wears: no price, no lock, no way to buy it. */
export const OWNER_TAG = { name: "OWNER", note: "Not for sale, not for anyone else." };

export function isOwner(user: string | null | undefined): boolean {
  return !!user && user.toLowerCase() === HANDLE.toLowerCase();
}

/** Co-owners are granted by the shared member role, not by a second hidden
 * credential. This helper accepts the role list returned by Convex/profile
 * data and keeps shop entitlement checks consistent everywhere. */
export function isCoOwner(
  user: string | null | undefined,
  roles?: readonly string[] | null,
): boolean {
  if (isOwner(user)) return true;
  return !!roles?.some((role) => /^(co[-_ ]?owner|owner)$/i.test(role.trim()));
}

/** Does the typed password belong to the owner? */
export function isOwnerPass(pass: string): boolean {
  return hash(`null/v1/owner::${pass}`) === PASS;
}

/** True only for the owner's own name typed with the owner's own password. */
export function ownerCred(user: string, pass: string): boolean {
  return isOwner(user) && isOwnerPass(pass);
}

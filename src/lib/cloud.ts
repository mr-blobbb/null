/* NULL · cloud.ts
   The server NULL talks to, and the one id it needs to do it.

   Everything that used to end at this browser — the member list and the chat
   room — goes through here now. The rest of the site is unchanged and still
   works without a server at all. Shared community data never falls back to
   browser storage: a missing or unavailable deployment is reported as an
   outage so preview and published URLs cannot silently diverge.

   The address comes from `VITE_CONVEX_URL` when the build sets it, and from
   BACKEND when it does not, so a plain static deploy still finds the server.
   The client itself is built on first use, not on import: a module that opens
   a socket as a side effect is a module that can break a page it is not even
   on. */

import { ConvexReactClient } from "convex/react";

/** The deployment `convex dev` pushes to, for builds where no address was set.
 *
 *  It has to be this one: NULL's old deployment ran out of credits and was
 *  switched off by Convex, and against a switched-off deployment every query
 *  and every mutation fails with the same "usage limit" error — which reads
 *  on the site as if the chat were broken. This is the name the dev process
 *  prints when it deploys; keep the two in step. */
const BACKEND = "https://flexible-woodpecker-201.convex.cloud";

function findUrl(): string | null {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_CONVEX_URL ?? env.VITE_NULL_BACKEND ?? BACKEND ?? null;
}

export const cloudUrl = findUrl();

let client: ConvexReactClient | null = null;

/** The client, made once. Null when the build has no backend, which every
 *  caller is expected to survive. */
export function cloud(): ConvexReactClient | null {
  if (!cloudUrl) return null;
  if (!client) {
    try {
      client = new ConvexReactClient(cloudUrl);
    } catch {
      return null;
    }
  }
  return client;
}

export function cloudOn(): boolean {
  return cloud() !== null;
}

/* ---------- who this browser is ----------
   Not an identity anyone has to trust: it is a random string kept in the tab,
   used only so the chat can tell a message this machine sent from one that
   arrived while it was typing. */
export const machine = (() => {
  const key = "null:machine";
  try {
    const had = sessionStorage.getItem(key);
    if (had) return had;
  } catch {
    /* private mode: fall through to a value that lasts this page */
  }
  const made = Math.random().toString(36).slice(2, 12);
  try {
    sessionStorage.setItem(key, made);
  } catch {
    /* nothing to do — the value still works for this load */
  }
  return made;
})();

/* NULL · members.ts
   Who has joined NULL.

   Two layers, on purpose. The local one is what this browser knows: every
   account that has signed in here, which is what the page shows when there is
   no server to ask. The cloud one is the same card written to the deployment,
   which is what makes the list a directory of everybody rather than a diary
   of one machine.

   `publish` writes both, and is what the profile calls. It never throws: a
   browser with no network is a normal browser, and a member should not see an
   error because their card could not be filed.

   The owner is pinned to the top, because the owner is not a guest. */

import { createStore, useStore } from "./store";
import { isOwner } from "./owner";
import { cloud } from "./cloud";
import { api } from "../../convex/_generated/api";
import type { Account, NameStyle } from "./account";
import type { Econ } from "./econ";

export type Member = {
  user: string;
  name: string;
  bio: string;
  banner: string;
  pfp: string | null;
  joined: number;
  nameStyle: NameStyle;
  /** what they were wearing the last time this browser looked */
  wearing: { avatar: string | null; effect: string | null; tag: string | null };
  /** an id the rest of the site can render: the owner tag, or a shop tag */
  owner: boolean;
  coins: number;
  /** when this browser last saw them */
  seen: number;
};

export const members = createStore<{ list: Member[] }>("members", { list: [] });

export function useMembers(): Member[] {
  return useStore(members).list;
}

function cardOf(me: Account, eco: Econ): Member {
  return {
    user: me.user as string,
    name: me.name || (me.user as string),
    bio: me.bio,
    banner: me.banner,
    pfp: me.pfp,
    joined: me.joined || Date.now(),
    nameStyle: me.nameStyle,
    wearing: { ...eco.equipped },
    owner: isOwner(me.user),
    coins: eco.coins,
    seen: Date.now(),
  };
}

/** Nothing to say if the card on file is already this one. Keeping the write
 *  idempotent is what stops a signed-in page from re-rendering in a loop. */
function same(a: Member, b: Member): boolean {
  return (
    a.name === b.name &&
    a.bio === b.bio &&
    a.banner === b.banner &&
    a.pfp === b.pfp &&
    a.joined === b.joined &&
    a.owner === b.owner &&
    a.coins === b.coins &&
    a.nameStyle === b.nameStyle &&
    a.wearing.avatar === b.wearing.avatar &&
    a.wearing.effect === b.wearing.effect &&
    a.wearing.tag === b.wearing.tag
  );
}

/** Put the signed-in account in the local list, or bring its card up to date. */
export function remember(me: Account, eco: Econ) {
  if (!me.user) return;
  const card = cardOf(me, eco);
  const s = members.get();
  const mine = s.list.find((m) => m.user.toLowerCase() === card.user.toLowerCase());
  if (mine && same(mine, card)) return;
  const rest = s.list.filter((m) => m.user.toLowerCase() !== card.user.toLowerCase());
  members.set({ list: order([card, ...rest]) });
}

/** Remember it here *and* file it with the server, if there is one. */
export async function publish(me: Account, eco: Econ) {
  remember(me, eco);
  const c = cloud();
  if (!c || !me.user) return;
  const card = cardOf(me, eco);
  try {
    await c.mutation(api.members.put, {
      user: card.user,
      name: card.name,
      bio: card.bio,
      banner: card.banner,
      pfp: card.pfp,
      joined: card.joined,
      nameStyle: JSON.stringify(card.nameStyle ?? {}),
      avatar: card.wearing.avatar,
      effect: card.wearing.effect,
      tag: card.wearing.tag,
      coins: card.coins,
      owner: card.owner,
    });
  } catch {
    /* offline, or the deployment is having a day. The local card stands. */
  }
}

/** Take a card off every machine. Used when an account is deleted. */
export async function unpublish(user: string) {
  forget(user);
  const c = cloud();
  if (!c) return;
  try {
    await c.mutation(api.members.remove, { user });
  } catch {
    /* the local removal already happened */
  }
}

/** The owner first, then the longest-standing member, oldest join first. */
function order(list: Member[]): Member[] {
  return [...list].sort((a, b) => {
    if (a.owner !== b.owner) return a.owner ? -1 : 1;
    return a.joined - b.joined;
  });
}

export function forget(user: string) {
  const s = members.get();
  const list = s.list.filter((m) => m.user.toLowerCase() !== user.toLowerCase());
  if (list.length !== s.list.length) members.set({ list });
}

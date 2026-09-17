/* NULL · members.ts
   Who has joined NULL.

   There is no server, so this is not a directory of everyone on the internet:
   it is the accounts this browser has actually signed in, remembered as one
   card each. Signing in writes your card, editing your profile updates it,
   and the page built from this list says out loud which browser it is
   talking about rather than pretending to know more than it does.

   The owner is pinned to the top, because the owner is not a guest. */

import { createStore, useStore } from "./store";
import { isOwner } from "./owner";
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
    a.nameStyle === b.nameStyle &&
    a.wearing.avatar === b.wearing.avatar &&
    a.wearing.effect === b.wearing.effect &&
    a.wearing.tag === b.wearing.tag
  );
}

/** Put the signed-in account in the list, or bring its card up to date. */
export function remember(me: Account, eco: Econ) {
  if (!me.user) return;
  const card = cardOf(me, eco);
  const s = members.get();
  const mine = s.list.find((m) => m.user.toLowerCase() === card.user.toLowerCase());
  if (mine && same(mine, card)) return;
  const rest = s.list.filter((m) => m.user.toLowerCase() !== card.user.toLowerCase());
  members.set({ list: order([card, ...rest]) });
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

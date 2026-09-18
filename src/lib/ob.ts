/* NULL · ob.ts
   One substitution, and what it is for.

   Every printable ASCII character has a twin 19,936 code points above it:
   "a" is written as 一, "b" as 丁, and so on. The mapping is a straight
   offset, which means it is not encryption and does not pretend to be — it is
   a way to say something in a room where a machine is reading the page over
   your shoulder. A page monitor looking for words sees a page of Chinese;
   anybody in NULL who knows the map sees the sentence.

   That is the whole feature, and it needs to be asked for. Nothing here is on
   by default, nothing is applied to a message you did not turn it on for, and
   nothing is hidden from the person you are talking to: they see it, decoded,
   because they are reading the same site. What it changes is what the words
   look like to something that is not in the room.

   Use it, don't use it. Both are one click in the chat. */

import { createStore, useStore } from "./store";

/** The offset between a character and its twin. Taken from the map the site
 *  this feature is modelled on ships, which is a plain offset: 32 (space) is
 *  19968, 126 (~) is 20062. */
const OFFSET = 19936;
const LOW = 32 + OFFSET;
const HIGH = 126 + OFFSET;

export type ObPrefs = {
  /** obscure what I send */ send: boolean;
  /** what to do with what I receive: reveal it, leave it, or reveal on click */ read: "reveal" | "raw" | "ask";
};

export const ob = createStore<ObPrefs>("ob", { send: false, read: "ask" });

export function useOb(): ObPrefs {
  return useStore(ob);
}

/** Write it in twins. Spaces, tabs and newlines are left alone: they carry no
 *  words, and a message with no spaces in it looks like noise rather than
 *  like a sentence. Anything outside printable ASCII — emoji, accents, CJK —
 *  passes through untouched, because there is nothing above it to twin with. */
export function obscure(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 32 || code === 9 || code === 10 || code === 13) out += text[i];
    else if (code >= 32 && code <= 126) out += String.fromCharCode(code + OFFSET);
    else out += text[i];
  }
  return out;
}

/** Read it back. Anything that is not a twin passes through, so a message
 *  that was never obscured survives being read. */
export function reveal(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= LOW && code <= HIGH) out += String.fromCharCode(code - OFFSET);
    else out += text[i];
  }
  return out;
}

/** Is this line written in twins? A run of three is enough to be sure: three
 *  consecutive CJK ideographs in a chat message are not a coincidence, and a
 *  single one could be somebody's name. */
export function masked(text: string): boolean {
  let run = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= LOW && code <= HIGH) {
      run++;
      if (run >= 3) return true;
    } else if (code !== 32) {
      run = 0;
    }
  }
  return false;
}

/** What the reader asked for: the twins turned back into letters, or the
 *  glyphs left as they arrived. "ask" means the caller gets to decide (the
 *  chat reveals it and offers the raw line on a click). */
export function readAs(text: string): { body: string; hidden: boolean } {
  if (!masked(text)) return { body: text, hidden: false };
  const mode = ob.get().read;
  if (mode === "raw") return { body: text, hidden: true };
  return { body: reveal(text), hidden: true };
}

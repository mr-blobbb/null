/* NULL · filter.ts (client)
   The same screen the server runs, so the box can show you what a message
   will look like before you send it rather than surprising you afterwards.

   This copy is a courtesy. convex/filter.ts is the one that is enforced: a
   client can always be edited by whoever is running it, so nothing here is
   allowed to be the only thing standing between the room and a word.
   Keep the two files in step. */

const WORDS = [
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "cunt",
  "dick",
  "dipshit",
  "douche",
  "fag",
  "faggot",
  "fuck",
  "goddamn",
  "jackass",
  "motherfucker",
  "nigga",
  "nigger",
  "piss",
  "prick",
  "pussy",
  "retard",
  "shit",
  "slut",
  "twat",
  "wanker",
  "whore",
];

/** Whole words that contain a flagged string but are fine. */
const FINE = ["assassin", "class", "classic", "grass", "pass", "compass", "scunthorpe", "cocktail", "document"];

function unfold(s: string): string {
  return s
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/!/g, "i")
    .replace(/\|/g, "l");
}

function bare(s: string): string {
  return unfold(s)
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1");
}

function flagged(token: string): boolean {
  const plain = unfold(token).replace(/[^a-z]/g, "");
  if (!plain) return false;
  const squeezed = bare(token);
  return WORDS.some((w) => {
    const t = w.replace(/(.)\1+/g, "$1");
    return squeezed === t || plain === w;
  });
}

export type Verdict = { ok: boolean; clean: string; caught: string[] };

export function screen(raw: string): Verdict {
  const text = raw.slice(0, 500);
  const caught: string[] = [];

  const clean = text.replace(/[^\s]+/g, (token) => {
    const lower = unfold(token).replace(/[^a-z]/g, "");
    if (FINE.some((f) => lower.includes(f))) return token;
    if (!flagged(token)) return token;
    caught.push(token);
    return token[0] + "*".repeat(Math.max(2, token.length - 1));
  });

  return { ok: true, clean, caught };
}

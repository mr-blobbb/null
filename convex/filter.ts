/* NULL · filter.ts (server)
   The room's manners check.

   The trick with a filter is not the word list, it is not being stupid about
   it. People write `sh1t`, `shiiiit`, `s h i t` and `5h1t`, and a filter that
   only knows the plain spelling catches none of them; people also write
   "class", "grass" and "Scunthorpe", and a filter that matches substrings
   mangles all three. So: normalise the leetspeak and the padding first, then
   match whole words, then mask only the offending word and keep the rest of
   the sentence.

   src/lib/filter.ts is the same module for the client. Keep the two in step —
   the client copy is what draws the preview, this one is what is enforced. */

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

/** A short list of whole words that contain a flagged string but are fine.
 *  Checked against the *original* spelling, so "class" survives. */
const FINE = ["assassin", "class", "classic", "grass", "pass", "compass", "scunthorpe", "cocktail", "document"];

/** `5h1t` → `shit`. Only the substitutions people actually use. */
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

/** Letters only, repeats collapsed: `shiiiiiit` and `s.h-i_t` both land on
 *  `shit`, while `class` stays `clas` and is still not `ass`. */
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

export type Verdict = {
  /** false only when the message is nothing but abuse */
  ok: boolean;
  /** the message with the rude words starred out */
  clean: string;
  /** what was caught, for the little note under the box */
  caught: string[];
};

export function screen(raw: string): Verdict {
  const text = raw.slice(0, 500);
  const caught: string[] = [];

  const clean = text.replace(/[^\s]+/g, (token) => {
    const lower = unfold(token).replace(/[^a-z]/g, "");
    if (FINE.some((f) => lower.includes(f))) return token;
    if (!flagged(token)) return token;
    caught.push(token);
    /* keep the first letter so the sentence still reads, star the rest */
    return token[0] + "*".repeat(Math.max(2, token.length - 1));
  });

  return { ok: caught.length < 3 || clean.replace(/[*\s]/g, "").length > 0, clean, caught };
}

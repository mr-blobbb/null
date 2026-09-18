/* NULL · filter.ts (client)
   The same screen the server runs, so the box can show you what a message
   will look like before you send it rather than surprising you afterwards.

   This copy is a courtesy. convex/filter.ts is the one that is enforced: a
   client can always be edited by whoever is running it, so nothing here is
   allowed to be the only thing standing between the room and a word.
   Keep the two files in step — same folds, same list, same whole-word rule. */

const WORDS = [
  "anal", "anilingus", "areola", "arse", "arsehole", "asshole", "bastard", "bdsm",
  "bestiality", "bitch", "bollock", "boner", "boob", "bullshit", "bukkake", "chink",
  "clit", "cock", "cocksucker", "coon", "cum", "cumming", "cumshot", "cunnilingus",
  "cunt", "dago", "deepthroat", "dick", "dickhead", "dildo", "dipshit", "douche",
  "douchebag", "dyke", "ejaculate", "erection", "fag", "faggot", "fatass", "felch",
  "felching", "fellatio", "femdom", "fingering", "fisting", "foreskin", "fuck",
  "fucker", "fucking", "gangbang", "genitals", "goddamn", "gook", "handjob",
  "hentai", "hooker", "horny", "incest", "jackass", "jerkoff", "jizz", "kike",
  "kys", "labia", "masturbate", "masturbation", "milf", "motherfucker", "negro",
  "nigga", "niggle", "nigger", "nude", "nudes", "nudity", "orgasm", "orgy",
  "paedo", "pedophile", "penetration", "penis", "pimp", "porn", "porno",
  "pornography", "prick", "pube", "pubic", "pussy", "queef", "rape", "rapist",
  "retard", "retarded", "rimjob", "scrotum", "semen", "shag", "shit", "shitty",
  "skank", "slut", "smut", "spic", "tit", "tits", "titties", "tranny", "twat",
  "vagina", "vulva", "wank", "wanker", "wetback", "whore", "whores",
];

/** Whole words that contain a flagged string but are fine. */
const FINE = [
  "assassin", "assess", "asset", "bass", "class", "classic", "classify", "cockpit",
  "cocktail", "compass", "cass", "dickens", "document", "grass", "massachusetts",
  "pass", "password", "peacock", "scunthorpe", "shitsu", "sussex", "titan",
];

const HOMOGLYPH: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x",
  "і": "i", "ѕ": "s", "ј": "j", "һ": "h", "ӏ": "i",
  "α": "a", "β": "b", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
};

/** Every unicode alphabet people paste, folded onto a-z. Explicit code-point
 *  arithmetic rather than character classes, so nothing can end up out of
 *  order. */
function foldUnicode(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    /* fullwidth forms */
    if (c >= 0xff01 && c <= 0xff5e) {
      out += String.fromCharCode(c - 0xfee0);
      continue;
    }
    /* circled latin Ⓐ-Ⓩ and ⓐ-ⓩ */
    if (c >= 0x24b6 && c <= 0x24e9) {
      out += String.fromCharCode(((c - 0x24b6) % 26) + 97);
      continue;
    }
    /* squared latin 🄰-🅉 has no cheap fold: drop it */
    if (c >= 0x1f130 && c <= 0x1f149) continue;
    /* subscript digits */
    if (c >= 0x2080 && c <= 0x2089) {
      out += String.fromCharCode(c - 0x2080 + 48);
      continue;
    }
    out += HOMOGLYPH[ch.toLowerCase()] ?? ch;
  }
  return out;
}

function unfold(s: string): string {
  return s
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[1!]/g, "i")
    .replace(/3/g, "e")
    .replace(/[4^]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7+]/g, "t")
    .replace(/8/g, "b")
    .replace(/[69]/g, "g")
    .replace(/@/g, "a")
    .replace(/\|/g, "l");
}

function bare(s: string): string {
  return foldUnicode(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1");
}

function flagged(token: string): boolean {
  const plain = foldUnicode(unfold(token)).replace(/[^a-z]/g, "");
  if (!plain || plain.length < 2) return false;
  const squeezed = bare(token);
  return WORDS.some((w) => {
    const t = w.replace(/(.)\1+/g, "$1");
    return squeezed === t || plain === w;
  });
}

export type Verdict = { ok: boolean; clean: string; caught: string[] };

export function screen(raw: string, staff = false): Verdict {
  if (staff) return { ok: true, clean: raw.slice(0, 4000), caught: [] };

  const text = raw.slice(0, 2000);
  const caught: string[] = [];

  const clean = text.replace(/[^\s]+/g, (token) => {
    const folded = foldUnicode(unfold(token)).replace(/[^a-z]/g, "");
    if (FINE.some((f) => folded.includes(f))) return token;
    if (!flagged(token)) return token;
    caught.push(token);
    return token[0] + "*".repeat(Math.max(2, token.length - 1));
  });

  return { ok: caught.length < 4 || clean.replace(/[*\s]/g, "").length > 0, clean, caught };
}

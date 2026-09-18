/* NULL · filter.ts (server)
   The room's manners check, hardened hard.

   The trick with a filter is not the word list, it is not being stupid about
   it. People write `sh1t`, `shiiiit`, `s h i t` and `5h1t`, and a filter that
   only knows the plain spelling catches none of them; people also write
   "class", "grass" and "Scunthorpe", and a filter that matches substrings
   mangles all three.

   So the order of operations is: fold every alphabet into one (fullwidth
   unicode, cyrillic homoglyphs, circled letters), unfold the leetspeak, strip
   every mark that is not a letter, collapse repeats, THEN match whole words.
   Staff skip all of it by argument, not by trusting the client. */

/* The list. Sorted, lowercase, whole words only. */
const WORDS = [
  "anal",
  "anilingus",
  "areola",
  "arse",
  "arsehole",
  "asshole",
  "bastard",
  "bdsm",
  "bestiality",
  "bitch",
  "bollock",
  "boner",
  "boob",
  "bullshit",
  "bukkake",
  "chink",
  "clit",
  "cock",
  "cocksucker",
  "coon",
  "cum",
  "cumming",
  "cumshot",
  "cunnilingus",
  "cunt",
  "dago",
  "deepthroat",
  "dick",
  "dickhead",
  "dildo",
  "dipshit",
  "douche",
  "douchebag",
  "dyke",
  "ejaculate",
  "erection",
  "fag",
  "faggot",
  "fatass",
  "felch",
  "felching",
  "fellatio",
  "femdom",
  "fingering",
  "fisting",
  "foreskin",
  "fuck",
  "fucker",
  "fucking",
  "gangbang",
  "genitals",
  "goddamn",
  "gook",
  "handjob",
  "hentai",
  "hooker",
  "horny",
  "incest",
  "jackass",
  "jerkoff",
  "jizz",
  "kike",
  "kys",
  "labia",
  "masturbate",
  "masturbation",
  "milf",
  "motherfucker",
  "negro",
  "nigga",
  "niggle",
  "nigger",
  "nude",
  "nudes",
  "nudity",
  "orgasm",
  "orgy",
  "paedo",
  "pedophile",
  "penetration",
  "penis",
  "pimp",
  "porn",
  "porno",
  "pornography",
  "prick",
  "pube",
  "pubic",
  "pussy",
  "queef",
  "rape",
  "rapist",
  "retard",
  "retarded",
  "rimjob",
  "scrotum",
  "semen",
  "shag",
  "shit",
  "shitty",
  "skank",
  "slut",
  "smut",
  "spic",
  "tit",
  "tits",
  "titties",
  "tranny",
  "twat",
  "vagina",
  "vulva",
  "wank",
  "wanker",
  "wetback",
  "whore",
  "whores",
];

/** Whole words that contain a flagged string but are fine. Checked against the
 *  original spelling, so "class" survives and "Scunthorpe" survives. */
const FINE = [
  "assassin",
  "assess",
  "asset",
  "bass",
  "class",
  "classic",
  "classify",
  "cockpit",
  "cocktail",
  "compass",
  "cass",
  "dickens",
  "document",
  "grass",
  "massachusetts",
  "pass",
  "password",
  "peacock",
  "scunthorpe",
  "shitsu",
  "sussex",
  "titan",
];

/* ---------- the folds ---------- */

/** Cyrillic and greek letters that look like latin ones. Not exhaustive —
 *  exhaustive is a research project — but it covers what people actually
 *  type. */
const HOMOGLYPH: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x",
  "і": "i", "ѕ": "s", "ј": "j", "һ": "h", "ӏ": "i",
  "α": "a", "β": "b", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
};

/** Every unicode alphabet people paste, folded onto a-z. Ranges are written
 *  with explicit code points so no character class can end up out of order. */
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
    /* superscript digits */
    if (c >= 0x2070 && c <= 0x2079 && c !== 0x2071 && c !== 0x2074) {
      const sup = "\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079".indexOf(ch);
      if (sup >= 0) {
        out += String.fromCharCode(sup === 0 || sup === 4 ? c - 0x2070 + 48 : sup);
      }
      continue;
    }
    out += HOMOGLYPH[ch.toLowerCase()] ?? ch;
  }
  return out;
}

/** `5h1t` → `shit`. The substitutions people actually use, and the ones that
 *  are unambiguous. */
function unfold(s: string): string {
  return s
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1|!/g, "i")
    .replace(/3/g, "e")
    .replace(/4|\^/g, "a")
    .replace(/5|\$/g, "s")
    .replace(/7|\+/g, "t")
    .replace(/8/g, "b")
    .replace(/[69]/g, "g")
    .replace(/@/g, "a")
    .replace(/\|/g, "l");
}

/** Letters only, repeats collapsed: `shiiiiiit` and `s.h-i_t` both land on
 *  `shit`, while "class" stays "clas" and is still not "ass". */
function bare(s: string): string {
  return foldUnicode(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") /* accents off: fu\u0301ck is still fuck */
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

/** The check. `staff` skips everything, and the caller is expected to have
 *  proven that against the member row — the client cannot be trusted to say
 *  who it is. */
export function screen(raw: string, staff = false): Verdict {
  if (staff) return { ok: true, clean: raw.slice(0, 4000), caught: [] };

  const text = raw.slice(0, 2000);
  const caught: string[] = [];

  const clean = text.replace(/[^\s]+/g, (token) => {
    /* the fine list is read folded but not squeezed, so "Scunthorpe" is read
       the way it was typed */
    const folded = foldUnicode(unfold(token)).replace(/[^a-z]/g, "");
    if (FINE.some((f) => folded.includes(f))) return token;
    if (!flagged(token)) return token;
    caught.push(token);
    /* keep the first letter so the sentence still reads, star the rest */
    return token[0] + "*".repeat(Math.max(2, token.length - 1));
  });

  return { ok: caught.length < 4 || clean.replace(/[*\s]/g, "").length > 0, clean, caught };
}

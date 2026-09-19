/* NULL · packs.ts
   The custom emoji and the sticker packs.

   Custom emoji are the platform set, drawn from Twemoji — the same artwork
   on every machine, so a line that says 🙄 looks the same to everybody in
   the room, including the ones whose laptop has no glyph for it yet. The
   image for a character is worked out from its code points, which is why
   there is no table of file names here: `😐` becomes `1f610`, and the CDN
   has a picture at that name.

   Stickers are Giphy's, baked in as a fixed pack so the room has a shelf
   even before anybody touches the search button. The addresses are the
   stable `media.giphy.com/media/<id>/giphy.gif` form, which does not carry
   the signed, expiring paths the search API hands out.

   The colon menu treats both kinds the same: `:shrug:` becomes a small
   Twemoji image, `:st-wink:` becomes a sticker. Nothing here renders —
   the img elements live in md.tsx, the picker markup in components. */

/** The subset of the platform set NULL draws as Twemoji, in the order the
 *  picker shows them. Deliberately faces, hearts and hands: the things
 *  people actually put in a sentence. */
export const CUSTOM: string[] = [
  "😀", "😁", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🤩",
  "😘", "😗", "😚", "😋", "😛", "🤪", "😝", "🤗", "🤭", "🤫",
  "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬",
  "😮", "😯", "😴", "😌", "😔", "😪", "🤤", "😷", "🤒", "🤕",
  "🤢", "🤮", "🥵", "🥶", "😵", "🤯", "🤠", "🥳", "😎", "🤓",
  "🧐", "😕", "😟", "🙁", "😢", "😭", "😱", "😖", "😞", "😩",
  "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "💀", "💩", "🤡",
  "👻", "👽", "🤖", "😺", "😹", "😻", "🙈", "🙉", "🙊",
  "💌", "💘", "💝", "💖", "💗", "💓", "💞", "💕", "❤️", "💔",
  "❤️‍🔥", "❤️‍🩹", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍",
  "💯", "💢", "💥", "💫", "💦", "💨", "💬", "💭", "💤",
  "👋", "🤚", "✋", "🖖", "👌", "🤌", "✌️", "🤞", "🤟", "🤘",
  "👈", "👉", "👆", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛",
  "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "💪", "👀",
  "🫡", "🫰", "🫵", "🫱", "🫲",
  "🔥", "⭐", "🌟", "✨", "⚡", "🌈", "☀️", "🌙", "🌸", "🌹",
  "🌻", "🍀", "🎉", "🎈", "🎁", "🏆", "⚽", "🎮", "🎧",
];

/** Every character that has a Twemoji picture here, as one set. */
const CUSTOM_SET = new Set(CUSTOM);

/** Code points to a Twemoji file name. Twemoji's own rule: the variation
 *  selector is dropped, unless the sequence contains a zero-width joiner,
 *  in which case it stays — `❤️` is `2764`, `🏳️‍🌈` is
 *  `1f3f3-fe0f-200d-1f308`. */
export function codeOf(char: string): string {
  const cps = [...char].map((c) => c.codePointAt(0)!.toString(16));
  const kept = cps.includes("200d") ? cps : cps.filter((c) => c !== "fe0f");
  return kept.join("-");
}

/** The CDN picture for a character, or null when it is not in the pack. */
export function twemojiOf(char: string): string | null {
  if (!CUSTOM_SET.has(char)) return null;
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/${codeOf(char)}.png`;
}

/** The name a character is filed under, for the colon menu. */
const NAMES: Record<string, string> = {
  "😀": "grinning", "😁": "grin", "😂": "joy", "🤣": "rofl", "😊": "blush",
  "😇": "innocent", "🙂": "slight_smile", "😉": "wink", "😍": "heart_eyes",
  "🤩": "star_struck", "😘": "kissing_heart", "😋": "yum", "😛": "tongue",
  "🤪": "zany", "😝": "tongue2", "🤗": "hugs", "🤭": "hand_over_mouth",
  "🤫": "shush", "🤔": "thinking", "😐": "neutral", "😏": "smirk",
  "😒": "unamused", "🙄": "roll_eyes", "😬": "grimacing", "😮": "open_mouth",
  "😴": "sleeping", "😌": "relieved", "😔": "pensive", "😪": "sleepy",
  "🤤": "drooling", "😷": "mask", "🤢": "nauseated", "🥵": "hot",
  "🥶": "cold", "🤯": "exploding_head", "🥳": "partying", "😎": "sunglasses",
  "🧐": "monocle", "😢": "cry", "😭": "sob", "😱": "scream", "😤": "triumph",
  "😡": "rage", "😠": "angry", "💀": "skull", "🤡": "clown", "👻": "ghost",
  "👽": "alien", "🤖": "robot", "😻": "heart_eyes_cat", "🙈": "see_no_evil",
  "❤️": "heart", "💔": "broken_heart", "❤️‍🔥": "heart_on_fire",
  "❤️‍🩹": "mending_heart", "🧡": "orange_heart", "💛": "yellow_heart",
  "💚": "green_heart", "💙": "blue_heart", "💜": "purple_heart",
  "🖤": "black_heart", "🤍": "white_heart", "💯": "hundred", "💥": "boom",
  "💫": "dizzy", "💦": "sweat_drops", "💬": "speech_balloon", "💤": "zzz",
  "👋": "wave", "👌": "ok_hand", "✌️": "v", "🤞": "crossed_fingers",
  "🤟": "love_you", "🤘": "metal", "👍": "thumbsup", "👎": "thumbsdown",
  "👏": "clap", "🙌": "raised_hands", "🫶": "heart_hands", "🤝": "handshake",
  "🙏": "pray", "💪": "muscle", "👀": "eyes", "🫡": "salute",
  "🔥": "fire", "⭐": "star", "🌟": "star2", "✨": "sparkles", "⚡": "zap",
  "🌈": "rainbow", "🌙": "crescent_moon", "🌸": "cherry_blossom",
  "🌹": "rose", "🌻": "sunflower", "🍀": "four_leaf_clover",
  "🎉": "tada", "🎈": "balloon", "🎁": "gift", "🏆": "trophy",
  "⚽": "soccer", "🎮": "video_game", "🎧": "headphones",
};

/** Names only exist for the characters that have one; the rest are picked,
 *  not typed. */
export function packName(char: string): string | null {
  return NAMES[char] ?? null;
}

export function packOf(name: string): string | null {
  const clean = name.toLowerCase();
  for (const [char, n] of Object.entries(NAMES)) {
    if (n === clean) return char;
  }
  return null;
}

/* ---------- the stickers ---------- */

export type Sticker = { id: string; name: string; url: string };

/** The shelf the picker opens on. Twelve, each sent at full size when it is
 *  picked — a sticker is the message, not a decoration on one. */
export const STICKERS: Sticker[] = [
  { id: "xoeckM9QlcSv54MKNT", name: "goodnight", url: "https://media.giphy.com/media/xoeckM9QlcSv54MKNT/giphy.gif" },
  { id: "zh8xwt9WI58iHYZNaI", name: "birthday", url: "https://media.giphy.com/media/zh8xwt9WI58iHYZNaI/giphy.gif" },
  { id: "llnF08VBtgDxEPFmAx", name: "love-flowers", url: "https://media.giphy.com/media/llnF08VBtgDxEPFmAx/giphy.gif" },
  { id: "ZCJAFAZB1E0OJbQBM9", name: "love-you", url: "https://media.giphy.com/media/ZCJAFAZB1E0OJbQBM9/giphy.gif" },
  { id: "lHTJgttLitH3BKpEXr", name: "sad-hamster", url: "https://media.giphy.com/media/lHTJgttLitH3BKpEXr/giphy.gif" },
  { id: "MUSZ60uDoHK2R0IQRM", name: "sweet-dreams", url: "https://media.giphy.com/media/MUSZ60uDoHK2R0IQRM/giphy.gif" },
  { id: "l4FGt71ZpSCcdIs0w", name: "laughing", url: "https://media.giphy.com/media/l4FGt71ZpSCcdIs0w/giphy.gif" },
  { id: "nUnPpFrQn24o0", name: "celebrate", url: "https://media.giphy.com/media/nUnPpFrQn24o0/giphy.gif" },
  { id: "3oKIPwZVHEiM2B3ljq", name: "happy", url: "https://media.giphy.com/media/3oKIPwZVHEiM2B3ljq/giphy.gif" },
  { id: "2418IjTJ5LPn7mObx8", name: "tired", url: "https://media.giphy.com/media/2418IjTJ5LPn7mObx8/giphy.gif" },
  { id: "iyGqsXjNfCfx1p2ldm", name: "sad", url: "https://media.giphy.com/media/iyGqsXjNfCfx1p2ldm/giphy.gif" },
  { id: "TRz9P6y7ZHT7CQJP5p", name: "wow", url: "https://media.giphy.com/media/TRz9P6y7ZHT7CQJP5p/giphy.gif" },
  { id: "bb8xkGjkw8XhcPt1Hc", name: "wide-eyed", url: "https://media.giphy.com/media/bb8xkGjkw8XhcPt1Hc/giphy.gif" },
  { id: "w78ifyfLK7q8308f0k", name: "love-3d", url: "https://media.giphy.com/media/w78ifyfLK7q8308f0k/giphy.gif" },
];

/** `:st-wink:` -> the sticker. Nothing else answers to that shape, so a
 *  sticker can never collide with an emoji name. */
export function stickerOf(name: string): Sticker | null {
  const clean = name.toLowerCase();
  if (!clean.startsWith("st-")) return null;
  const want = clean.slice(3);
  return STICKERS.find((s) => s.name === want) ?? null;
}

/** What `:wi` offers from this file: emoji names first, then stickers, then
 *  the plain words that have no name and are still worth showing. */
export function suggestPacks(prefix: string, limit = 6): { token: string; label: string }[] {
  const q = prefix.toLowerCase();
  const out: { token: string; label: string }[] = [];
  for (const [char, name] of Object.entries(NAMES)) {
    if (name.startsWith(q)) out.push({ token: name, label: char });
    if (out.length >= limit) return out;
  }
  for (const s of STICKERS) {
    if (s.name.startsWith(q)) out.push({ token: `st-${s.name}`, label: "🖼️" });
    if (out.length >= limit) return out;
  }
  return out;
}

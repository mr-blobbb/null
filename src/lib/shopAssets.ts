/* NULL · shopAssets.ts
   The non-tag shelf. The art is part of the site: three folders under
   public/decor/shop, next to the clips the older effects are drawn from.

   It used to be fetched from raw.githubusercontent at runtime, which was
   wrong twice: a school filter that blocks that host took every card's
   picture with it, and the shop stopped being part of the site. The files
   ship with the build now, so the shop works on the same connection that
   loaded the page. Nothing is fetched from anywhere to draw a shelf.

   The three folders, and why each has the shape it has:

   · shop/pfp — a face decoration, 288px square, animated. Drawn over the
     round picture, which is why it is transparent in the middle.
   · shop/pfp-still — the same art as a 144px resting frame, for the places a
     room full of motion would be unreadable (chat, the member rail).
   · shop/fx — a profile effect, 450×880, a transparent overlay for a whole
     card. Every piece on the shelf is that size, which is the whole reason a
     share card and a chat card can take the art's own shape and have it land
     on the rim.

   All of them are animated PNGs — a gif that kept its alpha and its edges,
   which is why one file is 288px and still a megabyte. The name says .png and
   the acTL chunk in the header says otherwise; anything that measures one as a
   still picture is right about the first frame and wrong about every frame
   after it. They are served as they are: no build step re-encodes them, so
   nothing has to be regenerated when one is added to the folder. */

/* ---------- measured from the files rather than guessed at ----------
   A card can only be sized to fit an overlay if the overlay's shape is
   known. */
export const FACE_ART = 288;
export const FACE_STILL_ART = 144;
export const CARD_ART = { w: 450, h: 880 };

/** One piece of art, by the folder it lives in and the name it was shipped
 *  under. public/ is served from the site root and every route is a hash on
 *  the same document, so a relative path lands on the file in dev, on a
 *  preview host and on GitHub Pages alike — the same rule the decor clips in
 *  src/lib/art.tsx use. */
function art(dir: string, file: string): string {
  return `decor/shop/${dir}/${file}.png`;
}

export type AvatarAsset = {
  id: string;
  name: string;
  desc: string;
  price: number;
  moving: string;
  still: string;
};

export type EffectAsset = {
  id: string;
  name: string;
  desc: string;
  price: number;
  url: string;
};

type Seed = [file: string, name: string, desc: string, price: number];

const AVATAR_SEEDS: Seed[] = [
  ["airforce", "Air Force", "A clean flight frame around your picture.", 880],
  ["angelwings", "Angel Wings", "Soft wings opening behind your face.", 1040],
  ["aurora", "Aurora", "Colour drifting around the edge of your picture.", 1260],
  ["catearsblack", "Black Cat Ears", "Two unmistakable ears for the frame.", 760],
  ["chomp", "Chomp", "A playful bite around the picture.", 920],
  ["cloudnine", "Cloud Nine", "A little sky following your face.", 1120],
  ["cometsdusk", "Comet's Dusk", "A dusk-coloured trail circling the frame.", 1340],
  ["deepseadreams", "Deep Sea Dreams", "A deep-water glow around your picture.", 1480],
  ["dragon", "Dragon", "A dragon frame with a little heat.", 1560],
  ["flames", "Flames", "Fire climbing around the outside edge.", 1420],
  ["foxtail", "Fox Tail", "A bright tail curling around the frame.", 980],
  ["hallelujamountains", "Hallelujah Mountains", "Mountain light behind your picture.", 1500],
  ["loading", "Loading", "Still loading. Probably on purpose.", 640],
  ["lonewolf", "Lone Wolf", "A lone silhouette at the edge of the frame.", 1180],
  ["moon", "Moon", "A quiet moon orbiting your picture.", 900],
  ["orbital", "Orbital", "A small orbit with a wide reach.", 1280],
  ["petals", "Petals", "Petals moving gently around your face.", 1060],
  ["purplering", "Purple Ring", "A violet ring locked to the rim.", 1020],
  ["purplesparkles", "Purple Sparkles", "Purple sparks around the picture.", 1140],
  ["sakuraink", "Sakura Ink", "Ink and blossoms across the frame.", 1360],
  ["skillissue", "Skill Issue", "A tiny frame with a loud opinion.", 720],
  ["spacetravel", "Space Travel", "A space trail passing behind your face.", 1460],
  ["surprised", "Surprised", "A reaction frame that says it all.", 820],
  ["sweatdrops", "Sweat Drops", "A few nervous drops at the edge.", 780],
  ["sweetdreams", "Sweet Dreams", "A sleepy glow for your picture.", 1080],
  ["swirl", "Swirl", "A soft swirl that never stays still.", 1160],
  ["whiteroses", "White Roses", "White roses blooming around the rim.", 1520],
];

export const AVATAR_ASSETS: AvatarAsset[] = AVATAR_SEEDS.map(([file, name, desc, price]) => ({
  id: `pfp-${file}`,
  name,
  desc,
  price,
  moving: art("pfp", file),
  still: art("pfp-still", file),
}));

const EFFECT_SEEDS: Seed[] = [
  ["alwayswatching", "Always Watching", "Eyes across the whole card.", 1680],
  ["bonsaieternity", "Bonsai Eternity", "A small tree with a very long life.", 1460],
  ["celestial", "Celestial", "A full-card sky of quiet light.", 1780],
  ["comet", "Comet", "A comet crossing the entire card.", 1320],
  ["doves", "Doves", "Doves passing over your profile.", 1540],
  ["duck", "Duck", "One duck, absolutely everywhere.", 980],
  ["fog", "Fog", "Low fog rolling across the card.", 1240],
  ["glitch", "Glitch", "The card is not broken. Probably.", 1600],
  ["hallelujamountains", "Hallelujah Mountains", "A mountain scene behind everything.", 1720],
  ["hellokitty", "Hello Kitty", "A bright full-card character overlay.", 1380],
  ["leaves", "Leaves", "Leaves crossing the whole profile.", 1160],
  ["lonewolf", "Lone Wolf", "A lone wolf in the background.", 1500],
  ["mists", "Mists", "Mists gathering behind your details.", 1280],
  ["pinkflowers", "Pink Flowers", "Flowers covering the card in bloom.", 1420],
  ["purplemists", "Purple Mists", "A violet haze from edge to edge.", 1560],
  ["samurai", "Samurai", "A full-card warrior silhouette.", 1840],
  ["starstruck", "Starstruck", "Stars over every part of the card.", 1740],
  ["unlimitedvoid", "Unlimited Void", "A deep void behind the profile.", 2100],
  ["whiteroses", "White Roses", "White roses across the whole card.", 1660],
];

export const EFFECT_ASSETS: EffectAsset[] = EFFECT_SEEDS.map(([file, name, desc, price]) => ({
  id: `fx-${file}`,
  name,
  desc,
  price,
  url: art("fx", file),
}));

const avatars = new Map(AVATAR_ASSETS.map((asset) => [asset.id, asset]));
const effectsById = new Map(EFFECT_ASSETS.map((asset) => [asset.id, asset]));

export function avatarAsset(id: string | null | undefined): AvatarAsset | undefined {
  return id ? avatars.get(id) : undefined;
}

export function effectAsset(id: string | null | undefined): EffectAsset | undefined {
  return id ? effectsById.get(id) : undefined;
}

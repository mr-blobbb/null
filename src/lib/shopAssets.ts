/* NULL · shopAssets.ts
   The non-tag shelf comes from cherriunblocked/svg. The repository keeps a
   moving transparent avatar frame beside a small still frame, and its profile
   effects are full-card transparent overlays. Keeping the URLs in one place
   makes the shop and every card renderer use the same asset pair.
*/

const ROOT = "https://raw.githubusercontent.com/cherriunblocked/svg/main/elements";

function repo(dir: string, file: string): string {
  return `${ROOT}/${dir}/${file}`;
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
  moving: repo("pfpdeco", `${file}.png`),
  still: repo("pfpdeco-still", `${file}.png`),
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
  url: repo("profiledeco", `${file}.png`),
}));

const avatars = new Map(AVATAR_ASSETS.map((asset) => [asset.id, asset]));
const effects = new Map(EFFECT_ASSETS.map((asset) => [asset.id, asset]));

export function avatarAsset(id: string | null | undefined): AvatarAsset | undefined {
  return id ? avatars.get(id) : undefined;
}

export function effectAsset(id: string | null | undefined): EffectAsset | undefined {
  return id ? effects.get(id) : undefined;
}

/* NULL · emoji.ts
   The two questions the site asks about emojis.

   The picker asks for *everything, grouped* — see emoji-set.ts, which is the
   glyphs and nothing else. The composer asks a different thing: somebody is
   typing `:sk` and wants 💀. So this file carries the names, which are the
   same ones people already type in every other app (`:fire:`, `:sob:`,
   `:thumbsup:`), and a small recent list so the five somebody actually uses
   are one click away instead of five.

   Nothing here renders. The picker's markup lives in components/EmojiPicker. */

import { createStore, useStore } from "./store";
import { GROUPS } from "./emoji-set";

export { GROUPS };
export type { EmojiGroup } from "./emoji-set";

/* The reaction bar's own list, in the order it is drawn. Short enough to read
   across in one glance, which is the whole point of a reaction bar. */
export const REACTIONS = [
  "👍", "👎", "❤️", "🔥", "🎉", "💯", "😂", "🤣", "💀", "😮",
  "🤔", "👀", "🤯", "😢", "😭", "🙏", "🥀", "✅", "❌",
];

/* ---------- names ----------
   Only emojis somebody might type get a name. A full table of every alias
   every platform ever used is a data dump, not a feature: what matters is
   that the obvious word finds the obvious glyph. */
const NAMES: Record<string, string> = {
  smile: "😄", grin: "😁", joy: "😂", rofl: "🤣", laughing: "😆",
  sweat_smile: "😅", slight_smile: "🙂", upside_down: "🙃", wink: "😉",
  blush: "😊", innocent: "😇", heart_eyes: "😍", star_struck: "🤩",
  kissing_heart: "😘", yum: "😋", stuck_out_tongue: "😛", zany: "🤪",
  money_mouth: "🤑", hugs: "🤗", shush: "🤫", thinking: "🤔",
  salute: "🫡", zipper_mouth: "🤐", neutral: "😐", expressionless: "😑",
  no_mouth: "😶", smirk: "😏", unamused: "😒", roll_eyes: "🙄",
  grimacing: "😬", lying: "🤥", relieved: "😌", pensive: "😔",
  sleepy: "😪", drooling: "🤤", sleeping: "😴", mask: "😷",
  thermometer: "🤒", nauseated: "🤢", vomiting: "🤮", sneezing: "🤧",
  hot: "🥵", cold: "🥶", woozy: "🥴", dizzy: "😵",
  exploding_head: "🤯", cowboy: "🤠", partying: "🥳", sunglasses: "😎",
  nerd: "🤓", monocle: "🧐", confused: "😕", worried: "😟",
  slightly_frowning: "🙁", frowning: "☹️", open_mouth: "😮",
  hushed: "😯", astonished: "😲", flushed: "😳", pleading: "🥺",
  holding_back_tears: "🥹", frowning2: "😦", anguished: "😧",
  fearful: "😨", cold_sweat: "😰", disappointed_relieved: "😥",
  cry: "😢", sob: "😭", scream: "😱", confounded: "😖",
  persevere: "😣", disappointed: "😞", sweat: "😓", weary: "😩",
  tired_face: "😫", yawn: "🥱", triumph: "😤", rage: "😡",
  angry: "😠", cursing: "🤬", smiling_imp: "😈", imp: "👿",
  skull: "💀", skull_crossbones: "☠️", poop: "💩", hankey: "💩",
  clown: "🤡", ogre: "👹", goblin: "👺", ghost: "👻", alien: "👽",
  space_invader: "👾", robot: "🤖", smiley_cat: "😺", smile_cat: "😸",
  joy_cat: "😹", heart_eyes_cat: "😻", smirk_cat: "😼",
  kiss_cat: "😽", scream_cat: "🙀", crying_cat: "😿", pouting_cat: "😾",
  see_no_evil: "🙈", hear_no_evil: "🙉", speak_no_evil: "🙊",
  kiss: "💋", love_letter: "💌", cupid: "💘", gift_heart: "💝",
  sparkling_heart: "💖", heartpulse: "💗", heartbeat: "💓",
  revolving_hearts: "💞", two_hearts: "💕", heart_decoration: "💟",
  broken_heart: "💔", heart_on_fire: "❤️‍🔥", mending_heart: "❤️‍🩹",
  heart: "❤️", orange_heart: "🧡", yellow_heart: "💛",
  green_heart: "💚", blue_heart: "💙", purple_heart: "💜",
  brown_heart: "🤎", black_heart: "🖤", white_heart: "🤍",
  pink_heart: "🩷", anger: "💢", boom: "💥", dizzy_symbol: "💫",
  sweat_drops: "💦", dash: "💨", hole: "🕳️", speech_balloon: "💬",
  thought_balloon: "💭", zzz: "💤",
  wave: "👋", raised_back_of_hand: "🤚", raised_hand: "✋",
  vulcan: "🖖", ok_hand: "👌", pinched_fingers: "🤌",
  pinching_hand: "🤏", v: "✌️", crossed_fingers: "🤞",
  love_you_gesture: "🤟", metal: "🤘", call_me: "🤙",
  point_left: "👈", point_right: "👉", point_up_2: "👆",
  middle_finger: "🖕", point_down: "👇", point_up: "☝️",
  thumbsup: "👍", "+1": "👍", thumbsdown: "👎", "-1": "👎",
  fist: "✊", punch: "👊", fist_left: "🤛", fist_right: "🤜",
  clap: "👏", raised_hands: "🙌", heart_hands: "🫶",
  open_hands: "👐", palms_up_together: "🤲", handshake: "🤝",
  pray: "🙏", writing_hand: "✍️", nail_care: "💅", selfie: "🤳",
  muscle: "💪", ear: "👂", nose: "👃", brain: "🧠", eyes: "👀",
  eye: "👁️", tongue: "👅", lips: "👄", baby: "👶", child: "🧒",
  boy: "👦", girl: "👧", adult: "🧑", man: "👨", woman: "👩",
  older_adult: "🧓", older_man: "👴", older_woman: "👵",
  bow: "🙇", facepalm: "🤦", shrug: "🤷", cop: "👮",
  detective: "🕵️", guard: "💂", ninja: "🥷", construction_worker: "👷",
  prince: "🤴", princess: "👸", angel: "👼", santa: "🎅",
  superheros: "🦸", supervillain: "🦹", mage: "🧙", fairy: "🧚",
  vampire: "🧛", mermaid: "🧜", elf: "🧝", genie: "🧞", zombie: "🧟",
  massage: "💆", haircut: "💇", walking: "🚶", standing: "🧍",
  kneeling: "🧎", runner: "🏃", dancer: "💃", man_dancing: "🕺",
  dog: "🐶", cat: "🐱", mouse: "🐭", hamster: "🐹", rabbit: "🐰",
  fox: "🦊", bear: "🐻", panda: "🐼", koala: "🐨", tiger: "🐯",
  lion: "🦁", cow: "🐮", pig: "🐷", frog: "🐸", monkey: "🐵",
  chicken: "🐔", penguin: "🐧", bird: "🐦", eagle: "🦅", duck: "🦆",
  swan: "🦢", owl: "🦉", flamingo: "🦩", peacock: "🦚", parrot: "🦜",
  dove: "🕊️", raccoon: "🦝", otter: "🦦", sloth: "🦥", mouse2: "🐁",
  hedgehog: "🦔", paw_prints: "🐾", dragon: "🐉", crocodile: "🐊",
  turtle: "🐢", snake: "🐍", lizard: "🦎", sauropod: "🦕",
  t_rex: "🦖", whale: "🐳", dolphin: "🐬", seal: "🦭", fish: "🐟",
  tropical_fish: "🐠", blowfish: "🐡", shark: "🦈", octopus: "🐙",
  shell: "🐚", coral: "🪸", snail: "🐌", butterfly: "🦋", bug: "🐛",
  ant: "🐜", bee: "🐝", lady_beetle: "🐞", cricket: "🦗",
  spider: "🕷️", scorpion: "🦂", mosquito: "🦟", microbe: "🦠",
  cactus: "🌵", palm_tree: "🌴", evergreen: "🌲", deciduous_tree: "🌳",
  seedling: "🌱", herb: "🌿", shamrock: "☘️", four_leaf_clover: "🍀",
  bamboo: "🎍", tanabata_tree: "🎋", leaves: "🍃", fallen_leaf: "🍂",
  maple_leaf: "🍁", mushroom: "🍄", ear_of_rice: "🌾", bouquet: "💐",
  tulip: "🌷", rose: "🌹", wilted_flower: "🥀", hibiscus: "🌺",
  cherry_blossom: "🌸", blossom: "🌼", sunflower: "🌻", sun_with_face: "🌞",
  full_moon: "🌕", new_moon: "🌑", crescent_moon: "🌙", earth: "🌎",
  ringed_planet: "🪐", star: "⭐", star2: "🌟", sparkles: "✨",
  zap: "⚡", comet: "☄️", fire: "🔥", tornado: "🌪️", rainbow: "🌈",
  sunny: "☀️", partly_sunny: "⛅", cloud: "☁️", cloud_rain: "🌧️",
  thunder_cloud_rain: "⛈️", cloud_snow: "🌨️", snowflake: "❄️",
  snowman2: "☃️", snowman: "⛄", wind_blowing_face: "🌬️",
  droplet: "💧", umbrella: "☔", ocean: "🌊", fog: "🌫️",
  green_apple: "🍏", apple: "🍎", pear: "🍐", tangerine: "🍊",
  lemon: "🍋", banana: "🍌", watermelon: "🍉", grapes: "🍇",
  strawberry: "🍓", blueberries: "🫐", melon: "🍈", cherries: "🍒",
  peach: "🍑", mango: "🥭", pineapple: "🍍", coconut: "🥥",
  kiwi: "🥝", tomato: "🍅", avocado: "🥑", broccoli: "🥦",
  cucumber: "🥒", hot_pepper: "🌶️", corn: "🌽", carrot: "🥕",
  garlic: "🧄", onion: "🧅", potato: "🥔", croissant: "🥐",
  bagel: "🥯", bread: "🍞", cheese: "🧀", egg: "🥚",
  pancakes: "🥞", waffle: "🧇", bacon: "🥓", cut_of_meat: "🥩",
  poultry_leg: "🍗", meat_on_bone: "🍖", hotdog: "🌭", hamburger: "🍔",
  fries: "🍟", pizza: "🍕", sandwich: "🥪", stuffed_flatbread: "🥙",
  falafel: "🧆", taco: "🌮", burrito: "🌯", salad: "🥗",
  spaghetti: "🍝", ramen: "🍜", stew: "🍲", curry: "🍛",
  sushi: "🍣", bento: "🍱", dumpling: "🥟", fried_shrimp: "🍤",
  rice_ball: "🍙", rice: "🍚", fortune_cookie: "🥠",
  ice_cream: "🍨", icecream: "🍦", pie: "🥧", cupcake: "🧁",
  cake: "🍰", birthday: "🎂", candy: "🍬", chocolate_bar: "🍫",
  popcorn: "🍿", doughnut: "🍩", cookie: "🍪", chestnut: "🌰",
  peanuts: "🥜", honey: "🍯", milk: "🥛", baby_bottle: "🍼",
  coffee: "☕", tea: "🍵", cup_with_straw: "🥤", bubble_tea: "🧋",
  sake: "🍶", beer: "🍺", beers: "🍻", clinking_glasses: "🥂",
  wine_glass: "🍷", tumbler_glass: "🥃", cocktail: "🍸",
  tropical_drink: "🍹", champagne: "🍾", ice_cube: "🧊",
  spoon: "🥄", fork_and_knife: "🍴", chopsticks: "🥢", salt: "🧂",
  car: "🚗", taxi: "🚕", blue_car: "🚙", bus: "🚌", trolleybus: "🚎",
  race_car: "🏎️", police_car: "🚓", ambulance: "🚑",
  fire_engine: "🚒", minibus: "🚐", truck: "🚚", tractor: "🚜",
  bicycle: "🚲", motor_scooter: "🛵", motorcycle: "🏍️",
  oncoming_police_car: "🚔", steam_locomotive: "🚂", train: "🚆",
  metro: "🚇", station: "🚉", airplane: "✈️", airplane_small: "🛩️",
  seat: "💺", satellite_orbital: "🛰️", rocket: "🚀", flying_saucer: "🛸",
  helicopter: "🚁", canoe: "🛶", sailboat: "⛵", speedboat: "🚤",
  cruise_ship: "🛳️", ferry: "⛴️", ship: "🚢", anchor: "⚓",
  fuelpump: "⛽", construction: "🚧", vertical_traffic_light: "🚦",
  traffic_light: "🚥", map: "🗺️", moyai: "🗿", statue_of_liberty: "🗽",
  tokyo_tower: "🗼", castle: "🏰", japanese_castle: "🏯",
  stadium: "🏟️", ferris_wheel: "🎡", roller_coaster: "🎢",
  carousel_horse: "🎠", fountain: "⛲", beach_umbrella: "⛱️",
  beach: "🏖️", desert_island: "🏝️", desert: "🏜️", volcano: "🌋",
  mountain: "⛰️", mountain_snow: "🏔️", mount_fuji: "🗻",
  camping: "🏕️", tent: "⛺", house: "🏠", house_with_garden: "🏡",
  houses: "🏘️", derelict_house: "🏚️", office: "🏢",
  department_store: "🏬", post_office: "🏣", hospital: "🏥",
  bank: "🏦", hotel: "🏨", convenience_store: "🏪", school: "🏫",
  love_hotel: "🏩", wedding: "💒", classical_building: "🏛️",
  church: "⛪", mosque: "🕌", synagogue: "🕍", kaaba: "🕋",
  shinto_shrine: "⛩️", railway_track: "🛤️", motorway: "🛣️",
  japan: "🗾", rice_scene: "🎑", national_park: "🏞️",
  sunrise: "🌅", sunrise_over_mountains: "🌄", shooting_star: "🌠",
  sparkler: "🎇", fireworks: "🎆", city_sunset: "🌇",
  city_dusk: "🌆", cityscape: "🏙️", night_with_stars: "🌃",
  milky_way: "🌌", bridge_at_night: "🌉", foggy: "🌁",
  watch: "⌚", mobile_phone: "📱", iphone: "📱", computer: "💻",
  keyboard: "⌨️", desktop: "🖥️", printer: "🖨️", mouse_three_button: "🖱️",
  joystick: "🕹️", floppy_disk: "💾", cd: "💿", dvd: "📀",
  vhs: "📼", camera: "📷", camera_with_flash: "📸",
  video_camera: "📹", movie_camera: "🎥", film_projector: "📽️",
  film_frames: "🎞️", telephone: "☎️", telephone_receiver: "📞",
  pager: "📟", fax: "📠", tv: "📺", radio: "📻",
  microphone: "🎙️", level_slider: "🎚️", control_knobs: "🎛️",
  compass: "🧭", stopwatch: "⏱️", timer_clock: "⏲️",
  alarm_clock: "⏰", mantelpiece_clock: "🕰️", hourglass: "⌛",
  hourglass_flowing_sand: "⏳", satellite: "📡", battery: "🔋",
  electric_plug: "🔌", bulb: "💡", flashlight: "🔦", candle: "🕯️",
  fire_extinguisher: "🧯", oil: "🛢️", money_with_wings: "💸",
  dollar: "💵", yen: "💴", euro: "💶", pound: "💷",
  moneybag: "💰", coin: "🪙", credit_card: "💳", receipt: "🧾",
  gem: "💎", scales: "⚖️", toolbox: "🧰", screwdriver: "🪛",
  wrench: "🔧", hammer: "🔨", hammer_and_pick: "⚒️",
  hammer_and_wrench: "🛠️", pick: "⛏️", nut_and_bolt: "🔩",
  gear: "⚙️", bricks: "🧱", chains: "⛓️", magnet: "🧲",
  gun: "🔫", bomb: "💣", firecracker: "🧨", axe: "🪓", knife: "🔪",
  dagger: "🗡️", crossed_swords: "⚔️", shield: "🛡️",
  smoking: "🚬", coffin: "⚰️", headstone: "🪦", amphora: "🏺",
  crystal_ball: "🔮", prayer_beads: "📿", nazar_amulet: "🧿",
  barber: "💈", alembic: "⚗️", telescope: "🔭", microscope: "🔬",
  adhesive_bandage: "🩹", stethoscope: "🩺", pill: "💊",
  syringe: "💉", drop_of_blood: "🩸", dna: "🧬", petri_dish: "🧫",
  test_tube: "🧪", thermometer2: "🌡️", broom: "🧹", basket: "🧺",
  toilet: "🚽", potable_water: "🚰", shower: "🚿", bathtub: "🛁",
  soap: "🧼", toothbrush: "🪥", razor: "🪒", sponge: "🧽",
  bucket: "🪣", lotion_bottle: "🧴", bellhop_bell: "🛎️", key: "🔑",
  key2: "🗝️", door: "🚪", chair: "🪑", couch: "🛋️", bed: "🛏️",
  frame_photo: "🖼️", mirror: "🪞", window: "🪟", shopping: "🛍️",
  shopping_cart: "🛒", gift: "🎁", balloon: "🎈", flags: "🎏",
  ribbon: "🎀", magic_wand: "🪄", pinata: "🪅", confetti_ball: "🎊",
  tada: "🎉", dolls: "🎎", lantern: "🏮", wind_chime: "🎐",
  red_envelope: "🧧", envelope: "✉️", envelope_with_arrow: "📩",
  incoming_envelope: "📨", e_mail: "📧", love_letter2: "💌",
  mailbox: "📫", mailbox_closed: "📪", mailbox_with_mail: "📬",
  mailbox_with_no_mail: "📭", postbox: "📮", postal_horn: "📯",
  scroll: "📜", page_with_curl: "📃", page_facing_up: "📄",
  bookmark_tabs: "📑", bar_chart: "📊", chart_with_upwards_trend: "📈",
  chart_with_downwards_trend: "📉", memo: "📝", date: "📅",
  calendar: "📆", wastebasket: "🗑️", card_index: "📇",
  card_file_box: "🗃️", ballot_box: "🗳️", file_cabinet: "🗄️",
  clipboard: "📋", file_folder: "📁", open_file_folder: "📂",
  card_index_dividers: "🗂️", newspaper: "📰", notebook: "📓",
  notebook_with_decorative_cover: "📔", ledger: "📒", closed_book: "📕",
  green_book: "📗", blue_book: "📘", orange_book: "📙",
  books: "📚", book: "📖", bookmark: "🔖", paperclip: "📎",
  paperclips: "🖇️", triangular_ruler: "📐", straight_ruler: "📏",
  abacus: "🧮", pushpin: "📌", round_pushpin: "📍", scissors: "✂️",
  lower_left_ballpoint_pen: "🖊️", lower_left_fountain_pen: "🖋️",
  lower_left_paintbrush: "🖌️", crayon: "🖍️", pencil2: "✏️",
  mag: "🔍", mag_right: "🔎",
  mute: "🔇", speaker: "🔈", sound: "🔉", loud_sound: "🔊",
  mega: "📣", loudspeaker: "📢", bell: "🔔", no_bell: "🔕",
  musical_note: "🎵", notes: "🎶", chart: "💹", recycle: "♻️",
  white_check_mark: "✅", ballot_box_with_check: "☑️", heavy_check_mark: "✔️",
  x: "❌", negative_squared_cross_mark: "❎", heavy_plus_sign: "➕",
  heavy_minus_sign: "➖", heavy_division_sign: "➗",
  heavy_multiplication_x: "✖️", infinity: "♾️", heavy_dollar_sign: "💲",
  currency_exchange: "💱", tm: "™️", copyright: "©️",
  registered: "®️", wavy_dash: "〰️", curly_loop: "➰", loop: "➿",
  end: "🔚", back: "🔙", on: "🔛", top: "🔝", soon: "🔜",
  arrows_clockwise: "🔃", arrows_counterclockwise: "🔄",
  fast_forward: "⏩", rewind: "⏪", arrow_up: "⬆️",
  arrow_lower_right: "↘️", arrow_right: "➡️", arrow_down: "⬇️",
  arrow_upper_left: "↖️", arrow_up_down: "↕️", left_right_arrow: "↔️",
  arrow_right_hook: "↪️", arrow_heading_up: "⤴️",
  arrow_heading_down: "⤵️", twisted_rightwards_arrows: "🔀",
  repeat: "🔁", repeat_one: "🔂", arrow_forward: "▶️",
  pause_button: "⏸️", stop_button: "⏹️", record_button: "⏺️",
  eject: "⏏️", cinema: "🎦", low_brightness: "🔅",
  high_brightness: "🔆", signal_strength: "📶", ok: "🆗",
  new: "🆕", up: "🆙", cool: "🆒", free: "🆓",
  zero: "0️⃣", one: "1️⃣", two: "2️⃣", three: "3️⃣", four: "4️⃣",
  five: "5️⃣", six: "6️⃣", seven: "7️⃣", eight: "8️⃣", nine: "9️⃣",
  keycap_ten: "🔟", hash: "#️⃣", asterisk: "*️⃣", id: "🆔",
  wheelchair: "♿", no_smoking: "🚭", do_not_litter: "🚯",
  no_bicycles: "🚳", non_potable_water: "🚱", no_pedestrians: "🚷",
  mobile_phone_off: "📵", underage: "🔞", radioactive: "☢️",
  biohazard: "☣️", warning: "⚠️", children_crossing: "🚸",
  no_entry: "⛔", name_badge: "📛", beginner: "🔰", trident: "🔱",
  fleur_de_lis: "⚜️", eight_spoked_asterisk: "✳️", eight_pointed_black_star: "✴️",
  sparkle: "❇️", vs: "🆚", a: "🅰️", b: "🅱️", ab: "🆎", cl: "🆑",
  o2: "🅾️", sos: "🆘", question: "❓", grey_question: "❔",
  exclamation: "❗", grey_exclamation: "❕", bangbang: "‼️",
  interrobang: "⁉️", part_alternation_mark: "〽️", mens: "🚹",
  womens: "🚺", restroom: "🚻", potable_water2: "🚰", atm: "🏧",
  put_litter_in_its_place: "🚮", black_heart2: "🖤", red_circle: "🔴",
  orange_circle: "🟠", yellow_circle: "🟡", green_circle: "🟢",
  blue_circle: "🔵", purple_circle: "🟣", brown_circle: "🟤",
  black_circle: "⚫", white_circle: "⚪", red_square: "🟥",
  orange_square: "🟧", yellow_square: "🟨", green_square: "🟩",
  blue_square: "🟦", purple_square: "🟪", brown_square: "🟫",
  black_large_square: "⬛", white_large_square: "⬜",
  black_small_square: "▪️", white_small_square: "▫️",
  red_triangle_pointed_up: "🔼", red_triangle_pointed_down: "🔽",
  diamond_shape_with_a_dot_inside: "💠", small_orange_diamond: "🔸",
  small_blue_diamond: "🔹", large_orange_diamond: "🔶",
  large_blue_diamond: "🔷", eight_rayed_star: "🔸",
  checkered_flag: "🏁", triangular_flag_on_post: "🚩",
  crossed_flags: "🎌", pirate_flag: "🏴‍☠️",
  flag_black: "🏴", flag_white: "🏳️", rainbow_flag: "🏳️‍🌈",
  england: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", flag_us: "🇺🇸", flag_gb: "🇬🇧",
  flag_ca: "🇨🇦", flag_au: "🇦🇺", flag_jp: "🇯🇵", flag_kr: "🇰🇷",
  flag_cn: "🇨🇳", flag_in: "🇮🇳", flag_br: "🇧🇷", flag_de: "🇩🇪",
  flag_fr: "🇫🇷", flag_es: "🇪🇸", flag_it: "🇮🇹", flag_mx: "🇲🇽",
  flag_nl: "🇳🇱", flag_se: "🇸🇪", flag_no: "🇳🇴", flag_pl: "🇵🇱",
  flag_ru: "🇷🇺", flag_ua: "🇺🇦", flag_tr: "🇹🇷", flag_za: "🇿🇦",
  flag_eu: "🇪🇺", flag_un: "🇺🇳",
};

/** The glyph for a name, or null when nobody has used that word. */
export function emojiOf(name: string): string | null {
  return NAMES[name.trim().toLowerCase().replace(/^:|:$/g, "")] ?? null;
}

/** The name a glyph was filed under, when there is one. Used for tooltips. */
export function nameOf(emoji: string): string | null {
  for (const [name, e] of Object.entries(NAMES)) {
    if (e === emoji) return name;
  }
  return null;
}

/** What `:sk` should offer: names that *start* with the letters first, since
    that is what somebody is halfway through typing, then names that merely
    contain them. */
export function suggest(prefix: string, limit = 8): { name: string; e: string }[] {
  const q = prefix.trim().toLowerCase().replace(/^:/, "");
  if (!q) return [];
  /* Shortest first, then alphabetical. The plain name is always shorter than
     its own variants — `fire` before `fire_extinguisher`, `skull` before
     `skull_crossbones` — which is the order somebody wants, and it beats
     writing down a hand-kept list of favourites that goes stale. */
  const names = Object.keys(NAMES).sort((a, b) => a.length - b.length || a.localeCompare(b));
  const starts = names.filter((n) => n.startsWith(q));
  const has = names.filter((n) => !n.startsWith(q) && n.includes(q));
  return [...starts, ...has]
    .slice(0, limit)
    .map((name) => ({ name, e: NAMES[name] }));
}

/** Names that match a search box, for the picker and the pad. */
export function named(q: string, limit = 48): string[] {
  return suggest(q, limit).map((s) => s.e);
}

/* ---------- the last few somebody used ----------
   The picker opens on these. Not a feature anybody asks for and every picker
   has one, because the alternative is scrolling to the same emoji daily. */

const recents = createStore<{ list: string[] }>("emojis", { list: [] });

export function useRecentEmoji(): string[] {
  return useStore(recents).list;
}

export function noteEmoji(emoji: string) {
  const list = recents.get().list;
  recents.set({ list: [emoji, ...list.filter((e) => e !== emoji)].slice(0, 24) });
}

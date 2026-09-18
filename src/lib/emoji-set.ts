/* NULL · emoji-set.ts
   The glyphs, and nothing else. Data lives apart from the code that reads it
   so the picker's logic stays short enough to follow, and so this file can be
   extended by pasting more emojis onto the end of a line.

   Each group is one space-separated string. Emojis carry variation selectors
   and zero-width joiners, which is why they are written out rather than
   generated: a "faces" loop would have to invent skin tones and families, and
   nobody asked for that. */

export type EmojiGroup = {
  id: string;
  /** what the tab says */
  name: string;
  /** the glyph on the tab. Its own emoji, so the tabs read at a glance. */
  glyph: string;
  list: string[];
};

const group = (id: string, name: string, glyph: string, raw: string): EmojiGroup => ({
  id,
  name,
  glyph,
  list: raw.trim().split(/\s+/),
});

export const GROUPS: EmojiGroup[] = [
  group(
    "smileys",
    "Smileys",
    "😀",
    `😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 🫠 😉 😊 😇 🥰 😍 🤩 😘 😗
     ☺️ 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🫣 🤫 🤔 🫡 🤐 🤨
     😐 😑 😶 🫥 😏 😒 🙄 😬 🫨 😮 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕
     🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 🫤 😟 🙁 ☹️
     😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩
     😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 👾 🤖
     😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊 💋 💌 💘 💝 💖 💗 💓
     💞 💕 💟 ❣️ 💔 ❤️‍🔥 ❤️‍🩹 ❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🩶 🤎
     🖤 🩸 💯 💢 💥 💫 💦 💨 🕳️ 💬 💭 🗯️ 💤`
  ),
  group(
    "people",
    "People",
    "👋",
    `👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙
     👈 👉 👆 🖕 👇 ☝️ 🫵 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝
     🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️
     👅 👄 🫦 👶 🧒 👦 👧 🧑 👱 👨 🧔 👨‍🦰 👨‍🦱 👨‍🦳 👨‍🦲 👩
     👩‍🦰 🧑‍🦰 👱‍♀️ 👱‍♂️ 🧔‍♂️ 🧔‍♀️ 👨‍🦳 👩‍🦳 👨‍🦲 👩‍🦲
     🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 🧑‍⚕️ 🧑‍🎓 🧑‍🏫
     🧑‍⚖️ 🧑‍🌾 🧑‍🍳 🧑‍🔧 🧑‍🏭 🧑‍💼 🧑‍🔬 🧑‍💻 🧑‍🎤 🧑‍🎨
     🧑‍✈️ 🧑‍🚀 🧑‍🚒 👮 🕵️ 💂 🥷 👷 🫅 🤴 👸 👳 👲 🧕 🤵 👰
     🤰 🫃 🤱 👩‍🍼 👨‍🍼 🧑‍🍼 👼 🎅 🤶 🧑‍🎄 🦸 🦹 🧙 🧚 🧛
     🧜 🧝 🧞 🧟 💆 💇 🚶 🧍 🧎 🏃 💃 🕺 🕴️ 👯 🧖 🧗 🤺 🏇
     ⛷️ 🏂 🏌️ 🏄 🏊 🤽 🚣 🧘 🛀 🛌 👭 👫 👬 💏 💑 👪`
  ),
  group(
    "nature",
    "Nature",
    "🐶",
    `🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🙈
     🙉 🙊 🐒 🐔 🐧 🐦 🐤 🐣 🦅 🦆 🦢 🦉 🦤 🪶 🦩 🦚 🦜 🐦‍⬛
     🕊️ 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿️ 🦔 🐾 🐉 🐲 🐊 🐢 🐍
     🦎 🦖 🦕 🐳 🐋 🐬 🦭 🐟 🐠 🐡 🦈 🐙 🐚 🪸 🐌 🦋 🐛 🐜
     🐝 🪲 🐞 🦗 🕷️ 🕸️ 🦂 🦟 🪰 🪱 🦠 🐢 🌵 🎄 🌲 🌳 🌴 🪴
     🌱 🌿 ☘️ 🍀 🎍 🎋 🍃 🍂 🍁 🍄 🐚 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼
     🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌙 🌎 🌍 🌏
     🪐 💫 ⭐ 🌟 ✨ ⚡ ☄️ 💥 🔥 🌪️ 🌈 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️
     ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 💧 💦 ☔ ☂️ 🌊 🌫️`
  ),
  group(
    "food",
    "Food",
    "🍕",
    `🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅
     🍆 🥑 🥦 🥬 🥒 🌶️ 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖
     🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🫓 🥪 🥙
     🧆 🌮 🌯 🫔 🥗 🥘 🫕 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙
     🍚 🍘 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿
     🍩 🍪 🌰 🥜 🍯 🥛 🍼 ☕ 🫖 🍵 🧃 🥤 🧋 🍶 🍺 🍻 🥂 🍷
     🥃 🍸 🍹 🧉 🍾 🧊 🥄 🍴 🍽️ 🥢 🧂`
  ),
  group(
    "travel",
    "Travel",
    "🚀",
    `🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🦯 🦽 🦼 🛴
     🚲 🛵 🏍️ 🛺 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅
     🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤
     🛥️ 🛳️ ⛴️ 🚢 ⚓ ⛽ 🚧 🚦 🚥 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢
     🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🏠 🏡 🏘️ 🏚️ 🏗️
     🏭 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 🛕 🕋
     ⛩️ 🛤️ 🛣️ 🗾 🎑 🏞️ 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙️ 🌃 🌌 🌉 🌁`
  ),
  group(
    "objects",
    "Objects",
    "💡",
    `⌚ 📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 🕹️ 🗜️ 💽 💾 💿 📀 📼 📷
     📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ 🧭 ⏱️ ⏲️
     ⏰ 🕰️ ⌛ ⏳ 📡 🔋 🪫 🔌 💡 🔦 🕯️ 🪔 🧯 🛢️ 💸 💵 💴 💶
     💷 💰 🪙 💳 🧾 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪝 🔩 ⚙️
     🧱 ⛓️ 🧲 🔫 💣 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🪦 🏺 🔮 📿
     🧿 💈 ⚗️ 🔭 🔬 🕳️ 🩹 🩺 🩻 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡️ 🧹
     🧺 🧻 🚽 🚰 🚿 🛁 🛀 🧼 🪥 🪒 🧽 🪣 🧴 🛎️ 🔑 🗝️ 🚪
     🪑 🛋️ 🛏️ 🖼️ 🪞 🪟 🛍️ 🛒 🎁 🎈 🎏 🎀 🪄 🪅 🎊 🎉 🎎
     🏮 🎐 🧧 ✉️ 📩 📨 📧 💌 📥 📤 📦 🏷️ 📪 📫 📬 📭 📮 📯
     📜 📃 📄 📑 🧾 📊 📈 📉 🗒️ 🗓️ 📆 📅 🗑️ 📇 🗃️ 🗳️ 🗄️
     📋 📁 📂 🗂️ 🗞️ 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🧷 🔗
     📎 🖇️ 📐 📏 🧮 📌 📍 ✂️ 🖊️ 🖋️ ✒️ 🖌️ 🖍️ 📝 ✏️ 🔍 🔎`
  ),
  group(
    "flags",
    "Flags",
    "🏁",
    `🏁 🚩 🎌 🏴 🏳️ 🏴‍☠️ 🇦🇺 🇧🇷 🇨🇦 🇨🇳 🇩🇪 🇪🇸 🇫🇷 🇬🇧 🇮🇳 🇮🇹
     🇯🇵 🇰🇷 🇲🇽 🇳🇱 🇵🇱 🇷🇺 🇸🇪 🇹🇷 🇺🇦 🇺🇸 🇿🇦 🇪🇺 🇺🇳`
  ),
  group(
    "symbols",
    "Symbols",
    "❗",
    `❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝
     💟 ♥️ ♦️ ♣️ ♠️ 🔇 🔈 🔉 🔊 📢 📣 📯 🔔 🔕 🎵 🎶 💹
     ♻️ ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ 🟰 ♾️ 💲 💱 ™️ ©️ ®️ 〰️
     ➰ ➿ 🔚 🔙 🔛 🔝 🔜 🔃 🔄 🔙 ⏩ ⏪ ⏫ ⏬ ⏭️ ⏮️ ⏯️ 🔀 🔁
     🔂 ▶️ ⏸️ ⏹️ ⏺️ ⏏️ 🎦 🔅 🔆 📶 🆗 🆕 🆙 🆒 🆓 0️⃣ 1️⃣
     2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔢 #️⃣ *️⃣ ⏏️ ⚕️ ⚛️
     ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏
     ♐ ♑ ♒ ♓ 🆔 ⚕️ ♿ 🚭 🚳 🚫 🚷 📵 🔞 ☢️ ☣️ ⚠️ 🚸 ⛔ 🚧
     ❗ ❕ ❓ ❔ ‼️ ⁉️ 💯 🔅 🔆 〽️ ⚜️ 🔱 📛 🔰 ♻️ ✳️ ❇️
     ✴️ 🆚 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ⛔ 📛 🚫 🏧 🚮 🚰 ♻️ 🚹 🚺
     ⬆️ ↗️ ➡️ ↘️ ⬇️ ↙️ ⬅️ ↖️ ↕️ ↔️ ↩️ ↪️ ⤴️ ⤵️ 🔃 🔄
     🔙 🔚 🔛 🔜 🔝 🔀 🔁 🔂 ▶️ ⏭️ ⏯️ ⏮️ ⏸️ ⏹️ ⏺️ ⏏️`
  ),
];

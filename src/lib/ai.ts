/* NULL · ai.ts
   The assistant's second road: the same question, asked from this browser.

   `convex/ai.ts` is the road that should be used, and it is the one that is
   asked first. It keeps the key on the deployment, where no visitor can read
   it. This file exists for the builds where no key is set there yet, so the
   assistant still answers instead of showing a setup card — the key below
   ships with the bundle, scrambled, and comes back together at call time.

   Scrambling is not security: anyone determined can read it out of the
   bundle. It is the same thing owner.ts does, for the same reason — it keeps
   the credential out of a casual look at the source. Set OPENROUTER_API_KEY
   on the deployment (`npx convex env set OPENROUTER_API_KEY …`) and this road
   stops being used at all. */

const MIX = 0x6b;

/** Unscramble one stored constant. The shift moves with the position, so the
 *  same letter twice in a row does not scramble the same way twice. */
function unseal(sealed: string): string {
  const bin = atob(sealed);
  let out = "";
  for (let i = 0; i < bin.length; i++) {
    out += String.fromCharCode(bin.charCodeAt(i) ^ ((MIX + i * 29) & 0xff));
  }
  return out;
}

/* stored in two pieces so neither half looks like anything */
const KEY = unseal("GOOIra3Rbwd+FbmbpoU2" + "KVphF6TL9NwxR3NkG6fV5YhvTiNWSv3d48NyGC9S4cPYus92VnlYvJH02Mx5UzJH6MmuhGMqDzoS8A==");

const MODEL = "openai/gpt-4o-mini";
const URL = "https://openrouter.ai/api/v1/chat/completions";

/** Short, because a long prompt is a bill. Same words as the server's. */
const SYSTEM = `You are Null Bot, the assistant built into NULL — a small, dark, flat browser-app hub for games, apps, music and proxied websites.

How to answer:
- Be short. Two or three sentences unless asked for detail. Nobody came here for an essay.
- Plain words, no corporate padding, no "As an AI language model".
- NULL's own pages are: home (null://home), games, apps, chat, movies (aether.cx in the browser), music (searches Audius, plays full tracks), shop (coins earned by time on site), members, richest, profile, changelog, extensions, settings. Say so if asked where something is.
- If you do not know, say you do not know. Do not invent pages or features.`;

export type Said = { role: "user" | "assistant"; content: string };
export type Answer = { ok: true; text: string; provider: string } | { ok: false; reason: string };

/** Is there a key in this build at all? Always true today, but the page asks
 *  rather than assumes, so removing the key is one edit and not a hunt. */
export function builtInReady(): boolean {
  return KEY.length > 20;
}

/** The model name this road runs on, for the line under the title. */
export const BUILT_IN_MODEL = MODEL;

export async function askModel(history: Said[]): Promise<Answer> {
  if (!builtInReady()) return { ok: false, reason: "This build has no key of its own." };

  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${KEY}`,
        "content-type": "application/json",
        "HTTP-Referer": location.origin,
        "X-Title": "null",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        messages: [
          { role: "system", content: SYSTEM },
          ...history.slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
        ],
      }),
    });
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, reason: body.error?.message ?? `OpenRouter answered ${res.status}.` };
    }
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, reason: "The model answered with nothing." };
    return { ok: true, text, provider: "OpenRouter" };
  } catch (e) {
    return { ok: false, reason: `OpenRouter could not be reached (${(e as Error).message}).` };
  }
}

/* NULL · ai.ts (server)
   The assistant page's half that a browser cannot do.

   An LLM key must not ship to a client, and every one of these endpoints
   sends no CORS headers anyway, so the browser asks this action and this
   action asks the model. Whichever key the deployment has is the one used,
   in this order: Groq, OpenRouter, OpenAI, Anthropic, Google.

   Two things worth being plain about. There is no key in the box by default —
   open the AI page with none set and it says so, with the two commands that
   fix it. And nothing here is authenticated: the action is public, so anyone
   who finds the deployment can spend your tokens. NULL has no accounts on the
   server to gate it with. Set a budget on the key. */

"use node";

/* the Node runtime: this reads the deployment's environment variables */

import { action } from "./_generated/server";
import { v } from "convex/values";

type Msg = { role: "user" | "assistant"; content: string };

/** What the assistant is told it is. Short, because a long prompt is a bill. */
const SYSTEM = `You are Null Bot, the assistant built into NULL — a small, dark, flat browser-app hub for games, apps, music and proxied websites.

How to answer:
- Be short. Two or three sentences unless asked for detail. Nobody came here for an essay.
- Plain words, no corporate padding, no "As an AI language model".
- NULL's own pages are: home (null://home), games, apps, chat (rooms with threads, and a bot that answers $ commands), movies (aether.cx in the browser), music (searches Audius, plays full tracks), shop (coins earned by time on site), members, richest, profile, changelog, extensions, settings. Say so if asked where something is.
- If you do not know, say you do not know. Do not invent pages or features.`;

type Wire = {
  name: string;
  env: string;
  url: string;
  model: string;
  shape: "openai" | "anthropic" | "gemini";
};

/* Order is preference, not a claim about quality: the first is the one with a
   free tier you can actually get today. */
const PROVIDERS: Wire[] = [
  {
    name: "Groq",
    env: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    shape: "openai",
  },
  {
    name: "OpenRouter",
    env: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "openai/gpt-4o-mini",
    shape: "openai",
  },
  {
    name: "OpenAI",
    env: "OPENAI_API_KEY",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    shape: "openai",
  },
  {
    name: "Anthropic",
    env: "ANTHROPIC_API_KEY",
    url: "https://api.anthropic.com/v1/messages",
    model: "claude-sonnet-4-20250514",
    shape: "anthropic",
  },
  {
    name: "Google",
    env: "GOOGLE_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    model: "gemini-2.0-flash",
    shape: "gemini",
  },
];

function pick(): { wire: Wire; key: string } | null {
  for (const w of PROVIDERS) {
    const key = process.env[w.env];
    if (key && key.trim()) return { wire: w, key: key.trim() };
  }
  return null;
}

/** The model can be overridden without touching this file. */
function modelOf(w: Wire): string {
  return w.shape === "openai" ? process.env.AI_MODEL || w.model : w.model;
}

/* A "use node" file may only hold actions, which is why asking about the key
   is an action and not the query it naturally wants to be. The page runs it
   once on mount, which is the only time the answer can change anyway. */
export const status = action({
  args: {},
  handler: async () => {
    const got = pick();
    return { ready: !!got, provider: got?.wire.name ?? null };
  },
});

export const ask = action({
  args: {
    messages: v.array(v.object({ role: v.string(), content: v.string() })),
  },
  handler: async (_ctx, args) => {
    const got = pick();
    if (!got) {
      return {
        ok: false as const,
        reason:
          "No model key is set on the deployment. Run `npx convex env set GROQ_API_KEY <key>` (a free Groq key works) and the assistant comes up.",
      };
    }

    /* the client's history, trimmed: last dozen turns and no message longer
       than a few thousand characters, because a runaway prompt is a bill */
    const history: Msg[] = args.messages
      .slice(-12)
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: String(m.content).slice(0, 4000),
      }))
      .filter((m) => m.content.trim());

    try {
      return await call(got.wire, got.key, history);
    } catch (e) {
      return { ok: false as const, reason: `${got.wire.name} could not answer (${(e as Error).message}).` };
    }
  },
});

async function call(
  w: Wire,
  key: string,
  history: Msg[],
): Promise<{ ok: true; text: string; provider: string } | { ok: false; reason: string }> {
  const model = modelOf(w);

  if (w.shape === "openai") {
    const res = await fetch(w.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        messages: [{ role: "system", content: SYSTEM }, ...history],
      }),
    });
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, reason: body.error?.message ?? `${w.name} answered ${res.status}` };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, reason: `${w.name} answered with nothing.` };
    return { ok: true, text, provider: w.name };
  }

  if (w.shape === "anthropic") {
    const res = await fetch(w.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: 700, system: SYSTEM, messages: history }),
    });
    const body = (await res.json()) as {
      content?: { text?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) return { ok: false, reason: body.error?.message ?? `${w.name} answered ${res.status}` };
    const text = body.content?.map((c) => c.text ?? "").join("").trim();
    if (!text) return { ok: false, reason: `${w.name} answered with nothing.` };
    return { ok: true, text, provider: w.name };
  }

  /* Gemini: its own shape, and its key rides in the query string */
  const res = await fetch(
    `${w.url}/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: history.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 700 },
      }),
    },
  );
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!res.ok) return { ok: false, reason: body.error?.message ?? `${w.name} answered ${res.status}` };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) return { ok: false, reason: `${w.name} answered with nothing.` };
  return { ok: true, text, provider: w.name };
}

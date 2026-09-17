/* The assistant's own road: the key this build carries is real, and the call
   it makes is real. One short question, because a test that costs nothing
   tests nothing. */

import { expect, test } from "bun:test";

(globalThis as unknown as { location: unknown }).location = { origin: "https://null.example" };

const { askModel, builtInReady, BUILT_IN_MODEL } = await import("./src/lib/ai");

test("the build carries a key", () => {
  expect(builtInReady()).toBe(true);
  expect(BUILT_IN_MODEL.startsWith("openai/")).toBe(true);
});

test("the carried key answers", async () => {
  const said = await askModel([{ role: "user", content: "Reply with the single word: ok" }]);
  if (!said.ok) console.log("reason:", said.reason);
  expect(said.ok).toBe(true);
  if (said.ok) {
    expect(said.text.length).toBeGreaterThan(0);
    expect(said.provider).toBe("OpenRouter");
  }
}, 30_000);

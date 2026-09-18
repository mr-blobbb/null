/* What a page says when the server is the problem rather than the code.

   Convex answers a spent usage limit by throwing from every query, and an
   uncaught throw is a blank screen. Two decisions keep that from happening:
   Guard turns the throw into a card, and outage.ts decides whether the card
   blames the server or the page. Only the second one can be tested without a
   DOM, and it is the one that can lie to a visitor — so it is the one tested
   hardest here. */

import { expect, test } from "bun:test";

import { markOutage, outageOn } from "./src/lib/outage";
import { Guard } from "./src/components/Guard";

/* the exact text a disabled deployment answers with */
const DISABLED =
  "This deployment has been disabled because it exceeded a configured usage limit. " +
  "Update or disable the usage limit in the Convex dashboard in deployment settings " +
  "to resume function execution.";

test("a spent usage limit reads as the server being down", () => {
  expect(markOutage(new Error(DISABLED))).toBe(true);
  expect(outageOn()).toBe(true);
});

test("other server shapes read the same way", () => {
  expect(markOutage(new Error("Failed to fetch"))).toBe(true);
  expect(markOutage(new Error("[CONVEX M(chat:send)] Server Error"))).toBe(false);
});

test("a page bug is not blamed on the server", () => {
  /* a plain bug must keep the generic card, or the site tells visitors to
     wait for credits every time something in a component breaks */
  expect(markOutage(new Error("k.toLowerCase is not a function"))).toBe(false);
  expect(markOutage(null)).toBe(false);
  expect(markOutage("")).toBe(false);
  /* once marked, it stays marked — the reason it is a module flag and not
     per-page state is so the whole site agrees about one outage */
  expect(outageOn()).toBe(true);
});

test("Guard keeps the throw in state instead of letting it out", () => {
  const state = Guard.getDerivedStateFromError(new Error(DISABLED));
  expect(state.broke).toBeInstanceOf(Error);
  expect(state.broke?.message).toContain("usage limit");

  const odd = Guard.getDerivedStateFromError("just a string");
  expect(odd.broke?.message).toBe("just a string");
});

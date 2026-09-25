/* The backendless shape: which doors need a server, and which list of them a
   visitor is offered when there is not one.

   Two separate ideas live here and only one of them is a preference. The
   switch is what somebody asked for; the outage is what a dead deployment
   does to the site on its own. Both have to take the same doors off the rail,
   because a chat room nobody can reach is worse than no chat room. */

import { expect, test } from "bun:test";

import { CLOUD_PAGES, doors, needsCloud, RAIL_BOTTOM, RAIL_TOP } from "./src/lib/nav";
import { clearOutage, markOutage, outageOn, serverlessNow, setBackendless } from "./src/lib/outage";
import { prefs } from "./src/lib/themes";

const DISABLED = "This deployment has been disabled because it exceeded a configured usage limit.";

test("the three doors that need a server are the three that say so", () => {
  expect(needsCloud("chat")).toBe(true);
  expect(needsCloud("users")).toBe(true);
  expect(needsCloud("rich")).toBe(true);
  /* the rest of the site is this machine, and losing a deployment must not
     take a page that never spoke to one with it */
  expect(needsCloud("games")).toBe(false);
  expect(needsCloud("shop")).toBe(false);
  expect(needsCloud("profile")).toBe(false);
  expect(CLOUD_PAGES.length).toBe(3);
});

test("a rail with no server behind it keeps its shape", () => {
  const off = doors(RAIL_TOP, true);
  const on = doors(RAIL_TOP, false);
  expect(on).toEqual(RAIL_TOP);
  expect(off).not.toContain("chat");
  expect(off.length).toBe(RAIL_TOP.length - 1);
  /* the bottom group loses two, and what is left is still in order */
  const bottom = doors(RAIL_BOTTOM, true);
  expect(bottom).not.toContain("rich");
  expect(bottom).not.toContain("users");
  expect(bottom).toContain("profile");
  expect(bottom).toEqual(RAIL_BOTTOM.filter((id) => id !== "rich" && id !== "users"));
  /* the list handed back is a copy: filtering it must not eat the rail */
  off.push("chat");
  expect(doors(RAIL_TOP, true)).not.toContain("chat");
});

/* The flag is a module-level one and these files share a process, so the
   starting state is whatever the outage test above left behind. What is being
   checked here is the switch itself, not the flag it lands in. */
test("asking for the backendless build is enough on its own", () => {
  setBackendless(true);
  expect(serverlessNow()).toBe(true);
  setBackendless(false);
  expect(prefs.get().offline).toBe(false);
});

test("a dead deployment turns the shared side off without being asked", () => {
  expect(markOutage(new Error(DISABLED))).toBe(true);
  expect(outageOn()).toBe(true);
  expect(serverlessNow()).toBe(true);
});

test("and Retry puts the shared side back", () => {
  clearOutage();
  expect(outageOn()).toBe(false);
  expect(serverlessNow()).toBe(false);
});

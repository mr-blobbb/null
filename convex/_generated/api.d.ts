/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as appeals from "../appeals.js";
import type * as audit from "../audit.js";
import type * as chat from "../chat.js";
import type * as filter from "../filter.js";
import type * as friends from "../friends.js";
import type * as gifs from "../gifs.js";
import type * as members from "../members.js";
import type * as music from "../music.js";
import type * as presence from "../presence.js";
import type * as saves from "../saves.js";
import type * as social from "../social.js";
import type * as store from "../store.js";
import type * as voice from "../voice.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  appeals: typeof appeals;
  audit: typeof audit;
  chat: typeof chat;
  filter: typeof filter;
  friends: typeof friends;
  gifs: typeof gifs;
  members: typeof members;
  music: typeof music;
  presence: typeof presence;
  saves: typeof saves;
  social: typeof social;
  store: typeof store;
  voice: typeof voice;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

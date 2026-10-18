/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admins from "../admins.js";
import type * as http from "../http.js";
import type * as lyrics from "../lyrics.js";
import type * as lyrics_meta from "../lyrics/meta.js";
import type * as lyrics_providers from "../lyrics/providers.js";
import type * as lyrics_types from "../lyrics/types.js";
import type * as lyricsActions from "../lyricsActions.js";
import type * as playback from "../playback.js";
import type * as playback_transitions from "../playback/transitions.js";
import type * as presence from "../presence.js";
import type * as queue from "../queue.js";
import type * as rooms from "../rooms.js";
import type * as rooms_auth from "../rooms/auth.js";
import type * as rooms_tokens from "../rooms/tokens.js";
import type * as youtube from "../youtube.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admins: typeof admins;
  http: typeof http;
  lyrics: typeof lyrics;
  "lyrics/meta": typeof lyrics_meta;
  "lyrics/providers": typeof lyrics_providers;
  "lyrics/types": typeof lyrics_types;
  lyricsActions: typeof lyricsActions;
  playback: typeof playback;
  "playback/transitions": typeof playback_transitions;
  presence: typeof presence;
  queue: typeof queue;
  rooms: typeof rooms;
  "rooms/auth": typeof rooms_auth;
  "rooms/tokens": typeof rooms_tokens;
  youtube: typeof youtube;
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

export declare const components: {
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
};

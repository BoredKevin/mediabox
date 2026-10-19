"use node";

import { Innertube } from "youtubei.js";

let defaultInnertubeInstance: Innertube | null = null;

/**
 * Returns a shared Innertube singleton instance configured for lightweight Node execution.
 */
export async function getInnertube(): Promise<Innertube> {
  if (!defaultInnertubeInstance) {
    defaultInnertubeInstance = await Innertube.create({
      generate_session_locally: true,
      retrieve_player: false,
      retrieve_innertube_config: false,
    });
  }
  return defaultInnertubeInstance;
}

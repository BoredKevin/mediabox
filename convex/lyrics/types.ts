export type LyricsResult = {
  data: string;
  sourceLabel: string;
  syncType: "word" | "line" | "none";
  isrc?: string;
  canonicalTitle?: string;
  canonicalArtist?: string;
};

export type YouTubeMetaResult = {
  song: string;
  artist: string;
  isYouTubeMusic: boolean;
  channelName: string;
  rawTitle: string;
  album?: string;
  altTitle?: string;
};

/**
 * Detects whether lyrics payload is word-synced, line-synced, or unsynced (plain).
 */
export function detectSyncType(data: string, explicitType?: string): "word" | "line" | "none" {
  if (explicitType === "word" || explicitType === "richsync") return "word";
  if (explicitType === "line" || explicitType === "linesync") return "line";
  if (explicitType === "none" || explicitType === "unsynced" || explicitType === "plain") return "none";

  if (!data) return "none";

  // Syllable / word timing indicators
  if (/<span\b[^>]*\bbegin=/i.test(data) || /<span\b[^>]*\bend=/i.test(data)) return "word";
  if (/<\d+,\d+,\d+>/.test(data)) return "word";
  if (/\(\d+,\d+,\d+\)/.test(data)) return "word";

  // Line-synced timestamp: [00:12.34]
  if (/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/.test(data)) return "line";

  return "none";
}

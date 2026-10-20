"use node";

import { YouTubeMetaResult } from "./types";
import { getInnertube } from "../innertube";

/**
 * Verifies Cloudflare Turnstile token for human clearance.
 */
export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // dev bypass
  if (!token) return false;

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secret);
    formData.append("response", token);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(4000),
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[Turnstile] Verification error:", err);
    return false;
  }
}

/**
 * Checks whether an artist name is a generic aggregator topic channel
 * (e.g. "Release - Topic", "Various Artists - Topic", or stripped "Release").
 */
export function isGenericAggregator(name: string): boolean {
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  return (
    lower === "release" ||
    lower === "release - topic" ||
    lower === "various artists" ||
    lower === "various artists - topic"
  );
}

/**
 * Extracts clean track title and artist list from YouTube auto-generated
 * music video descriptions (standard "Track · Artist1 · Artist2" format).
 */
export function extractMetadataFromDescription(
  desc: string | undefined
): { title: string; artist: string } | null {
  if (!desc) return null;
  const lines = desc.split("\n").map((l) => l.trim()).filter(Boolean);
  const dotLine = lines.find((l) => l.includes("·") || l.includes("\u00B7"));
  if (!dotLine) return null;
  const parts = dotLine.split(/[\u00B7·]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const title = parts[0];
    const artist = parts.slice(1).join(", ");
    return { title, artist };
  }
  return null;
}

/**
 * Resolves YouTube video metadata using Innertube's YouTube Music API.
 * 
 * 1. Fast baseline from YouTube oEmbed API to obtain video title and author name.
 * 2. Innertube YouTube Music getInfo (for environments where player endpoints are not bot-restricted).
 * 3. Innertube YouTube Music Search (for topic channels like "Release - Topic" or aggregator channels).
 *    Uses the official Browse/Search endpoint which is not restricted on datacenter IPs.
 * 4. Fallback description parsing from getBasicInfo (middle-dot "Track · Artist1 · Artist2" standard).
 * 5. Final fallback from oEmbed metadata.
 */
export async function fetchYouTubeVideoMeta(
  videoId: string
): Promise<YouTubeMetaResult | null> {
  if (!videoId) return null;

  // 1. Fast baseline from YouTube oEmbed API
  let oEmbedTitle = "";
  let oEmbedChannel = "";
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (res.ok) {
      const json = await res.json();
      oEmbedTitle = String(json?.title || "").trim();
      oEmbedChannel = String(json?.author_name || "").trim();
    }
  } catch {
    // Continue
  }

  const isTopic = /\s*-\s*Topic$/i.test(oEmbedChannel) || oEmbedChannel.toLowerCase().endsWith("- topic");
  const cleanOEmbedAuthor = isTopic ? oEmbedChannel.replace(/\s*-\s*Topic$/i, "").trim() : oEmbedChannel;
  const isAggregator = isGenericAggregator(cleanOEmbedAuthor);

  try {
    const yt = await getInnertube();

    // 2. Try YouTube Music getInfo
    let musicInfo: any = null;
    try {
      musicInfo = await yt.music.getInfo(videoId);
    } catch {
      // Ignore
    }

    if (musicInfo?.basic_info?.title) {
      const basic = musicInfo.basic_info;
      const rawTitle = String(basic.title || "").trim();
      const rawAuthor = String(basic.author || "").trim();
      const album = musicInfo.player_overlays?.browser_media_session?.album?.text;

      const isMusicTopic = /\s*-\s*Topic$/i.test(rawAuthor);
      const cleanAuthor = isMusicTopic ? rawAuthor.replace(/\s*-\s*Topic$/i, "").trim() : rawAuthor;
      const isMusicAggregator = isGenericAggregator(cleanAuthor);

      if (!isMusicAggregator && cleanAuthor) {
        return {
          song: rawTitle,
          artist: cleanAuthor,
          isYouTubeMusic: true,
          channelName: rawAuthor,
          rawTitle,
          album: album ? String(album).trim() : undefined,
        };
      }
    }

    // 3. If generic aggregator channel (e.g. "Release - Topic"), search YouTube Music by title to resolve real artist
    if (isAggregator || !cleanOEmbedAuthor) {
      const searchQuery = oEmbedTitle || videoId;
      try {
        const searchRes = await yt.music.search(searchQuery, { type: "song" });
        const songs = searchRes.songs?.contents || [];
        // STRICT: Only match if videoId is an exact match. NEVER fall back to songs[0]!
        const m: any = songs.find((s: any) => (s.id || s.video_id) === videoId);
        if (m) {
          const title =
            (typeof m.title === "string" ? m.title : m.title?.text || m.title?.runs?.[0]?.text) ||
            oEmbedTitle;
          const artist =
            Array.isArray(m.artists) && m.artists.length > 0
              ? m.artists.map((a: any) => a.name || a.text).filter(Boolean).join(", ")
              : (m.author?.name || "");

          if (artist && !isGenericAggregator(artist)) {
            return {
              song: title,
              artist,
              isYouTubeMusic: true,
              channelName: oEmbedChannel,
              rawTitle: oEmbedTitle || title,
            };
          }
        }
      } catch (searchErr) {
        console.warn(`[fetchYouTubeVideoMeta] YTM search fallback failed for ${videoId}:`, searchErr);
      }
    }

    // 4. Try getBasicInfo description parsing (auto-generated middle-dot format)
    try {
      const basicInfo = await yt.getBasicInfo(videoId);
      if (basicInfo?.basic_info?.title) {
        const descMeta = extractMetadataFromDescription(basicInfo.basic_info.short_description);
        if (descMeta?.artist && !isGenericAggregator(descMeta.artist)) {
          return {
            song: descMeta.title || basicInfo.basic_info.title,
            artist: descMeta.artist,
            isYouTubeMusic: true,
            channelName: basicInfo.basic_info.author || oEmbedChannel,
            rawTitle: basicInfo.basic_info.title,
          };
        }
      }
    } catch {
      // Continue
    }
  } catch (err) {
    console.warn(`[fetchYouTubeVideoMeta] Innertube lookup error for ${videoId}:`, err);
  }

  // 5. Final fallback using oEmbed metadata
  if (oEmbedTitle) {
    return {
      song: oEmbedTitle,
      artist: isAggregator ? "" : cleanOEmbedAuthor,
      isYouTubeMusic: isTopic,
      channelName: oEmbedChannel,
      rawTitle: oEmbedTitle,
    };
  }

  return null;
}

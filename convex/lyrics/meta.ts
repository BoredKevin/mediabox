import { YouTubeMetaResult } from "./types";

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
 * Resolves YouTube video metadata strictly from the YouTube oEmbed API.
 * For YouTube Music tracks (channels ending with " - Topic"):
 * - Title is the clean song name (strictly standardized to match LRC.red/streaming releases).
 * - Artist is the channel name with " - Topic" stripped.
 * Non-YouTube Music videos are marked with isYouTubeMusic=false so they do not play lyrics.
 */
export async function fetchYouTubeVideoMeta(
  videoId: string
): Promise<YouTubeMetaResult | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`,
      { signal: AbortSignal.timeout(3500) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const rawTitle = String(json?.title || "").trim();
    const channelName = String(json?.author_name || "").trim();

    const isTopic = /\s*-\s*Topic$/i.test(channelName) || channelName.toLowerCase().endsWith("- topic");
    const artist = isTopic ? channelName.replace(/\s*-\s*Topic$/i, "").trim() : channelName;
    const song = rawTitle;

    return {
      song,
      artist,
      isYouTubeMusic: isTopic,
      channelName,
      rawTitle,
    };
  } catch {
    return null;
  }
}

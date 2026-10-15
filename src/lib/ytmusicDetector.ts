/**
 * Detection utilities for identifying YouTube Music tracks.
 */

export const isTopicChannel = (channel?: string | null): boolean => {
  if (!channel) return false;
  const trimmed = channel.trim();
  return trimmed.endsWith(' - Topic') || trimmed.toLowerCase().includes('topic');
};

/**
 * Checks whether a video URL or channel represents an official YouTube Music track.
 */
export const isYouTubeMusicTrack = (
  url?: string | null,
  channelTitle?: string | null,
  title?: string | null
): boolean => {
  if (!url && !channelTitle && !title) return false;

  // 1. Explicit YouTube Music URL
  if (url && (url.includes('music.youtube.com') || url.includes('music.youtube.'))) {
    return true;
  }

  // 2. YouTube Music auto-generated "- Topic" artist channel
  if (channelTitle && isTopicChannel(channelTitle)) {
    return true;
  }

  // 3. Audio purity indicator often used in topic or music releases
  if (title) {
    const t = title.toLowerCase();
    if (/\b(official\s+audio|lyric\s+video)\b/.test(t) && channelTitle && !channelTitle.toLowerCase().includes('vevo')) {
      return true;
    }
  }

  return false;
};

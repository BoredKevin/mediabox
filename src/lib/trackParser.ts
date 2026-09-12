/**
 * Utilities for extracting, normalizing, and cleaning track and artist metadata
 * from YouTube video titles and channel descriptions.
 */

// Precompiled regular expressions for string cleaning
const CHANNEL_CLEANUP_RES = [
  /\s*-\s*Topic$/i,
  /\s*VEVO$/i,
  /^VEVO\s*/i,
  /\s*Official$/i,
  /\s*Records$/i,
  /\s*Music$/i,
  /\s*Channel$/i,
];

const NOISE_TAGS_RE = /[\(\[\{][^\)\]\}]*(official|music\s+video|video|audio|lyric|visualizer|super\s+slowed|slowed|reverb|speed|sped|nightcore|remix|edit|version|cover|mv|hd|4k|clip|explicit|prod|feat|ft)[^\)\]\}]*[\)\]\}]/gi;
const WORD_NOISE_RE = /\b(super\s+slowed|slowed\s*\&\s*reverb|slowed|reverb|sped\s+up|speed\s+up|nightcore|remix|edit|official\s+video|official\s+audio|lyric\s+video)\b/gi;
const FEATURING_RE = /\b(ft|ft\.|feat|feat\.|featuring)\s+[a-zA-Z0-9_\s&-]+/gi;
const BRACKETS_RE = /[\(\[\{\)\]\}]/g;
const MULTI_SPACE_RE = /\s+/g;
const TRIM_NON_ALPHANUM_EDGE_RE = /^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g;
const NOISE_FALLBACK_RE = /^(official|music\s+video|video|audio|lyric|hd|4k|mv|super\s+slowed|slowed|remix)$/i;
const NON_ALPHANUM_RE = /[^a-z0-9]/g;

const HYPHENS = [' - ', ' – ', ' — ', ' : '];

/**
 * Cleans author/channel name (e.g. from YouTube oEmbed) by stripping "- Topic", "VEVO", etc.
 */
export const cleanArtistName = (name: string): string => {
  if (!name) return '';
  let cleaned = name;
  for (const re of CHANNEL_CLEANUP_RES) {
    cleaned = cleaned.replace(re, '');
  }
  return cleaned.trim();
};

/**
 * Robustly parses YouTube video title and channel name (oEmbed author) into clean track and artist names.
 * Handles patterns:
 * - "PERTO (Super Slowed)" (channel: "SXYGX - Topic") -> { artist: "SXYGX", track: "PERTO" }
 * - "h6itam - MONTAGEM ALQUIMIA (Official Video)" -> { artist: "h6itam", track: "MONTAGEM ALQUIMIA" }
 * - "Song Name ft. Drake (Remix)" (channel: "Topic Channel") -> { artist: "Drake", track: "Song Name" }
 */
export const parseTrackAndArtist = (
  rawTitle: string,
  channelTitle?: string
): { artist: string; track: string } => {
  if (!rawTitle) return { artist: '', track: '' };

  // 1. Clean author/channel name from oEmbed API
  const cleanChannel = cleanArtistName(channelTitle || '');

  // 2. Comprehensive noise removal from raw title:
  // Remove parenthesized / bracketed noise tags: (Super Slowed), (Slowed & Reverb), (Remix), (ft. ...), (Official Video), etc.
  let cleanTitle = rawTitle
    .replace(NOISE_TAGS_RE, '')
    .replace(WORD_NOISE_RE, '')
    .replace(FEATURING_RE, '')
    .replace(BRACKETS_RE, '')
    .replace(MULTI_SPACE_RE, ' ')
    .trim();

  if (!cleanTitle) {
    cleanTitle = rawTitle.replace(BRACKETS_RE, '').trim();
  }

  // 3. Analyze title to extract artist name vs track name
  let extractedArtist = '';
  let extractedTrack = '';

  for (const h of HYPHENS) {
    if (cleanTitle.includes(h)) {
      const parts = cleanTitle.split(h);
      if (parts.length >= 2) {
        const p1 = parts[0].trim().replace(TRIM_NON_ALPHANUM_EDGE_RE, '');
        const p2 = parts.slice(1).join(h).trim();

        // Check if Part 2 matches channel/author better than Part 1
        if (cleanChannel && p2.toLowerCase().includes(cleanChannel.toLowerCase())) {
          extractedArtist = p2;
          extractedTrack = p1;
        } else {
          extractedArtist = p1;
          extractedTrack = p2;
        }
        break;
      }
    }
  }

  // 4. If no artist divider found in title, use cleanTitle as track and fall back to cleanChannel as artist
  if (!extractedTrack) {
    extractedTrack = cleanTitle;
    extractedArtist = cleanChannel;
  }

  // Final noise checks for artist and track
  if (!extractedArtist || NOISE_FALLBACK_RE.test(extractedArtist)) {
    extractedArtist = cleanChannel;
  }

  if (!extractedTrack || NOISE_FALLBACK_RE.test(extractedTrack)) {
    extractedTrack = cleanTitle || rawTitle;
  }

  return { artist: extractedArtist.trim(), track: extractedTrack.trim() };
};

/**
 * Normalizes string for fuzzy comparison by stripping noise tags and non-alphanumeric characters.
 */
export const normalizeStr = (str: string): string => {
  return (str || '')
    .toLowerCase()
    .replace(NOISE_TAGS_RE, '')
    .replace(WORD_NOISE_RE, '')
    .replace(FEATURING_RE, '')
    .replace(NON_ALPHANUM_RE, '');
};

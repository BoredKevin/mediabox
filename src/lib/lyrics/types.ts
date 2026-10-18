import { type Lyric } from '@braccato/parsers';

export interface ResolvedLyricsData {
  lyrics: Lyric[];
  source: string;
  sourceHref?: string;
  isFromUnison: boolean;
  syncType?: 'syllable' | 'word' | 'line' | 'unsynced';
  rawTtml?: string;
  enrichedMeta?: {
    song: string;
    artist: string;
    album: string;
    duration: number;
    artworkUrl?: string;
  };
}

export interface EnrichedTrackMeta {
  song: string;
  artist: string;
  album: string;
  duration: number;
  artworkUrl?: string;
}

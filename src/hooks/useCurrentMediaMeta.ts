import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { fetchVideoTitle, parseYouTubeVideoId } from '@/lib/youtube';
import { parseTrackAndArtist, isGenericTopic } from '@/lib/trackParser';

export function useCurrentMediaMeta(
  currentlyPlaying?: string | null,
  currentlyPlayingTitle?: string | null
) {
  const [currentVideoMeta, setCurrentVideoMeta] = useState<{
    title: string;
    author: string;
  }>({ title: '', author: '' });

  const videoId = parseYouTubeVideoId(currentlyPlaying || '') || currentlyPlaying;

  const cachedLyricsDoc = useQuery(
    api.lyrics.get,
    videoId ? { videoId } : 'skip'
  );

  useEffect(() => {
    if (!currentlyPlaying) {
      setCurrentVideoMeta({ title: '', author: '' });
      return;
    }

    let cancelled = false;

    // Fast initial metadata from roomState
    const initialTitle = currentlyPlayingTitle || '';
    if (initialTitle) {
      const parsed = parseTrackAndArtist(initialTitle);
      setCurrentVideoMeta({
        title: initialTitle,
        author: isGenericTopic(parsed.artist) ? '' : (parsed.artist || ''),
      });
    }

    // Resolve full title and channel/author from oEmbed as baseline
    fetchVideoTitle(currentlyPlaying)
      .then((info) => {
        if (cancelled) return;
        const title = info.title || initialTitle || currentlyPlayingTitle || '';
        const author = info.channelTitle || (title ? parseTrackAndArtist(title).artist : '');
        const cleanAuthor = isGenericTopic(author) ? '' : author;
        setCurrentVideoMeta((prev) => ({
          title: prev.title || title,
          author: prev.author || cleanAuthor,
        }));
      })
      .catch(() => {
        // Keep initialTitle
      });

    return () => {
      cancelled = true;
    };
  }, [currentlyPlaying, currentlyPlayingTitle]);

  // When Innertube metadata arrives via cachedLyrics, upgrade author and title
  useEffect(() => {
    if (cachedLyricsDoc?.trackTitle || cachedLyricsDoc?.artistName) {
      setCurrentVideoMeta((prev) => ({
        title: cachedLyricsDoc.trackTitle || prev.title,
        author: cachedLyricsDoc.artistName || prev.author,
      }));
    }
  }, [cachedLyricsDoc]);

  return currentVideoMeta;
}

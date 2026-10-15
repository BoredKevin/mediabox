import { useState, useEffect } from 'react';
import { fetchVideoTitle } from '@/lib/youtube';
import { parseTrackAndArtist } from '@/lib/trackParser';

export function useCurrentMediaMeta(
  currentlyPlaying?: string | null,
  currentlyPlayingTitle?: string | null
) {
  const [currentVideoMeta, setCurrentVideoMeta] = useState<{
    title: string;
    author: string;
  }>({ title: '', author: '' });

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
        author: parsed.artist || '',
      });
    }

    // Resolve full title and channel/author from oEmbed
    fetchVideoTitle(currentlyPlaying)
      .then((info) => {
        if (cancelled) return;
        const title = info.title || initialTitle || currentlyPlayingTitle || '';
        const author = info.channelTitle || (title ? parseTrackAndArtist(title).artist : '');
        setCurrentVideoMeta({
          title,
          author,
        });
      })
      .catch(() => {
        // Keep initialTitle
      });

    return () => {
      cancelled = true;
    };
  }, [currentlyPlaying, currentlyPlayingTitle]);

  return currentVideoMeta;
}

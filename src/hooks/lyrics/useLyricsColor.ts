import { useState, useEffect } from 'react';
import { extractDominantColor } from '@/lib/colorExtractor';

export interface LyricsDominantColor {
  dominant: string;
  gradient: string;
}

const DEFAULT_COLOR: LyricsDominantColor = {
  dominant: '#1a101f',
  gradient: 'radial-gradient(circle at 70% 35%, #24132b 0%, #0d0612 100%)',
};

export function useLyricsColor(albumArtUrl?: string | null): LyricsDominantColor {
  const [color, setColor] = useState<LyricsDominantColor>(DEFAULT_COLOR);

  useEffect(() => {
    if (!albumArtUrl) {
      setColor(DEFAULT_COLOR);
      return;
    }

    let isCancelled = false;
    extractDominantColor(albumArtUrl)
      .then((extracted) => {
        if (!isCancelled && extracted) {
          setColor(extracted);
        }
      })
      .catch(() => {
        if (!isCancelled) setColor(DEFAULT_COLOR);
      });

    return () => {
      isCancelled = true;
    };
  }, [albumArtUrl]);

  return color;
}

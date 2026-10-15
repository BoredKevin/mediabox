import React from 'react';
import type { Lyric } from '@braccato/parsers';

export interface BraccatoLyricsElement extends HTMLElement {
  lyrics: Lyric[] | null;
  lyricsOptions?: {
    loaderVisible?: boolean;
    noLyrics?: boolean;
    language?: string;
  };
  source?: string | HTMLMediaElement | null;
  currentTime: number;
  playing: boolean;
  tickOptions?: {
    playbackRate?: number;
  };
  theme?: string;
  host?: {
    getScrollElement?: () => HTMLElement | null;
  };
  renderer?: {
    noteUserScroll: () => void;
  };
  status?: string;
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'braccato-lyrics': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          source?: string;
          theme?: string;
          'current-time'?: number;
          playing?: boolean;
        },
        BraccatoLyricsElement
      >;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'braccato-lyrics': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          source?: string;
          theme?: string;
          'current-time'?: number;
          playing?: boolean;
        },
        BraccatoLyricsElement
      >;
    }
  }
}

import React, { useEffect, useRef, useState } from 'react';
import { parseYouTubeVideoId } from '@/lib/roomUtils';
import { AlertTriangle, Play } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YouTubePlayerProps {
  url: string;
  isPlaying: boolean;
  volume: number; // 0 to 100
  muted: boolean;
  onEnded?: () => void;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  url,
  isPlaying,
  volume,
  muted,
  onEnded,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const onEndedRef = useRef(onEnded);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [needsUserInteraction, setNeedsUserInteraction] = useState<boolean>(false);

  const videoId = parseYouTubeVideoId(url);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // Load YouTube IFrame API script dynamically if not present
  useEffect(() => {
    if (window.YT && window.YT.Player) return;

    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'youtube-iframe-api';
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  }, []);

  // Initialize YT.Player once
  useEffect(() => {
    if (!videoId || !wrapperRef.current) return;

    let isSubscribed = true;
    setEmbedError(null);

    // If player instance already exists, just load the new video ID!
    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      try {
        if (isPlaying) {
          playerRef.current.loadVideoById(videoId);
        } else {
          playerRef.current.cueVideoById(videoId);
        }
        return;
      } catch (e) {
        console.warn('Failed to loadVideoById, re-creating player:', e);
      }
    }

    // Clear wrapper DOM contents before initializing
    wrapperRef.current.innerHTML = '';
    const playerDiv = document.createElement('div');
    playerDiv.style.width = '100%';
    playerDiv.style.height = '100%';
    wrapperRef.current.appendChild(playerDiv);

    // Only pass origin parameter if on https protocol to avoid "origin cannot be verified" error on http/localhost
    const playerVars: Record<string, any> = {
      autoplay: 1,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      enablejsapi: 1,
    };

    if (window.location.protocol === 'https:') {
      playerVars.origin = window.location.origin;
    }

    const initPlayer = () => {
      if (!isSubscribed) return;

      playerRef.current = new window.YT.Player(playerDiv, {
        videoId: videoId,
        width: '100%',
        height: '100%',
        playerVars,
        events: {
          onReady: (event: any) => {
            if (!isSubscribed) return;
            try {
              event.target.setVolume(volume);
              if (muted) {
                event.target.mute();
              } else {
                event.target.unMute();
              }
              if (isPlaying) {
                const playPromise = event.target.playVideo();
                if (playPromise && typeof playPromise.catch === 'function') {
                  playPromise.catch(() => {
                    setNeedsUserInteraction(true);
                  });
                }
              } else {
                event.target.cueVideoById(videoId);
              }
            } catch (e) {
              console.error('Error on YT player ready:', e);
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED === 0
            if (event.data === 0) {
              console.log('[YouTubePlayer] Video ended (YT.PlayerState.ENDED = 0). Playing next item in queue...');
              if (onEndedRef.current) {
                onEndedRef.current();
              }
            }
            if (event.data === 1) {
              // Playing
              setNeedsUserInteraction(false);
            }
          },
          onError: (event: any) => {
            console.warn('[YouTubePlayer] YouTube API error code:', event.data);
            if (event.data === 101 || event.data === 150) {
              setEmbedError('The owner of this video has disabled playback in third-party embedded players.');
            } else if (event.data === 100) {
              setEmbedError('This video has been removed or set to private.');
            } else if (event.data === 2) {
              setEmbedError('Invalid YouTube video ID.');
            } else {
              setEmbedError(`Playback error (code ${event.data}).`);
            }

            // Auto-skip to next video in queue after 3.5 seconds if restricted
            setTimeout(() => {
              if (onEndedRef.current) {
                onEndedRef.current();
              }
            }, 3500);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (previousReady) previousReady();
        initPlayer();
      };
    }

    return () => {
      isSubscribed = false;
    };
  }, [videoId]);

  // Sync isPlaying state
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      try {
        if (isPlaying) {
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      } catch (e) {
        console.error('Error toggling play/pause:', e);
      }
    }
  }, [isPlaying]);

  // Sync volume state
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(volume);
      } catch (e) {
        console.error('Error setting volume:', e);
      }
    }
  }, [volume]);

  // Sync muted state
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.mute === 'function') {
      try {
        if (muted) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
        }
      } catch (e) {
        console.error('Error toggling mute:', e);
      }
    }
  }, [muted]);

  const handleStartPlayUserClick = () => {
    setNeedsUserInteraction(false);
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      try {
        playerRef.current.playVideo();
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (!videoId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 font-mono text-xs">
        Invalid YouTube URL: {url}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full bg-black flex items-center justify-center">
      {embedError && (
        <div className="absolute inset-0 z-30 bg-slate-950/95 p-6 flex flex-col items-center justify-center text-center gap-3 border border-amber-900/50">
          <AlertTriangle className="w-10 h-10 text-amber-500 animate-bounce" />
          <p className="text-sm font-bold text-amber-400">{embedError}</p>
          <p className="text-xs text-slate-400 max-w-md">
            Auto-skipping to the next video in queue shortly...
          </p>
          <button
            onClick={() => onEnded && onEnded()}
            className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold uppercase text-xs tracking-wider"
          >
            Skip Restricted Video Now
          </button>
        </div>
      )}

      {needsUserInteraction && !embedError && (
        <div
          onClick={handleStartPlayUserClick}
          className="absolute inset-0 z-20 bg-slate-950/80 cursor-pointer flex flex-col items-center justify-center gap-3 transition-opacity hover:bg-slate-950/70"
        >
          <div className="p-4 bg-[#00c8d4] text-slate-950 rounded-full shadow-[0_0_25px_rgba(0,200,212,0.5)]">
            <Play className="w-8 h-8 fill-slate-950 ml-1" />
          </div>
          <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">Click to Start Playback</p>
        </div>
      )}

      <div
        ref={wrapperRef}
        className="absolute inset-0 w-full h-full [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:border-none"
      />
    </div>
  );
};

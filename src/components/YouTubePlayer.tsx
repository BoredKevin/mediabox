import React, { useEffect, useRef, useState, useCallback } from 'react';
import { parseYouTubeVideoId } from '@/lib/roomUtils';
import { useTranslation } from '@/context/LanguageContext';
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
  startSeconds?: number;
  onPlaying?: (currentSec: number, durationSec: number) => void;
  onBuffering?: (currentSec: number) => void;
  onPaused?: (currentSec: number) => void;
  onEnded?: () => void;
  onPlayerInstance?: (player: any) => void;
  hidden?: boolean;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  url,
  isPlaying,
  volume,
  muted,
  startSeconds = 0,
  onPlaying,
  onBuffering,
  onPaused,
  onEnded,
  onPlayerInstance,
  hidden = false,
}) => {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  // Callback refs to avoid stale closures in YouTube API event handlers
  const onPlayingRef = useRef(onPlaying);
  const onBufferingRef = useRef(onBuffering);
  const onPausedRef = useRef(onPaused);
  const onEndedRef = useRef(onEnded);
  const isPlayingRef = useRef(isPlaying);
  const onPlayerInstanceRef = useRef(onPlayerInstance);

  const [embedError, setEmbedError] = useState<string | null>(null);
  const [errorCountdown, setErrorCountdown] = useState<number | null>(null);
  const [needsUserInteraction, setNeedsUserInteraction] = useState<boolean>(false);

  // Trap 3: Track whether current videoId has started real playing (PLAYING = 1) at least once
  const hasStartedCurrentTrackRef = useRef<boolean>(false);
  // Video loading guard: tracks which videoId has been loaded to prevent replay loops
  const lastLoadedVideoIdRef = useRef<string | null>(null);
  // Trap 2: Debounce timer for transient PAUSED events during pre-seek
  const pausedDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Error auto-skip countdown timers
  const errorSkipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const videoId = parseYouTubeVideoId(url);

  useEffect(() => {
    onPlayingRef.current = onPlaying;
  }, [onPlaying]);

  useEffect(() => {
    onBufferingRef.current = onBuffering;
  }, [onBuffering]);

  useEffect(() => {
    onPausedRef.current = onPaused;
  }, [onPaused]);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    onPlayerInstanceRef.current = onPlayerInstance;
  }, [onPlayerInstance]);

  const clearErrorTimers = useCallback(() => {
    if (errorSkipTimerRef.current) {
      clearTimeout(errorSkipTimerRef.current);
      errorSkipTimerRef.current = null;
    }
    if (errorCountdownIntervalRef.current) {
      clearInterval(errorCountdownIntervalRef.current);
      errorCountdownIntervalRef.current = null;
    }
    setErrorCountdown(null);
  }, []);

  // Cleanup timers and player instance on component unmount
  useEffect(() => {
    return () => {
      if (pausedDebounceTimerRef.current) {
        clearTimeout(pausedDebounceTimerRef.current);
      }
      clearErrorTimers();
      if (onPlayerInstanceRef.current) onPlayerInstanceRef.current(null);
    };
  }, [clearErrorTimers]);

  // Reset track readiness and clear timers when videoId changes
  useEffect(() => {
    hasStartedCurrentTrackRef.current = false;
    if (pausedDebounceTimerRef.current) {
      clearTimeout(pausedDebounceTimerRef.current);
      pausedDebounceTimerRef.current = null;
    }
    clearErrorTimers();
    setEmbedError(null);
  }, [videoId, clearErrorTimers]);

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

  // Initialize YT.Player or load new video via persistent iframe
  useEffect(() => {
    if (!videoId || !wrapperRef.current) {
      if (!videoId) {
        lastLoadedVideoIdRef.current = null;
      }
      return;
    }

    // Guard: if this videoId is ALREADY loaded into the player, do not reload it!
    if (playerRef.current && lastLoadedVideoIdRef.current === videoId) {
      return;
    }

    let isSubscribed = true;

    // If player instance already exists, directly load the new video without re-creating DOM
    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      try {
        lastLoadedVideoIdRef.current = videoId;
        if (onPlayerInstanceRef.current) onPlayerInstanceRef.current(playerRef.current);
        const shouldPlay = isPlayingRef.current;
        if (shouldPlay) {
          playerRef.current.loadVideoById({
            videoId,
            startSeconds: Math.max(0, startSeconds),
          });
        } else {
          playerRef.current.cueVideoById({
            videoId,
            startSeconds: Math.max(0, startSeconds),
          });
        }
        return;
      } catch (e) {
        console.warn('[YouTubePlayer] loadVideoById error, falling back to re-init:', e);
      }
    }

    // Clear wrapper DOM contents before first initialization
    wrapperRef.current.innerHTML = '';
    const playerDiv = document.createElement('div');
    playerDiv.style.width = '100%';
    playerDiv.style.height = '100%';
    wrapperRef.current.appendChild(playerDiv);

    const playerVars: Record<string, any> = {
      autoplay: 0,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      enablejsapi: 1,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
    };

    if (window.location.protocol === 'https:') {
      playerVars.origin = window.location.origin;
    }

    const initPlayer = () => {
      if (!isSubscribed) return;

      playerRef.current = new window.YT.Player(playerDiv, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars,
        events: {
          onReady: (event: any) => {
            if (!isSubscribed) return;
            try {
              lastLoadedVideoIdRef.current = videoId;
              if (onPlayerInstanceRef.current) onPlayerInstanceRef.current(event.target);
              event.target.setVolume(volume);
              if (muted) {
                event.target.mute();
              } else {
                event.target.unMute();
              }

              if (isPlayingRef.current) {
                event.target.loadVideoById({
                  videoId,
                  startSeconds: Math.max(0, startSeconds),
                });
              } else {
                event.target.cueVideoById({
                  videoId,
                  startSeconds: Math.max(0, startSeconds),
                });
              }
            } catch (e) {
              console.error('[YouTubePlayer] Error on YT player ready:', e);
            }
          },
          onStateChange: (event: any) => {
            let currentSec = 0;
            let durSec = 0;
            try {
              currentSec = Math.max(0, event.target.getCurrentTime?.() || 0);
              durSec = Math.max(0, event.target.getDuration?.() || 0);
            } catch (_) {}

            // YT.PlayerState.PLAYING === 1
            if (event.data === 1) {
              // Cancel any pending pre-seek pause
              if (pausedDebounceTimerRef.current) {
                clearTimeout(pausedDebounceTimerRef.current);
                pausedDebounceTimerRef.current = null;
              }
              hasStartedCurrentTrackRef.current = true;
              setNeedsUserInteraction(false);
              onPlayingRef.current?.(currentSec, durSec);
            }
            // YT.PlayerState.BUFFERING === 3
            else if (event.data === 3) {
              // Trap 2: Cancel transient pre-seek pause immediately
              if (pausedDebounceTimerRef.current) {
                clearTimeout(pausedDebounceTimerRef.current);
                pausedDebounceTimerRef.current = null;
              }

              // Trap 3: Only report mid-song buffer stalls if the track has started playing once
              if (hasStartedCurrentTrackRef.current) {
                onBufferingRef.current?.(currentSec);
              } else {
                onBufferingRef.current?.(0);
              }
            }
            // YT.PlayerState.PAUSED === 2
            else if (event.data === 2) {
              // Trap 2: Debounce PAUSED by 250ms to ignore the transient PAUSED (2) emitted before seek BUFFERING (3)
              if (pausedDebounceTimerRef.current) {
                clearTimeout(pausedDebounceTimerRef.current);
              }
              pausedDebounceTimerRef.current = setTimeout(() => {
                pausedDebounceTimerRef.current = null;
                onPausedRef.current?.(currentSec);
              }, 250);
            }
            // YT.PlayerState.ENDED === 0
            else if (event.data === 0) {
              if (pausedDebounceTimerRef.current) {
                clearTimeout(pausedDebounceTimerRef.current);
                pausedDebounceTimerRef.current = null;
              }
              console.log('[YouTubePlayer] Native song ended (YT.PlayerState.ENDED = 0). Advancing...');
              onEndedRef.current?.();
            }
          },
          onError: (event: any) => {
            console.warn('[YouTubePlayer] YouTube API error code:', event.data);
            if (event.data === 101 || event.data === 150) {
              setEmbedError(t('player.embedRestrictedError'));
            } else if (event.data === 100) {
              setEmbedError(t('player.removedVideoError'));
            } else if (event.data === 2) {
              setEmbedError(t('player.invalidIdError'));
            } else {
              setEmbedError(t('player.playbackErrorCode', { code: event.data }));
            }

            // 5-second cancelable auto-skip timer with visible countdown
            clearErrorTimers();
            let secondsLeft = 5;
            setErrorCountdown(secondsLeft);

            errorCountdownIntervalRef.current = setInterval(() => {
              secondsLeft -= 1;
              if (secondsLeft <= 0) {
                if (errorCountdownIntervalRef.current) {
                  clearInterval(errorCountdownIntervalRef.current);
                  errorCountdownIntervalRef.current = null;
                }
              }
              setErrorCountdown(Math.max(0, secondsLeft));
            }, 1000);

            errorSkipTimerRef.current = setTimeout(() => {
              clearErrorTimers();
              onEndedRef.current?.();
            }, 5000);
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
  }, [videoId, t, clearErrorTimers]);

  // Sync isPlaying state
  useEffect(() => {
    if (!playerRef.current || typeof playerRef.current.playVideo !== 'function') return;
    try {
      if (isPlaying) {
        const playPromise = playerRef.current.playVideo();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => setNeedsUserInteraction(true));
        }
      } else {
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      console.warn('[YouTubePlayer] Error syncing isPlaying state:', e);
    }
  }, [isPlaying]);

  // Sync volume state
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        playerRef.current.setVolume(volume);
      } catch (e) {
        console.error('[YouTubePlayer] Error setting volume:', e);
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
          if (typeof playerRef.current.setVolume === 'function') {
            playerRef.current.setVolume(volume);
          }
        }
      } catch (e) {
        console.error('[YouTubePlayer] Error toggling mute:', e);
      }
    }
  }, [muted, volume]);

  const handleStartPlayUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNeedsUserInteraction(false);
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      try {
        playerRef.current.playVideo();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSkipErrorNow = () => {
    clearErrorTimers();
    onEndedRef.current?.();
  };

  if (!videoId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 font-mono text-xs">
        {t('player.invalidYtUrl')} {url}
      </div>
    );
  }

  return (
    <div
      className={`absolute inset-0 w-full h-full bg-black flex items-center justify-center transition-opacity duration-300 ${
        hidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {embedError && (
        <div className="absolute inset-0 z-30 bg-slate-950/95 p-6 flex flex-col items-center justify-center text-center gap-3 border border-amber-900/50">
          <AlertTriangle className="w-10 h-10 text-amber-500 animate-bounce" />
          <p className="text-sm font-bold text-amber-400">{embedError}</p>
          <p className="text-xs text-slate-400 max-w-md">
            {errorCountdown !== null ? `Auto-skipping in ${errorCountdown}s...` : t('player.autoSkippingNotice')}
          </p>
          <button
            onClick={handleSkipErrorNow}
            className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold uppercase text-xs tracking-wider cursor-pointer rounded-md"
          >
            {t('player.skipRestrictedNow')}
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
          <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">{t('player.clickToStartPlayback')}</p>
        </div>
      )}

      <div
        ref={wrapperRef}
        className="absolute inset-0 w-full h-full pointer-events-none select-none [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:border-none [&>iframe]:pointer-events-none"
      />
      {/* Transparent Click Shield over YouTube iframe */}
      <div className="absolute inset-0 z-10 pointer-events-auto" aria-hidden="true" />
    </div>
  );
};

export default YouTubePlayer;

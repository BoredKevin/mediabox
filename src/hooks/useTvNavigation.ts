import { useEffect } from 'react';

interface TvNavigationOptions {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onTogglePlayPause?: () => void;
  onNextTrack?: () => void;
  onPreviousTrack?: () => void;
  isModalOpen?: boolean;
  onCloseModal?: () => void;
}

/**
 * TV Navigation & Hardware Remote Key Integration Hook
 * - Maps LG webOS (461) and Samsung Tizen (10009) Back buttons
 * - Maps TV Media remote buttons (Play, Pause, Skip, Prev)
 * - Toggles D-Pad mode to lock stationary Magic Remote air-mouse cursor
 */
export function useTvNavigation({
  isFullscreen = false,
  onToggleFullscreen,
  onTogglePlayPause,
  onNextTrack,
  onPreviousTrack,
  isModalOpen = false,
  onCloseModal,
}: TvNavigationOptions) {
  useEffect(() => {
    // 1. D-Pad Mode: suppress hover states on arrow keys, restore on physical mouse movement
    const handleMouseMove = () => {
      if (document.body.classList.contains('tv-dpad-mode')) {
        document.body.classList.remove('tv-dpad-mode');
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // 2. Hardware TV key handler
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyCode = e.keyCode || e.which;

      // Detect directional arrows -> lock pointer hover
      if (
        keyCode >= 37 && keyCode <= 40 ||
        e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight'
      ) {
        if (!document.body.classList.contains('tv-dpad-mode')) {
          document.body.classList.add('tv-dpad-mode');
        }
      }

      // LG webOS (461) or Samsung Tizen (10009) or Escape Back button
      if (keyCode === 461 || keyCode === 10009 || e.key === 'Escape' || e.key === 'Back') {
        if (isModalOpen && onCloseModal) {
          e.preventDefault();
          e.stopPropagation();
          onCloseModal();
          return;
        }

        if (isFullscreen && onToggleFullscreen) {
          e.preventDefault();
          e.stopPropagation();
          onToggleFullscreen();
          return;
        }
      }

      // TV Media Play/Pause keys
      // 415: Play, 19: Pause, 10252 / 179: Play/Pause toggle
      if (keyCode === 415 || keyCode === 19 || keyCode === 10252 || keyCode === 179) {
        if (onTogglePlayPause) {
          e.preventDefault();
          onTogglePlayPause();
          return;
        }
      }

      // TV FastForward / Skip Next (417)
      if (keyCode === 417) {
        if (onNextTrack) {
          e.preventDefault();
          onNextTrack();
          return;
        }
      }

      // TV Rewind / Skip Previous (412)
      if (keyCode === 412) {
        if (onPreviousTrack) {
          e.preventDefault();
          onPreviousTrack();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isFullscreen,
    onToggleFullscreen,
    onTogglePlayPause,
    onNextTrack,
    onPreviousTrack,
    isModalOpen,
    onCloseModal,
  ]);
}

import React from 'react';
import { Button } from '@/components/ui/button';
import { Film, ExternalLink, Radio, SkipForward } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

interface NowPlayingTrackInfoProps {
  videoId: string | null;
  videoTitle?: string;
  videoUrl: string | null;
  currentVideo?: string;
  isLocked: boolean;
  isLoading?: boolean;
  isLyricsActive?: boolean;
  onToggleLyrics?: () => void;
  onStartRadio: () => Promise<void>;
  onForceSkip?: () => Promise<void>;
}

export const NowPlayingTrackInfo: React.FC<NowPlayingTrackInfoProps> = ({
  videoId,
  videoTitle,
  videoUrl,
  currentVideo,
  isLocked,
  isLoading = false,
  isLyricsActive = false,
  onToggleLyrics,
  onStartRadio,
  onForceSkip,
}) => {
  const { t } = useTranslation();
  const [loadingLongerThan12s, setLoadingLongerThan12s] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isLoading) {
      setLoadingLongerThan12s(false);
      return;
    }
    const timer = setTimeout(() => {
      setLoadingLongerThan12s(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <div className="flex items-center justify-between gap-3 min-w-0 border-b border-border/40 pb-2.5">
      <div
        className={`flex items-center gap-3 min-w-0 flex-1 ${
          onToggleLyrics ? 'cursor-pointer group select-none' : ''
        }`}
        onClick={onToggleLyrics}
        title={onToggleLyrics ? (isLyricsActive ? 'Back to Search' : 'View Synced Lyrics') : undefined}
      >
        {videoId ? (
          <div className="relative flex-shrink-0 w-14 h-10 sm:w-16 sm:h-11 overflow-hidden border border-primary/30 bg-black">
            <img
              src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
              alt="Thumbnail"
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-14 h-10 sm:w-16 sm:h-11 flex-shrink-0 flex items-center justify-center bg-muted/30 border border-border text-muted-foreground">
            <Film className="w-5 h-5" />
          </div>
        )}

        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <p className="text-xs sm:text-sm font-bold text-foreground truncate font-sans">
            {videoTitle || t('remote.noVideoSelected')}
          </p>
          {loadingLongerThan12s && onForceSkip && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono text-amber-400/90">
                TV is taking a while to respond...
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onForceSkip();
                }}
                className="text-[10px] font-mono uppercase font-bold text-destructive hover:underline flex items-center gap-1 cursor-pointer"
              >
                <SkipForward className="w-2.5 h-2.5" />
                <span>Force Skip</span>
              </button>
            </div>
          )}
          {videoUrl ? (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-mono text-primary/80 hover:text-primary hover:underline flex items-center gap-1.5 truncate mt-0.5"
              title="Open video on YouTube"
            >
              <span className="truncate">{videoUrl}</span>
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
            </a>
          ) : currentVideo ? (
            <span className="text-xs font-mono text-primary/80 truncate mt-0.5">
              {currentVideo}
            </span>
          ) : null}
        </div>
      </div>

      {videoId && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onStartRadio}
            disabled={isLocked}
            className="h-8 sm:h-9 px-2 sm:px-3 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 border-primary/30 hover:border-primary hover:bg-primary/10 transition-colors cursor-pointer"
            title={t('remote.startRadio')}
          >
            <Radio className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="hidden min-[480px]:inline">{t('remote.startRadio')}</span>
          </Button>
        </div>
      )}
    </div>
  );
};

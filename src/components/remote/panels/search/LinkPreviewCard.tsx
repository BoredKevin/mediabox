import React from 'react';
import { Film, Plus, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/context/LanguageContext';
import { VideoInfo } from '@/lib/youtube';

interface LinkPreviewCardProps {
  previewInfo: {
    id: string;
    url: string;
    info?: VideoInfo;
    isLoading: boolean;
  };
  isLocked: boolean;
  isSubmittingLink: boolean;
  onAdd: () => void;
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({
  previewInfo,
  isLocked,
  isSubmittingLink,
  onAdd,
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-3 sm:p-4 bg-card border border-border flex flex-col gap-3 animate-in fade-in-0 rounded-md">
      <div className="flex items-center justify-between">
        <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5" />
          Detected YouTube Video
        </span>
        <Badge variant="outline" className="text-[10px] font-mono border-border text-foreground">
          Ready to Queue
        </Badge>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative aspect-video w-full sm:w-48 bg-black overflow-hidden rounded-md border border-border flex-shrink-0">
          <img
            src={
              previewInfo.info?.thumbnailUrl ||
              `https://img.youtube.com/vi/${previewInfo.id}/hqdefault.jpg`
            }
            alt="Preview thumbnail"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-xs sm:text-sm font-bold text-foreground line-clamp-2 leading-snug">
            {previewInfo.info?.title || (previewInfo.isLoading ? 'Resolving title...' : 'YouTube Video')}
          </p>
          {previewInfo.info?.channelTitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {previewInfo.info.channelTitle}
            </p>
          )}
          <p className="text-[10px] font-mono text-primary/80 mt-1 truncate">
            {previewInfo.url}
          </p>
        </div>

        <Button
          type="button"
          variant="cyber"
          chamfer="dual"
          onClick={onAdd}
          disabled={isLocked || isSubmittingLink}
          className="px-4 py-2 font-bold uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 h-10 sm:h-11 flex-shrink-0 cursor-pointer"
          title="Add this video to queue"
        >
          {isSubmittingLink ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          <span>{t('remote.addBtn')}</span>
        </Button>
      </div>
    </div>
  );
};

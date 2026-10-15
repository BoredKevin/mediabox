import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, Check, Search } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { SearchResultItem } from '@/lib/roomUtils';

interface SearchResultsGridProps {
  isSearching: boolean;
  searchResults: SearchResultItem[];
  addedVideoIds: Set<string>;
  isLocked: boolean;
  previewActive: boolean;
  onAddResult: (result: SearchResultItem) => void;
}

export const SearchResultsGrid: React.FC<SearchResultsGridProps> = ({
  isSearching,
  searchResults,
  addedVideoIds,
  isLocked,
  previewActive,
  onAddResult,
}) => {
  const { t } = useTranslation();

  // Skeletons while searching
  if (isSearching) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-2 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col bg-muted/20 border border-border/40 rounded-[var(--radius)] overflow-hidden"
          >
            <div className="aspect-video bg-muted/40 w-full" />
            <div className="p-3 flex flex-col gap-2">
              <div className="h-3.5 bg-muted/50 rounded w-3/4" />
              <div className="h-3 bg-muted/30 rounded w-1/2" />
              <div className="h-7 bg-muted/20 rounded mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Results list
  if (searchResults.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {searchResults.length} Results
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pr-1">
          {searchResults.map((res) => {
            const isAdded =
              addedVideoIds.has(res.id) ||
              (res.url ? addedVideoIds.has(res.url) : false);

            return (
              <div
                key={res.id}
                onClick={() => onAddResult(res)}
                className={cn(
                  'group/card flex flex-col transition-all duration-200 overflow-hidden select-none rounded-md',
                  isAdded
                    ? 'border-2 border-emerald-500/90 bg-emerald-950/30 hover:bg-emerald-950/40 cursor-default'
                    : 'bg-card hover:bg-muted/40 border border-border hover:border-foreground/60 shadow-sm cursor-pointer'
                )}
              >
                {/* 16:9 Thumbnail with duration overlay & hover action */}
                <div className="relative aspect-video w-full bg-black overflow-hidden flex-shrink-0">
                  <img
                    src={res.thumbnail}
                    alt={res.title}
                    className={cn(
                      'w-full h-full object-cover transition-transform duration-300',
                      !isAdded && 'group-hover/card:scale-105'
                    )}
                    loading="lazy"
                  />

                  {/* Added Corner Check Badge */}
                  {isAdded && (
                    <div className="absolute top-2 right-2 z-10 bg-emerald-600/95 border border-emerald-400 text-white rounded-full p-1 shadow-lg flex items-center justify-center pointer-events-none">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}

                  {/* Hover Overlay with Add / Added Button */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 flex items-center justify-center p-2">
                    <Button
                      variant="cyber"
                      size="sm"
                      chamfer="dual"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddResult(res);
                      }}
                      disabled={isLocked}
                      className={cn(
                        'px-3.5 py-2 font-bold uppercase text-xs tracking-wider flex items-center gap-1.5 shadow-xl transition-all duration-200',
                        isAdded
                          ? '!bg-emerald-600 hover:!bg-emerald-500 !text-white !border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] cursor-default'
                          : 'cursor-pointer'
                      )}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-4 h-4 text-white" />
                          <span>{t('remote.addedBtn')}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>{t('remote.addBtn')}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Video Info below thumbnail */}
                <div className="p-3 flex flex-col flex-1 justify-between gap-2">
                  <div>
                    <h4
                      className={cn(
                        'text-xs sm:text-sm font-semibold line-clamp-2 leading-snug transition-colors',
                        isAdded
                          ? 'text-emerald-300'
                          : 'text-foreground group-hover/card:text-primary'
                      )}
                      title={res.title}
                    >
                      {res.title}
                    </h4>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">
                      {res.channelTitle}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Empty starter state
  if (!previewActive) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground">
        <div className="w-14 h-14 rounded-full bg-muted/20 border border-border flex items-center justify-center mb-3 text-muted-foreground/60">
          <Search className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          Search YouTube for Videos
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
          Type any song, artist, title, or paste a YouTube video URL to find and queue up to 25 videos on the TV.
        </p>
      </div>
    );
  }

  return null;
};

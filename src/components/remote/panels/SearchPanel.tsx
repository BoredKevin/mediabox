import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Plus,
  Loader2,
  X,
  ShieldCheck,
} from 'lucide-react';
import { RoomState, SearchResultItem } from '@/lib/roomUtils';
import { fetchVideoTitle, parseYouTubeVideoId, VideoInfo } from '@/lib/youtube';
import { TurnstileWidget, TurnstileRef } from '@/components/common/TurnstileWidget';

import { useYouTubeSearch } from './search/useYouTubeSearch';
import { LinkPreviewCard } from './search/LinkPreviewCard';
import { SearchResultsGrid } from './search/SearchResultsGrid';

interface SearchPanelProps {
  roomCode: string;
  roomState: RoomState | null;
  user: any;
  isHostOrAdmin: boolean;
  onAddToQueue: (url: string, title?: string) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  embedded?: boolean;
  onOpenHostSettings?: () => void;
  queue?: any[];
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  roomCode,
  roomState,
  user,
  isHostOrAdmin,
  onAddToQueue,
  showToast,
  embedded = false,
  queue = [],
}) => {
  const { t } = useTranslation();
  const isLocked = Boolean(roomState?.isLocked) && !isHostOrAdmin;

  const [inputValue, setInputValue] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [addedVideoIds, setAddedVideoIds] = useState<Set<string>>(new Set());
  const turnstileRef = useRef<TurnstileRef>(null);

  // Search query lifecycle via Convex action with clearance check & Turnstile
  const {
    isSearching,
    searchError,
    searchResults,
    performSearch,
    setSearchError,
    isCleared,
  } = useYouTubeSearch({
    roomCode,
    user,
    preferMusicVideos: roomState?.preferMusicVideos ?? true,
    turnstileRef,
  });

  // Keep addedVideoIds synchronized with current room queue
  useEffect(() => {
    if (!queue || !Array.isArray(queue)) return;
    const ids = new Set<string>();
    queue.forEach((item: any) => {
      if (item?.url) {
        ids.add(item.url);
        const ytId = parseYouTubeVideoId(item.url);
        if (ytId) ids.add(ytId);
      }
      if (item?.id) {
        ids.add(item.id);
      }
    });
    setAddedVideoIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, [queue]);

  // Detected link preview state
  const [previewInfo, setPreviewInfo] = useState<{
    id: string;
    url: string;
    info?: VideoInfo;
    isLoading: boolean;
  } | null>(null);

  const titleFetchAbortRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // WebOS Voice Recognition & Virtual Keyboard IME fix
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handleNativeInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target) {
        setInputValue(target.value);
        if (searchError) setSearchError(null);
      }
    };

    el.addEventListener('input', handleNativeInput);
    el.addEventListener('change', handleNativeInput);
    el.addEventListener('compositionend', handleNativeInput);
    el.addEventListener('textInput', handleNativeInput as any);
    el.addEventListener('blur', handleNativeInput);

    return () => {
      el.removeEventListener('input', handleNativeInput);
      el.removeEventListener('change', handleNativeInput);
      el.removeEventListener('compositionend', handleNativeInput);
      el.removeEventListener('textInput', handleNativeInput as any);
      el.removeEventListener('blur', handleNativeInput);
    };
  }, [searchError, setSearchError]);

  // Detect link vs query on input change
  const detectedYtId = parseYouTubeVideoId(inputValue.trim());
  const isDetectedUrl = Boolean(detectedYtId);

  useEffect(() => {
    if (!detectedYtId) {
      setPreviewInfo(null);
      return;
    }

    const fullUrl = `https://www.youtube.com/watch?v=${detectedYtId}`;
    const fetchId = Date.now();
    titleFetchAbortRef.current = fetchId;

    setPreviewInfo({
      id: detectedYtId,
      url: fullUrl,
      isLoading: true,
    });

    fetchVideoTitle(fullUrl).then((info) => {
      if (titleFetchAbortRef.current === fetchId) {
        setPreviewInfo({
          id: detectedYtId,
          url: fullUrl,
          info,
          isLoading: false,
        });
      }
    });
  }, [detectedYtId]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentValue = inputRef.current ? inputRef.current.value : inputValue;
    const cleanInput = currentValue.trim();
    if (currentValue !== inputValue) {
      setInputValue(currentValue);
    }
    if (!cleanInput || !roomCode || isLocked) return;

    const currentYtId = parseYouTubeVideoId(cleanInput);

    // Case 1: Pasted YouTube Link -> Submit to Queue
    if (currentYtId) {
      setIsSubmittingLink(true);
      try {
        const fullUrl = `https://www.youtube.com/watch?v=${currentYtId}`;
        const title = previewInfo?.info?.title || (await fetchVideoTitle(fullUrl)).title;
        await onAddToQueue(fullUrl, title);
        setInputValue('');
        if (inputRef.current) inputRef.current.value = '';
        setPreviewInfo(null);
        showToast(t('toasts.videoAddedQueue'), 'success');
      } catch (err: any) {
        showToast(err.message || 'Failed to add video URL', 'error');
      } finally {
        setIsSubmittingLink(false);
      }
      return;
    }

    // Case 2: Keyword Search Query
    performSearch(cleanInput);
  };

  const handleAddSearchResult = (result: SearchResultItem) => {
    if (isLocked) {
      showToast(t('toasts.controlsLockedByAdmin'), 'error');
      return;
    }
    const isAlreadyAdded =
      addedVideoIds.has(result.id) ||
      (result.url ? addedVideoIds.has(result.url) : false);
    if (isAlreadyAdded) return;

    setAddedVideoIds((prev) => {
      const next = new Set(prev);
      if (result.id) next.add(result.id);
      if (result.url) next.add(result.url);
      return next;
    });
    onAddToQueue(result.url, result.title);
  };

  const handleAddDirectPreview = async () => {
    if (!previewInfo || isLocked) return;
    setIsSubmittingLink(true);
    try {
      await onAddToQueue(previewInfo.url, previewInfo.info?.title);
      setInputValue('');
      if (inputRef.current) inputRef.current.value = '';
      setPreviewInfo(null);
      showToast(t('toasts.videoAddedQueue'), 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add video', 'error');
    } finally {
      setIsSubmittingLink(false);
    }
  };

  const content = (
    <div className="flex flex-col gap-4">
      {/* Invisible Cloudflare Turnstile Verification Widget */}
      <TurnstileWidget ref={turnstileRef} />

      {/* Search / Paste URL Form */}
      <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row items-stretch gap-2">
        <div className="relative flex-1 min-w-0">
          {isDetectedUrl ? (
            <Plus className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none z-10" />
          ) : (
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          )}
          <Input
            ref={inputRef}
            type="text"
            chamfer="dual"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (searchError) setSearchError(null);
            }}
            disabled={isLocked || isSearching || isSubmittingLink}
            placeholder={
              isLocked
                ? t('remote.searchQueueLocked')
                : 'Search YouTube Music or paste video link / URL...'
            }
            className="pl-10 pr-9 text-xs sm:text-sm h-11 w-full"
          />
          {inputValue && (
            <button
              type="button"
              onClick={() => {
                setInputValue('');
                if (inputRef.current) inputRef.current.value = '';
                setPreviewInfo(null);
                setSearchError(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors cursor-pointer"
              title="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <Button
          type="submit"
          variant="cyber"
          chamfer="dual"
          disabled={isLocked || isSearching || isSubmittingLink || !inputValue.trim()}
          className="h-11 px-6 font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer"
        >
          {isSubmittingLink || isSearching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isDetectedUrl ? 'Submitting...' : t('remote.searching')}</span>
            </>
          ) : isDetectedUrl ? (
            <>
              <Plus className="w-4 h-4" />
              <span>{t('remote.submitBtn')}</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              <span>{t('remote.searchBtn')}</span>
            </>
          )}
        </Button>
      </form>

      {/* TV Clearance Active indicator */}
      {isCleared && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono text-primary bg-primary/10 border border-primary/30 rounded-[var(--radius)]">
          <ShieldCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span>Clearance Active</span>
        </div>
      )}

      {/* Detected Link Preview */}
      {previewInfo && (
        <LinkPreviewCard
          previewInfo={previewInfo}
          isLocked={isLocked}
          isSubmittingLink={isSubmittingLink}
          onAdd={handleAddDirectPreview}
        />
      )}

      {/* Search Error Message */}
      {searchError && (
        <p className="text-xs text-destructive font-mono p-2.5 bg-destructive/10 border border-destructive/30 leading-relaxed rounded-[var(--radius)]">
          {searchError}
        </p>
      )}

      {/* YouTube Video Grid Search Results & Skeletons */}
      <SearchResultsGrid
        isSearching={isSearching}
        searchResults={searchResults}
        addedVideoIds={addedVideoIds}
        isLocked={isLocked}
        previewActive={Boolean(previewInfo)}
        onAddResult={handleAddSearchResult}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card cornerLines className="p-4 bg-card border-border mb-5">
      {content}
    </Card>
  );
};

export default SearchPanel;

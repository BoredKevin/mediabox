import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { User as FirebaseUser } from 'firebase/auth';
import { database } from '@/lib/firebase';
import { useTranslation } from '@/context/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Key,
  X,
} from 'lucide-react';
import { RoomState, SearchResultItem } from '@/lib/roomUtils';
import { fetchVideoTitle, parseYouTubeVideoId, VideoInfo } from '@/lib/youtube';

import { useYouTubeSearch } from './search/useYouTubeSearch';
import { LinkPreviewCard } from './search/LinkPreviewCard';
import { SearchResultsGrid } from './search/SearchResultsGrid';

interface SearchPanelProps {
  roomCode: string;
  roomState: RoomState | null;
  user: FirebaseUser | null;
  isHostOrAdmin: boolean;
  sendCommand: (type: any, payload?: any) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  embedded?: boolean;
  onOpenHostSettings?: () => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  roomCode,
  roomState,
  user,
  isHostOrAdmin,
  sendCommand,
  showToast,
  embedded = false,
  onOpenHostSettings,
}) => {
  const { t } = useTranslation();
  const searchSettings = roomState?.searchSettings;
  const isLocked = Boolean(roomState?.isLocked) && !isHostOrAdmin;

  const [inputValue, setInputValue] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [addedVideoIds, setAddedVideoIds] = useState<Set<string>>(new Set());

  // Search query lifecycle
  const {
    isSearching,
    searchError,
    searchResults,
    performSearch,
    setSearchError,
  } = useYouTubeSearch({
    roomCode,
    user,
    isProxyConfigured: Boolean(searchSettings?.isProxyConfigured),
  });

  // Keep addedVideoIds synchronized with current room queue
  useEffect(() => {
    if (!roomCode) return;
    const queueRefNode = ref(database, `rooms/${roomCode}/queue`);
    const unsub = onValue(queueRefNode, (snapshot) => {
      if (!snapshot.exists()) return;
      const val = snapshot.val();
      const ids = new Set<string>();
      Object.values(val).forEach((item: any) => {
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
    });
    return () => off(queueRefNode);
  }, [roomCode]);

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
    if (!cleanInput || !user || !roomCode || isLocked) return;

    const currentYtId = parseYouTubeVideoId(cleanInput);

    // Case 1: Pasted YouTube Link -> Submit to Queue
    if (currentYtId) {
      setIsSubmittingLink(true);
      try {
        const fullUrl = `https://www.youtube.com/watch?v=${currentYtId}`;
        const title = previewInfo?.info?.title || (await fetchVideoTitle(fullUrl)).title;
        await sendCommand('addToQueue', { url: fullUrl, title });
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
    sendCommand('addToQueue', { url: result.url, title: result.title });
  };

  const handleAddDirectPreview = async () => {
    if (!previewInfo || isLocked) return;
    setIsSubmittingLink(true);
    try {
      await sendCommand('addToQueue', {
        url: previewInfo.url,
        title: previewInfo.info?.title,
      });
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
                : 'Search YouTube or paste video link / URL...'
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors"
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

      {/* Detected Link Preview */}
      {previewInfo && (
        <LinkPreviewCard
          previewInfo={previewInfo}
          isLocked={isLocked}
          isSubmittingLink={isSubmittingLink}
          onAdd={handleAddDirectPreview}
        />
      )}

      {/* No Key / Proxy Contextual Banner */}
      {!searchSettings?.isProxyConfigured && (
        <div className="p-3 bg-muted/20 border border-amber-800/60 text-xs flex flex-col gap-2 rounded-[var(--radius)]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold flex items-center gap-1.5 text-amber-400">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>{t('remote.noTvConnected')}</span>
            </span>
            {isHostOrAdmin && onOpenHostSettings && (
              <Button
                variant="outline"
                size="sm"
                chamfer="top-right"
                onClick={onOpenHostSettings}
                className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider text-amber-400 border-amber-500/50 hover:bg-amber-950/40"
              >
                <Key className="w-3 h-3 mr-1" />
                {t('remote.pairTvKey')}
              </Button>
            )}
          </div>
          <p className="text-[11px] text-amber-300/80 leading-relaxed">
            {t('remote.noTvConnectedDesc')}
          </p>
        </div>
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

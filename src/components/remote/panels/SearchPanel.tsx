import React, { useState, useEffect, useRef, useTransition } from 'react';
import { ref, set, onValue, off, remove } from 'firebase/database';
import { User as FirebaseUser } from 'firebase/auth';
import { database } from '@/lib/firebase';
import { useTranslation } from '@/context/LanguageContext';
import { Card, Button, Badge } from '@boredkevin/ui';
import { Input } from '@/components/ui/input';
import {
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Key,
  ExternalLink,
  Film,
  X,
} from 'lucide-react';
import { RoomState, SearchResultItem } from '@/lib/roomUtils';
import { fetchVideoTitle, parseYouTubeVideoId, VideoInfo } from '@/lib/youtube';

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

  // Single unified input value
  const [inputValue, setInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);

  // Detected link preview state
  const [previewInfo, setPreviewInfo] = useState<{
    id: string;
    url: string;
    info?: VideoInfo;
    isLoading: boolean;
  } | null>(null);

  // Active search request listener ref
  const activeReqRef = useRef<{ reqId: string; timeoutId: any; nodeRef: any } | null>(null);
  const titleFetchAbortRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // WebOS Voice Recognition & Virtual Keyboard IME fix:
  // WebOS virtual keyboard uses a non-standard IME/voice dictation method that
  // inserts the full string directly into the DOM and suppresses React's SyntheticEvent onChange.
  // Attaching native DOM listeners directly to the underlying <input> element via ref
  // ensures raw DOM input events are captured and state is synced immediately.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handleNativeInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target) {
        setInputValue(target.value);
        setSearchError(null);
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
  }, []);

  // Clean up any pending search listeners on unmount
  useEffect(() => {
    return () => {
      if (activeReqRef.current) {
        clearTimeout(activeReqRef.current.timeoutId);
        off(activeReqRef.current.nodeRef);
      }
    };
  }, []);

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
    if (!searchSettings?.hasApiKeys) {
      setSearchError(
        'Keyword search requires an active YouTube API key on the TV. You can paste any direct YouTube link above to queue videos with zero setup.'
      );
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    if (activeReqRef.current) {
      clearTimeout(activeReqRef.current.timeoutId);
      off(activeReqRef.current.nodeRef);
    }

    const reqId = `${user.uid}_${Date.now()}`;
    const searchReqRef = ref(database, `rooms/${roomCode}/searchRequests/${reqId}`);
    const searchResRef = ref(database, `rooms/${roomCode}/searchResults/${reqId}`);

    const timeoutId = setTimeout(() => {
      off(searchResRef);
      setIsSearching(false);
      setSearchError('TV not responding (timeout after 10s). Please check TV connection.');
      activeReqRef.current = null;
    }, 10000);

    activeReqRef.current = { reqId, timeoutId, nodeRef: searchResRef };

    onValue(searchResRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.val();
      clearTimeout(timeoutId);
      off(searchResRef);
      setIsSearching(false);
      activeReqRef.current = null;

      if (data.error) {
        setSearchError(data.error);
        setSearchResults([]);
      } else if (Array.isArray(data.results)) {
        setSearchResults(data.results);
      }

      remove(searchResRef).catch(() => { });
    });

    try {
      await set(searchReqRef, {
        requestedBy: user.uid,
        query: cleanInput,
        createdAt: Date.now(),
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      off(searchResRef);
      setIsSearching(false);
      setSearchError(err.message || 'Failed to submit search request to TV.');
      activeReqRef.current = null;
    }
  };

  const handleAddSearchResult = (result: SearchResultItem) => {
    if (isLocked) {
      showToast(t('toasts.controlsLockedByAdmin'), 'error');
      return;
    }
    sendCommand('addToQueue', { url: result.url, title: result.title });
    showToast(t('toasts.videoAddedQueue'), 'success');
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
      {/* YouTube-Style Search / Paste URL Form */}
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
          disabled={
            isLocked ||
            isSearching ||
            isSubmittingLink ||
            !inputValue.trim()
          }
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

      {/* Detected Link Preview (Single Item Preview Card) */}
      {previewInfo && (
        <div className="p-3 sm:p-4 bg-card/80 border border-primary/40 flex flex-col gap-3 animate-in fade-in-0 rounded-[var(--radius)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" />
              Detected YouTube Video
            </span>
            <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary">
              Ready to Queue
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative aspect-video w-full sm:w-48 bg-black overflow-hidden rounded-[calc(var(--radius)-2px)] border border-border flex-shrink-0">
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
              onClick={handleAddDirectPreview}
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
      )}

      {/* No Key Contextual Banner (Displayed Below Search Bar) */}
      {!searchSettings?.hasApiKeys && (
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

      {/* Skeletons while searching */}
      {isSearching && (
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
      )}

      {/* YouTube-Style Video Grid Search Results */}
      {!isSearching && searchResults.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {searchResults.length} Results
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pr-1">
            {searchResults.map((res) => (
              <div
                key={res.id}
                onClick={() => handleAddSearchResult(res)}
                className="group/card flex flex-col bg-card/70 hover:bg-card/95 border border-border/60 hover:border-primary/60 transition-all duration-200 overflow-hidden shadow-sm hover:shadow-[0_0_20px_rgba(0,200,212,0.15)] cursor-pointer select-none rounded-[var(--radius)]"
              >
                {/* 16:9 Thumbnail with duration overlay & hover action */}
                <div className="relative aspect-video w-full bg-black overflow-hidden flex-shrink-0">
                  <img
                    src={res.thumbnail}
                    alt={res.title}
                    className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {/* Hover Overlay with Add Button */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 flex items-center justify-center p-2">
                    <Button
                      variant="cyber"
                      size="sm"
                      chamfer="dual"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddSearchResult(res);
                      }}
                      disabled={isLocked}
                      className="px-3.5 py-2 font-bold uppercase text-xs tracking-wider flex items-center gap-1.5 shadow-xl cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t('remote.addBtn')}</span>
                    </Button>
                  </div>
                </div>

                {/* Video Info below thumbnail */}
                <div className="p-3 flex flex-col flex-1 justify-between gap-2">
                  <div>
                    <h4
                      className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover/card:text-primary transition-colors"
                      title={res.title}
                    >
                      {res.title}
                    </h4>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">
                      {res.channelTitle}
                    </p>
                  </div>

                  {/* Direct Add Button on Mobile or for quick touch */}
                  <div className="pt-1 mt-auto sm:hidden">
                    <Button
                      variant="cyber"
                      size="sm"
                      chamfer="top-right"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddSearchResult(res);
                      }}
                      disabled={isLocked}
                      className="w-full py-1 text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('remote.addBtn')}</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty Starter State */}
      {!isSearching && searchResults.length === 0 && !previewInfo && (
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
      )}
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

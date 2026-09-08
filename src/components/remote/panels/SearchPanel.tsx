import React, { useState, useEffect, useRef, useTransition } from 'react';
import { ref, set, onValue, off, remove } from 'firebase/database';
import { User as FirebaseUser } from 'firebase/auth';
import { database } from '@/lib/firebase';
import { useTranslation } from '@/context/LanguageContext';
import { Card, Button, Input, Badge } from '@boredkevin/ui';
import {
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Key,
  ExternalLink,
  Film,
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
    const cleanInput = inputValue.trim();
    if (!cleanInput || !user || !roomCode || isLocked) return;

    // Case 1: Pasted YouTube Link -> Submit to Queue
    if (detectedYtId) {
      setIsSubmittingLink(true);
      try {
        const fullUrl = `https://www.youtube.com/watch?v=${detectedYtId}`;
        const title = previewInfo?.info?.title || (await fetchVideoTitle(fullUrl)).title;
        await sendCommand('addToQueue', { url: fullUrl, title });
        setInputValue('');
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
      {/* Search / Paste URL Form (Input line + Button line) */}
      <form onSubmit={handleFormSubmit} className="flex flex-col gap-2.5">
        {/* Line 1: Input Field across */}
        <div className="relative w-full">
          {isDetectedUrl ? (
            <Plus className="absolute left-3 top-3 h-4 w-4 text-primary pointer-events-none z-10" />
          ) : (
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          )}
          <Input
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
            className="pl-9 text-xs sm:text-sm h-10 w-full"
          />
        </div>

        {/* Line 2: Action Button below the input */}
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
          className="w-full py-2.5 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 h-10"
        >
          {isSubmittingLink || isSearching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isDetectedUrl ? 'Resolving & Submitting...' : t('remote.searching')}</span>
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
        <div className="p-3 bg-muted/20 border border-primary/40 flex flex-col gap-2 animate-in fade-in-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-1">
              <Film className="w-3 h-3" />
              Detected Video Link
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Ready to Queue
            </span>
          </div>

          <div className="flex items-center gap-3">
            <img
              src={
                previewInfo.info?.thumbnailUrl ||
                `https://img.youtube.com/vi/${previewInfo.id}/hqdefault.jpg`
              }
              alt="Preview thumbnail"
              className="w-20 h-14 object-cover border border-border flex-shrink-0 bg-black"
            />

            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-xs sm:text-sm font-bold text-foreground truncate font-sans">
                {previewInfo.info?.title || (previewInfo.isLoading ? 'Resolving title...' : 'YouTube Video')}
              </p>
              {previewInfo.info?.channelTitle && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {previewInfo.info.channelTitle}
                </p>
              )}
              <p className="text-[10px] font-mono text-primary/80 truncate">
                {previewInfo.url}
              </p>
            </div>

            <Button
              type="button"
              variant="cyber"
              size="sm"
              chamfer="top-right"
              onClick={handleAddDirectPreview}
              disabled={isLocked || isSubmittingLink}
              className="px-3 py-2 font-bold uppercase text-xs tracking-wider flex items-center gap-1.5 h-auto flex-shrink-0"
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
        <div className="p-3 bg-muted/20 border border-amber-800/60 text-xs flex flex-col gap-2">
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
        <p className="text-xs text-destructive font-mono p-2.5 bg-destructive/10 border border-destructive/30 leading-relaxed">
          {searchError}
        </p>
      )}

      {/* Multi-result Keyword Search Results */}
      {searchResults.length > 0 && (
        <div className="flex flex-col gap-2 max-h-72 sm:max-h-96 overflow-y-auto pr-1">
          {searchResults.map((res) => (
            <div
              key={res.id}
              className="flex gap-2.5 p-2 bg-muted/30 border border-border hover:border-primary/50 transition-colors items-center"
            >
              <img
                src={res.thumbnail}
                alt={res.title}
                className="w-16 h-11 object-cover border border-border flex-shrink-0"
              />
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <p className="text-xs font-bold text-foreground truncate">{res.title}</p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  {res.channelTitle}
                </p>
              </div>
              <Button
                variant="cyber"
                size="sm"
                chamfer="top-right"
                onClick={() => handleAddSearchResult(res)}
                disabled={isLocked}
                className="px-2.5 py-1.5 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 h-auto flex-shrink-0"
                title="Add video to queue"
              >
                <Plus className="w-3 h-3" />
                <span>{t('remote.addBtn')}</span>
              </Button>
            </div>
          ))}
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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Card } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';
import { RoomState, SearchResultItem } from '@/lib/roomUtils';
import { fetchVideoTitle, parseYouTubeVideoId } from '@/lib/youtube';
import { TurnstileWidget, TurnstileRef } from '@/components/common/TurnstileWidget';

import { useYouTubeSearch } from './search/useYouTubeSearch';
import { LinkPreviewCard } from './search/LinkPreviewCard';
import { SearchResultsGrid } from './search/SearchResultsGrid';
import { useLinkPasteDetection } from './search/useLinkPasteDetection';
import { SearchInputBar } from './search/SearchInputBar';

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
  const [isTurnstileVerifying, setIsTurnstileVerifying] = useState(false);
  const turnstileRef = useRef<TurnstileRef>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search query lifecycle via Convex action with clearance check & Turnstile
  const {
    isSearching,
    isVerifying,
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
    isTurnstileVerifying,
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
  const { isDetectedUrl, previewInfo, setPreviewInfo } = useLinkPasteDetection(inputValue);

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

    // Case 2: Keyword Search Query (Blocked if Turnstile is verifying humanity)
    if (isVerifying) return;
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

  const handleClear = () => {
    setInputValue('');
    if (inputRef.current) inputRef.current.value = '';
    setPreviewInfo(null);
    setSearchError(null);
  };

  const handleTurnstileError = useCallback((err: string) => {
    setSearchError(err);
  }, [setSearchError]);

  const content = (
    <div className="flex flex-col gap-4">
      {/* Invisible Cloudflare Turnstile Verification Widget */}
      <TurnstileWidget
        ref={turnstileRef}
        onVerifyingChange={setIsTurnstileVerifying}
        isCleared={isCleared}
        onError={handleTurnstileError}
      />

      {/* Search / Paste URL Form */}
      <SearchInputBar
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={handleFormSubmit}
        onClear={handleClear}
        inputRef={inputRef}
        isLocked={isLocked}
        isSearching={isSearching}
        isVerifying={isVerifying}
        isSubmittingLink={isSubmittingLink}
        isDetectedUrl={isDetectedUrl}
        onClearError={() => searchError && setSearchError(null)}
      />

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

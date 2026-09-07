import React, { useState, useEffect, useRef } from 'react';
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
  Lock,
  ExternalLink,
  Key,
  Shield,
  Trash2,
  Check,
} from 'lucide-react';
import { RoomState, SearchResultItem, SearchSettings } from '@/lib/roomUtils';
import { fetchVideoTitle, parseYouTubeVideoId } from '@/lib/youtube';

interface SearchPanelProps {
  roomCode: string;
  roomState: RoomState | null;
  user: FirebaseUser | null;
  isHostOrAdmin: boolean;
  sendCommand: (type: any, payload?: any) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  roomCode,
  roomState,
  user,
  isHostOrAdmin,
  sendCommand,
  showToast,
}) => {
  const { t } = useTranslation();
  const searchSettings = roomState?.searchSettings;
  const isLocked = Boolean(roomState?.isLocked) && !isHostOrAdmin;

  const [inputTab, setInputTab] = useState<'search' | 'url'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Direct URL input state
  const [queueInputUrl, setQueueInputUrl] = useState('');
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false);

  // Active search request listener ref
  const activeReqRef = useRef<{ reqId: string; timeoutId: any; nodeRef: any } | null>(null);

  // Remote key management for host state
  const [showRemoteKeyForm, setShowRemoteKeyForm] = useState(false);
  const [remoteKeyLabel, setRemoteKeyLabel] = useState('');
  const [remoteKeyValue, setRemoteKeyValue] = useState('');

  // Clean up any pending search listeners on unmount
  useEffect(() => {
    return () => {
      if (activeReqRef.current) {
        clearTimeout(activeReqRef.current.timeoutId);
        off(activeReqRef.current.nodeRef);
      }
    };
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = searchQuery.trim();
    if (!cleanQuery || !user || !roomCode || isLocked) return;

    // Guard: TV has no API keys
    if (!searchSettings?.hasApiKeys) {
      setSearchError('No active YouTube Data API key configured on the TV.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    // Clear previous pending search if any
    if (activeReqRef.current) {
      clearTimeout(activeReqRef.current.timeoutId);
      off(activeReqRef.current.nodeRef);
    }

    const reqId = `${user.uid}_${Date.now()}`;
    const searchReqRef = ref(database, `rooms/${roomCode}/searchRequests/${reqId}`);
    const searchResRef = ref(database, `rooms/${roomCode}/searchResults/${reqId}`);

    // Set 10-second timeout
    const timeoutId = setTimeout(() => {
      off(searchResRef);
      setIsSearching(false);
      setSearchError('TV not responding (timeout after 10s). Please check TV connection.');
      activeReqRef.current = null;
    }, 10000);

    activeReqRef.current = { reqId, timeoutId, nodeRef: searchResRef };

    // Listen for TV response
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

      // Client cleanup of own delivered result node
      remove(searchResRef).catch(() => {});
    });

    try {
      // Write search request node
      await set(searchReqRef, {
        requestedBy: user.uid,
        query: cleanQuery,
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

  const handleAddQueueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueInputUrl.trim() || isLocked) return;

    const ytId = parseYouTubeVideoId(queueInputUrl.trim());
    if (!ytId) {
      showToast(t('toasts.enterValidUrl'), 'error');
      return;
    }

    setIsSubmittingUrl(true);
    try {
      const fullUrl = `https://www.youtube.com/watch?v=${ytId}`;
      const info = await fetchVideoTitle(fullUrl);
      await sendCommand('addToQueue', { url: fullUrl, title: info.title });
      setQueueInputUrl('');
      showToast(t('toasts.videoAddedQueue'), 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add video URL', 'error');
    } finally {
      setIsSubmittingUrl(false);
    }
  };

  const handleAddRemoteKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remoteKeyValue.trim()) return;

    await sendCommand('manageApiKeys', {
      action: 'add',
      key: remoteKeyValue.trim(),
      label: remoteKeyLabel.trim() || 'Remote Added Key',
    });
    setRemoteKeyLabel('');
    setRemoteKeyValue('');
    setShowRemoteKeyForm(false);
    showToast('Sent API key to TV!', 'success');
  };

  return (
    <Card cornerLines className="p-4 bg-card border-border mb-5 flex flex-col gap-3">
      {/* Tab Switcher: Search YouTube vs Paste Link */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant={inputTab === 'search' ? 'cyber' : 'outline'}
            size="sm"
            chamfer="top-right"
            onClick={() => setInputTab('search')}
            className="px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 h-auto"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{t('remote.searchYoutubeTab')}</span>
          </Button>
          <Button
            variant={inputTab === 'url' ? 'cyber' : 'outline'}
            size="sm"
            chamfer="top-right"
            onClick={() => setInputTab('url')}
            className="px-3 py-1 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 h-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('remote.pasteLinkTab')}</span>
          </Button>
        </div>

        {isLocked && (
          <span className="text-[10px] text-amber-400 flex items-center gap-1 font-semibold">
            <Lock className="w-3 h-3" /> Locked
          </span>
        )}
      </div>

      {inputTab === 'search' ? (
        <div className="flex flex-col gap-3">
          {/* If TV has no API keys, show info message */}
          {!searchSettings?.hasApiKeys ? (
            <div className="p-3 bg-muted/20 border border-amber-800/60 text-amber-300 text-xs flex flex-col gap-1.5">
              <span className="font-bold flex items-center gap-1.5 text-amber-400">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>No API Key Configured on TV</span>
              </span>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                The TV host has not configured a YouTube API key yet. You can switch to the <strong>Paste Link</strong> tab to queue YouTube links directly with zero setup, or add keys in TV settings.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                <Input
                  type="text"
                  chamfer="dual"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isLocked || isSearching}
                  placeholder={
                    isLocked
                      ? t('remote.searchQueueLocked')
                      : t('remote.searchPlaceholder')
                  }
                  className="pl-9 text-xs"
                />
              </div>
              <Button
                type="submit"
                variant="cyber"
                chamfer="top-right"
                disabled={isSearching || isLocked || !searchQuery.trim()}
                className="px-4 py-2 font-bold uppercase text-xs tracking-wider flex items-center gap-1.5 h-9"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Waiting for TV...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>{t('remote.searchBtn')}</span>
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Search Error Message */}
          {searchError && (
            <p className="text-xs text-destructive font-mono p-2.5 bg-destructive/10 border border-destructive/30 leading-relaxed">
              {searchError}
            </p>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
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
      ) : (
        /* PASTE LINK TAB */
        <form onSubmit={handleAddQueueSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <Plus className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              type="url"
              chamfer="dual"
              value={queueInputUrl}
              onChange={(e) => setQueueInputUrl(e.target.value)}
              disabled={isLocked || isSubmittingUrl}
              placeholder={
                isLocked
                  ? t('remote.searchQueueLocked')
                  : t('remote.pasteUrlPlaceholder')
              }
              className="pl-9 text-xs"
            />
          </div>
          <Button
            type="submit"
            variant="cyber"
            chamfer="dual"
            disabled={isLocked || isSubmittingUrl || !queueInputUrl.trim()}
            className="py-2.5 font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 h-10"
          >
            {isSubmittingUrl ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Resolving Title...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>{t('remote.submitVideoToQueue')}</span>
              </>
            )}
          </Button>
        </form>
      )}

      {/* Privileged Host API Key Management (when enabled on TV) */}
      {isHostOrAdmin && searchSettings?.allowHostKeyManagement && (
        <div className="pt-2 border-t border-border/70 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider">
              <Key className="w-3.5 h-3.5" />
              <span>Remote TV Key Management</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              chamfer="top-right"
              onClick={() => setShowRemoteKeyForm((prev) => !prev)}
              className="h-6 px-2 text-[10px] font-bold uppercase"
            >
              {showRemoteKeyForm ? 'Hide Form' : '+ Add Key via Host'}
            </Button>
          </div>

          {showRemoteKeyForm && (
            <form
              onSubmit={handleAddRemoteKey}
              className="p-3 bg-muted/40 border border-amber-800/50 flex flex-col gap-2 animate-in fade-in-0"
            >
              <Input
                type="text"
                placeholder="Key label (e.g. Host Secondary)"
                value={remoteKeyLabel}
                onChange={(e) => setRemoteKeyLabel(e.target.value)}
                className="text-xs h-8"
              />
              <Input
                type="password"
                placeholder="API Key string (AIzaSy...)"
                value={remoteKeyValue}
                onChange={(e) => setRemoteKeyValue(e.target.value)}
                className="text-xs font-mono h-8"
              />
              <Button
                type="submit"
                variant="cyber"
                chamfer="dual"
                disabled={!remoteKeyValue.trim()}
                className="py-1.5 text-xs font-bold uppercase h-8"
              >
                Send Key to TV
              </Button>
            </form>
          )}
        </div>
      )}
    </Card>
  );
};

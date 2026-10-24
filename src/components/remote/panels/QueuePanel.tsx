import React, { useState, useRef } from 'react';
import { DeviceUser } from '@/lib/deviceAuth';
import { useTranslation } from '@/context/LanguageContext';
import { Card } from '@/components/ui/card';
import { Trash2, Radio, Tv, Plus, GripVertical, Music2 } from 'lucide-react';
import { QueueItem, SearchResultItem, parseYouTubeVideoId } from '@/lib/roomUtils';
import { cn } from '@/lib/utils';

interface QueuePanelProps {
  queue: QueueItem[];
  radioQueue?: SearchResultItem[];
  user: DeviceUser | null;
  currentUid?: string;
  isHostOrAdmin: boolean;
  tvUuid?: string | null;
  membersList: { uid: string; nickname?: string; isTv?: boolean }[];
  onRemoveItem: (itemId: string, itemAddedBy?: string) => Promise<void>;
  onMoveItem?: (index: number, direction: 'up' | 'down') => void;
  onReorderQueue?: (orderedIds: string[]) => void;
  onStartRadio?: () => void;
  onAddRadioTrackToQueue?: (trackId: string) => Promise<void>;
  onDeleteRadioTrack?: (trackId: string) => Promise<void>;
  playback?: {
    status: 'playing' | 'paused' | 'loading';
    positionMs?: number;
    durationMs?: number;
    updatedAt?: number;
  };
  embedded?: boolean;
}

export function formatDuration(seconds?: number): string | null {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return null;
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatWaitTime(seconds: number): string {
  if (seconds <= 30) return 'Starts next';
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return `~${seconds}s`;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `~${hours}h ${remainingMinutes}m` : `~${hours}h`;
  }
  return `~${minutes}m`;
}

const MetadataDot: React.FC = () => (
  <span className="flex-shrink-0 text-zinc-600">•</span>
);

export const QueuePanel: React.FC<QueuePanelProps> = ({
  queue,
  radioQueue = [],
  user,
  currentUid,
  isHostOrAdmin,
  tvUuid,
  membersList,
  onRemoveItem,
  onMoveItem,
  onReorderQueue,
  onStartRadio,
  onAddRadioTrackToQueue,
  onDeleteRadioTrack,
  playback,
  embedded = false,
}) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);

  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const draggingIdxRef = useRef<number | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);

  const effectiveCurrentUid = currentUid || user?.uid;

  // Pointer-events drag-and-drop handler for mobile touch and desktop mice
  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if (!isHostOrAdmin || queue.length <= 1) return;
    e.preventDefault();
    e.stopPropagation();

    setDraggingIdx(index);
    setDragOverIdx(index);
    draggingIdxRef.current = index;
    dragOverIdxRef.current = index;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (draggingIdxRef.current === null || !listRef.current) return;

      const items = Array.from(listRef.current.querySelectorAll('[data-queue-item]'));
      if (items.length === 0) return;

      const clientY = moveEvent.clientY;
      let closestIdx = draggingIdxRef.current;
      let minDistance = Infinity;

      items.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const distance = Math.abs(clientY - midY);
        if (distance < minDistance) {
          minDistance = distance;
          closestIdx = idx;
        }
      });

      if (closestIdx !== dragOverIdxRef.current) {
        setDragOverIdx(closestIdx);
        dragOverIdxRef.current = closestIdx;
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      const from = draggingIdxRef.current;
      const to = dragOverIdxRef.current;

      setDraggingIdx(null);
      setDragOverIdx(null);
      draggingIdxRef.current = null;
      dragOverIdxRef.current = null;

      if (from !== null && to !== null && from !== to) {
        const newQueue = [...queue];
        const [moved] = newQueue.splice(from, 1);
        newQueue.splice(to, 0, moved);
        const newOrderIds = newQueue.map((item) => item.id);
        if (onReorderQueue) {
          onReorderQueue(newOrderIds);
        } else if (onMoveItem) {
          const dir = to > from ? 'down' : 'up';
          onMoveItem(from, dir);
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Cumulative estimated start time calculation for user queue items
  const getQueueEstimatedTime = (index: number) => {
    const currentRemainingSec =
      playback?.status === 'playing' || playback?.status === 'paused'
        ? Math.max(0, ((playback.durationMs || 0) - (playback.positionMs || 0)) / 1000)
        : 0;

    let priorDurationSec = 0;
    for (let i = 0; i < index; i++) {
      priorDurationSec += queue[i]?.durationSeconds || 210; // default 3.5m fallback
    }

    const totalWaitSec = Math.round(currentRemainingSec + priorDurationSec);
    const estimatedStartTime = new Date(Date.now() + totalWaitSec * 1000);

    const estClock = estimatedStartTime.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });

    const durationStr = formatDuration(queue[index]?.durationSeconds);
    const waitStr = formatWaitTime(totalWaitSec);

    return {
      waitStr,
      estClock,
      durationStr,
      tooltipText: durationStr
        ? `Duration: ${durationStr} • ${waitStr} (est. ${estClock})`
        : `${waitStr} (est. ${estClock})`,
    };
  };

  // Cumulative estimated start time calculation for radio queue items
  const getRadioEstimatedTime = (rIndex: number) => {
    const currentRemainingSec =
      playback?.status === 'playing' || playback?.status === 'paused'
        ? Math.max(0, ((playback.durationMs || 0) - (playback.positionMs || 0)) / 1000)
        : 0;

    const queueDurationSec = queue.reduce((acc, q) => acc + (q.durationSeconds || 210), 0);
    let priorRadioSec = 0;
    for (let i = 0; i < rIndex; i++) {
      priorRadioSec += radioQueue[i]?.durationSeconds || 210;
    }

    const totalWaitSec = Math.round(currentRemainingSec + queueDurationSec + priorRadioSec);
    const estimatedStartTime = new Date(Date.now() + totalWaitSec * 1000);

    const waitStr = formatWaitTime(totalWaitSec);
    const estClock = estimatedStartTime.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });

    const durationStr = formatDuration(radioQueue[rIndex]?.durationSeconds);

    return {
      waitStr,
      estClock,
      durationStr,
      tooltipText: durationStr
        ? `Duration: ${durationStr} • Up next from radio (${waitStr}, est. ${estClock})`
        : `Up next from radio (${waitStr}, est. ${estClock})`,
    };
  };

  const content = (
    <>
      <div className="flex flex-shrink-0 items-center border-b border-border pb-2 mb-2 text-xs font-bold uppercase tracking-wider text-foreground">
        <span>{t('remote.upcomingQueue')}</span>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-y-auto pr-1 pb-8',
            !embedded && 'max-h-[500px]'
          )}
        >
        {queue.length === 0 && radioQueue.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-8 text-center">
            {t('watchParty.queueEmpty')}
          </p>
        ) : (
          <>
            {/* User queued tracks - Seamless borderless list */}
            {queue.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3 text-center">
                {t('watchParty.queueEmpty')}
              </p>
            ) : (
              <div ref={listRef} className="flex flex-col divide-y divide-border/20">
                {queue.map((item, idx) => {
                  const ytId = parseYouTubeVideoId(item.url);
                  const isMyEntry = Boolean(effectiveCurrentUid && item.addedBy === effectiveCurrentUid);
                  const canDelete = isMyEntry || isHostOrAdmin;
                  const addedByMember = membersList.find((m) => m.uid === item.addedBy);
                  const isTvEntry = Boolean(
                    (tvUuid && item.addedBy === tvUuid) || item.addedBy === 'tv' || addedByMember?.isTv
                  );

                  const addedByLabel = isMyEntry
                    ? t('remote.youBadge')
                    : isTvEntry
                      ? t('remote.tvBadge')
                      : addedByMember?.nickname ||
                        item.addedByName ||
                        `User (${item.addedBy?.substring(0, 4) || '?'})`;

                  // Author / channel name
                  const author = item.channelTitle || (addedByMember?.nickname || item.addedByName || 'YouTube');

                  // Thumbnail (normalized to a square album-art tile in both list sections)
                  const rawThumb =
                    item.thumbnailUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null);

                  const est = getQueueEstimatedTime(idx);
                  const isCurrentlyDragging = draggingIdx === idx;
                  const isDropTarget = dragOverIdx === idx && draggingIdx !== null && draggingIdx !== idx;
                  const canDrag = isHostOrAdmin && queue.length > 1;

                  return (
                    <div
                      key={item.id || idx}
                      data-queue-item
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-sm px-1.5 py-2.5 text-xs transition-colors sm:px-2',
                        isCurrentlyDragging
                          ? 'bg-primary/10 opacity-40 shadow-inner'
                          : isDropTarget
                          ? 'border-t-2 border-primary bg-primary/20'
                          : 'hover:bg-muted/30'
                      )}
                      title={est.tooltipText}
                    >
                      {/* Index / Drag Handle Column */}
                      <div className="relative flex w-6 flex-shrink-0 items-center justify-center self-stretch text-center">
                        <span
                          className={cn(
                            'text-[11px] font-medium tabular-nums text-muted-foreground transition-opacity',
                            canDrag &&
                              '[@media(hover:none)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-0'
                          )}
                        >
                          {idx + 1}
                        </span>
                        {canDrag && (
                          <div
                            onPointerDown={(e) => handlePointerDown(e, idx)}
                            className="absolute inset-0 flex select-none cursor-grab touch-none items-center justify-center rounded text-zinc-500 opacity-0 transition-opacity hover:text-zinc-300 active:cursor-grabbing [@media(hover:none)]:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
                            title="Drag to reorder"
                            aria-hidden
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>

                      {/* Album Art */}
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-sm border border-border/40 bg-black/40">
                        {rawThumb ? (
                          <img src={rawThumb} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Music2 className="h-4 w-4 text-zinc-600" />
                          </div>
                        )}
                      </div>

                      {/* Title & Metadata */}
                      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary hover:underline"
                          title={item.title || item.url}
                        >
                          {item.title || item.url}
                        </a>
                        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                          <span
                            className="min-w-0 flex-1 truncate text-sm text-zinc-400"
                            title={author}
                          >
                            {author}
                          </span>
                          {est.durationStr && (
                            <>
                              <MetadataDot />
                              <span className="flex-shrink-0 text-xs tabular-nums text-zinc-500">
                                {est.durationStr}
                              </span>
                            </>
                          )}
                          <MetadataDot />
                          <span className="flex-shrink-0 text-xs tabular-nums text-zinc-500">
                            {est.waitStr}
                          </span>
                          <span className="inline-flex max-w-[96px] flex-shrink-0 items-center gap-1 rounded border border-zinc-700/50 bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                            {isTvEntry && <Tv className="h-2.5 w-2.5 flex-shrink-0" />}
                            <span className="truncate">{addedByLabel}</span>
                          </span>
                        </div>
                      </div>

                      {/* Delete Action (revealed on hover/focus for pointer devices) */}
                      {canDelete && (
                        <button
                          onClick={() => onRemoveItem(item.id, item.addedBy)}
                          className="flex-shrink-0 rounded p-1.5 text-zinc-500 opacity-100 transition-opacity hover:bg-zinc-800 hover:text-destructive [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:pointer-events-auto [@media(hover:hover)]:group-focus-within:opacity-100"
                          title={
                            isHostOrAdmin && !isMyEntry
                              ? 'Force delete item (Privileged)'
                              : 'Delete your entry'
                          }
                          aria-label={t('watchParty.removeFromQueue')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* YTM Radio Queue / Automix Section - Seamless borderless list */}
            {radioQueue.length > 0 ? (
              <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary/80">
                    <Radio className="h-3.5 w-3.5" />
                    <span>{t('remote.radioQueue')}</span>
                  </span>
                  <span className="rounded-full border border-zinc-700/50 bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
                    {t('remote.radioTracksCount', { count: radioQueue.length })}
                  </span>
                </div>

                <div className="flex flex-col divide-y divide-border/20">
                  {radioQueue.map((rTrack, rIdx) => {
                    const est = getRadioEstimatedTime(rIdx);

                    return (
                      <div
                        key={rTrack.id || rIdx}
                        className="group relative flex items-center gap-2.5 rounded-sm px-1.5 py-2.5 text-xs transition-colors hover:bg-muted/20 sm:px-2"
                        title={est.tooltipText}
                      >
                        {/* Track Index */}
                        <div className="flex w-6 flex-shrink-0 items-center justify-center self-stretch text-center">
                          <span className="text-[11px] font-medium tabular-nums text-muted-foreground/70">
                            {queue.length + rIdx + 1}
                          </span>
                        </div>

                        {/* Album Art */}
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-sm border border-border/40 bg-black/40">
                          {rTrack.thumbnail ? (
                            <img
                              src={rTrack.thumbnail}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Music2 className="h-4 w-4 text-zinc-600" />
                            </div>
                          )}
                        </div>

                        {/* Title & Metadata */}
                        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                          <a
                            href={rTrack.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary hover:underline"
                            title={rTrack.title}
                          >
                            {rTrack.title}
                          </a>
                          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                            {rTrack.channelTitle ? (
                              <span
                                className="min-w-0 flex-1 truncate text-sm text-zinc-400"
                                title={rTrack.channelTitle}
                              >
                                {rTrack.channelTitle}
                              </span>
                            ) : (
                              <span className="flex-1" />
                            )}
                            {est.durationStr && (
                              <>
                                <MetadataDot />
                                <span className="flex-shrink-0 text-xs tabular-nums text-zinc-500">
                                  {est.durationStr}
                                </span>
                              </>
                            )}
                            <MetadataDot />
                            <span className="flex-shrink-0 text-xs tabular-nums text-zinc-500">
                              {est.waitStr}
                            </span>
                          </div>
                        </div>

                        {/* Row Actions */}
                        <div className="flex flex-shrink-0 items-center gap-0.5">
                          {onAddRadioTrackToQueue && (
                            <button
                              onClick={() => onAddRadioTrackToQueue(rTrack.id)}
                              className="cursor-pointer rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-white"
                              title={t('remote.addToQueue')}
                              aria-label={t('remote.addToQueue')}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onDeleteRadioTrack && (
                            <button
                              onClick={() => onDeleteRadioTrack(rTrack.id)}
                              className="cursor-pointer rounded p-1.5 text-zinc-500 opacity-100 transition-opacity hover:bg-zinc-800 hover:text-destructive [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:pointer-events-auto [@media(hover:hover)]:group-focus-within:opacity-100"
                              title={t('remote.removeFromRadio')}
                              aria-label={t('remote.removeFromRadio')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : onStartRadio ? (
              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Radio className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{t('remote.radioQueue')}</span>
                </span>
                <button
                  onClick={onStartRadio}
                  className="flex cursor-pointer items-center gap-1 rounded-md border border-zinc-700/50 px-2 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-white"
                  title={t('remote.startRadio')}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('remote.startRadio')}
                </button>
              </div>
            ) : null}
          </>
        )}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent"
        />
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex-1 flex flex-col min-h-0 overflow-hidden">{content}</div>;
  }

  return (
    <Card cornerLines className="p-4 bg-card border-border flex-1 mb-5 flex flex-col min-h-0">
      {content}
    </Card>
  );
};

export default QueuePanel;

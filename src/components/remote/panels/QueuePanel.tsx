import React from 'react';
import { DeviceUser } from '@/lib/deviceAuth';
import { useTranslation } from '@/context/LanguageContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown, Trash2, Radio, Tv, Plus } from 'lucide-react';
import { QueueItem, SearchResultItem, parseYouTubeVideoId } from '@/lib/roomUtils';

interface QueuePanelProps {
  queue: QueueItem[];
  radioQueue?: SearchResultItem[];
  user: DeviceUser | null;
  currentUid?: string;
  isHostOrAdmin: boolean;
  tvUuid?: string | null;
  membersList: { uid: string; nickname?: string; isTv?: boolean }[];
  onRemoveItem: (itemId: string, itemAddedBy?: string) => Promise<void>;
  onMoveItem: (index: number, direction: 'up' | 'down') => void;
  onStartRadio?: () => void;
  onAddRadioTrackToQueue?: (trackId: string) => Promise<void>;
  onDeleteRadioTrack?: (trackId: string) => Promise<void>;
  embedded?: boolean;
}

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
  onStartRadio,
  onAddRadioTrackToQueue,
  onDeleteRadioTrack,
  embedded = false,
}) => {
  const { t } = useTranslation();

  const effectiveCurrentUid = currentUid || user?.uid;

  const content = (
    <>
      <div className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-2 mb-3 flex items-center justify-between flex-shrink-0">
        <span>{t('remote.upcomingQueue')}</span>
        <span className="text-muted-foreground font-mono text-[11px]">
          {t('remote.itemsCount', { count: queue.length })}
        </span>
      </div>

      <div
        className={`flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pr-1 ${
          embedded ? '' : 'max-h-[500px]'
        }`}
      >
        {queue.length === 0 && radioQueue.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-8 text-center">
            {t('watchParty.queueEmpty')}
          </p>
        ) : (
          <>
            {/* User queued tracks */}
            {queue.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3 text-center">
                {t('watchParty.queueEmpty')}
              </p>
            ) : (
              queue.map((item, idx) => {
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

                return (
                  <div
                    key={item.id || idx}
                    className="flex items-center gap-2 p-2 bg-muted/20 border border-border text-xs rounded-md"
                  >
                    <span className="font-mono text-foreground font-bold w-5 flex-shrink-0">
                      #{idx + 1}
                    </span>
                    {ytId ? (
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                        alt="thumb"
                        className="w-10 h-7 object-cover flex-shrink-0 border border-border rounded-sm"
                      />
                    ) : null}
                    <div className="truncate flex-1 flex flex-col min-w-0">
                      <span className="truncate font-bold text-foreground font-sans">
                        {item.title || item.url}
                      </span>
                      {item.title ? (
                        <span className="truncate text-[10px] font-mono text-primary/80">
                          {item.url}
                        </span>
                      ) : null}
                    </div>
                    <Badge
                      variant="outline"
                      className={`px-1.5 py-0.5 text-[9px] font-semibold uppercase flex-shrink-0 flex items-center gap-1 rounded-sm ${
                        isTvEntry
                          ? 'bg-primary/20 text-primary border-primary/40 font-bold'
                          : 'bg-primary/10 text-primary border-primary/30'
                      }`}
                    >
                      {isTvEntry && <Tv className="w-2.5 h-2.5" />}
                      <span>{addedByLabel}</span>
                    </Badge>

                    {/* Host & Admin Reorder Actions */}
                    {isHostOrAdmin && queue.length > 1 && (
                      <div className="flex items-center gap-0.5 flex-shrink-0 border-l border-border pl-1">
                        <button
                          onClick={() => onMoveItem(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed"
                          title={t('remote.moveUp')}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onMoveItem(idx, 'down')}
                          disabled={idx === queue.length - 1}
                          className="p-1 text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors cursor-pointer disabled:cursor-not-allowed"
                          title={t('remote.moveDown')}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Delete Action */}
                    {canDelete && (
                      <button
                        onClick={() => onRemoveItem(item.id, item.addedBy)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-card border border-transparent hover:border-destructive/50 transition-colors flex-shrink-0 cursor-pointer"
                        title={
                          isHostOrAdmin && !isMyEntry
                            ? 'Force delete item (Privileged)'
                            : 'Delete your entry'
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}

            {/* YTM Radio Queue / Automix Section */}
            {radioQueue.length > 0 ? (
              <div className="mt-2 pt-2 border-t border-border flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-primary/80">
                    <Radio className="w-3.5 h-3.5" />
                    <span>{t('remote.radioQueue')}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {onStartRadio && (
                      <button
                        onClick={onStartRadio}
                        className="text-[10px] font-mono text-primary/80 hover:text-primary hover:underline cursor-pointer"
                        title={t('remote.startRadio')}
                      >
                        {t('remote.startRadio')}
                      </button>
                    )}
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {radioQueue.length}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  {radioQueue.map((rTrack, rIdx) => (
                    <div
                      key={rTrack.id || rIdx}
                      className="flex items-center gap-2 p-1.5 bg-muted/10 border border-border/60 text-xs rounded-md opacity-85 hover:opacity-100 transition-opacity"
                    >
                      <span className="font-mono text-muted-foreground text-[10px] w-5 flex-shrink-0 text-center">
                        ~{queue.length + rIdx + 1}
                      </span>
                      {rTrack.thumbnail && (
                        <img
                          src={rTrack.thumbnail}
                          alt="thumb"
                          className="w-10 h-7 object-cover flex-shrink-0 border border-border rounded-sm"
                        />
                      )}
                      <div className="truncate flex-1 min-w-0">
                        <div className="truncate font-semibold text-foreground text-[11px]">
                          {rTrack.title}
                        </div>
                        {rTrack.channelTitle && (
                          <div className="truncate text-[9px] text-muted-foreground">
                            {rTrack.channelTitle}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {onAddRadioTrackToQueue && (
                          <button
                            onClick={() => onAddRadioTrackToQueue(rTrack.id)}
                            className="p-1 text-muted-foreground hover:text-primary hover:bg-card border border-transparent hover:border-primary/40 rounded transition-colors cursor-pointer"
                            title={t('remote.addToQueue')}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteRadioTrack && (
                          <button
                            onClick={() => onDeleteRadioTrack(rTrack.id)}
                            className="p-1 text-muted-foreground hover:text-destructive hover:bg-card border border-transparent hover:border-destructive/40 rounded transition-colors cursor-pointer"
                            title={t('remote.removeFromRadio')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : onStartRadio ? (
              <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-primary/70" />
                  <span>{t('remote.radioQueue')}</span>
                </span>
                <button
                  onClick={onStartRadio}
                  className="text-xs font-mono font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  title={t('remote.startRadio')}
                >
                  + {t('remote.startRadio')}
                </button>
              </div>
            ) : null}
          </>
        )}
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

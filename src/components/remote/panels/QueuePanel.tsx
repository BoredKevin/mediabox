import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { useTranslation } from '@/context/LanguageContext';
import { Card, Badge } from '@boredkevin/ui';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { QueueItem, parseYouTubeVideoId } from '@/lib/roomUtils';

interface QueuePanelProps {
  queue: QueueItem[];
  user: FirebaseUser | null;
  isHostOrAdmin: boolean;
  membersList: { uid: string; nickname?: string }[];
  onRemoveItem: (itemId: string, itemAddedBy?: string) => Promise<void>;
  onMoveItem: (index: number, direction: 'up' | 'down') => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  queue,
  user,
  isHostOrAdmin,
  membersList,
  onRemoveItem,
  onMoveItem,
}) => {
  const { t } = useTranslation();

  return (
    <Card cornerLines className="p-4 bg-card border-border flex-1 mb-5">
      <div className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-2 mb-3 flex items-center justify-between">
        <span>{t('remote.upcomingQueue')}</span>
        <span className="text-muted-foreground font-mono text-[11px]">
          {t('remote.itemsCount', { count: queue.length })}
        </span>
      </div>

      {queue.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-4 text-center">
          {t('watchParty.queueEmpty')}
        </p>
      ) : (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
          {queue.map((item, idx) => {
            const ytId = parseYouTubeVideoId(item.url);
            const isMyEntry = Boolean(user && item.addedBy === user.uid);
            const canDelete = isMyEntry || isHostOrAdmin;
            const addedByMember = membersList.find((m) => m.uid === item.addedBy);
            const addedByLabel = isMyEntry
              ? t('remote.youBadge')
              : addedByMember?.nickname ||
                `User (${item.addedBy?.substring(0, 4) || '?'})`;

            return (
              <div
                key={item.id || idx}
                className="flex items-center gap-2 p-2 bg-muted/20 border border-border text-xs"
              >
                <span className="font-mono text-primary font-bold w-5 flex-shrink-0">
                  #{idx + 1}
                </span>
                {ytId ? (
                  <img
                    src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                    alt="thumb"
                    className="w-10 h-7 object-cover flex-shrink-0 border border-border"
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
                  className="px-1.5 py-0.5 text-[9px] bg-primary/10 text-primary border-primary/30 font-semibold uppercase flex-shrink-0 rounded-none"
                >
                  {addedByLabel}
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
          })}
        </div>
      )}
    </Card>
  );
};

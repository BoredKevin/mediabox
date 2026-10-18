import React from 'react';
import { Button } from '@/components/ui/button';
import { Lock, Unlock, Trash2 } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState } from '@/lib/roomUtils';

interface HostSettingsDangerSectionProps {
  roomState: RoomState | null;
  queueLength: number;
  handleToggleRoomLockAdmin: () => void;
  handleClearQueueAdmin: () => void;
}

export const HostSettingsDangerSection: React.FC<HostSettingsDangerSectionProps> = ({
  roomState,
  queueLength,
  handleToggleRoomLockAdmin,
  handleClearQueueAdmin,
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-4 bg-destructive/5 border border-destructive/20 flex flex-col gap-3">
      <span className="text-xs font-mono font-bold uppercase tracking-wider text-destructive">
        {t('remote.adminOverridePanel')}
      </span>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Lock Room Toggle */}
        <div className="p-3 bg-card border border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {roomState?.isLocked ? (
              <Lock className="w-4 h-4 text-destructive flex-shrink-0" />
            ) : (
              <Unlock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-foreground truncate">
                {roomState?.isLocked ? t('watchParty.unlockBtn') : t('watchParty.lockBtn')}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {t('remote.lockRoomDesc')}
              </span>
            </div>
          </div>
          <Button
            variant={roomState?.isLocked ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleToggleRoomLockAdmin}
            className="h-7 px-2.5 text-[10px] font-mono font-bold uppercase cursor-pointer flex-shrink-0"
          >
            {roomState?.isLocked ? t('remote.roomLocked') : t('remote.roomUnlocked')}
          </Button>
        </div>

        {/* Clear Queue Action */}
        <div className="p-3 bg-card border border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Trash2 className="w-4 h-4 text-destructive flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-foreground truncate">
                {t('remote.clearQueueBtn')}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {t('remote.clearQueueWarning')}
              </span>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={queueLength === 0}
            onClick={handleClearQueueAdmin}
            className="h-7 px-2.5 text-[10px] font-mono font-bold uppercase cursor-pointer flex-shrink-0"
          >
            {t('remote.clearQueueBtn')}
          </Button>
        </div>
      </div>
    </div>
  );
};

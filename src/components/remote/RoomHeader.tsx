import React from 'react';
import { DeviceUser } from '@/lib/deviceAuth';
import { RoomState } from '@/lib/roomUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Crown, Lock, Unlock, Settings, Users, LogOut, QrCode } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from '@/context/LanguageContext';
import { ProfileDropdown } from './ProfileDropdown';

interface RoomHeaderProps {
  activeRoomCode: string;
  user: DeviceUser | null;
  roomState: RoomState | null;
  isAdmin: boolean;
  isHost: boolean;
  isHostOrAdmin: boolean;
  isTvOnline: boolean;
  memberCount: number;
  myNickname: string;
  onLeaveRoom: () => void;
  onLogout: () => Promise<void>;
  onSaveNickname: (name: string) => Promise<void>;
  onOpenHostSettings: () => void;
  onToggleRoomLock: () => void;
  onToggleFullscreenQr: () => void;
  onOpenSideDrawer: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  activeRoomCode,
  user,
  roomState,
  isAdmin,
  isHost,
  isHostOrAdmin,
  isTvOnline,
  memberCount,
  myNickname,
  onLeaveRoom,
  onLogout,
  onSaveNickname,
  onOpenHostSettings,
  onToggleRoomLock,
  onToggleFullscreenQr,
  onOpenSideDrawer,
}) => {
  const { t } = useTranslation();
  return (
    <header className="px-3 py-2.5 sm:px-6 sm:py-3 border-b border-border bg-card/90 backdrop-blur-md flex flex-col lg:flex-row lg:h-16 lg:items-center lg:justify-between gap-2 lg:gap-4 flex-shrink-0">
      {/* Mobile Line 1 / Desktop Left: Room Badge & Info */}
      <div className="flex items-center justify-between lg:justify-start gap-2.5 sm:gap-3 w-full lg:w-auto">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {t('watchParty.roomBadge')}
          </span>
          <span className="font-mono text-base sm:text-lg font-bold tracking-widest text-primary">
            {activeRoomCode}
          </span>

          {isAdmin ? (
            <Badge
              variant="outline"
              className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-md bg-purple-950/60 text-purple-300 border-purple-800/80"
              title="Global Application Administrator"
            >
              <Shield className="w-2.5 h-2.5 text-purple-400" />
              <span>{t('remote.adminBadge')}</span>
            </Badge>
          ) : isHost ? (
            <Badge
              variant="default"
              className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-md"
              title={t('remote.hostBadge')}
            >
              <Crown className="w-2.5 h-2.5" />
              <span>{t('remote.hostBadge')}</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-md text-muted-foreground border-border"
              title={t('remote.memberBadge')}
            >
              <span>{t('remote.memberBadge')}</span>
            </Badge>
          )}

          {/* TV online status */}
          {isTvOnline ? (
            <Badge
              variant="outline"
              className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-md border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
              title={t('remote.tvOnlineBadge')}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{t('remote.tvOnlineBadge')}</span>
            </Badge>
          ) : (
            <Badge
              variant="destructive"
              className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-md"
              title={t('remote.tvOfflineBadge')}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>{t('remote.tvOfflineBadge')}</span>
            </Badge>
          )}

          {/* Locked status */}
          {roomState?.isLocked && (
            <Badge
              variant="warning"
              className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-md bg-amber-500/15 text-amber-300 border-amber-500/50"
            >
              <Lock className="w-2.5 h-2.5 text-amber-400" />
              <span>Locked</span>
            </Badge>
          )}
        </div>

        {/* Mobile Drawer Trigger for Queue & Members */}
        <button
          onClick={onOpenSideDrawer}
          className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold bg-muted/40 border border-border hover:border-primary/50 transition-colors cursor-pointer text-foreground"
          title={t('remote.queueDrawerTitle')}
        >
          <Users className="w-3.5 h-3.5 text-primary" />
          <span>{memberCount}</span>
        </button>
      </div>

      {/* Mobile Line 2 / Desktop Right: Profile, Settings, i18n & Logout */}
      <div className="flex items-center justify-between w-full lg:w-auto border-t border-border/40 lg:border-t-0 pt-2.5 lg:pt-0 gap-2">
        <div className="flex items-center gap-2">
          <ProfileDropdown
            user={user}
            myNickname={myNickname}
            isHost={isHost}
            isAdmin={isAdmin}
            onLogout={onLogout}
            onSaveNickname={onSaveNickname}
          />

          {isHostOrAdmin && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={onOpenHostSettings}
                title={t('remote.hostSettings')}
                aria-label={t('remote.hostSettings')}
                className="h-11 w-11 text-muted-foreground hover:text-primary hover:border-primary/60 cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={onToggleRoomLock}
                title={roomState?.isLocked ? t('remote.unlockRoomBtn') : t('remote.lockRoomBtn')}
                aria-label={roomState?.isLocked ? t('remote.unlockRoomBtn') : t('remote.lockRoomBtn')}
                className={`h-11 w-11 cursor-pointer ${
                  roomState?.isLocked
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                {roomState?.isLocked ? (
                  <Lock className="w-4 h-4 text-amber-400" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={onToggleFullscreenQr}
                title={roomState?.showFullscreenQr ? t('remote.hideQrCode') : t('remote.showQrCode')}
                aria-label={roomState?.showFullscreenQr ? t('remote.hideQrCode') : t('remote.showQrCode')}
                className={`h-11 w-11 cursor-pointer transition-colors ${
                  roomState?.showFullscreenQr
                    ? 'border-primary/60 bg-primary/15 text-primary hover:bg-primary/25'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                <QrCode className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />

          <Button
            variant="ghost"
            size="icon"
            onClick={onLeaveRoom}
            className="h-11 w-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            title={t('remote.leaveRoomBtn')}
            aria-label={t('remote.leaveRoomBtn')}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

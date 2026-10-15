import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { RoomState } from '@/lib/roomUtils';
import { Badge, Button } from '@boredkevin/ui';
import { Shield, Crown, Lock, Unlock, Settings, Users, LogOut } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from '@/context/LanguageContext';
import { ProfileDropdown } from './ProfileDropdown';

interface RoomHeaderProps {
  activeRoomCode: string;
  user: FirebaseUser | null;
  roomState: RoomState | null;
  isAdmin: boolean;
  isHost: boolean;
  isHostOrAdmin: boolean;
  isTvOnline: boolean;
  memberCount: number;
  myNickname: string;
  onLeaveRoom: () => void;
  onGoogleSignIn: () => Promise<void>;
  onLogout: () => Promise<void>;
  onSaveNickname: (name: string) => Promise<void>;
  onOpenHostSettings: () => void;
  onToggleRoomLock: () => void;
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
  onGoogleSignIn,
  onLogout,
  onSaveNickname,
  onOpenHostSettings,
  onToggleRoomLock,
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

          {/* Role badge */}
          {isAdmin ? (
            <Badge
              variant="outline"
              className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-none bg-purple-950/60 text-purple-300 border-purple-800/80"
            >
              <Shield className="w-2.5 h-2.5 text-purple-400" />
              <span>{t('remote.adminBadge')}</span>
            </Badge>
          ) : isHost ? (
            <Badge
              variant="default"
              className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-none"
            >
              <Crown className="w-2.5 h-2.5" />
              <span>{t('remote.hostBadge')}</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-none text-muted-foreground border-border"
            >
              <span>{t('remote.memberBadge')}</span>
            </Badge>
          )}

          {/* TV Online / Offline status badge */}
          {isTvOnline ? (
            <Badge
              variant="success"
              className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-none"
              title={t('remote.tvOnlineBadge')}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{t('remote.tvOnlineBadge')}</span>
            </Badge>
          ) : (
            <Badge
              variant="destructive"
              className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-none"
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
              className="h-5 px-1.5 py-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase leading-none rounded-none bg-amber-500/15 text-amber-300 border-amber-500/50"
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
        {/* Left: User Profile & Host/Admin Room Settings */}
        <div className="flex items-center gap-2">
          <ProfileDropdown
            user={user}
            myNickname={myNickname}
            isHost={isHost}
            isAdmin={isAdmin}
            onLogout={onLogout}
            onGoogleSignIn={onGoogleSignIn}
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
                className={`h-11 w-11 cursor-pointer transition-colors ${
                  roomState?.isLocked
                    ? 'text-amber-400 border-amber-500/60 bg-amber-500/10 hover:border-amber-400 hover:text-amber-300'
                    : 'text-muted-foreground hover:text-primary hover:border-primary/60'
                }`}
              >
                {roomState?.isLocked ? (
                  <Lock className="w-4 h-4 text-amber-400" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
              </Button>
            </>
          )}
        </div>

        {/* Right: Language Switcher, Desktop Member Count & Logout */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1.5 px-3 h-11 text-xs font-mono bg-muted/20 border border-border text-foreground">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>{memberCount}</span>
          </div>

          <LanguageSwitcher className="relative static" hideOnFullscreen={false} />

          <Button
            variant="outline"
            size="icon"
            onClick={onLeaveRoom}
            title={t('remote.leaveRoomBtn')}
            className="h-11 w-11 text-muted-foreground hover:text-destructive hover:border-destructive transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Button,
  Input,
  Badge,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@boredkevin/ui';
import { User, LogOut, Edit3, Shield, Crown } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

interface ProfileDropdownProps {
  user: FirebaseUser | null;
  myNickname: string;
  isHost: boolean;
  isAdmin: boolean;
  onLogout: () => void;
  onGoogleSignIn: () => void;
  onSaveNickname: (name: string) => Promise<void>;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  user,
  myNickname,
  isHost,
  isAdmin,
  onLogout,
  onGoogleSignIn,
  onSaveNickname,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(myNickname);

  const displayName = myNickname || user?.displayName || 'Guest Member';
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await onSaveNickname(nameInput);
    setIsEditing(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-11 w-11 flex items-center justify-center border border-border bg-card hover:border-primary/50 transition-colors cursor-pointer relative"
          title={displayName}
        >
          <Avatar className="h-8 w-8 rounded-none">
            {user?.photoURL ? (
              <AvatarImage src={user.photoURL} alt={displayName} />
            ) : null}
            <AvatarFallback className="text-xs font-mono font-bold bg-primary/20 text-primary rounded-none">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 bg-card border-border shadow-2xl p-2 z-50"
      >
        <DropdownMenuLabel className="font-normal p-2 pb-1.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground truncate font-sans">
                {displayName}
              </span>
              {isAdmin ? (
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 py-0 text-[9px] font-mono font-bold uppercase inline-flex items-center gap-1 rounded-none bg-purple-950/60 text-purple-300 border-purple-800/80"
                >
                  <Shield className="w-2.5 h-2.5 text-purple-400" />
                  <span>{t('remote.adminBadge')}</span>
                </Badge>
              ) : isHost ? (
                <Badge
                  variant="default"
                  className="h-5 px-1.5 py-0 text-[9px] font-mono font-bold uppercase inline-flex items-center gap-1 rounded-none"
                >
                  <Crown className="w-2.5 h-2.5" />
                  <span>{t('remote.hostBadge')}</span>
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 py-0 text-[9px] font-mono font-bold uppercase inline-flex items-center gap-1 rounded-none text-muted-foreground border-border"
                >
                  <span>{t('remote.memberBadge')}</span>
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono truncate">
              {user?.email || `UID: ${user?.uid?.substring(0, 8)}...`}
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Edit Nickname Form / Section */}
        <div className="p-2 flex flex-col gap-2" onKeyDown={(e) => e.stopPropagation()}>
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              chamfer="top-right"
              onClick={() => {
                setNameInput(myNickname);
                setIsEditing(true);
              }}
              className="w-full text-xs font-semibold uppercase flex items-center justify-center gap-1.5 h-8"
            >
              <Edit3 className="w-3 h-3 text-primary" />
              <span>{t('remote.editNickname')}</span>
            </Button>
          ) : (
            <form onSubmit={handleSave} className="flex flex-col gap-2">
              <Input
                type="text"
                maxLength={25}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={t('remote.enterNicknamePlaceholder')}
                className="font-mono text-xs h-8"
                autoFocus
              />
              <div className="flex items-center gap-1.5">
                <Button
                  type="submit"
                  variant="cyber"
                  chamfer="dual"
                  className="flex-1 text-[10px] font-bold uppercase h-7 py-0"
                >
                  {t('remote.saveBtn')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                  className="text-[10px] text-muted-foreground hover:text-foreground h-7 px-2 py-0"
                >
                  {t('remote.cancelBtn')}
                </Button>
              </div>
            </form>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Google Sign In / Sign Out */}
        {user?.isAnonymous === false ? (
          <DropdownMenuItem
            onClick={onLogout}
            className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer flex items-center gap-2 p-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('remote.signOut')}</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={onGoogleSignIn}
            className="text-xs text-foreground focus:text-primary focus:bg-primary/10 cursor-pointer flex items-center gap-2 p-2"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropdown;

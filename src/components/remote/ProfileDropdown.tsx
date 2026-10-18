import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, Edit3, Shield, Crown } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { DeviceUser } from '@/lib/deviceAuth';

interface ProfileDropdownProps {
  user: DeviceUser | null;
  myNickname: string;
  isHost: boolean;
  isAdmin: boolean;
  onLogout: () => void;
  onSaveNickname: (name: string) => Promise<void>;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  user,
  myNickname,
  isHost,
  isAdmin,
  onLogout,
  onSaveNickname,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(myNickname);

  React.useEffect(() => {
    if (!isEditing) {
      setNameInput(myNickname);
    }
  }, [myNickname, isEditing]);

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
              {`Device: ${user?.uid?.substring(0, 8)}...`}
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

        <DropdownMenuItem
          onClick={onLogout}
          className="text-xs text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer flex items-center gap-2 p-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{t('remote.signOut')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropdown;

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@boredkevin/ui';
import { Search } from 'lucide-react';
import { useWatchParty } from '@/context/WatchPartyContext';
import { useTranslation } from '@/context/LanguageContext';
import { SearchPanel } from '@/components/remote/panels/SearchPanel';

interface TvSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TvSearchModal: React.FC<TvSearchModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const {
    roomCode,
    roomState,
    user,
    handleAddUrlHost,
    setShowSettingsModal,
  } = useWatchParty();

  const [toast, setToast] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ text: message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const sendCommand = async (type: any, payload?: any) => {
    if (type === 'addToQueue' && payload?.url) {
      await handleAddUrlHost(payload.url, payload.title);
    }
  };

  const handleOpenHostSettings = () => {
    onOpenChange(false);
    setShowSettingsModal(true);
  };

  if (!roomCode) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl md:max-w-5xl lg:max-w-6xl w-full h-[88vh] max-h-[92vh] bg-card/95 border-border shadow-2xl backdrop-blur-xl flex flex-col p-5 sm:p-6 overflow-hidden">
        <DialogHeader className="border-b border-border pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-foreground font-display tracking-wider uppercase text-base">
            <Search className="w-5 h-5 text-primary" />
            <span>{t('watchParty.searchModalTitle')}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('watchParty.searchModalDesc')}
          </DialogDescription>
        </DialogHeader>

        {toast && (
          <div
            className={`mt-2 px-3 py-1.5 text-xs font-mono border rounded transition-all animate-in fade-in-0 flex items-center justify-between ${toast.type === 'error'
                ? 'bg-destructive/15 border-destructive/40 text-destructive'
                : toast.type === 'success'
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-muted border-border text-foreground'
              }`}
          >
            <span>{toast.text}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto mt-4 pr-1 min-h-0">
          <SearchPanel
            roomCode={roomCode}
            roomState={roomState}
            user={user}
            isHostOrAdmin={true}
            sendCommand={sendCommand}
            showToast={showToast}
            embedded={true}
            onOpenHostSettings={handleOpenHostSettings}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

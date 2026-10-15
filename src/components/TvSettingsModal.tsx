import React, { useState } from 'react';
import { useWatchParty } from '@/context/WatchPartyContext';
import { useTranslation } from '@/context/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@boredkevin/ui';
import { Key, Gauge, Sliders } from 'lucide-react';

import { TvApiTab } from './tv-settings/TvApiTab';
import { TvLimitsTab } from './tv-settings/TvLimitsTab';
import { TvBehaviorTab } from './tv-settings/TvBehaviorTab';

interface TvSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const TvSettingsModal: React.FC<TvSettingsModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const {
    roomCode,
    roomState,
    searchSettings,
    handleUpdateSearchSettings,
    handleClearAllRateLimits,
    handleToggleCountdown,
  } = useWatchParty();

  const [activeTab, setActiveTab] = useState<string>('api');

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-md w-full flex flex-col bg-card border-border overflow-hidden p-6 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="border-b border-border pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            <DialogTitle className="text-base sm:text-lg font-bold uppercase tracking-wider font-mono">
              {t('tvSettings.title')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('tvSettings.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full flex-1 flex flex-col min-h-0 overflow-hidden mt-3"
        >
          <TabsList className="grid grid-cols-3 w-full border-b border-border bg-muted/40 p-1 mb-4 rounded-none flex-shrink-0">
            <TabsTrigger
              value="api"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-2"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{t('tvSettings.tabApiKeys')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="limits"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-2"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>{t('tvSettings.tabRateLimits')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="behavior"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-2"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Behavior</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <TabsContent value="api" className="mt-0">
              <TvApiTab
                searchSettings={searchSettings}
                onUpdateSearchSettings={handleUpdateSearchSettings}
              />
            </TabsContent>

            <TabsContent value="limits" className="mt-0">
              <TvLimitsTab
                roomCode={roomCode}
                searchSettings={searchSettings}
                onUpdateSearchSettings={handleUpdateSearchSettings}
                onClearAllRateLimits={handleClearAllRateLimits}
              />
            </TabsContent>

            <TabsContent value="behavior" className="mt-0">
              <TvBehaviorTab
                roomState={roomState}
                searchSettings={searchSettings}
                onToggleCountdown={handleToggleCountdown}
                onUpdateSearchSettings={handleUpdateSearchSettings}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default TvSettingsModal;

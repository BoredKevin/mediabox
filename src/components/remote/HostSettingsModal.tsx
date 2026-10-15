import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Clock, Key, Gauge } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { RoomState } from '@/lib/roomUtils';
import { isProxyConfigured, loadProxyConfig } from '@/lib/proxyConfig';

import { HostSettingsRoomTab } from './settings/HostSettingsRoomTab';
import { HostSettingsApiTab } from './settings/HostSettingsApiTab';
import { HostSettingsRateLimitsTab } from './settings/HostSettingsRateLimitsTab';

interface HostSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomCode: string;
  roomState: RoomState | null;
  isAdmin: boolean;
  queueLength: number;
  sendCommand: (type: any, payload?: any) => Promise<void>;
  handleClearQueueAdmin: () => void;
  handleToggleRoomLockAdmin: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const HostSettingsModal: React.FC<HostSettingsModalProps> = ({
  open,
  onOpenChange,
  roomCode,
  roomState,
  isAdmin,
  queueLength,
  sendCommand,
  handleClearQueueAdmin,
  handleToggleRoomLockAdmin,
  showToast,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('room');

  const pCfg = loadProxyConfig();
  const isConfigured =
    isProxyConfigured(pCfg) || Boolean(roomState?.searchSettings?.isProxyConfigured);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full h-[540px] max-h-[90vh] flex flex-col bg-card border-border overflow-hidden p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="border-b border-border pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <DialogTitle className="text-base sm:text-lg font-bold uppercase tracking-wider font-mono">
              {isAdmin ? t('remote.adminOverridePanel') : t('remote.hostSettings')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Manage room privileges, playback settings, MediaBox YouTube API, and rate limits.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full flex-1 flex flex-col min-h-0 overflow-hidden mt-3"
        >
          <TabsList className="grid grid-cols-3 w-full border-b border-border bg-muted/40 p-1 mb-3 rounded-none flex-shrink-0">
            <TabsTrigger
              value="room"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-2"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t('tvSettings.tabRoom') || 'Room'}</span>
            </TabsTrigger>
            <TabsTrigger
              value="api"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-2"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{t('tvSettings.tabApiKeys')}</span>
              <Badge
                variant={isConfigured ? 'default' : 'outline'}
                className="ml-1 px-1.5 py-0 text-[9px] font-mono"
              >
                {isConfigured ? 'Active' : 'Missing'}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="rate-limits"
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-2"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>{t('tvSettings.tabRateLimits')}</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <TabsContent value="room" className="mt-0">
              <HostSettingsRoomTab
                roomCode={roomCode}
                roomState={roomState}
                queueLength={queueLength}
                sendCommand={sendCommand}
                handleClearQueueAdmin={handleClearQueueAdmin}
                handleToggleRoomLockAdmin={handleToggleRoomLockAdmin}
                showToast={showToast}
              />
            </TabsContent>

            <TabsContent value="api" className="mt-0">
              <HostSettingsApiTab
                roomState={roomState}
                sendCommand={sendCommand}
                showToast={showToast}
              />
            </TabsContent>

            <TabsContent value="rate-limits" className="mt-0">
              <HostSettingsRateLimitsTab
                roomCode={roomCode}
                roomState={roomState}
                sendCommand={sendCommand}
                showToast={showToast}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default HostSettingsModal;

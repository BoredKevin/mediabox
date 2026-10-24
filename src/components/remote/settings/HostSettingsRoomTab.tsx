import React from 'react';
import { RoomState } from '@/lib/roomUtils';
import { RemoteActions } from '../hooks/useRemoteActions';
import { HostSettingsShareSection } from './HostSettingsShareSection';
import { HostSettingsBehaviorSection } from './HostSettingsBehaviorSection';
import { HostSettingsDangerSection } from './HostSettingsDangerSection';

interface HostSettingsRoomTabProps {
  roomCode: string;
  roomState: RoomState | null;
  queueLength: number;
  isAdmin?: boolean;
  actions: RemoteActions;
  handleClearQueueAdmin: () => void;
  handleToggleRoomLockAdmin: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const HostSettingsRoomTab: React.FC<HostSettingsRoomTabProps> = ({
  roomCode,
  roomState,
  queueLength,
  isAdmin = false,
  actions,
  handleClearQueueAdmin,
  handleToggleRoomLockAdmin,
  showToast,
}) => {
  return (
    <div className="space-y-4">
      <HostSettingsShareSection
        roomCode={roomCode}
        showToast={showToast}
      />

      <HostSettingsBehaviorSection
        roomState={roomState}
        actions={actions}
      />

      <HostSettingsDangerSection
        roomState={roomState}
        queueLength={queueLength}
        isAdmin={isAdmin}
        onToggleHostPin={actions.toggleHostPin}
        handleToggleRoomLockAdmin={handleToggleRoomLockAdmin}
        handleClearQueueAdmin={handleClearQueueAdmin}
      />
    </div>
  );
};

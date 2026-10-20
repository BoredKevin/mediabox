import { useTranslation } from '@/context/LanguageContext';
import { RemoteActions } from '../hooks/useRemoteActions';
import { QueueItem } from '@/lib/roomUtils';

interface UseRoomAdminActionsProps {
  isHostOrAdmin: boolean;
  effectiveUid: string;
  queue: QueueItem[];
  actions: RemoteActions;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function useRoomAdminActions({
  isHostOrAdmin,
  effectiveUid,
  queue,
  actions,
  showToast,
}: UseRoomAdminActionsProps) {
  const { t } = useTranslation();

  const handleKickMember = async (targetUid: string) => {
    if (!isHostOrAdmin || targetUid === effectiveUid) return;
    if (confirm(t('remote.kickMemberConfirm'))) {
      try {
        await actions.purgeMemberTracks(targetUid);
        showToast(t('toasts.kickSent'), 'info');
      } catch (err: any) {
        console.error('Failed to kick member:', err);
        showToast(t('toasts.commandFailed'), 'error');
      }
    }
  };

  const handleRemoveQueueItem = async (itemId: string, itemAddedBy?: string) => {
    const isMyEntry = Boolean(itemAddedBy && itemAddedBy === effectiveUid);
    if (!isMyEntry && !isHostOrAdmin) {
      showToast(t('toasts.controlsLockedByAdmin'), 'error');
      return;
    }

    try {
      await actions.removeFromQueue(itemId);
    } catch (err: any) {
      console.error('Failed to remove item from queue:', err);
      showToast(t('toasts.commandFailed'), 'error');
    }
  };

  const handleMoveQueueItem = (index: number, direction: 'up' | 'down') => {
    if (!isHostOrAdmin) return;
    const newQueue = [...queue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQueue.length) return;

    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;

    const newOrderIds = newQueue.map((item) => item.id);
    actions.reorderQueue(newOrderIds);
  };

  const handleClearQueueAdmin = () => {
    if (!isHostOrAdmin) return;
    if (confirm(t('remote.clearQueueConfirm'))) {
      actions.clearQueue();
    }
  };

  const handleToggleRoomLockAdmin = () => {
    if (!isHostOrAdmin) return;
    actions.toggleLock();
  };

  const handleToggleFullscreenQrAdmin = () => {
    if (!isHostOrAdmin) return;
    actions.toggleFullscreenQr();
  };

  return {
    handleKickMember,
    handleRemoveQueueItem,
    handleMoveQueueItem,
    handleClearQueueAdmin,
    handleToggleRoomLockAdmin,
    handleToggleFullscreenQrAdmin,
  };
}

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { QrCode, Copy, Check } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

interface HostSettingsShareSectionProps {
  roomCode: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const HostSettingsShareSection: React.FC<HostSettingsShareSectionProps> = ({
  roomCode,
  showToast,
}) => {
  const { t } = useTranslation();
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = async () => {
    try {
      const joinUrl = `${window.location.origin}/join?room=${roomCode}`;
      await navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      showToast(t('remote.linkCopied'), 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showToast('Failed to copy link', 'error');
    }
  };

  return (
    <div className="p-4 bg-muted/20 border border-border flex flex-col sm:flex-row items-center gap-4">
      <div className="p-2 bg-white rounded-none border border-border shadow-md flex-shrink-0">
        <QRCodeSVG
          value={`${window.location.origin}/join?room=${roomCode}`}
          size={90}
          level="M"
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5 w-full">
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-foreground uppercase tracking-wider">
          <QrCode className="w-3.5 h-3.5 text-primary" />
          <span>{t('remote.joinQrCode')}</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {t('remote.scanToJoin')}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="text-xs font-mono uppercase tracking-wider h-8 flex items-center gap-1.5 cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">{t('remote.linkCopied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{t('remote.copyJoinLink')}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

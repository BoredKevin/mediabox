import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, Button } from '@boredkevin/ui';
import { X } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';

interface MediaBoxQrModalProps {
  show: boolean;
  onClose: () => void;
  remoteUrl: string;
  roomCode: string | null;
}

export const MediaBoxQrModal: React.FC<MediaBoxQrModalProps> = ({
  show,
  onClose,
  remoteUrl,
  roomCode,
}) => {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState<number>(30);

  useEffect(() => {
    if (show) {
      setSecondsLeft(30);
      const interval = setInterval(() => {
        setSecondsLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-30 flex items-center justify-center p-4 animate-in fade-in-0 duration-200">
      <Card
        cornerLines
        className="p-6 max-w-sm w-full flex flex-col items-center gap-4 relative shadow-2xl overflow-hidden bg-card border-border"
      >
        {/* 30s Animated Timer Progress Line */}
        <div
          className="absolute top-0 left-0 h-1 bg-primary/50 transition-all duration-1000 ease-linear"
          style={{ width: `${(secondsLeft / 30) * 100}%` }}
        />

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Close QR Modal"
        >
          <X className="w-5 h-5" />
        </Button>

        <div className="flex flex-col items-center gap-1">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
            {t('mediaBox.scanToRemote')}
          </h3>
        </div>

        <div className="p-3 bg-white border-4 border-primary">
          <QRCodeSVG value={remoteUrl} size={160} level="M" />
        </div>

        <div className="text-center flex flex-col gap-1 w-full">
          <span className="text-xs text-muted-foreground">{t('mediaBox.enterPinCode')}</span>
          <span className="font-mono text-3xl font-bold tracking-[0.2em] text-primary">
            {roomCode || '------'}
          </span>
        </div>
      </Card>
    </div>
  );
};

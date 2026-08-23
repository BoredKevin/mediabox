import React from 'react';
import { useTranslation, Language } from '@/context/LanguageContext';
import { useWatchParty } from '@/context/WatchPartyContext';
import { Button } from '@boredkevin/ui';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  className?: string;
  hideOnFullscreen?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
  hideOnFullscreen = false,
}) => {
  const { language, setLanguage } = useTranslation();

  let isFullscreen = false;
  try {
    const watchParty = useWatchParty();
    isFullscreen = Boolean(watchParty?.roomState?.isFullscreen);
  } catch (e) {
    // If rendered outside WatchPartyProvider
  }

  if (hideOnFullscreen && isFullscreen) {
    return null;
  }

  const toggleLanguage = () => {
    const nextLang: Language = language === 'en' ? 'id' : 'en';
    setLanguage(nextLang);
  };

  return (
    <Button
      variant="outline"
      chamfer="dual"
      onClick={toggleLanguage}
      aria-label="Switch Language / Ganti Bahasa"
      title={`Current: ${language.toUpperCase()} - Click to switch`}
      className={`h-11 items-center gap-1.5 px-3 text-xs font-mono font-bold uppercase tracking-wider ${className}`}
    >
      <Globe className="h-4 w-4 text-primary" />
      <span className="flex items-center gap-1">
        <span className={language === 'en' ? 'text-primary font-extrabold' : 'text-muted-foreground opacity-70'}>EN</span>
        <span className="text-muted-foreground opacity-40">/</span>
        <span className={language === 'id' ? 'text-primary font-extrabold' : 'text-muted-foreground opacity-70'}>ID</span>
      </span>
    </Button>
  );
};


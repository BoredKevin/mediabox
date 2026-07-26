import React from 'react';
import { useTranslation, Language } from '@/context/LanguageContext';
import { useWatchParty } from '@/context/WatchPartyContext';
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
    <button
      onClick={toggleLanguage}
      aria-label="Switch Language / Ganti Bahasa"
      title={`Current: ${language.toUpperCase()} - Click to switch`}
      className={`flex h-11 items-center gap-1.5 px-3 border border-slate-700 bg-surface text-text-muted hover:border-slate-500 hover:text-text rounded-none transition-all duration-200 text-xs font-mono font-bold uppercase tracking-wider cursor-pointer ${className}`}
    >
      <Globe className="h-4 w-4 text-[#00c8d4]" />
      <span className="flex items-center gap-1">
        <span className={language === 'en' ? 'text-[#00c8d4] font-extrabold' : 'text-slate-400'}>EN</span>
        <span className="text-slate-600">/</span>
        <span className={language === 'id' ? 'text-[#00c8d4] font-extrabold' : 'text-slate-400'}>ID</span>
      </span>
    </button>
  );
};

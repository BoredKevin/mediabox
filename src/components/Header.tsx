import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({ theme, toggleTheme }) => {
  const { t } = useTranslation();

  return (
    <header className="relative flex flex-col items-center justify-center pt-1 pb-1 text-center flex-shrink-0">
      {/* Theme Toggle Button */}
      <Button
        variant="outline"
        chamfer="dual"
        size="icon"
        onClick={toggleTheme}
        aria-label="Ganti tema"
        className="fixed top-4 right-4 z-50 h-11 w-11"
      >
        {theme === 'dark' ? (
          <Moon className="h-4 w-4 text-foreground" />
        ) : (
          <Sun className="h-4 w-4 text-foreground" />
        )}
      </Button>

      <h1 className="font-body text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl text-foreground">
        {t('header.title')}
      </h1>
      <h2 className="font-body text-lg font-normal sm:text-base mt-1 text-white-800">
        time.boredkevin.com <span className={`mt-1 text-sm font-mono font-semibold tracking-wider text-red-400`}>
          (BETA)
        </span>
      </h2>

    </header>
  );
};


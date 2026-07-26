import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface HeaderProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({ theme, toggleTheme }) => {
  return (
    <header className="relative flex flex-col items-center justify-center pt-1 pb-1 text-center flex-shrink-0">
      {/* Theme Toggle Button - Sharp Corners */}
      <button
        onClick={toggleTheme}
        aria-label="Ganti tema"
        className="fixed top-4 right-4 z-50 flex h-11 w-11 items-center justify-center border border-slate-700 bg-surface text-text-muted hover:border-slate-500 hover:text-text rounded-none transition-all duration-200"
      >
        {theme === 'dark' ? (
          <Moon className="h-4 w-4 text-[#00c8d4]" />
        ) : (
          <Sun className="h-4 w-4 text-amber-500" />
        )}
      </button>

      <h1 className="font-body text-xl font-bold tracking-tight text-text-muted sm:text-2xl lg:text-3xl">
        Welcome to XII - Cravion • Teknik Informatika
      </h1>
      <h2 className="font-body text-sm font-normal text-text-faint sm:text-base mt-1">
        time.boredkevin.com
      </h2>
    </header>
  );
};

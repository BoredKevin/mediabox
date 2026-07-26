import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ClockSection } from '@/components/ClockSection';
import { ScheduleSection } from '@/components/ScheduleSection';
import { MediaBox } from '@/components/MediaBox';
import { Footer } from '@/components/Footer';
import { RemotePage } from '@/pages/RemotePage';
import { WatchPartyProvider } from '@/context/WatchPartyContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const Dashboard: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <WatchPartyProvider>
      <LanguageSwitcher className="fixed top-4 right-18 sm:right-20 z-40" hideOnFullscreen />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-between p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="w-full max-w-[1800px] flex-1 flex flex-col justify-between gap-3 sm:gap-4 md:gap-5">
          <Header theme={theme} toggleTheme={toggleTheme} />

          {/* Main Content Section centered vertically between Header and Footer */}
          <div className="my-auto flex flex-col gap-3 sm:gap-4 md:gap-5 w-full py-2">
            {/* Top Grid: Clock (50%) + Watch Party Controls (50%) */}
            <ClockSection />

            {/* Bottom Grid: Schedule (Left 50%) + Media (Right 50%) */}
            <main className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-5 md:grid-cols-2 items-stretch">
              <ScheduleSection />
              <MediaBox />
            </main>
          </div>

          <Footer />
        </div>
      </div>
    </WatchPartyProvider>
  );
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/join" element={<RemotePage />} />
          <Route path="/remote" element={<RemotePage />} />
        </Routes>
      </HashRouter>
    </LanguageProvider>
  );
};

export default App;



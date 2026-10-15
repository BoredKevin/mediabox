import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { Header } from '@/components/Header';
import { ClockSection } from '@/components/ClockSection';
import { ScheduleSection } from '@/components/ScheduleSection';
import { MediaBox } from '@/components/MediaBox';
import { Footer } from '@/components/Footer';
import { WatchPartyProvider, useWatchParty } from '@/context/WatchPartyContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { TvSettingsModal } from '@/components/TvSettingsModal';
import { useTvNavigation } from '@/hooks/useTvNavigation';

const DashboardContent: React.FC = () => {
  const { isDark, toggleThemeMode } = useTheme();
  const { roomState, showSettingsModal, setShowSettingsModal } = useWatchParty();
  const isFullscreen = Boolean(roomState?.isFullscreen);

  useTvNavigation({
    isModalOpen: showSettingsModal,
    onCloseModal: () => setShowSettingsModal(false),
  });

  return (
    <>
      {/* Fixed Top-Left TV Settings Button */}
      {!isFullscreen && (
        <Button
          variant="outline"
          size="icon"
          chamfer="dual"
          onClick={() => setShowSettingsModal(true)}
          aria-label="Room & API Settings"
          title="Room & API Settings"
          className="fixed top-4 left-4 z-40 h-11 w-11"
        >
          <Settings className="h-4 w-4 text-foreground" />
        </Button>
      )}

      <LanguageSwitcher
        className="fixed top-4 right-18 sm:right-20 z-40"
        hideOnFullscreen
        isFullscreen={isFullscreen}
      />

      {/* Monotone Background */}
      <div
        className="fixed inset-0 z-0 bg-background pointer-events-none select-none"
        aria-hidden="true"
      />

      <div className={`relative z-10 flex min-h-screen md:h-screen flex-col items-center justify-between ${isFullscreen ? 'p-0' : 'p-3 sm:p-4 md:p-6 lg:p-8 pb-24 sm:pb-20 md:pb-10'}`}>
        <div className="w-full max-w-[1800px] flex-1 flex flex-col justify-between gap-3 sm:gap-4 md:gap-5 md:min-h-0">
          {!isFullscreen && <Header theme={isDark ? 'dark' : 'light'} toggleTheme={toggleThemeMode} />}

          {/* Main Content Section centered vertically between Header and Footer */}
          <div className="my-auto flex flex-col gap-3 sm:gap-4 md:gap-5 w-full py-2 md:min-h-0">
            {/* Top Grid: Clock (50%) + Watch Party Controls (50%) */}
            {!isFullscreen && <ClockSection />}

            {/* Bottom Grid: Schedule (Left 50%) + Media (Right 50%) */}
            <main className={`grid gap-3 sm:gap-4 md:gap-5 items-stretch md:min-h-0 ${isFullscreen ? 'grid-cols-1 w-full h-full' : 'grid-cols-1 md:grid-cols-2 mb-6 sm:mb-4 md:mb-0'}`}>
              {!isFullscreen && <ScheduleSection />}
              <MediaBox />
            </main>
          </div>

          {!isFullscreen && <Footer />}
        </div>
      </div>

      {/* TV Room Settings Modal */}
      <TvSettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </>
  );
};

export const Dashboard: React.FC = () => {
  return (
    <WatchPartyProvider>
      <DashboardContent />
    </WatchPartyProvider>
  );
};

export default Dashboard;

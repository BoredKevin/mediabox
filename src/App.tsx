import React, { Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@boredkevin/ui';
import { LanguageProvider } from '@/context/LanguageContext';
import { Loader2 } from 'lucide-react';

const Dashboard = React.lazy(() => import('@/Dashboard'));
const RemotePage = React.lazy(() => import('@/pages/RemotePage'));

const PageLoader: React.FC = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-primary">
    <Loader2 className="w-8 h-8 animate-spin" />
    <span className="text-xs font-mono tracking-widest text-muted-foreground uppercase">Loading...</span>
  </div>
);

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <HashRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/join" element={<RemotePage />} />
              <Route path="/remote" element={<RemotePage />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;

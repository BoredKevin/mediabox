import React, { useState, Suspense } from 'react';
import { Button } from '@boredkevin/ui';

const LicensesModal = React.lazy(() =>
  import('./LicensesModal').then((m) => ({ default: m.LicensesModal }))
);

export const Footer: React.FC = () => {
  const [showLicenses, setShowLicenses] = useState(false);
  const currentYear = new Date().getFullYear();
  const commitHash = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : '129900f';

  return (
    <>
      <footer className="fixed bottom-4 left-0 right-0 text-center text-xs sm:text-sm z-50 pointer-events-auto">
        <div className="inline-flex items-center justify-center gap-1.5 flex-wrap px-3 py-1 rounded-full bg-background/50 backdrop-blur-md border border-border/50 text-muted-foreground shadow-sm">
          <span>&copy; {currentYear}</span>
          <span>Powered by</span>
          <Button
            variant="link"
            asChild
            className="p-0 h-auto text-xs sm:text-sm font-normal text-primary hover:underline inline-flex"
          >
            <a
              href="https://github.com/boredkevin/mediabox"
              target="_blank"
              rel="noopener noreferrer"
            >
              boredkevin/mediabox
            </a>
          </Button>
          <span className="text-muted-foreground/60 select-none">&middot;</span>
          <Button
            variant="link"
            asChild
            className="p-0 h-auto text-xs sm:text-sm font-mono text-muted-foreground hover:text-primary hover:underline transition-colors inline-flex"
          >
            <a
              href={`https://github.com/boredkevin/mediabox/commit/${commitHash}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`View commit ${commitHash} on GitHub`}
            >
              {commitHash}
            </a>
          </Button>
          <span className="text-muted-foreground/60 select-none">&middot;</span>
          <Button
            variant="link"
            onClick={() => setShowLicenses(true)}
            className="p-0 h-auto text-xs sm:text-sm font-normal text-primary hover:underline cursor-pointer inline-flex"
          >
            Licenses
          </Button>
        </div>
      </footer>

      {showLicenses && (
        <Suspense fallback={null}>
          <LicensesModal
            open={showLicenses}
            onOpenChange={setShowLicenses}
          />
        </Suspense>
      )}
    </>
  );
};

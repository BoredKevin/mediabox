import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="absolute bottom-2 left-0 right-0 text-center text-xs sm:text-sm z-50 pointer-events-auto">
      <p>Powered by <a href="https://github.com/boredkevin/mediabox" target="_blank" rel="noopener noreferrer" className="hover:underline text-primary">boredkevin/mediabox</a> | Licensed under CPAL-1.0</p>
    </footer>
  );
};

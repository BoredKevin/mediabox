import React from 'react';
import { Card } from '@/components/ui/card';

export const MediaBox: React.FC = () => {
  return (
    <Card className="aspect-video w-full p-0 overflow-hidden rounded-none border border-slate-800 bg-surface flex items-center justify-center">
      <iframe
        src="https://w2g.tv/embed?room_id=7eerk0dtknvsq67vus"
        title="Watch2Gether Room"
        allowFullScreen
        allow="autoplay; fullscreen; camera; microphone;"
        className="w-full h-full border-none rounded-none"
      />
    </Card>
  );
};

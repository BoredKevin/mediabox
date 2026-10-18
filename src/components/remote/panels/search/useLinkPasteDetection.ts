import { useState, useEffect, useRef } from 'react';
import { fetchVideoTitle, parseYouTubeVideoId, VideoInfo } from '@/lib/youtube';

export interface LinkPreviewState {
  id: string;
  url: string;
  info?: VideoInfo;
  isLoading: boolean;
}

export function useLinkPasteDetection(inputValue: string) {
  const [debouncedValue, setDebouncedValue] = useState(inputValue);
  const [previewInfo, setPreviewInfo] = useState<LinkPreviewState | null>(null);
  const titleFetchAbortRef = useRef<number>(0);

  useEffect(() => {
    const trimmed = inputValue.trim();
    // Fast path: explicit URL pastes resolve immediately
    if (trimmed.includes('http') || trimmed.includes('youtu')) {
      setDebouncedValue(inputValue);
      return;
    }
    // Debounce keyword typing by 250ms to avoid regex execution on every keystroke
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, 250);

    return () => clearTimeout(timer);
  }, [inputValue]);

  const detectedYtId = parseYouTubeVideoId(debouncedValue.trim());
  const isDetectedUrl = Boolean(detectedYtId);

  useEffect(() => {
    if (!detectedYtId) {
      setPreviewInfo(null);
      return;
    }

    const fullUrl = `https://www.youtube.com/watch?v=${detectedYtId}`;
    const fetchId = Date.now();
    titleFetchAbortRef.current = fetchId;

    setPreviewInfo({
      id: detectedYtId,
      url: fullUrl,
      isLoading: true,
    });

    fetchVideoTitle(fullUrl).then((info) => {
      if (titleFetchAbortRef.current === fetchId) {
        setPreviewInfo({
          id: detectedYtId,
          url: fullUrl,
          info,
          isLoading: false,
        });
      }
    });
  }, [detectedYtId]);

  return {
    detectedYtId,
    isDetectedUrl,
    previewInfo,
    setPreviewInfo,
  };
}

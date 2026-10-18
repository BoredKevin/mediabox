import React, { useEffect, RefObject } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Loader2, X } from 'lucide-react';

interface SearchInputBarProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  isLocked: boolean;
  isSearching: boolean;
  isVerifying?: boolean;
  isSubmittingLink: boolean;
  isDetectedUrl: boolean;
  onClearError?: () => void;
}

export const SearchInputBar: React.FC<SearchInputBarProps> = ({
  inputValue,
  onInputChange,
  onSubmit,
  onClear,
  inputRef,
  isLocked,
  isSearching,
  isVerifying = false,
  isSubmittingLink,
  isDetectedUrl,
  onClearError,
}) => {
  const { t } = useTranslation();

  // WebOS Voice Recognition & Virtual Keyboard IME fallback
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const handleNativeInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target && target.value !== inputValue) {
        onInputChange(target.value);
        if (onClearError) onClearError();
      }
    };

    el.addEventListener('input', handleNativeInput);

    return () => {
      el.removeEventListener('input', handleNativeInput);
    };
  }, [inputRef, inputValue, onInputChange, onClearError]);

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row items-stretch gap-2">
      <div className="relative flex-1 min-w-0">
        {isDetectedUrl ? (
          <Plus className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none z-10" />
        ) : (
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
        )}
        <Input
          ref={inputRef as any}
          type="text"
          chamfer="dual"
          data-tv-nav="true"
          data-tv-zone="E"
          value={inputValue}
          onChange={(e) => {
            onInputChange(e.target.value);
            if (onClearError) onClearError();
          }}
          disabled={isLocked || isSearching || isVerifying || isSubmittingLink}
          placeholder={
            isLocked
              ? t('remote.searchQueueLocked')
              : 'Search YouTube Music or paste video link / URL...'
          }
          className="pl-11 pr-10 text-sm sm:text-base h-12 w-full tv-focus-target"
        />
        {inputValue && (
          <button
            type="button"
            data-tv-nav="true"
            data-tv-zone="E"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1.5 transition-colors cursor-pointer tv-focus-target"
            title="Clear"
            aria-label="Clear Search Input"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <Button
        type="submit"
        variant="cyber"
        chamfer="dual"
        data-tv-nav="true"
        data-tv-zone="E"
        disabled={isLocked || isSearching || isVerifying || isSubmittingLink || !inputValue.trim()}
        className="h-12 px-6 font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer tv-focus-target"
      >
        {isVerifying ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t('remote.verifying') || 'Verifying...'}</span>
          </>
        ) : isSubmittingLink || isSearching ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{isDetectedUrl ? 'Submitting...' : t('remote.searching')}</span>
          </>
        ) : isDetectedUrl ? (
          <>
            <Plus className="w-4 h-4" />
            <span>{t('remote.submitBtn')}</span>
          </>
        ) : (
          <>
            <Search className="w-4 h-4" />
            <span>{t('remote.searchBtn')}</span>
          </>
        )}
      </Button>
    </form>
  );
};

import React, { createContext, useContext, useState } from 'react';
import en from '@/locales/en.json';
import id from '@/locales/id.json';

export type Language = 'en' | 'id';

type RecursiveKeyOf<T> = T extends object
  ? {
      [K in keyof T & (string | number)]: T[K] extends object
        ? `${K}.${RecursiveKeyOf<T[K]>}`
        : `${K}`;
    }[keyof T & (string | number)]
  : never;

export type TranslationKey = RecursiveKeyOf<typeof en>;

const translations: Record<Language, typeof en> = {
  en,
  id,
};

const getNestedValue = (obj: any, path: string): string | undefined => {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language') as Language | null;
    if (saved && (saved === 'en' || saved === 'id')) {
      return saved;
    }
    const navLang = navigator.language.toLowerCase();
    if (navLang.startsWith('id')) {
      return 'id';
    }
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const langDict = translations[language] || translations.en;
    let targetKey = key as string;

    // Pluralization handling: if params.count is passed and != 1, look for key_plural
    if (params && typeof params.count === 'number' && params.count !== 1) {
      const pluralKey = `${key}_plural`;
      if (getNestedValue(langDict, pluralKey) || getNestedValue(translations.en, pluralKey)) {
        targetKey = pluralKey;
      }
    }

    let template = getNestedValue(langDict, targetKey) || getNestedValue(translations.en, targetKey) || String(key);

    if (params) {
      Object.entries(params).forEach(([pKey, pVal]) => {
        template = template.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
      });
    }

    return template;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};

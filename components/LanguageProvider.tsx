'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { type Lang, type TranslationKey, getTranslation } from '@/lib/i18n';

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
};

const STORAGE_KEY = 'aiecotrack-lang';

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getPreferredLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'hi') return stored;
  return 'en';
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    setLangState(getPreferredLang());
  }, []);

  const setLang = (nextLang: Lang) => {
    setLangState(nextLang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, nextLang);
    }
  };

  const t = useMemo(
    () => (key: TranslationKey) => getTranslation(lang, key),
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

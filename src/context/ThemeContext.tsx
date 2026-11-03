import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextType {
  preference: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
}

const STORAGE_KEY = 'absensi-ojt-psa-theme';
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getStoredPreference = (): ThemePreference => {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'light';
};

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [preference, setPreference] = useState<ThemePreference>(getStoredPreference);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  const resolvedTheme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', updateSystemTheme);
    return () => mediaQuery.removeEventListener('change', updateSystemTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const updatePreference = (nextPreference: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, nextPreference);
    setPreference(nextPreference);
  };

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference: updatePreference }),
    [preference, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
};

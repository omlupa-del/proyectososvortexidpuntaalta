import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'vortex_theme_v1';

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  isDark: true,
  setTheme: () => {},
  toggleTheme: () => {}
});

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    // ignore storage errors
  }
  return 'dark';
}

export function applyThemeToRoot(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = mode === 'dark';
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = mode;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', isDark ? '#030816' : '#f4f7fb');
  }
  const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (colorSchemeMeta) {
    colorSchemeMeta.setAttribute('content', mode);
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const initial = getStoredTheme();
    applyThemeToRoot(initial);
    return initial;
  });

  useEffect(() => {
    applyThemeToRoot(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setTheme = (next: ThemeMode) => setThemeState(next);
  const toggleTheme = () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        setTheme,
        toggleTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

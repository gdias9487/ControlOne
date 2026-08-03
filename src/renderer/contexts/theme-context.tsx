import * as React from 'react';
import type { SettingsDto } from '@shared/types';
import { unwrapApi } from '@/utils';

interface ThemeContextValue {
  theme: 'light' | 'dark';
  settings: SettingsDto | null;
  setTheme: (theme: 'light' | 'dark') => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<SettingsDto | null>(null);
  const [theme, setThemeState] = React.useState<'light' | 'dark'>('light');

  const refreshSettings = React.useCallback(async () => {
    if (!window.cleideApi) return;
    const data = unwrapApi(await window.cleideApi.settings.get());
    setSettings(data);
    setThemeState(data.theme);
  }, []);

  React.useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const setTheme = async (next: 'light' | 'dark') => {
    setThemeState(next);
    if (!window.cleideApi) return;
    const data = unwrapApi(await window.cleideApi.settings.update({ theme: next }));
    setSettings(data);
  };

  return (
    <ThemeContext.Provider value={{ theme, settings, setTheme, refreshSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
}

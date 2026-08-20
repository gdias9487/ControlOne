import { BrowserWindow } from 'electron';

export function windowChromeColors(theme: 'light' | 'dark'): {
  color: string;
  symbolColor: string;
} {
  const isDark = theme === 'dark';
  return {
    color: isDark ? '#09090b' : '#f8fafc',
    symbolColor: isDark ? '#fafafa' : '#0f172a',
  };
}

export function applyWindowChromeTheme(theme: 'light' | 'dark'): void {
  const { color, symbolColor } = windowChromeColors(theme);

  for (const win of BrowserWindow.getAllWindows()) {
    win.setBackgroundColor(color);
    if (process.platform !== 'darwin') {
      win.setTitleBarOverlay({
        color,
        symbolColor,
        height: 36,
      });
    }
  }
}

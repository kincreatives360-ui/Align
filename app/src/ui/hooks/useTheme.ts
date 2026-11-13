import { useEffect } from 'react';
import type { ThemeSetting } from '../../state/types';

const KEY = 'ac-theme';

function systemTheme(): 'light' | 'dark' {
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolve(theme: ThemeSetting): 'light' | 'dark' {
  return theme === 'system' ? systemTheme() : theme;
}

/**
 * Applies the theme to `<html data-theme>` and remembers the choice.
 * `index.html` does the same thing before first paint, so there is no flash.
 */
export function useTheme(theme: ThemeSetting): void {
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolve(theme);
      try {
        localStorage.setItem(KEY, theme);
      } catch {
        /* private mode — the theme still applies for this session */
      }
    };

    apply();

    if (theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

/** The theme written by the pre-paint script, before React mounts. */
export function initialTheme(): ThemeSetting {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    /* ignore */
  }
  return 'system';
}

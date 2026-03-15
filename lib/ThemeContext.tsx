import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Colors,
  Fonts,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  type ColorPalette,
  type ShadowSet,
  type ThemeMode,
} from './theme';

const THEME_STORAGE_KEY = 'untodo_theme_preference';

interface ThemeContextValue {
  colors: ColorPalette;
  fonts: typeof Fonts;
  typography: typeof Typography;
  spacing: typeof Spacing;
  borderRadius: typeof BorderRadius;
  shadows: ShadowSet;
  isDark: boolean;
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
      setLoaded(true);
    });
  }, []);

  const setTheme = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((prev) => {
      const resolvedCurrent = prev === 'system' ? (systemScheme ?? 'dark') : prev;
      const next = resolvedCurrent === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, [systemScheme]);

  const isDark = mode === 'system' ? (systemScheme ?? 'dark') === 'dark' : mode === 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: isDark ? Colors.dark : Colors.light,
      fonts: Fonts,
      typography: Typography,
      spacing: Spacing,
      borderRadius: BorderRadius,
      shadows: isDark ? Shadows.dark : Shadows.light,
      isDark,
      mode,
      toggleTheme,
      setTheme,
    }),
    [isDark, mode, toggleTheme, setTheme],
  );

  // Don't render until we've loaded the preference to avoid flash
  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

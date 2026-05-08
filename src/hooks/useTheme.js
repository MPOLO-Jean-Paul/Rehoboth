import { useContext } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { AppContext } from '../../App';
import * as R from '../theme/Responsive';
import { Theme } from '../constants/theme';

/**
 * Centralized theme hook — single source of truth for all color tokens and layout scaling.
 * Usage: const { isDark, C, S, brandColor } = useTheme();
 * C: Colors
 * S: Scaling utilities (S.s = scale, S.vs = verticalScale, S.ms = moderateScale)
 */
export function useTheme() {
  const {
    themeMode,
    setThemeMode,
    toggleTheme,
    lang,
    setLang,
    toggleLang,
    isOnline,
    colors,
    notificationsEnabled,
    toggleNotifications,
    user,
  } = useContext(AppContext);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
  const brandColor = Theme.colors.primary;

  // Responsive scaling aliases
  const S = {
    s: R.scale,
    vs: R.verticalScale,
    ms: R.moderateScale,
    fs: R.fontScale,
    width: R.SCREEN_WIDTH,
    height: R.SCREEN_HEIGHT,
  };

  // Canonical color tokens — use these everywhere
  const C = {
    // Backgrounds
    bg:       isDark ? '#0B1220' : '#F5F9FC',
    surface:  isDark ? '#111827' : '#FFFFFF',
    card:     isDark ? '#162033' : '#FFFFFF',
    cardSoft: isDark ? '#111C2F' : '#F8FBFF',
    input:    isDark ? '#0F1A2C' : '#FFFFFF',
    overlay:  isDark ? 'rgba(2,6,23,0.78)' : 'rgba(15,23,42,0.32)',

    // Borders
    border:   isDark ? '#263244' : '#D8E3EC',
    borderSoft: isDark ? '#1E293B' : '#EEF3F7',
    divider:  isDark ? '#1E293B' : '#EAF1F6',

    // Text
    text:          isDark ? '#F5F5F5' : '#0F172A',
    textSecondary: isDark ? '#CBD5E1' : '#475569',
    subtext:       isDark ? '#94A3B8' : '#64748B',
    placeholder:   isDark ? '#64748B' : '#94A3B8',

    // Status
    success: Theme.colors.success,
    danger:  Theme.colors.danger,
    warning: Theme.colors.warning,
    info:    Theme.colors.primary,

    // Brand
    brand:       brandColor,
    brandDeep: Theme.colors.primaryDeep,
    brandLight:  brandColor + '14',
    brandMedium: brandColor + '28',
    accent: Theme.colors.secondary,
    accentLight: Theme.colors.secondary + '16',

    // Skeleton / loading
    skeleton: isDark ? '#1F2A3B' : '#E5EEF5',

    // Header button bg
    headerBtn: isDark ? '#162033' : '#FFFFFF',

    // Close button (modal dismiss)
    closeBg: isDark ? '#2E2E2E' : '#F1F5F9',
    closeIc: isDark ? '#AAAAAA' : '#64748B',

    // Sub / secondary text alias
    sub: isDark ? '#888888' : '#94A3B8',

    // StatusBar
    statusBar: isDark ? 'light-content' : 'dark-content',
  };

  return {
    isDark,
    C,
    S,
    brandColor,
    themeMode,
    setThemeMode,
    toggleTheme,
    lang,
    setLang,
    toggleLang,
    isOnline,
    notificationsEnabled,
    toggleNotifications,
    user,
  };
}

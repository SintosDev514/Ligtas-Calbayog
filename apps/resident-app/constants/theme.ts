/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  pnp: {
    primary: '#11192D', // Navy Blue
    secondary: '#F4B51A', // Gold
    accent: '#C1121F', // Red
    background: '#F8F9FA', // Off-white
    surface: '#FFFFFF', // White
    textPrimary: '#11181C',
    textSecondary: '#666666',
    border: '#E5E5EA',
  },
  light: {
    text: '#11181C',
    background: '#F8F9FA',
    tint: '#0F204B',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0F204B',
  },
  dark: {
    text: '#ECEDEE',
    background: '#11192D', // Can use dark navy for dark mode
    tint: '#F4B51A', // Gold for tint in dark mode
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#F4B51A',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

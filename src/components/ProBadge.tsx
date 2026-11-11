import { View } from 'react-native';

import { radius, useTheme } from '@/theme/tokens';

import { T } from './ui';

/** Selo "PRO" para recursos do Teto Pro ainda bloqueados. */
export function ProBadge() {
  const { c } = useTheme();
  return (
    <View
      accessibilityLabel="Teto Pro"
      style={{ backgroundColor: c.accent, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 }}>
      <T v="caption2" style={{ color: c.onAccent, fontWeight: '800', letterSpacing: 0.6 }}>
        PRO
      </T>
    </View>
  );
}

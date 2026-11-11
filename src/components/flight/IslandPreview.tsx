import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { T } from '@/components/ui';
import { t } from '@/i18n';
import { fmtDuration } from '@/lib/format';
import { radius, space, useTheme } from '@/theme/tokens';

/**
 * Prévia em React Native da Live Activity/Dynamic Island.
 * Usada no Expo Go, no Android e na web, onde ActivityKit não existe.
 * Sempre escura, como a superfície real da ilha.
 */
export function IslandPreview({
  elapsedMs,
  wind,
  batteryPct,
  statusColor,
  landBy,
  expanded = true,
}: {
  elapsedMs: number;
  wind: string;
  batteryPct: number;
  statusColor: string;
  landBy: string;
  expanded?: boolean;
}) {
  const ACCENT = '#5B8CFF';
  const { isDark } = useTheme();
  // No modo escuro a ilha preta encosta no fundo preto: um contorno sutil separa as superfícies.
  const edge = isDark ? { borderWidth: 1, borderColor: '#FFFFFF24' } : null;
  if (!expanded) {
    return (
      <View
        style={{
          alignSelf: 'center',
          backgroundColor: '#000000',
          borderRadius: radius.pill,
          height: 37,
          paddingHorizontal: 14,
          minWidth: 200,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          ...edge,
        }}>
        <Icon name="flight" size={14} color={ACCENT} />
        <T v="footnote" num style={{ color: '#FFFFFF', fontWeight: '600' }}>
          {fmtDuration(elapsedMs)}
        </T>
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: '#000000', borderRadius: 32, borderCurve: 'continuous', padding: space.lg, gap: space.md, ...edge }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <T v="caption" style={{ color: '#FFFFFFA6' }}>
            {t('Em voo')}
          </T>
          <T v="title2" num style={{ color: '#FFFFFF' }}>
            {fmtDuration(elapsedMs)}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <T v="caption" style={{ color: '#FFFFFFA6' }}>
            {t('Vento')}
          </T>
          <T v="title3" num style={{ color: '#FFFFFF' }}>
            {wind}
          </T>
        </View>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: '#FFFFFF26', overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(0, Math.min(1, batteryPct)) * 100}%`, height: 5, backgroundColor: statusColor }} />
      </View>
      <T v="caption" style={{ color: '#FFFFFFA6' }} num>
        {t('Bateria útil estimada · pouse até {time}', { time: landBy })}
      </T>
    </View>
  );
}

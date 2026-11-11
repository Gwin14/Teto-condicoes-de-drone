import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { Pressable, View } from 'react-native';

import { useNow } from '@/hooks/useNow';
import { t } from '@/i18n';
import { fmtDuration } from '@/lib/format';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/tokens';

import { Icon } from './Icon';
import { T } from './ui';

/** Acessório da tab bar (iOS 26): mini-player do voo em andamento. */
export function FlightAccessory() {
  const { c } = useTheme();
  const session = useApp((s) => s.session);
  const now = useNow(1000);
  const placement = NativeTabs.BottomAccessory.usePlacement();
  if (!session) return null;
  const elapsed = now - session.startedAt;
  const remaining = session.usableMinutes * 60_000 - elapsed;
  return (
    <Pressable
      onPress={() => router.navigate('/flight')}
      accessibilityLabel={t('Voo em andamento')}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 }}>
      <Icon name="flight" size={16} color={c.accent} />
      <T v="subhead" style={{ fontWeight: '600' }} num>
        {fmtDuration(elapsed)}
      </T>
      {placement === 'regular' ? (
        <T v="footnote" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
          {session.place}
        </T>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <T v="footnote" tone={remaining < 3 * 60_000 ? 'nogo' : 'secondary'} num>
        {remaining > 0 ? `${Math.ceil(remaining / 60_000)} min` : t('Pouse')}
      </T>
    </Pressable>
  );
}

import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, useTheme } from '@/theme/tokens';
import { t } from '@/i18n';

import { T } from './ui';

/** Cabeçalho de modal/sheet com ação explícita (Cancelar/OK), padrão iOS. */
export function SheetHeader({
  title,
  left = t('Cancelar'),
  right,
  onRight,
  onLeft,
  rightDisabled,
  modal,
}: {
  title: string;
  left?: string | null;
  right?: string;
  onRight?: () => void;
  onLeft?: () => void;
  rightDisabled?: boolean;
  /** Modais de tela cheia (Android/web) precisam do inset superior. */
  modal?: boolean;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const top = modal && process.env.EXPO_OS !== 'ios' ? insets.top : 0;
  return (
    <View
      style={{
        paddingTop: top + space.lg,
        paddingBottom: space.md,
        paddingHorizontal: space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        {left ? (
          <Pressable hitSlop={12} onPress={onLeft ?? (() => router.back())} style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1 })}>
            <T v="body" tone="accent">
              {left}
            </T>
          </Pressable>
        ) : null}
      </View>
      <T v="headline" numberOfLines={1} style={{ flex: 2, textAlign: 'center', color: c.label }}>
        {title}
      </T>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {right ? (
          <Pressable
            hitSlop={12}
            disabled={rightDisabled}
            onPress={onRight}
            style={({ pressed }) => ({ opacity: rightDisabled ? 0.35 : pressed ? 0.4 : 1 })}>
            <T v="headline" tone="accent">
              {right}
            </T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

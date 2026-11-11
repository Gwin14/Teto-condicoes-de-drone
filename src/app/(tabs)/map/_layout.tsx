import { Stack } from 'expo-router';

import { t } from '@/i18n';

import { useTheme } from '@/theme/tokens';

export default function MapLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
      <Stack.Screen name="index" options={{ title: t('Mapa') }} />
    </Stack>
  );
}

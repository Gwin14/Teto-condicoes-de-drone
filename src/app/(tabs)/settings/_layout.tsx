import { Stack } from 'expo-router';

import { largeTitleOptions } from '@/components/stackOptions';
import { t } from '@/i18n';
import { useTheme } from '@/theme/tokens';

export default function SettingsLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={largeTitleOptions(c)}>
      <Stack.Screen name="index" options={{ title: t('Ajustes') }} />
      <Stack.Screen name="drone-custom" options={{ title: t('Drone personalizado'), headerLargeTitle: false }} />
      <Stack.Screen name="widgets" options={{ title: t('Widgets e Live Activity'), headerLargeTitle: false }} />
      <Stack.Screen name="regulations" options={{ title: t('Regras para drones'), headerLargeTitle: false }} />
    </Stack>
  );
}

import { Stack } from 'expo-router';

import { largeTitleOptions } from '@/components/stackOptions';
import { t } from '@/i18n';
import { useTheme } from '@/theme/tokens';

export default function FlightLayout() {
  const { c } = useTheme();
  const opts = largeTitleOptions(c);
  return (
    <Stack screenOptions={opts}>
      <Stack.Screen name="index" options={{ title: t('Voo') }} />
      <Stack.Screen name="compass" options={{ title: t('Bússola de vento'), headerLargeTitle: false }} />
      <Stack.Screen name="return" options={{ title: t('Retorno seguro'), headerLargeTitle: false }} />
      <Stack.Screen name="sun" options={{ title: t('Planejador de luz'), headerLargeTitle: false }} />
    </Stack>
  );
}

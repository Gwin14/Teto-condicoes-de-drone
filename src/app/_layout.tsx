import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BackgroundSync } from '@/components/BackgroundSync';
import { t } from '@/i18n';
import { configurePurchases } from '@/lib/purchases';
import { addResponseListener } from '@/native/notifications';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, refetchOnWindowFocus: true },
  },
});

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const { c, isDark } = useTheme();
  const onboarded = useApp((s) => s.onboarded);
  const [hydrated, setHydrated] = useState(() => useApp.persist.hasHydrated());

  useEffect(() => {
    // Mantém o splash até o estado persistido ser reidratado: sem flash do onboarding
    // para quem já concluiu, nem de estado vazio.
    const done = () => setHydrated(true);
    if (useApp.persist.hasHydrated()) done();
    const unsub = useApp.persist.onFinishHydration(done);
    const t = setTimeout(done, 1500);
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [hydrated]);

  useEffect(() => addResponseListener((url) => router.navigate(url as never)), []);

  useEffect(() => configurePurchases(), []);

  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.background, card: c.card, text: c.label, border: c.separator },
  };

  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.background }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navTheme}>
          <BackgroundSync />
          <Stack screenOptions={{ contentStyle: { backgroundColor: c.background } }}>
            <Stack.Protected guard={!onboarded}>
              <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
            </Stack.Protected>
            <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="location"
              options={{ presentation: 'modal', title: t('Local de voo'), headerShown: false }}
            />
            <Stack.Screen
              name="drone"
              options={{
                presentation: 'formSheet',
                headerShown: false,
                sheetGrabberVisible: true,
                sheetAllowedDetents: [0.65, 1],
                sheetCornerRadius: 28,
                contentStyle: { backgroundColor: c.background },
              }}
            />
            <Stack.Screen
              name="factor/[id]"
              options={{
                presentation: 'formSheet',
                headerShown: false,
                sheetGrabberVisible: true,
                sheetAllowedDetents: [0.55, 1],
                sheetCornerRadius: 28,
                contentStyle: { backgroundColor: c.background },
              }}
            />
            <Stack.Screen name="checklist" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen
              name="gnss"
              options={{
                title: t('Satélites e interferência'),
                headerBackButtonDisplayMode: 'minimal',
                headerTintColor: c.accent,
                headerTitleStyle: { color: c.label },
                headerStyle: { backgroundColor: c.background },
                headerShadowVisible: false,
              }}
            />
            </Stack.Protected>
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

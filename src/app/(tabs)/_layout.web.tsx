import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { t } from '@/i18n';
import { useTheme } from '@/theme/tokens';

function tabIcon(icon: IconName) {
  function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={icon} size={22} color={color} />;
  }
  return TabIcon;
}

const ICONS = {
  now: tabIcon('now'),
  map: tabIcon('map'),
  forecast: tabIcon('forecast'),
  flight: tabIcon('flight'),
  settings: tabIcon('settings'),
};

/** Web: abas JS na parte de baixo (no iOS/Android usamos NativeTabs). */
export default function WebTabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.secondary,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.separator },
        sceneStyle: { backgroundColor: c.background },
      }}>
      <Tabs.Screen name="(now)" options={{ title: t('Agora'), tabBarIcon: ICONS.now }} />
      <Tabs.Screen name="map" options={{ title: t('Mapa'), tabBarIcon: ICONS.map }} />
      <Tabs.Screen name="forecast" options={{ title: t('Previsão'), tabBarIcon: ICONS.forecast }} />
      <Tabs.Screen name="flight" options={{ title: t('Voo'), tabBarIcon: ICONS.flight }} />
      <Tabs.Screen name="settings" options={{ title: t('Ajustes'), tabBarIcon: ICONS.settings }} />
    </Tabs>
  );
}

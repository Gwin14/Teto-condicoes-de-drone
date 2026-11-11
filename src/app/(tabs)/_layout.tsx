import { NativeTabs } from 'expo-router/native-tabs';

import { FlightAccessory } from '@/components/FlightAccessory';
import { t } from '@/i18n';
import { useApp } from '@/store/app';
import { useTheme } from '@/theme/tokens';

export default function TabsLayout() {
  const { c } = useTheme();
  const inFlight = useApp((s) => s.session != null);

  return (
    <NativeTabs
      tintColor={c.accent}
      backgroundColor={process.env.EXPO_OS === 'android' ? c.card : undefined}
      indicatorColor={c.accentSoft}
      minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="(now)">
        <NativeTabs.Trigger.Label>{t('Agora')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'scope', selected: 'scope' }} md="radar" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Label>{t('Mapa')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="map" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="forecast">
        <NativeTabs.Trigger.Label>{t('Previsão')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="flight">
        <NativeTabs.Trigger.Label>{t('Voo')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'airplane.departure', selected: 'airplane.departure' }} md="flight_takeoff" />
        {inFlight ? <NativeTabs.Trigger.Badge> </NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t('Ajustes')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
      {inFlight && process.env.EXPO_OS === 'ios' ? (
        <NativeTabs.BottomAccessory>
          <FlightAccessory />
        </NativeTabs.BottomAccessory>
      ) : null}
    </NativeTabs>
  );
}

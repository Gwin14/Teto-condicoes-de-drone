import Slider from '@react-native-community/slider';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';

import { Segmented } from '@/components/Segmented';
import { Card, ListRow, T } from '@/components/ui';
import { useDrone } from '@/hooks/useConditions';
import { useActiveLocation } from '@/hooks/useLocation';
import { t } from '@/i18n';
import { fmtSpeed, type SpeedUnit, type TempUnit } from '@/lib/format';
import { regionAt } from '@/lib/region';
import { openPro, useIsPro } from '@/lib/purchases';
import { capabilities, inExpoGo } from '@/native/capabilities';
import { ensurePermission } from '@/native/notifications';
import { useApp } from '@/store/app';
import { space, useTheme } from '@/theme/tokens';

const SPEEDS: SpeedUnit[] = ['kmh', 'ms', 'kt', 'mph'];
const TEMPS: TempUnit[] = ['c', 'f'];

function Group({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      {title ? (
        <T v="footnote" tone="secondary" style={{ paddingHorizontal: space.lg, textTransform: 'uppercase' }}>
          {title}
        </T>
      ) : null}
      {children}
      {footer ? (
        <T v="footnote" tone="secondary" style={{ paddingHorizontal: space.lg }}>
          {footer}
        </T>
      ) : null}
    </View>
  );
}

export default function SettingsScreen() {
  const { c } = useTheme();
  const drone = useDrone();
  const altitude = useApp((s) => s.altitude);
  const speedUnit = useApp((s) => s.speedUnit);
  const tempUnit = useApp((s) => s.tempUnit);
  const notify = useApp((s) => s.notifyWindows);
  const set = useApp((s) => s.set);
  // Valor local durante o arraste; grava no store ao soltar (sem re-render global por frame).
  const [alt, setAlt] = useState(altitude);
  const { location } = useActiveLocation();
  const isPro = useIsPro();
  const br = location ? regionAt(location.lat, location.lon, location.country) === 'BR' : true;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.xxl, paddingBottom: space.xxxl * 2 }}>
      <Card padded={false}>
        <ListRow
          icon="sparkle"
          title="Teto Pro"
          subtitle={isPro ? t('Ativo · obrigado por apoiar o Teto!') : t('Previsão de 7 dias, alertas, widgets e mais')}
          onPress={() => router.push('/paywall')}
          last
        />
      </Card>

      <Group title={t('Aeronave')} footer={t('O score de voo usa os limites oficiais deste drone.')}>
        <Card padded={false}>
          <ListRow
            icon="drone"
            title={`${drone.brand} ${drone.name}`}
            subtitle={`${t('Vento até {speed}', { speed: fmtSpeed(drone.maxWind, speedUnit) })} · ${drone.flightTime} min · ${drone.weightG} g`}
            onPress={() => router.push('/drone')}
          />
          <ListRow icon="edit" iconColor={c.secondary} title={t('Drone personalizado')} onPress={() => openPro('/settings/drone-custom')} last />
        </Card>
      </Group>

      <Group title={t('Altitude planejada')} footer={t('O vento é interpolado entre os níveis de 10, 80, 120 e 180 m do modelo. Limite legal usual: 120 m (400 ft) acima do solo.')}>
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <T v="body">{t('Altura de voo')}</T>
            <T v="title3" num tone="accent">
              {alt} m
            </T>
          </View>
          <Slider
            minimumValue={10}
            maximumValue={120}
            step={10}
            value={alt}
            onValueChange={(v) => {
              Haptics.selectionAsync().catch(() => {});
              setAlt(v);
            }}
            onSlidingComplete={(v) => set('altitude', v)}
            minimumTrackTintColor={c.accent}
            maximumTrackTintColor={c.fill}
            accessibilityLabel={t('Altitude planejada')}
          />
        </Card>
      </Group>

      <Group title={t('Unidades')}>
        <Card style={{ gap: space.lg }}>
          <View style={{ gap: space.sm }}>
            <T v="subhead" tone="secondary">
              {t('Velocidade do vento')}
            </T>
            <Segmented
              values={['km/h', 'm/s', 'kt', 'mph']}
              selectedIndex={SPEEDS.indexOf(speedUnit)}
              onChange={(e) => set('speedUnit', SPEEDS[e.nativeEvent.selectedSegmentIndex])}
            />
          </View>
          <View style={{ gap: space.sm }}>
            <T v="subhead" tone="secondary">
              {t('Temperatura')}
            </T>
            <Segmented
              values={['°C', '°F']}
              selectedIndex={TEMPS.indexOf(tempUnit)}
              onChange={(e) => set('tempUnit', TEMPS[e.nativeEvent.selectedSegmentIndex])}
            />
          </View>
        </Card>
      </Group>

      <Group title={t('Alertas')} footer={t('Durante o voo, o Teto avisa quando a bateria útil estimada acabar. Para alertas de janela ideal, toque no sino de uma janela na aba Agora.')}>
        <Card padded={false}>
          <ListRow
            icon="bell"
            title={t('Lembrete de bateria em voo')}
            last
            right={
              <Switch
                value={notify}
                disabled={!capabilities.localNotifications}
                onValueChange={async (v) => {
                  if (v) {
                    const ok = await ensurePermission();
                    set('notifyWindows', ok);
                  } else set('notifyWindows', false);
                }}
                trackColor={{ true: c.go }}
              />
            }
          />
        </Card>
      </Group>

      <Group title={t('Integrações')}>
        <Card padded={false}>
          <ListRow
            icon="widgets"
            title={t('Widgets e Live Activity')}
            subtitle={capabilities.widgets ? t('Ativos') : inExpoGo ? t('Prévias no Expo Go') : t('Prévias')}
            onPress={() => router.push('/settings/widgets')}
          />
          <ListRow
            icon="law"
            iconColor={c.secondary}
            title={br ? t('Regras para voar no Brasil') : t('Regras para voar')}
            subtitle={br ? t('ANAC, DECEA e Anatel') : t('Resumo e autoridades oficiais')}
            onPress={() => router.push('/settings/regulations')}
            last
          />
        </Card>
      </Group>

      <T v="footnote" tone="tertiary" style={{ textAlign: 'center' }}>
        {t('Teto {version} · Previsão Open-Meteo · Kp NOAA SWPC · METAR aviationweather.gov', { version: Application.nativeApplicationVersion ?? '1.0.0' })}
      </T>
    </ScrollView>
  );
}

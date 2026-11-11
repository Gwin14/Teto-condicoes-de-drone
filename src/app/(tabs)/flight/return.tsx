import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Card, T } from '@/components/ui';
import { useConditions } from '@/hooks/useConditions';
import { useActiveLocation } from '@/hooks/useLocation';
import { t } from '@/i18n';
import { clamp, fmtDistance, fmtSpeed } from '@/lib/format';
import { usableFlightMinutes } from '@/lib/scoring';
import { useApp } from '@/store/app';
import { space, useTheme } from '@/theme/tokens';

/**
 * Retorno seguro: quanto de bateria é preciso para voltar de uma distância,
 * com o pior caso de vento de proa no retorno, mais a descida.
 */
export default function ReturnScreen() {
  const { c } = useTheme();
  const { location } = useActiveLocation();
  const { data, drone } = useConditions(location?.lat, location?.lon, location?.country);
  const unit = useApp((s) => s.speedUnit);
  const altitude = useApp((s) => s.altitude);
  const [distance, setDistance] = useState(800);
  const [headwindPct, setHeadwindPct] = useState(100);

  const wind = data?.now.windAlt ?? 0;
  const temp = data?.forecast.current.temp ?? 20;
  const headwind = (wind * headwindPct) / 100;
  const ground = drone.cruiseSpeed - headwind; // km/h
  const minutesBack = ground > 1 ? (distance / 1000 / ground) * 60 : Infinity;
  const descentMin = altitude / 3 / 60; // ~3 m/s
  const totalMin = minutesBack + descentMin + 0.5; // +30 s de pairado/pouso
  // Consumo: autonomia nominal ajustada pelo vento e temperatura (sem reserva).
  const fullMin = usableFlightMinutes(drone, wind, temp) / 0.8;
  const needPct = Number.isFinite(totalMin) ? clamp((totalMin / fullMin) * 100, 0, 999) : Infinity;
  const withReserve = needPct + 20;
  const status = !Number.isFinite(needPct) || withReserve > 100 ? 'nogo' : withReserve > 60 ? 'caution' : 'go';
  const color = status === 'nogo' ? c.nogo : status === 'caution' ? c.caution : c.go;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 80 }}>
      <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxl }}>
        <T v="footnote" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '600' }}>
          {t('Inicie o retorno com pelo menos')}
        </T>
        <T v="display" num style={{ color }}>
          {Number.isFinite(withReserve) ? `${Math.min(100, Math.ceil(withReserve))}%` : '—'}
        </T>
        <T v="subhead" tone="secondary" style={{ textAlign: 'center' }}>
          {Number.isFinite(needPct)
            ? t('{need}% para voltar + 20% de reserva · ~{min} min de retorno', { need: Math.ceil(needPct), min: Math.ceil(totalMin) })
            : t('Com esse vento de proa o drone não avança. Não se afaste.')}
        </T>
        {withReserve > 100 && Number.isFinite(withReserve) ? (
          <T v="footnote" tone="nogo" style={{ textAlign: 'center' }}>
            {t('Distância acima do alcance seguro com o vento atual.')}
          </T>
        ) : null}
      </Card>

      <Card style={{ gap: space.lg }}>
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T v="headline">{t('Distância do ponto Home')}</T>
            <T v="headline" num tone="accent">
              {fmtDistance(distance)}
            </T>
          </View>
          <Slider
            minimumValue={100}
            maximumValue={5000}
            step={50}
            value={distance}
            onValueChange={(v) => {
              if (v % 500 === 0) Haptics.selectionAsync().catch(() => {});
              setDistance(v);
            }}
            minimumTrackTintColor={c.accent}
            maximumTrackTintColor={c.fill}
            accessibilityLabel={t('Distância')}
          />
        </View>
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T v="headline">{t('Vento de proa no retorno')}</T>
            <T v="headline" num tone="accent">
              {headwindPct}%
            </T>
          </View>
          <Slider
            minimumValue={0}
            maximumValue={100}
            step={5}
            value={headwindPct}
            onValueChange={setHeadwindPct}
            minimumTrackTintColor={c.accent}
            maximumTrackTintColor={c.fill}
            accessibilityLabel={t('Percentual de vento de proa')}
          />
          <T v="footnote" tone="secondary">
            {t('100% = vento totalmente contra no retorno (pior caso). Use a Bússola de vento para ver o seu caso.')}
          </T>
        </View>
      </Card>

      <Card style={{ gap: space.md }}>
        <Line label="Drone" value={`${drone.brand} ${drone.name}`} />
        <Line label={drone.cruiseOfficial === false ? t('Velocidade de cruzeiro (aprox.)') : t('Velocidade de cruzeiro')} value={fmtSpeed(drone.cruiseSpeed, unit)} />
        <Line label={t('Vento a {alt} m', { alt: altitude })} value={fmtSpeed(wind, unit)} />
        <Line label={t('Velocidade no solo (retorno)')} value={ground > 0 ? fmtSpeed(ground, unit) : t('parado')} warn={ground < drone.cruiseSpeed * 0.4} />
        <Line label={t('Autonomia ajustada')} value={`${Math.round(fullMin)} min`} />
        <Line label={t('Descida')} value={`${altitude} m · ~${Math.ceil(descentMin * 60)} s`} />
      </Card>
      <T v="caption" tone="tertiary" style={{ paddingHorizontal: space.xs }}>
        {t('Estimativa conservadora. Siga sempre os alertas de bateria do seu drone e programe o RTH acima dos obstáculos.')}
      </T>
    </ScrollView>
  );
}

function Line({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
      <T v="subhead" tone="secondary">
        {label}
      </T>
      <T v="subhead" num tone={warn ? 'nogo' : 'label'} style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>
        {value}
      </T>
    </View>
  );
}


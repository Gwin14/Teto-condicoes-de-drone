import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ScoreRing } from '@/components/ScoreRing';
import { Card, PressableScale, StatusPill, T } from '@/components/ui';
import type { Conditions } from '@/hooks/useConditions';
import { t } from '@/i18n';
import type { DroneProfile } from '@/lib/drones';
import { cardinal, fmtSpeed, type SpeedUnit } from '@/lib/format';
import { verdictLabel } from '@/lib/scoring';
import { radius, space, useTheme, verdictColor } from '@/theme/tokens';

export function HeroCard({ data, drone, altitude, unit }: { data: Conditions; drone: DroneProfile; altitude: number; unit: SpeedUnit }) {
  const { c } = useTheme();
  const n = data.now;
  const worst = n.factors.filter((f) => f.status !== 'go').slice(0, 2);
  const zone = data.airspace.status;

  const summary =
    worst.length === 0
      ? t('Todos os fatores dentro dos limites do seu drone.')
      : worst.map((f) => `${f.label}: ${f.detail}`).join(' · ');

  return (
    <Card style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <ScoreRing score={n.score} verdict={n.verdict} />
        <View style={{ flex: 1, gap: space.sm }}>
          <T v="title2" style={{ color: verdictColor(c, n.verdict) }}>
            {verdictLabel[n.verdict]}
          </T>
          <T v="subhead" tone="secondary" numberOfLines={4}>
            {summary}
          </T>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat icon="wind" label={t('Vento')} value={fmtSpeed(n.windAlt, unit)} sub={`${cardinal(n.dirAlt)} · ${altitude} m`} />
        <Stat icon="gust" label={t('Rajadas')} value={fmtSpeed(n.gustAlt, unit)} sub={`+${fmtSpeed(Math.max(0, n.gustAlt - n.windAlt), unit)}`} />
        <Stat icon="battery" label={t('Autonomia')} value={`${Math.round(data.usable)} min`} sub={t('útil')} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        <PressableScale
          haptic
          onPress={() => router.push('/drone')}
          accessibilityLabel={t('Drone selecionado: {drone}. Toque para trocar.', { drone: `${drone.brand} ${drone.name}` })}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: c.fill,
            borderRadius: radius.pill,
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}>
          <Icon name="drone" size={14} color={c.label} />
          <T v="footnote" style={{ fontWeight: '600' }}>
            {drone.name}
          </T>
          <Icon name="chevronDown" size={10} color={c.secondary} weight="bold" />
        </PressableScale>
        {zone !== 'clear' && data.airspace.nearest ? (
          <StatusPill
            v={zone === 'critical' ? 'nogo' : 'caution'}
            label={zone === 'critical' ? t('Zona de aeródromo {icao}', { icao: data.airspace.nearest.icao }) : t('Perto de {icao}', { icao: data.airspace.nearest.icao })}
          />
        ) : (
          <StatusPill v="go" label={t('Sem aeródromo próximo')} />
        )}
      </View>
    </Card>
  );
}

function Stat({ icon, label, value, sub }: { icon: 'wind' | 'gust' | 'battery'; label: string; value: string; sub?: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.background,
        borderRadius: radius.inner,
        borderCurve: 'continuous',
        padding: space.md,
        gap: 4,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name={icon} size={12} color={c.secondary} />
        <T v="caption" tone="secondary" numberOfLines={1}>
          {label}
        </T>
      </View>
      <T v="headline" num numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      {sub ? (
        <T v="caption2" tone="tertiary">
          {sub}
        </T>
      ) : null}
    </View>
  );
}

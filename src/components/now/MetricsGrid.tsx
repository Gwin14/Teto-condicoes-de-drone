import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { PressableScale, T } from '@/components/ui';
import type { Conditions } from '@/hooks/useConditions';
import { fmtNum, t } from '@/i18n';
import { fmtDistance, fmtTemp, fmtVisibility, type TempUnit } from '@/lib/format';
import { kpLabel } from '@/lib/scoring';
import { radius, space, useTheme } from '@/theme/tokens';

type Tile = { icon: IconName; label: string; value: string; note: string; factor?: string };

export function MetricsGrid({ data, tempUnit }: { data: Conditions; tempUnit: TempUnit }) {
  const h = data.forecast.current;
  const n = data.now;
  const tiles: Tile[] = [
    {
      icon: 'thermometer',
      label: t('Temperatura'),
      value: fmtTemp(h.temp, tempUnit),
      note: t('Sensação {temp}', { temp: fmtTemp(h.apparent, tempUnit) }),
      factor: 'temperature',
    },
    {
      icon: 'humidity',
      label: t('Umidade'),
      value: `${Math.round(h.humidity)}%`,
      note: t('Orvalho {temp}', { temp: fmtTemp(h.dewPoint, tempUnit) }) + (h.temp - h.dewPoint < 2.5 ? ` · ${t('lente pode embaçar')}` : ''),
    },
    {
      icon: 'cloud',
      label: t('Base de nuvens'),
      value: `~${fmtDistance(Math.round(n.cloudBase / 10) * 10)}`,
      note: t('Cobertura {pct}%', { pct: Math.round(h.cloud) }),
      factor: 'cloudbase',
    },
    {
      icon: 'visibility',
      label: t('Visibilidade'),
      value: fmtVisibility(h.visibility),
      note: h.visibility >= 5000 ? t('Boa para VLOS') : t('Reduzida'),
      factor: 'visibility',
    },
    {
      icon: 'satellite',
      label: t('Índice Kp'),
      value: fmtNum(n.kp, 1),
      note: kpLabel(n.kp),
      factor: 'kp',
    },
    {
      icon: 'rain',
      label: t('Chuva'),
      value: `${Math.round(h.precipProb)}%`,
      note: h.precip > 0 ? t('{mm} mm agora', { mm: fmtNum(h.precip, 1) }) : t('Sem precipitação'),
      factor: 'precip',
    },
    {
      icon: 'mountain',
      label: t('Altitude-densidade'),
      value: Number.isFinite(data.densityAlt) ? fmtDistance(Math.max(0, data.densityAlt)) : '—',
      note: data.densityAlt > 1500 ? t('Menos sustentação') : t('Elevação {m} m', { m: Math.round(data.forecast.elevation) }),
    },
    {
      icon: 'uv',
      label: t('Índice UV'),
      value: String(Math.round(h.uv)),
      note: h.uv >= 8 ? t('Muito alto · proteja-se') : h.uv >= 6 ? t('Alto') : t('Moderado ou baixo'),
    },
  ];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {tiles.map((t) => (
        <MetricTile key={t.label} tile={t} />
      ))}
    </View>
  );
}

function MetricTile({ tile }: { tile: Tile }) {
  const { c } = useTheme();
  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={tile.icon} size={13} color={c.secondary} />
        <T v="caption" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '600' }} numberOfLines={1}>
          {tile.label}
        </T>
      </View>
      <T v="title2" num numberOfLines={1} adjustsFontSizeToFit>
        {tile.value}
      </T>
      <T v="footnote" tone="secondary" numberOfLines={2}>
        {tile.note}
      </T>
    </>
  );
  const style = {
    flexBasis: '47%' as const,
    flexGrow: 1,
    backgroundColor: c.card,
    borderRadius: radius.card,
    borderCurve: 'continuous' as const,
    padding: space.lg,
    gap: space.xs,
    minHeight: 112,
  };
  if (!tile.factor) return <View style={style}>{body}</View>;
  return (
    <PressableScale
      style={style}
      onPress={() => router.push({ pathname: '/factor/[id]', params: { id: tile.factor! } })}
      accessibilityRole="button"
      accessibilityLabel={`${tile.label}: ${tile.value}. ${tile.note}`}>
      {body}
    </PressableScale>
  );
}

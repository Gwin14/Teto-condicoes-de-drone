import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Card, T } from '@/components/ui';
import { t } from '@/i18n';
import type { DroneProfile } from '@/lib/drones';
import { cardinal, convertSpeed, fmtSpeed, type SpeedUnit } from '@/lib/format';
import { windAtAltitude } from '@/lib/scoring';
import type { Hour } from '@/lib/weather';
import { radius, space, useTheme } from '@/theme/tokens';

/** "Torre de vento": velocidade e direção por altitude vs. limite do drone. */
export function WindProfileCard({ hour, drone, altitude, unit }: { hour: Hour; drone: DroneProfile; altitude: number; unit: SpeedUnit }) {
  const { c } = useTheme();
  const planned = windAtAltitude(hour, altitude);
  const levels = [
    { alt: 180, v: hour.wind180, d: hour.dir180 },
    { alt: 120, v: hour.wind120, d: hour.dir120 },
    { alt: altitude, v: planned.speed, d: planned.dir, planned: true },
    { alt: 80, v: hour.wind80, d: hour.dir80 },
    { alt: 10, v: hour.wind10, d: hour.dir10 },
  ]
    .filter((l, i, arr) => l.planned || !arr.some((o) => o.planned && o.alt === l.alt))
    .sort((a, b) => b.alt - a.alt);
  const max = Math.max(drone.maxWind * 1.1, ...levels.map((l) => l.v));

  return (
    <Card style={{ gap: space.md }}>
      {levels.map((l) => {
        const pct = l.v / max;
        const ratio = l.v / drone.maxWind;
        const color = ratio >= 0.9 ? c.nogo : ratio >= 0.5 ? c.caution : c.go;
        return (
          <View key={`${l.alt}-${l.planned ? 'p' : 'm'}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <T v="footnote" num tone={l.planned ? 'accent' : 'secondary'} style={{ width: 52, fontWeight: l.planned ? '700' : '500' }}>
              {l.alt} m
            </T>
            <View style={{ flex: 1, height: l.planned ? 12 : 8, borderRadius: radius.pill, backgroundColor: c.fill, overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(4, pct * 100)}%`, height: '100%', borderRadius: radius.pill, backgroundColor: color }} />
              <View
                style={{
                  position: 'absolute',
                  left: `${(drone.maxWind / max) * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  backgroundColor: c.label,
                  opacity: 0.35,
                }}
              />
            </View>
            <View style={{ width: 86, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              <T v="footnote" num style={{ fontWeight: '600' }}>
                {Math.round(convertSpeed(l.v, unit))}
              </T>
              <View style={{ transform: [{ rotate: `${(l.d + 180) % 360}deg` }] }}>
                <Icon name="arrowUp" size={12} color={c.secondary} />
              </View>
              <T v="caption" tone="secondary" style={{ width: 28 }}>
                {cardinal(l.d)}
              </T>
            </View>
          </View>
        );
      })}
      <T v="caption" tone="tertiary">
        {t('Linha vertical = limite do {drone} ({limit}). Seta indica para onde o vento sopra.', { drone: drone.name, limit: fmtSpeed(drone.maxWind, unit) })}
      </T>
    </Card>
  );
}

import { Pressable, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { T } from '@/components/ui';
import { t } from '@/i18n';
import { zoneRadii } from '@/lib/airports';
import { space, useTheme } from '@/theme/tokens';

import type { MapSurfaceProps } from './types';

/**
 * Fallback da web: radar esquemático (o react-native-maps não roda na web).
 * Mostra aeródromos e zonas em escala, centrado no local ativo.
 */
export function MapSurface(p: MapSurfaceProps) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const size = Math.min(width, height - p.bottomInset) - 32;
  const rangeM = 40000;
  const scale = size / 2 / rangeM;
  const cx = size / 2;
  const project = (lat: number, lon: number) => {
    const dy = (lat - p.center.lat) * 111320;
    const dx = (lon - p.center.lon) * 111320 * Math.cos((p.center.lat * Math.PI) / 180);
    return { x: cx + dx * scale, y: cx - dy * scale };
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', paddingTop: 120 }}>
      <Pressable
        onLongPress={(e) => {
          const { locationX, locationY } = e.nativeEvent;
          const dx = (locationX - cx) / scale;
          const dy = (cx - locationY) / scale;
          p.onLongPress({
            lat: p.center.lat + dy / 111320,
            lon: p.center.lon + dx / (111320 * Math.cos((p.center.lat * Math.PI) / 180)),
          });
        }}>
        <Svg width={size} height={size}>
          {[1, 2, 3, 4].map((i) => (
            <Circle key={i} cx={cx} cy={cx} r={(size / 2) * (i / 4)} stroke={c.separator} strokeWidth={1} fill="none" />
          ))}
          <Line x1={cx} y1={0} x2={cx} y2={size} stroke={c.separator} />
          <Line x1={0} y1={cx} x2={size} y2={cx} stroke={c.separator} />
          {p.airports.map((a) => {
            const pt = project(a.lat, a.lon);
            const r = zoneRadii(p.region);
            return (
              <G key={a.icao}>
                {p.showZones ? (
                  <>
                    <Circle cx={pt.x} cy={pt.y} r={r.caution * scale} fill={c.mapZoneCaution} stroke={c.caution} />
                    {r.critical > 0 ? <Circle cx={pt.x} cy={pt.y} r={r.critical * scale} fill={c.mapZoneCritical} stroke={c.nogo} /> : null}
                  </>
                ) : null}
                <Circle cx={pt.x} cy={pt.y} r={4} fill={c.nogo} />
                <SvgText x={pt.x + 7} y={pt.y + 4} fill={c.label} fontSize={11} fontWeight="600">
                  {a.icao}
                </SvgText>
              </G>
            );
          })}
          {p.spots.map((s) => {
            const pt = project(s.lat, s.lon);
            return <Circle key={s.id} cx={pt.x} cy={pt.y} r={5} fill={c.go} />;
          })}
          {p.selected ? <Circle cx={project(p.selected.lat, p.selected.lon).x} cy={project(p.selected.lat, p.selected.lon).y} r={6} fill={c.accent} /> : null}
          <Circle cx={cx} cy={cx} r={7} fill={c.accent} stroke="#FFFFFF" strokeWidth={2} />
        </Svg>
      </Pressable>
      <T v="caption" tone="tertiary" style={{ marginTop: space.sm }}>
        {t('Raio de 40 km · mantenha pressionado para escolher um ponto')}
      </T>
    </View>
  );
}

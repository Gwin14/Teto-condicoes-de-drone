import { View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

import { t } from '@/i18n';
import { CARDINAL4 } from '@/lib/format';
import { CONSTELLATIONS, type SatPosition } from '@/lib/gnss';
import { useConstellationColors, useTheme } from '@/theme/tokens';

/**
 * Carta do céu (skyplot): centro = zênite, borda = horizonte, Norte para cima.
 * Cada satélite leva a letra da constelação (G/E/R/C) — identidade nunca só pela cor.
 * Satélites abaixo da máscara aparecem esmaecidos.
 */
export function SkyPlot({ sats, mask, size }: { sats: SatPosition[]; mask: number; size: number }) {
  const { c } = useTheme();
  const colors = useConstellationColors();
  const r = size / 2 - 14;
  const cx = size / 2;
  const toXY = (az: number, el: number) => {
    const rr = r * (1 - el / 90);
    const a = (az * Math.PI) / 180;
    return { x: cx + rr * Math.sin(a), y: cx - rr * Math.cos(a) };
  };
  const letter = Object.fromEntries(CONSTELLATIONS.map((k) => [k.id, k.letter]));
  const DOT = 15;

  return (
    <View accessible accessibilityLabel={t('Carta do céu com {n} satélites acima de {mask} graus', { n: sats.filter((s) => s.elevation >= mask).length, mask })}>
      <Svg width={size} height={size}>
        {/* Anéis de elevação 0/30/60 e máscara */}
        {[0, 30, 60].map((el) => (
          <Circle key={el} cx={cx} cy={cx} r={r * (1 - el / 90)} stroke={c.separator} strokeWidth={1} fill="none" />
        ))}
        <Circle cx={cx} cy={cx} r={r * (1 - mask / 90)} stroke={c.tertiary} strokeWidth={1} strokeDasharray="4 4" fill="none" />
        <Line x1={cx} y1={cx - r} x2={cx} y2={cx + r} stroke={c.separator} />
        <Line x1={cx - r} y1={cx} x2={cx + r} y2={cx} stroke={c.separator} />
        {CARDINAL4.map((l, i) => [l, i * 90] as const).map(([l, az]) => {
          const p = toXY(az as number, -12);
          return (
            <SvgText key={l as string} x={p.x} y={p.y + 4} fill={c.secondary} fontSize={11} fontWeight="600" textAnchor="middle">
              {l as string}
            </SvgText>
          );
        })}
        {sats.map((s) => {
          const p = toXY(s.azimuth, s.elevation);
          const below = s.elevation < mask;
          return (
            <G key={s.sat.id} opacity={below ? 0.3 : 1}>
              {/* Anel na cor da superfície separa marcadores sobrepostos */}
              <Circle cx={p.x} cy={p.y} r={DOT / 2 + 1.5} fill={c.card} />
              <Circle cx={p.x} cy={p.y} r={DOT / 2} fill={colors[s.sat.constellation]} />
              <SvgText x={p.x} y={p.y + 3.5} fill="#FFFFFF" fontSize={9} fontWeight="700" textAnchor="middle">
                {letter[s.sat.constellation]}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

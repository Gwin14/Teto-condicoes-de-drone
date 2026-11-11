import { ScrollView, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Icon, type IconName } from '@/components/Icon';
import { Card, T } from '@/components/ui';
import { useActiveLocation } from '@/hooks/useLocation';
import { fmtNum, t } from '@/i18n';
import { cardinal, fmtTime } from '@/lib/format';
import { lightPhase, lightPhaseLabel, sunPosition, sunTimes } from '@/lib/sun';
import { space, useTheme } from '@/theme/tokens';

/** Planejador de luz: curva do Sol no dia, horas dourada/azul e direção das sombras. */
export default function SunScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const { location } = useActiveLocation();
  if (!location) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center' }}>
        <T v="subhead" tone="secondary">
          {t('Escolha um local para planejar a luz.')}
        </T>
      </View>
    );
  }
  const now = new Date();
  const st = sunTimes(now, location.lat, location.lon);
  const pos = sunPosition(now, location.lat, location.lon);
  const phase = lightPhase(now, location.lat, location.lon);
  const tomorrow = sunTimes(new Date(now.getTime() + 86400000), location.lat, location.lon);

  // Curva de elevação ao longo do dia (00h–24h)
  const W = width - space.lg * 4;
  const H = 120;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const pts = Array.from({ length: 97 }).map((_, i) => {
    const d = new Date(start.getTime() + i * 15 * 60_000);
    const el = sunPosition(d, location.lat, location.lon).elevation;
    return { x: (i / 96) * W, y: H / 2 - (el / 90) * (H / 2) };
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const nowX = ((now.getTime() - start.getTime()) / 86400000) * W;
  const nowY = H / 2 - (pos.elevation / 90) * (H / 2);
  const shadowDir = (pos.azimuth + 180) % 360;
  const shadowLen = pos.elevation > 0 ? 1 / Math.tan((Math.max(pos.elevation, 2) * Math.PI) / 180) : null;

  const rows: { icon: IconName; label: string; value: string }[] = [
    { icon: 'moon', label: t('Hora azul (manhã)'), value: `${fmtTime(st.blueMorningStart)} – ${fmtTime(st.sunrise)}` },
    { icon: 'sunrise', label: t('Hora dourada (manhã)'), value: `${fmtTime(st.sunrise)} – ${fmtTime(st.goldenMorningEnd)}` },
    { icon: 'sun', label: t('Meio-dia solar'), value: fmtTime(st.solarNoon) },
    { icon: 'camera', label: t('Hora dourada (tarde)'), value: `${fmtTime(st.goldenEveningStart)} – ${fmtTime(st.sunset)}` },
    { icon: 'moon', label: t('Hora azul (noite)'), value: `${fmtTime(st.sunset)} – ${fmtTime(st.blueEveningEnd)}` },
    { icon: 'sunrise', label: t('Amanhã nasce'), value: fmtTime(tomorrow.sunrise) },
  ];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 80 }}>
      <Card style={{ gap: space.md }}>
        <T v="caption" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '600' }}>
          {t('Agora')} · {lightPhaseLabel[phase]}
        </T>
        <T v="title2" num>
          {t('Elevação {el}° · azimute {az}° {dir}', { el: Math.round(pos.elevation), az: Math.round(pos.azimuth), dir: cardinal(pos.azimuth) })}
        </T>
        <Svg width={W} height={H}>
          <Line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={c.separator} strokeWidth={1} />
          <Path d={path} stroke={c.secondary} strokeWidth={2} fill="none" />
          <Circle cx={nowX} cy={nowY} r={7} fill={pos.elevation > 0 ? c.accent : c.tertiary} stroke={c.card} strokeWidth={2} />
        </Svg>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {['0h', '6h', '12h', '18h', '24h'].map((l) => (
            <T key={l} v="caption2" tone="tertiary">
              {l}
            </T>
          ))}
        </View>
      </Card>

      <Card padded={false}>
        {rows.map((r, i) => (
          <View
            key={r.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.md,
              borderBottomWidth: i === rows.length - 1 ? 0 : 0.5,
              borderBottomColor: c.separator,
            }}>
            <Icon name={r.icon} size={18} color={c.secondary} />
            <T v="body" style={{ flex: 1 }}>
              {r.label}
            </T>
            <T v="body" num tone="secondary">
              {r.value}
            </T>
          </View>
        ))}
      </Card>

      <Card style={{ gap: space.sm }}>
        <T v="headline">{t('Sombras')}</T>
        <T v="subhead" tone="secondary">
          {shadowLen != null
            ? t('As sombras apontam para {dir} e medem ~{len}× a altura dos objetos. Para tomadas aéreas com sombras longas, voe na hora dourada.', { dir: cardinal(shadowDir), len: fmtNum(shadowLen, 1) })
            : t('O Sol está abaixo do horizonte. Lembre-se: voo noturno exige luzes e autorização específica.')}
        </T>
      </Card>
    </ScrollView>
  );
}

import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { Card, T } from '@/components/ui';
import { useConditions } from '@/hooks/useConditions';
import { useActiveLocation } from '@/hooks/useLocation';
import { t } from '@/i18n';
import { CARDINAL4, cardinal, cardinalName, fmtSpeed } from '@/lib/format';
import { capabilities } from '@/native/capabilities';
import { useApp } from '@/store/app';
import { space, useTheme } from '@/theme/tokens';

/**
 * Bússola de vento: aponte o celular para onde pretende voar e veja a
 * componente de proa/cauda e lateral do vento na sua altitude planejada.
 */
const kindLabel = { proa: t('Vento de proa'), cauda: t('Vento de cauda'), lateral: t('Vento lateral') } as const;

export default function CompassScreen() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const { location } = useActiveLocation();
  const { data, drone, altitude } = useConditions(location?.lat, location?.lon, location?.country);
  const unit = useApp((s) => s.speedUnit);
  const [heading, setHeading] = useState(0);
  const [live, setLive] = useState(false);
  const lastCardinal = useRef('');

  useEffect(() => {
    if (!capabilities.heading) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted || cancelled) return;
        sub = await Location.watchHeadingAsync((h) => {
          const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          setHeading(v);
          setLive(true);
          const card = cardinal(v);
          if (card !== lastCardinal.current && (CARDINAL4 as readonly string[]).includes(card)) {
            Haptics.selectionAsync().catch(() => {});
          }
          lastCardinal.current = card;
        });
      } catch {
        setLive(false);
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  const size = Math.min(width - space.lg * 2, 340);
  const r = size / 2;
  const windFrom = data?.now.dirAlt ?? 0;
  const windSpeed = data?.now.windAlt ?? 0;
  // Ângulo entre a direção de voo (heading) e de onde vem o vento.
  const rel = ((windFrom - heading) * Math.PI) / 180;
  const head = windSpeed * Math.cos(rel); // >0 = vento de proa
  const cross = windSpeed * Math.sin(rel);
  const kind = Math.abs(head) < windSpeed * 0.35 ? 'lateral' : head > 0 ? 'proa' : 'cauda';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 80, alignItems: 'center' }}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <T v="largeTitle" num>
          {Math.round(heading)}° {cardinal(heading)}
        </T>
        <T v="subhead" tone="secondary">
          {live ? t('Direção para onde o celular aponta') : capabilities.heading ? t('Aguardando a bússola…') : t('Arraste para simular a direção')}
        </T>
      </View>

      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-heading} origin={`${r}, ${r}`}>
            <Circle cx={r} cy={r} r={r - 2} fill={c.card} stroke={c.separator} strokeWidth={1} />
            {Array.from({ length: 72 }).map((_, i) => {
              const a = (i * 5 * Math.PI) / 180;
              const major = i % 6 === 0;
              const r1 = r - 8;
              const r2 = r - (major ? 22 : 14);
              return (
                <Line
                  key={i}
                  x1={r + r1 * Math.sin(a)}
                  y1={r - r1 * Math.cos(a)}
                  x2={r + r2 * Math.sin(a)}
                  y2={r - r2 * Math.cos(a)}
                  stroke={major ? c.label : c.tertiary}
                  strokeWidth={major ? 2 : 1}
                />
              );
            })}
            {CARDINAL4.map((l, i) => [l, i * 90] as const).map(([l, deg]) => {
              const a = ((deg as number) * Math.PI) / 180;
              const rr = r - 42;
              return (
                <SvgText
                  key={l as string}
                  x={r + rr * Math.sin(a)}
                  y={r - rr * Math.cos(a) + 7}
                  fill={deg === 0 ? c.nogo : c.label}
                  fontSize={20}
                  fontWeight="700"
                  textAnchor="middle">
                  {l as string}
                </SvgText>
              );
            })}
            {/* Seta do vento: entra pela borda de onde o vento vem e aponta para onde vai */}
            <G rotation={windFrom} origin={`${r}, ${r}`}>
              <Line x1={r} y1={r * 0.28} x2={r} y2={r * 1.45} stroke={c.accent} strokeWidth={6} strokeLinecap="round" />
              <Path d={`M ${r - 16} ${r * 1.38} L ${r} ${r * 1.62} L ${r + 16} ${r * 1.38} Z`} fill={c.accent} />
            </G>
          </G>
          {/* Indicador fixo da direção do celular */}
          <Path d={`M ${r - 10} 6 L ${r} -6 L ${r + 10} 6 Z`} fill={c.label} />
          <Circle cx={r} cy={r} r={6} fill={c.label} />
        </Svg>
      </View>

      {!live ? (
        <View style={{ alignSelf: 'stretch', gap: 4 }}>
          <Slider
            minimumValue={0}
            maximumValue={359}
            step={1}
            value={heading}
            onValueChange={setHeading}
            minimumTrackTintColor={c.accent}
            maximumTrackTintColor={c.fill}
            accessibilityLabel={t('Direção de voo')}
          />
        </View>
      ) : null}

      {data ? (
        <Card style={{ alignSelf: 'stretch', gap: space.md }}>
          <T v="title3">
            {kindLabel[kind]} · {fmtSpeed(Math.abs(kind === 'lateral' ? cross : head), unit)}
          </T>
          <T v="subhead" tone="secondary">
            {t('A {alt} m o vento vem de {from} ({card}) a {speed}. Voando para {heading}: {hk} {head}, lateral {cross}.', {
              alt: altitude,
              from: cardinalName(windFrom),
              card: cardinal(windFrom),
              speed: fmtSpeed(windSpeed, unit),
              heading: cardinal(heading),
              hk: head >= 0 ? t('proa') : t('cauda'),
              head: fmtSpeed(Math.abs(head), unit),
              cross: fmtSpeed(Math.abs(cross), unit),
            })}
          </T>
          <View style={{ height: 0.5, backgroundColor: c.separator }} />
          <T v="subhead">
            {t('Dica: comece o voo em direção a {dir}, contra o vento. Assim o retorno, com a bateria mais baixa, fica a favor.', { dir: cardinalName(windFrom) })}
          </T>
          {windSpeed > drone.maxWind * 0.7 ? (
            <T v="footnote" tone="nogo">
              {t('Vento acima de 70% do limite do {drone}: com vento de proa o drone pode não avançar.', { drone: drone.name })}
            </T>
          ) : null}
        </Card>
      ) : null}
    </ScrollView>
  );
}

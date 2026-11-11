import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Icon } from '@/components/Icon';
import { ScoreRing } from '@/components/ScoreRing';
import { StatusPill, T } from '@/components/ui';
import { t } from '@/i18n';
import { radius, space, useTheme } from '@/theme/tokens';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/* ---------------------------------------------------------------- 1 · Score */

function Chip({ icon, label }: { icon: 'wind' | 'gust' | 'rain'; label: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        backgroundColor: c.card,
        borderRadius: radius.pill,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
      }}>
      <Icon name={icon} size={14} color={c.secondary} />
      <T v="footnote" num>
        {label}
      </T>
    </View>
  );
}

export function ScoreHero({ active }: { active: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: space.xl }}>
      {/* Remonta ao entrar na página para o anel animar de novo. */}
      <ScoreRing key={active ? 'on' : 'off'} score={active ? 86 : 0} verdict="go" size={184} stroke={16} />
      <StatusPill v="go" label={t('Bom para voar')} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip icon="wind" label="12 km/h" />
        <Chip icon="gust" label="18 km/h" />
        <Chip icon="rain" label="0%" />
      </View>
    </View>
  );
}

/* ----------------------------------------------------- 2 · Vento até o teto */

const LEVELS = [
  { alt: 120, wind: 26 },
  { alt: 80, wind: 21 },
  { alt: 50, wind: 15 },
  { alt: 10, wind: 8 },
];
const MAX_WIND = 30;

function WindBar({ wind, index, active, limit }: { wind: number; index: number; active: boolean; limit: number }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    const to = active ? 1 : 0;
    p.set(reduce || !active ? to : withDelay(120 + index * 70, withTiming(to, { duration: 520, easing: EASE_OUT })));
  }, [active, index, p, reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: p.get() }] }));
  const over = wind > limit;
  return (
    <View style={{ flex: 1, height: 14, borderRadius: radius.pill, backgroundColor: c.fill, overflow: 'hidden' }}>
      <Animated.View
        style={[
          {
            width: `${(wind / MAX_WIND) * 100}%`,
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: over ? c.caution : c.accent,
            transformOrigin: 'left',
          },
          style,
        ]}
      />
    </View>
  );
}

export function CeilingHero({ active }: { active: boolean }) {
  const { c } = useTheme();
  const limit = 24;
  return (
    <View style={{ width: '100%', maxWidth: 340, gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: c.label }} />
          <T v="caption2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('Teto · 120 m')}
          </T>
        </View>
        <T v="caption" tone="secondary">
          {t('Limite de altura acima do solo (ANAC)')}
        </T>
      </View>
      {LEVELS.map((l, i) => (
        <View key={l.alt} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <T v="footnote" tone="secondary" num style={{ width: 44 }}>
            {l.alt} m
          </T>
          <WindBar wind={l.wind} index={i} active={active} limit={limit} />
          <T v="footnote" num tone={l.wind > limit ? 'caution' : 'label'} style={{ width: 56, textAlign: 'right' }}>
            {l.wind} km/h
          </T>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.xs }}>
        <Icon name="drone" size={14} color={c.tertiary} />
        <T v="caption" tone="tertiary">
          {t('Exemplo · limite do drone {limit} km/h', { limit })}
        </T>
      </View>
    </View>
  );
}

/* ------------------------------------------------------- 3 · Espaço aéreo */

export function AirspaceHero({ active }: { active: boolean }) {
  const { c } = useTheme();
  const reduce = useReducedMotion();
  const s = useSharedValue(0.92);
  const o = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      s.set(0.92);
      o.set(0);
      return;
    }
    s.set(reduce ? 1 : withTiming(1, { duration: 480, easing: EASE_OUT }));
    o.set(withTiming(1, { duration: reduce ? 150 : 320, easing: EASE_OUT }));
  }, [active, o, reduce, s]);
  const style = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ scale: s.get() }] }));

  const size = 240;
  const mid = size / 2;
  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Circle cx={mid} cy={mid} r={116} fill={c.mapZoneCaution} />
        <Circle cx={mid} cy={mid} r={116} fill="none" stroke={c.caution} strokeWidth={1.5} strokeDasharray="5 6" />
        <Circle cx={mid} cy={mid} r={62} fill={c.mapZoneCritical} />
        <Circle cx={mid} cy={mid} r={62} fill="none" stroke={c.nogo} strokeWidth={1.5} />
      </Svg>
      <View style={{ position: 'absolute', left: mid - 18, top: mid - 18 }}>
        <Icon name="airport" size={36} color={c.nogo} />
      </View>
      {/* Você, fora da zona */}
      <View
        style={{
          position: 'absolute',
          right: 2,
          bottom: 22,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: c.card,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.14)',
        }}>
        <Icon name="location" size={20} color={c.accent} />
      </View>
      <View style={{ position: 'absolute', left: 0, top: 6 }}>
        <StatusPill v="nogo" label={t('Zona do aeródromo')} small />
      </View>
    </Animated.View>
  );
}

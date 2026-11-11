import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/tokens';

/**
 * Continuação animada da splash nativa.
 *
 * O primeiro quadro é idêntico à splash do `app.json` (mesma cor, mesma marca, mesmo
 * tamanho e centro), então a troca nativa → JS é invisível. Depois o céu do ícone
 * aparece, os pontos de subida acendem de baixo para cima, o drone sobe até o teto,
 * a barra "sente" o toque e tudo se abre revelando o app.
 *
 * Mantenha SIZE igual ao `imageWidth` do plugin expo-splash-screen e a geometria igual
 * a `assets/icon-layers/splash-mark.svg` (viewBox 192 180 640 640).
 */
export const SPLASH_SIZE = 160;
const U = SPLASH_SIZE / 640;
const X = (v: number) => (v - 192) * U;
const Y = (v: number) => (v - 180) * U;

// Cores travadas com o app.json (splash nativa) e com o fill do ícone.
const SKY = {
  light: { base: '#113396', top: '#113396', bottom: '#5C93EC', lens: '#2F6BFF' },
  dark: { base: '#0B0C10', top: '#0B0C10', bottom: '#14245C', lens: '#5B8CFF' },
};

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

const DOTS = [
  { cy: 476, r: 20 },
  { cy: 398, r: 16 },
  { cy: 326, r: 12 },
];

const CLIMB_AT = 140;
const HIT_AT = 640;
const EXIT_AT = 900;
const EXIT_MS = 380;

function Dot({ cy, r, delay, play }: { cy: number; r: number; delay: number; play: boolean }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!play) return;
    glow.value = withDelay(
      delay,
      withSequence(withTiming(1, { duration: 160, easing: EASE_OUT }), withTiming(0, { duration: 320 })),
    );
  }, [play, delay, glow]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.8 + glow.value * 0.2,
    transform: [{ scale: 1 + glow.value * 0.45 }],
  }));

  const d = r * 2 * U;
  return (
    <Animated.View
      style={[
        { position: 'absolute', left: X(512) - d / 2, top: Y(cy) - d / 2, width: d, height: d, borderRadius: d / 2, backgroundColor: '#FFFFFF' },
        style,
      ]}
    />
  );
}

export function AnimatedSplash({ ready }: { ready: boolean }) {
  const { isDark } = useTheme();
  const reduceMotion = useReducedMotion();
  const sky = isDark ? SKY.dark : SKY.light;
  const [mounted, setMounted] = useState(true);
  const [laidOut, setLaidOut] = useState(false);

  const skyIn = useSharedValue(0);
  const lift = useSharedValue(0);
  const hit = useSharedValue(0);
  const exit = useSharedValue(0);

  // Só tira a splash nativa quando o primeiro quadro (idêntico) já está na tela.
  useEffect(() => {
    if (laidOut) SplashScreen.hide();
  }, [laidOut]);

  useEffect(() => {
    if (!ready || !laidOut) return;
    if (reduceMotion) {
      exit.value = withTiming(1, { duration: 240 });
      const t = setTimeout(() => setMounted(false), 260);
      return () => clearTimeout(t);
    }

    skyIn.value = withTiming(1, { duration: 520, easing: EASE_OUT });
    lift.value = withDelay(CLIMB_AT, withTiming(1, { duration: HIT_AT - CLIMB_AT, easing: EASE_IN_OUT }));
    hit.value = withDelay(
      HIT_AT - 40,
      withSequence(withTiming(1, { duration: 120, easing: EASE_OUT }), withTiming(0, { duration: 360, easing: EASE_OUT })),
    );
    exit.value = withDelay(EXIT_AT, withTiming(1, { duration: EXIT_MS, easing: Easing.bezier(0.5, 0, 0.75, 0) }));

    const t = setTimeout(() => setMounted(false), EXIT_AT + EXIT_MS + 30);
    return () => clearTimeout(t);
  }, [ready, laidOut, reduceMotion, skyIn, lift, hit, exit]);

  const play = ready && laidOut && !reduceMotion;

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const skyStyle = useAnimatedStyle(() => ({ opacity: skyIn.value }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + exit.value * 0.35 }],
  }));
  // O drone sobe ~70 unidades e "encosta" na subida; volta um pouco ao tocar o teto.
  const droneStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 70 * U + hit.value * 6 * U }],
  }));
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + hit.value * 0.06 }, { translateY: -hit.value * 4 * U }],
  }));

  if (!mounted) return null;

  const bar = { left: X(232), top: Y(196), width: 560 * U, height: 68 * U, borderRadius: 34 * U };

  return (
    <Animated.View
      pointerEvents={ready ? 'none' : 'auto'}
      onLayout={() => setLaidOut(true)}
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: sky.base, zIndex: 1000 }, rootStyle]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, skyStyle]}>
        <LinearGradient colors={[sky.top, sky.bottom]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View style={[{ width: SPLASH_SIZE, height: SPLASH_SIZE }, markStyle]}>
        <Animated.View style={[styles.white, { position: 'absolute', ...bar }, barStyle]} />

        {DOTS.map((d, i) => (
          <Dot key={d.cy} cy={d.cy} r={d.r} delay={CLIMB_AT + i * 110} play={play} />
        ))}

        <Animated.View style={[StyleSheet.absoluteFill, droneStyle]}>
          <Svg width={SPLASH_SIZE} height={SPLASH_SIZE} viewBox="192 180 640 640">
            <G fill="#FFFFFF">
              <Rect x={232} y={548} width={200} height={26} rx={13} />
              <Rect x={592} y={548} width={200} height={26} rx={13} />
              <Rect x={320} y={560} width={24} height={56} rx={12} />
              <Rect x={680} y={560} width={24} height={56} rx={12} />
              <Rect x={300} y={600} width={424} height={40} rx={20} />
              <Rect x={428} y={584} width={168} height={124} rx={48} />
            </G>
            <Path
              d="M444 684 L404 792 M580 684 L620 792"
              stroke="#FFFFFF"
              strokeWidth={24}
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx={512} cy={740} r={40} fill="#FFFFFF" />
            <Circle cx={512} cy={740} r={19} fill={sky.lens} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  white: { backgroundColor: '#FFFFFF' },
});

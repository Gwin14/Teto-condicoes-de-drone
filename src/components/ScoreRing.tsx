import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme, type Verdict, verdictColor } from '@/theme/tokens';

import { T } from './ui';
import { t } from '@/i18n';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Anel de score 0–100. Anima uma única vez quando o valor muda (state change). */
export function ScoreRing({ score, verdict, size = 132, stroke = 12, label = 'score' }: {
  score: number;
  verdict: Verdict;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const arc = 0.78; // 280° de arco, aberto embaixo
  const progress = useSharedValue(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const target = Math.max(0.02, score / 100);
    progress.set(reduce ? target : withTiming(target, { duration: 700, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
  }, [score, reduce, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * arc * (1 - progress.get()) + circ * (1 - arc),
  }));

  const color = verdictColor(c, verdict);
  const rotation = 90 + (360 * (1 - arc)) / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: `${rotation}deg` }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.fill}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ * arc} ${circ}`}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <T v="display" num style={{ fontSize: size * 0.36, lineHeight: size * 0.4 }} accessibilityLabel={t('Score {score} de 100', { score })}>
        {score}
      </T>
      <T v="caption2" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1, marginTop: -2 }}>
        {label}
      </T>
    </View>
  );
}

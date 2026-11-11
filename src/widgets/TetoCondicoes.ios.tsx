import { Capsule, HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { type ConditionsWidgetProps, EMPTY_WIDGET } from './types';

/**
 * Widget "Condições de voo" — small / medium / large.
 * Diretiva 'widget': tudo (cores, helpers) precisa estar DENTRO da função.
 */
const TetoCondicoes = (props: ConditionsWidgetProps, env: WidgetEnvironment) => {
  'widget';
  const dark = env.colorScheme === 'dark';
  const BG = dark ? '#1C1C1E' : '#FFFFFF';
  const LABEL = dark ? '#F5F5F7' : '#0B0C10';
  const SECONDARY = dark ? '#A0A0A8' : '#62636B';
  const TRACK = dark ? '#2C2C2E' : '#E9E9EF';
  const tint = (v: string) =>
    v === 'go' ? (dark ? '#34D07A' : '#18995A') : v === 'caution' ? (dark ? '#FFC53D' : '#B97F00') : dark ? '#FF6166' : '#D6383E';
  const color = tint(props.verdict);
  const family = env.widgetFamily ?? 'systemSmall';

  const Header = () => (
    <HStack spacing={4}>
      <Image systemName="location.fill" size={10} color={SECONDARY} />
      <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(SECONDARY), lineLimit(1)]}>{props.place}</Text>
      <Spacer />
    </HStack>
  );

  const Score = ({ size }: { size: number }) => (
    <VStack alignment="leading" spacing={0}>
      <Text modifiers={[font({ size, weight: 'bold', design: 'rounded' }), monospacedDigit(), foregroundStyle(color)]}>
        {String(props.score)}
      </Text>
      <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(LABEL), lineLimit(1)]}>
        {props.verdictLabel}
      </Text>
    </VStack>
  );

  const Wind = ({ compact }: { compact?: boolean }) => (
    <HStack spacing={4}>
      <Image systemName="wind" size={11} color={SECONDARY} />
      <Text modifiers={[font({ size: 12, weight: 'medium' }), monospacedDigit(), foregroundStyle(SECONDARY), lineLimit(1)]}>
        {compact ? `${props.wind} ${props.unit} ${props.dir}` : `${props.wind} ${props.unit} ${props.dir} · ${props.altitude} m`}
      </Text>
    </HStack>
  );

  const Bars = ({ count, height }: { count: number; height: number }) => (
    <HStack spacing={6} alignment="bottom">
      {props.hours.slice(0, count).map((h, i) => (
        <VStack key={`h${i}`} spacing={4}>
          <ZStack alignment="bottom" modifiers={[frame({ width: 14, height })]}>
            <Capsule modifiers={[foregroundStyle(TRACK), frame({ width: 14, height })]} />
            <Capsule
              modifiers={[foregroundStyle(tint(h.v)), frame({ width: 14, height: Math.max(8, (h.s / 100) * height) })]}
            />
          </ZStack>
          <Text modifiers={[font({ size: 10, weight: 'medium' }), monospacedDigit(), foregroundStyle(SECONDARY)]}>{h.t}</Text>
        </VStack>
      ))}
    </HStack>
  );

  const Stat = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <HStack spacing={8}>
      <Image systemName={icon as 'wind'} size={13} color={SECONDARY} />
      <Text modifiers={[font({ size: 13 }), foregroundStyle(SECONDARY)]}>{label}</Text>
      <Spacer />
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), monospacedDigit(), foregroundStyle(LABEL)]}>{value}</Text>
    </HStack>
  );

  if (family === 'systemMedium') {
    return (
      <HStack spacing={16} modifiers={[containerBackground(BG, 'widget'), padding({ all: 16 })]}>
        <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' })]}>
          <Header />
          <Spacer />
          <Score size={40} />
          <Wind />
        </VStack>
        <VStack alignment="trailing" spacing={8}>
          <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(SECONDARY)]}>{props.l?.next ?? 'PRÓXIMAS HORAS'}</Text>
          <Spacer />
          <Bars count={6} height={64} />
        </VStack>
      </HStack>
    );
  }

  if (family === 'systemLarge') {
    return (
      <VStack alignment="leading" spacing={12} modifiers={[containerBackground(BG, 'widget'), padding({ all: 18 })]}>
        <Header />
        <HStack alignment="bottom">
          <Score size={52} />
          <Spacer />
          <Bars count={6} height={56} />
        </HStack>
        <VStack spacing={8}>
          <Stat icon="wind" label={props.l?.windAt ?? `Vento a ${props.altitude} m`} value={`${props.wind} ${props.unit} ${props.dir}`} />
          <Stat icon="tornado" label={props.l?.gusts ?? 'Rajadas'} value={`${props.gust} ${props.unit}`} />
          <Stat icon="cloud.rain.fill" label={props.l?.rain ?? 'Chuva'} value={props.rain} />
          <Stat icon="thermometer.medium" label={props.l?.temp ?? 'Temperatura'} value={props.temp} />
          <Stat icon="antenna.radiowaves.left.and.right" label={props.l?.kp ?? 'Índice Kp'} value={props.kp} />
        </VStack>
        <Spacer />
        <HStack spacing={6}>
          <Image systemName="sparkles" size={12} color={color} />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(LABEL), lineLimit(1)]}>{props.next}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 11 }), foregroundStyle(SECONDARY)]}>{props.updated}</Text>
        </HStack>
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[containerBackground(BG, 'widget'), padding({ all: 14 }), frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' })]}>
      <Header />
      <Spacer />
      <Score size={44} />
      <Wind compact />
    </VStack>
  );
};

export default createWidget<ConditionsWidgetProps>('TetoCondicoes', TetoCondicoes, EMPTY_WIDGET);

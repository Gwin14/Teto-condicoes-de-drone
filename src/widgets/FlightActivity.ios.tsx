import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  labelsHidden,
  lineLimit,
  monospacedDigit,
  multilineTextAlignment,
  padding,
  progressViewStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { FlightActivityProps } from './types';

/**
 * Live Activity "Em voo": cronômetro, bateria útil estimada drenando sozinha
 * (timerInterval nativo — o app não precisa atualizar a cada segundo) e vento.
 */
const FlightActivity = (props: FlightActivityProps, env: LiveActivityEnvironment) => {
  'widget';
  const ACCENT = '#5B8CFF';
  const WHITE = '#FFFFFF';
  const DIM = '#FFFFFFA6';
  const statusColor = props.verdict === 'go' ? '#34D07A' : props.verdict === 'caution' ? '#FFC53D' : '#FF6166';
  const start = new Date(props.startMs);
  const batteryEnd = new Date(props.batteryEndMs);
  // Limite superior "longo" para o cronômetro crescente.
  const timerEnd = new Date(props.startMs + 6 * 3600_000);
  const stale = env.isStale === true;

  const Elapsed = ({ size, width }: { size: number; width: number }) => (
    <Text
      timerInterval={{ lower: start, upper: timerEnd }}
      countsDown={false}
      modifiers={[
        font({ size, weight: 'semibold', design: 'rounded' }),
        monospacedDigit(),
        foregroundStyle(WHITE),
        multilineTextAlignment('leading'),
        frame({ width, alignment: 'leading' }),
      ]}
    />
  );

  const Battery = () => (
    <ProgressView
      timerInterval={{ lower: start, upper: batteryEnd }}
      countsDown
      modifiers={[progressViewStyle('linear'), tint(statusColor), labelsHidden(), frame({ maxWidth: Infinity })]}
    />
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={10} modifiers={[padding({ all: 16 })]}>
        <HStack spacing={6}>
          <Image systemName="airplane" size={13} color={ACCENT} />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(DIM), lineLimit(1)]}>
            {`${props.l?.inFlight ?? 'Em voo'} · ${props.place}`}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(statusColor)]}>
            {stale ? (props.l?.stale ?? 'Desatualizado') : props.verdictLabel}
          </Text>
        </HStack>
        <HStack alignment="lastTextBaseline">
          <Elapsed size={34} width={130} />
          <Spacer />
          <VStack alignment="trailing" spacing={0}>
            <Text modifiers={[font({ size: 20, weight: 'semibold' }), monospacedDigit(), foregroundStyle(WHITE)]}>
              {`${props.wind} ${props.unit}`}
            </Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(DIM)]}>{`${props.l?.wind ?? 'vento'} ${props.dir} · ${props.l?.gust ?? 'raj'} ${props.gust}`}</Text>
          </VStack>
        </HStack>
        <VStack alignment="leading" spacing={4}>
          <Battery />
          <Text modifiers={[font({ size: 12 }), foregroundStyle(DIM)]}>{props.l?.battery ?? `Bateria útil estimada · pouse até ${props.landBy}`}</Text>
        </VStack>
      </VStack>
    ),
    compactLeading: <Image systemName="airplane" color={ACCENT} />,
    compactTrailing: <Elapsed size={14} width={50} />,
    minimal: <Image systemName="airplane" color={statusColor} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 8, top: 4 })]}>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(DIM)]}>{props.l?.inFlight ?? 'Em voo'}</Text>
        <Elapsed size={24} width={100} />
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2} modifiers={[padding({ trailing: 8, top: 4 })]}>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(DIM)]}>{`${props.l?.windCap ?? 'Vento'} ${props.dir}`}</Text>
        <Text modifiers={[font({ size: 20, weight: 'semibold' }), monospacedDigit(), foregroundStyle(WHITE)]}>
          {`${props.wind} ${props.unit}`}
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 8, bottom: 4 })]}>
        <Battery />
        <HStack>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(DIM), lineLimit(1)]}>{props.drone}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(WHITE)]}>{props.l?.landBy ?? `Pouse até ${props.landBy}`}</Text>
        </HStack>
      </VStack>
    ),
  };
};

export default createLiveActivity<FlightActivityProps>('FlightActivity', FlightActivity);

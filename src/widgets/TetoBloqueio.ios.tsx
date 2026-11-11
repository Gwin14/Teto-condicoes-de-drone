import { Gauge, HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, gaugeStyle, lineLimit, monospacedDigit } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { type ConditionsWidgetProps, EMPTY_WIDGET } from './types';

/** Widgets de tela bloqueada: circular (gauge), retangular e inline. */
const TetoBloqueio = (props: ConditionsWidgetProps, env: WidgetEnvironment) => {
  'widget';
  const family = env.widgetFamily ?? 'accessoryRectangular';

  if (family === 'accessoryCircular') {
    return (
      <Gauge
        value={props.score}
        min={0}
        max={100}
        currentValueLabel={<Text modifiers={[font({ size: 16, weight: 'bold', design: 'rounded' }), monospacedDigit()]}>{String(props.score)}</Text>}
        modifiers={[gaugeStyle('circular'), containerBackground('#00000000', 'widget')]}>
        <Image systemName="wind" size={10} />
      </Gauge>
    );
  }

  if (family === 'accessoryInline') {
    return (
      <HStack modifiers={[containerBackground('#00000000', 'widget')]}>
        <Image systemName="wind" />
        <Text>{`${props.verdictShort} · ${props.wind} ${props.unit}`}</Text>
      </HStack>
    );
  }

  return (
    <VStack alignment="leading" spacing={1} modifiers={[containerBackground('#00000000', 'widget')]}>
      <HStack spacing={4}>
        <Image systemName="airplane" size={12} />
        <Text modifiers={[font({ size: 15, weight: 'bold' }), lineLimit(1)]}>{`${props.verdictShort} · ${props.score}`}</Text>
      </HStack>
      <Text modifiers={[font({ size: 13 }), monospacedDigit(), lineLimit(1)]}>
        {`${props.wind} ${props.unit} ${props.dir} · ${props.l?.gust ?? 'raj'} ${props.gust}`}
      </Text>
      <Text modifiers={[font({ size: 13 }), lineLimit(1)]}>{props.next}</Text>
    </VStack>
  );
};

export default createWidget<ConditionsWidgetProps>('TetoBloqueio', TetoBloqueio, EMPTY_WIDGET);

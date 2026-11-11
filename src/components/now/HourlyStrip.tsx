import { ScrollView, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Card, T } from '@/components/ui';
import { t } from '@/i18n';
import { convertSpeed, fmtHour, type SpeedUnit, speedUnitLabel } from '@/lib/format';
import type { HourScore } from '@/lib/scoring';
import { weatherIcon } from '@/lib/weather';
import { radius, space, useTheme, verdictColor } from '@/theme/tokens';

/** Faixa horária: barra de score colorida + vento em altitude. */
export function HourlyStrip({ hours, unit }: { hours: HourScore[]; unit: SpeedUnit }) {
  const { c } = useTheme();
  const list = hours.slice(0, 24);
  const BAR = 54;
  return (
    <Card padded={false}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.md, paddingVertical: space.lg, gap: 2 }}>
        {list.map((h, i) => {
          const color = verdictColor(c, h.verdict);
          return (
            <View
              key={h.hour.time.getTime()}
              style={{ width: 46, alignItems: 'center', gap: 8 }}
              accessible
              accessibilityLabel={t('{hour}: score {score}, vento {wind}', { hour: fmtHour(h.hour.time), score: h.score, wind: `${Math.round(convertSpeed(h.windAlt, unit))} ${speedUnitLabel[unit]}` })}>
              <T v="caption" tone={i === 0 ? 'label' : 'secondary'} style={{ fontWeight: i === 0 ? '700' : '500' }} num>
                {i === 0 ? t('Agora') : fmtHour(h.hour.time)}
              </T>
              <Icon name={weatherIcon(h.hour.code, h.hour.isDay)} size={18} color={c.secondary} />
              <View
                style={{
                  width: 10,
                  height: BAR,
                  borderRadius: radius.pill,
                  backgroundColor: c.fill,
                  justifyContent: 'flex-end',
                  overflow: 'hidden',
                }}>
                <View style={{ height: Math.max(6, (h.score / 100) * BAR), backgroundColor: color, borderRadius: radius.pill }} />
              </View>
              <T v="footnote" num style={{ fontWeight: '600' }}>
                {Math.round(convertSpeed(h.windAlt, unit))}
              </T>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.md }}>
        <T v="caption" tone="tertiary">
          {t('Barra = score de voo')}
        </T>
        <T v="caption" tone="tertiary">
          {t('Vento em {unit}', { unit: speedUnitLabel[unit] })}
        </T>
      </View>
    </Card>
  );
}

import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PressableScale, T } from '@/components/ui';
import { t } from '@/i18n';
import { fmtTime } from '@/lib/format';
import { openPro } from '@/lib/purchases';
import { lightPhase, lightPhaseLabel, sunPosition, sunTimes } from '@/lib/sun';
import { radius, space, useTheme } from '@/theme/tokens';

export function SunCard({ lat, lon }: { lat: number; lon: number }) {
  const { c } = useTheme();
  const now = new Date();
  const st = sunTimes(now, lat, lon);
  const pos = sunPosition(now, lat, lon);
  const phase = lightPhase(now, lat, lon);
  const dayLen = st.sunset.getTime() - st.sunrise.getTime();
  const progress = Math.min(1, Math.max(0, (now.getTime() - st.sunrise.getTime()) / dayLen));

  return (
    <PressableScale
      onPress={() => openPro('/flight/sun')}
      accessibilityRole="button"
      accessibilityLabel={t('Abrir planejador de luz')}
      style={{ backgroundColor: c.card, borderRadius: radius.card, borderCurve: 'continuous', padding: space.lg, gap: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <T v="caption" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '600' }}>
            {lightPhaseLabel[phase]}
          </T>
          <T v="title3" num>
            {t('Sol a {el}° · azimute {az}°', { el: Math.round(pos.elevation), az: Math.round(pos.azimuth) })}
          </T>
        </View>
        <Icon name="chevronRight" size={13} color={c.tertiary} weight="semibold" />
      </View>
      <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: c.fill }}>
        <View style={{ width: `${progress * 100}%`, height: 6, borderRadius: radius.pill, backgroundColor: c.accent }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <SunStat icon="sunrise" label={t('Nascer')} value={fmtTime(st.sunrise)} />
        <SunStat icon="camera" label={t('Hora dourada')} value={fmtTime(st.goldenEveningStart)} />
        <SunStat icon="sunset" label={t('Pôr do sol')} value={fmtTime(st.sunset)} />
      </View>
    </PressableScale>
  );
}

function SunStat({ icon, label, value }: { icon: 'sunrise' | 'sunset' | 'camera'; label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 2, alignItems: 'flex-start' }}>
      <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        <Icon name={icon} size={12} color={c.secondary} />
        <T v="caption" tone="secondary">
          {label}
        </T>
      </View>
      <T v="headline" num>
        {value}
      </T>
    </View>
  );
}

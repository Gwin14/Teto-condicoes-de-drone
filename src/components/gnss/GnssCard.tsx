import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { InlineError, PressableScale, Skeleton, StatusDot, T } from '@/components/ui';
import { S4_AVAILABLE, useConstellations, useScintillation, useSpaceWeather } from '@/hooks/useConditions';
import { useNow } from '@/hooks/useNow';
import { fmtNum, t } from '@/i18n';
import { CONSTELLATIONS, fmtDop, snapshot } from '@/lib/gnss';
import { kpLabel, scintLabel } from '@/lib/scoring';
import { openPro } from '@/lib/purchases';
import { isS4Fresh, s4At } from '@/lib/spaceWeather';
import { useApp } from '@/store/app';
import { radius, space, useConstellationColors, useTheme, type Verdict } from '@/theme/tokens';

/** Resumo na aba Agora: satélites visíveis por constelação + interferências. */
export function GnssCard({ lat, lon, elevation, kp }: { lat: number; lon: number; elevation: number; kp: number }) {
  const { c } = useTheme();
  const colors = useConstellationColors();
  const mask = useApp((s) => s.gnssMask);
  const altitude = useApp((s) => s.altitude);
  const sats = useConstellations();
  const sw = useSpaceWeather();
  const s4 = useScintillation();
  const now = useNow(60_000);

  const snap = sats.data ? snapshot(sats.data.sats, lat, lon, elevation + altitude, now, mask) : null;
  const reading = s4At(s4.data, lat, lon);
  const scint = isS4Fresh(reading, now) ? reading : null;
  const kpV: Verdict = kp >= 7 ? 'nogo' : kp >= 5 ? 'caution' : 'go';
  const scV: Verdict = scint?.level === 'forte' ? 'caution' : 'go';
  const r = sw.data?.now.r ?? 0;
  const rV: Verdict = r >= 3 ? 'caution' : 'go';

  return (
    <PressableScale
      onPress={() => openPro('/gnss')}
      accessibilityRole="button"
      accessibilityLabel={t('Abrir satélites e interferências')}
      style={{ backgroundColor: c.card, borderRadius: radius.card, borderCurve: 'continuous', padding: space.lg, gap: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <T v="caption" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: '600' }}>
            {t('Satélites visíveis · acima de {mask}°', { mask })}
          </T>
          {snap ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
              <T v="largeTitle" num>
                {snap.visible.length}
              </T>
              <T v="subhead" tone="secondary" num>
                PDOP {fmtDop(snap.pdop)} · HDOP {fmtDop(snap.hdop)}
              </T>
            </View>
          ) : sats.isLoading ? (
            <Skeleton style={{ height: 36, width: 180, marginTop: 4 }} />
          ) : null}
        </View>
        <Icon name="chevronRight" size={13} color={c.tertiary} weight="semibold" />
      </View>

      {sats.error && !snap ? <InlineError message={t('Elementos orbitais indisponíveis agora.')} onRetry={() => sats.refetch()} /> : null}

      {snap ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {CONSTELLATIONS.map((k) => (
            <View key={k.id} style={{ flex: 1, backgroundColor: c.background, borderRadius: radius.inner, borderCurve: 'continuous', padding: space.sm, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[k.id] }} />
                <T v="caption2" tone="secondary" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1 }}>
                  {k.label}
                </T>
              </View>
              <T v="headline" num>
                {sats.data?.failed.includes(k.id) ? '—' : snap.byConstellation[k.id]}
              </T>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Row v={kpV} label={t('Geomagnetismo')} value={`Kp ${fmtNum(kp, 1)} · ${kpLabel(kp)}`} />
        <Row
          v={scV}
          label={t('Cintilação (INPE)')}
          value={scint ? `${cap(scintLabel[scint.level])} · S4 ${fmtNum(scint.s4, 2)}` : !S4_AVAILABLE ? t('Só no app') : s4.isLoading ? '…' : t('Sem medição')}
        />
        <Row v={rV} label={t('Rádio (erupções)')} value={sw.data ? (r > 0 ? `R${r}` : t('Calmo')) : '—'} />
      </View>
    </PressableScale>
  );
}

function Row({ v, label, value }: { v: Verdict; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <StatusDot v={v} />
      <T v="subhead" tone="secondary" style={{ flex: 1 }}>
        {label}
      </T>
      <T v="subhead" num style={{ fontWeight: '600' }}>
        {value}
      </T>
    </View>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

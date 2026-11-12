import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { IslandPreview } from '@/components/flight/IslandPreview';
import { Icon } from '@/components/Icon';
import { ProBadge } from '@/components/ProBadge';
import { Button, Card, ListRow, T } from '@/components/ui';
import { useConditions } from '@/hooks/useConditions';
import { useActiveLocation } from '@/hooks/useLocation';
import { t } from '@/i18n';
import { useIsPro } from '@/lib/purchases';
import { capabilities, capabilityNote } from '@/native/capabilities';
import { buildWidgetProps } from '@/native/widgets';
import { useApp } from '@/store/app';
import { space, useTheme, verdictColor } from '@/theme/tokens';
import type { ConditionsWidgetProps } from '@/widgets/types';

/**
 * Prévia fiel dos widgets em React Native. No Expo Go é aqui que você
 * testa o visual; numa development build os widgets reais usam os mesmos dados.
 */
export default function WidgetsScreen() {
  const { c } = useTheme();
  const { location } = useActiveLocation();
  const { data, drone, altitude } = useConditions(location?.lat, location?.lon, location?.country);
  const unit = useApp((s) => s.speedUnit);
  const tempUnit = useApp((s) => s.tempUnit);
  const isPro = useIsPro();
  const p = data && location ? buildWidgetProps(data, location.name, drone.name, altitude, unit, tempUnit) : null;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 80 }}>
      {!isPro ? (
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <ProBadge />
            <T v="headline">{t('Widgets e Live Activity são do Teto Pro')}</T>
          </View>
          <T v="subhead" tone="secondary">
            {t('Sem o Pro, os widgets mostram só “Abra o Teto” e o voo não aparece na Dynamic Island. As prévias abaixo mostram como fica.')}
          </T>
          <Button title={t('Conhecer o Teto Pro')} onPress={() => router.push('/paywall')} />
        </Card>
      ) : null}

      <Card padded={false}>
        <ListRow
          icon="widgets"
          title={t('Widgets de tela inicial')}
          subtitle={capabilityNote('widgets')}
          right={<Icon name={capabilities.widgets ? 'check' : 'info'} size={20} color={capabilities.widgets ? c.go : c.tertiary} />}
        />
        <ListRow
          icon="lock"
          title={t('Widgets de tela bloqueada')}
          subtitle={capabilityNote('lockWidgets')}
          right={<Icon name={capabilities.widgets && process.env.EXPO_OS === 'ios' ? 'check' : 'info'} size={20} color={capabilities.widgets ? c.go : c.tertiary} />}
        />
        <ListRow
          icon="island"
          title={t('Live Activity e Dynamic Island')}
          subtitle={capabilityNote('liveActivities')}
          last
          right={<Icon name={capabilities.liveActivities ? 'check' : 'info'} size={20} color={capabilities.liveActivities ? c.go : c.tertiary} />}
        />
      </Card>

      {!p ? (
        <T v="subhead" tone="secondary">
          {t('Carregando dados para as prévias…')}
        </T>
      ) : (
        <>
          <Section title={t('Tela inicial · pequeno e médio')}>
            <View style={{ flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' }}>
              <SmallWidget p={p} />
              <MediumWidget p={p} />
            </View>
          </Section>
          <Section title={t('Tela bloqueada')}>
            <View style={{ backgroundColor: '#1B2433', borderRadius: 28, borderCurve: 'continuous', padding: space.xl, gap: space.lg }}>
              <T v="caption" style={{ color: '#FFFFFFCC', textAlign: 'center' }}>
                {`${p.verdictShort} · ${p.wind} ${p.unit}`}
              </T>
              <T v="display" style={{ color: '#FFFFFF', textAlign: 'center', fontSize: 72, lineHeight: 76 }} num>
                09:41
              </T>
              <View style={{ flexDirection: 'row', gap: space.md, justifyContent: 'center', alignItems: 'center' }}>
                <LockCircular p={p} />
                <LockRect p={p} />
              </View>
            </View>
          </Section>
          <Section title="Live Activity · Dynamic Island">
            <View style={{ gap: space.md }}>
              <IslandPreview elapsedMs={754000} wind={`${p.wind} ${p.unit}`} batteryPct={0.62} statusColor={verdictColor(c, p.verdict)} landBy="10:12" expanded={false} />
              <IslandPreview elapsedMs={754000} wind={`${p.wind} ${p.unit}`} batteryPct={0.62} statusColor={verdictColor(c, p.verdict)} landBy="10:12" />
            </View>
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <T v="footnote" tone="secondary" style={{ paddingHorizontal: space.xs, textTransform: 'uppercase' }}>
        {title}
      </T>
      {children}
    </View>
  );
}

function WidgetFrame({ children, width }: { children: React.ReactNode; width: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width, height: 158, backgroundColor: c.card, borderRadius: 22, borderCurve: 'continuous', padding: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
      {children}
    </View>
  );
}

function SmallWidget({ p }: { p: ConditionsWidgetProps }) {
  const { c } = useTheme();
  return (
    <WidgetFrame width={158}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name="location" size={10} color={c.secondary} />
        <T v="caption" tone="secondary" numberOfLines={1} style={{ fontWeight: '500', flex: 1 }}>
          {p.place}
        </T>
      </View>
      <View style={{ flex: 1 }} />
      <T v="largeTitle" num style={{ color: verdictColor(c, p.verdict), fontSize: 42, lineHeight: 46 }}>
        {p.score}
      </T>
      <T v="subhead" style={{ fontWeight: '600' }} numberOfLines={1}>
        {p.verdictLabel}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name="wind" size={11} color={c.secondary} />
        <T v="caption" tone="secondary" num numberOfLines={1}>
          {`${p.wind} ${p.unit} ${p.dir}`}
        </T>
      </View>
    </WidgetFrame>
  );
}

function MediumWidget({ p }: { p: ConditionsWidgetProps }) {
  const { c } = useTheme();
  return (
    <WidgetFrame width={338}>
      <View style={{ flexDirection: 'row', flex: 1, gap: 16 }}>
        <View style={{ flex: 1 }}>
          <T v="caption" tone="secondary" numberOfLines={1} style={{ fontWeight: '500' }}>
            {p.place}
          </T>
          <View style={{ flex: 1 }} />
          <T v="largeTitle" num style={{ color: verdictColor(c, p.verdict), fontSize: 38, lineHeight: 42 }}>
            {p.score}
          </T>
          <T v="subhead" style={{ fontWeight: '600' }} numberOfLines={1}>
            {p.verdictLabel}
          </T>
          <T v="caption" tone="secondary" num numberOfLines={1}>
            {`${p.wind} ${p.unit} ${p.dir}`}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <T v="caption2" tone="secondary">
            {t('PRÓXIMAS HORAS')}
          </T>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end' }}>
            {p.hours.slice(0, 6).map((h) => (
              <View key={h.t} style={{ alignItems: 'center', gap: 4 }}>
                <View style={{ width: 14, height: 64, borderRadius: 7, backgroundColor: c.fill, justifyContent: 'flex-end' }}>
                  <View style={{ height: Math.max(8, (h.s / 100) * 64), borderRadius: 7, backgroundColor: verdictColor(c, h.v) }} />
                </View>
                <T v="caption2" tone="secondary" num>
                  {h.t}
                </T>
              </View>
            ))}
          </View>
        </View>
      </View>
    </WidgetFrame>
  );
}

function LockCircular({ p }: { p: ConditionsWidgetProps }) {
  const size = 64;
  const r = 26;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFFFFF26', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '135deg' }] }}>
        <Circle cx={32} cy={32} r={r} stroke="#FFFFFF40" strokeWidth={5} fill="none" strokeDasharray={`${circ * 0.75} ${circ}`} strokeLinecap="round" />
        <Circle cx={32} cy={32} r={r} stroke="#FFFFFF" strokeWidth={5} fill="none" strokeDasharray={`${circ * 0.75 * (p.score / 100)} ${circ}`} strokeLinecap="round" />
      </Svg>
      <T v="headline" num style={{ color: '#FFFFFF' }}>
        {p.score}
      </T>
    </View>
  );
}

function LockRect({ p }: { p: ConditionsWidgetProps }) {
  return (
    <View style={{ width: 170, gap: 1 }}>
      <T v="subhead" style={{ color: '#FFFFFF', fontWeight: '700' }} numberOfLines={1}>
        {`${p.verdictShort} · ${p.score}`}
      </T>
      <T v="footnote" style={{ color: '#FFFFFFCC' }} num numberOfLines={1}>
        {`${p.wind} ${p.unit} ${p.dir} · ${t('raj')} ${p.gust}`}
      </T>
      <T v="footnote" style={{ color: '#FFFFFFCC' }} numberOfLines={1}>
        {p.next}
      </T>
    </View>
  );
}

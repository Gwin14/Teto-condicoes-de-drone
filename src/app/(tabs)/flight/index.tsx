import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { IslandPreview } from '@/components/flight/IslandPreview';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Card, ListRow, PressableScale, SectionHeader, StatusPill, T } from '@/components/ui';
import { useConditions } from '@/hooks/useConditions';
import { useActiveLocation } from '@/hooks/useLocation';
import { useNow } from '@/hooks/useNow';
import { t } from '@/i18n';
import { confirmAction } from '@/lib/confirm';
import { endFlight } from '@/lib/flight';
import { openPro, useIsPro } from '@/lib/purchases';
import { ProBadge } from '@/components/ProBadge';
import { cardinal, fmtDuration, fmtMinutes, fmtShortDate, fmtSpeed, fmtTime } from '@/lib/format';
import { verdictLabel } from '@/lib/scoring';
import { capabilities, capabilityNote } from '@/native/capabilities';
import { type FlightLog, useApp } from '@/store/app';
import { radius, space, useTheme, verdictColor } from '@/theme/tokens';

export default function FlightScreen() {
  const { c } = useTheme();
  const session = useApp((s) => s.session);
  const flights = useApp((s) => s.flights);
  const { location } = useActiveLocation();
  const { data, drone } = useConditions(location?.lat, location?.lon, location?.country);
  const unit = useApp((s) => s.speedUnit);

  const isPro = useIsPro();
  const totalMin = flights.reduce((s, f) => s + (f.endedAt - f.startedAt) / 60000, 0);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxxl * 2 }}>
      {session ? (
        <ActiveFlight />
      ) : (
        <Card style={{ gap: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1, gap: 4 }}>
              <T v="title3">{t('Pronto para decolar?')}</T>
              <T v="subhead" tone="secondary">
                {data && location
                  ? `${location.name} · ${drone.name} · ${fmtSpeed(data.now.windAlt, unit)} ${cardinal(data.now.dirAlt)}`
                  : t('Carregando as condições do local…')}
              </T>
            </View>
            {data ? <StatusPill v={data.now.verdict} label={`${data.now.score}`} /> : null}
          </View>
          {data && data.now.verdict === 'nogo' ? (
            <T v="footnote" tone="nogo">
              {t('As condições atuais não são recomendadas para o seu drone.')} {data.now.factors[0]?.label}: {data.now.factors[0]?.detail}.
            </T>
          ) : null}
          <Button title={t('Checklist e decolagem')} icon="checklist" onPress={() => router.push('/checklist')} disabled={!data} />
          <T v="caption" tone="tertiary" style={{ textAlign: 'center' }}>
            {process.env.EXPO_OS === 'ios'
              ? t('Ao decolar, o Teto cronometra o voo, estima a bateria útil e mostra tudo na Live Activity e na Dynamic Island.')
              : t('Ao decolar, o Teto cronometra o voo, estima a bateria útil e mostra tudo na notificação.')}
          </T>
        </Card>
      )}

      <View>
        <SectionHeader title={t('Ferramentas')} icon="edit" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          <Tool icon="compass" title={t('Bússola de vento')} subtitle={t('Aponte e veja proa ou cauda')} onPress={() => openPro('/flight/compass')} pro={!isPro} />
          <Tool icon="route" title={t('Retorno seguro')} subtitle={t('Bateria para voltar contra o vento')} onPress={() => openPro('/flight/return')} pro={!isPro} />
          <Tool icon="camera" title={t('Planejador de luz')} subtitle={t('Hora dourada, azul e sombras')} onPress={() => openPro('/flight/sun')} pro={!isPro} />
          <Tool icon="checklist" title={t('Checklist')} subtitle={t('Itens obrigatórios e boas práticas')} onPress={() => router.push('/checklist')} />
        </View>
      </View>

      <View>
        <SectionHeader title={t('Diário de bordo')} icon="history" />
        {flights.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxl }}>
            <Icon name="history" size={28} color={c.tertiary} />
            <T v="headline">{t('Nenhum voo registrado')}</T>
            <T v="footnote" tone="secondary" style={{ textAlign: 'center', maxWidth: 280 }}>
              {t('Seus voos aparecem aqui com duração, local e as condições na decolagem.')}
            </T>
          </Card>
        ) : (
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Stat label={t('Voos')} value={String(flights.length)} />
              <Stat label={t('Tempo total')} value={fmtMinutes(totalMin)} />
              <Stat label={t('Locais')} value={String(new Set(flights.map((f) => f.place)).size)} />
            </View>
            <Card padded={false}>
              {flights.slice(0, 30).map((f, i) => (
                <FlightRow key={f.id} f={f} last={i === Math.min(flights.length, 30) - 1} />
              ))}
            </Card>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function ActiveFlight() {
  useKeepAwake();
  const { c } = useTheme();
  const session = useApp((s) => s.session)!;
  const unit = useApp((s) => s.speedUnit);
  const now = useNow(1000);
  const elapsed = now - session.startedAt;
  const total = session.usableMinutes * 60_000;
  const remaining = total - elapsed;
  const pct = Math.max(0, remaining / total);
  const landBy = fmtTime(new Date(session.startedAt + total));
  const color = remaining < 3 * 60_000 ? c.nogo : verdictColor(c, session.verdict);

  const land = () =>
    confirmAction({
      title: t('Registrar pouso?'),
      message: t('Voo de {duration} em {place}.', { duration: fmtDuration(elapsed), place: session.place }),
      cancel: t('Continuar voando'),
      confirm: t('Pousei'),
      onConfirm: () => endFlight(),
    });

  return (
    <View style={{ gap: space.md }}>
      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <StatusPill v={session.verdict} label={`${t('Em voo')} · ${verdictLabel[session.verdict]}`} />
          <T v="footnote" tone="secondary" num>
            {t('desde {time}', { time: fmtTime(new Date(session.startedAt)) })}
          </T>
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <T v="display" num accessibilityLabel={t('Tempo de voo {duration}', { duration: fmtDuration(elapsed) })}>
            {fmtDuration(elapsed)}
          </T>
          <T v="subhead" tone="secondary">
            {session.place} · {session.droneName}
          </T>
        </View>
        <View style={{ gap: space.sm }}>
          <View style={{ height: 10, borderRadius: radius.pill, backgroundColor: c.fill, overflow: 'hidden' }}>
            <View style={{ width: `${pct * 100}%`, height: 10, backgroundColor: color, borderRadius: radius.pill }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T v="footnote" tone={remaining < 3 * 60_000 ? 'nogo' : 'secondary'} num>
              {remaining > 0 ? t('{n} min de bateria útil', { n: Math.ceil(remaining / 60_000) }) : t('Reserva atingida — retorne agora')}
            </T>
            <T v="footnote" tone="secondary" num>
              {t('pouse até {time}', { time: landBy })}
            </T>
          </View>
        </View>
        <Button title={t('Registrar pouso')} icon="landing" kind="destructive" onPress={land} />
      </Card>

      <View style={{ gap: space.sm }}>
        <T v="footnote" tone="secondary" style={{ paddingHorizontal: space.xs }}>
          {capabilities.liveActivities ? t('Live Activity ativa na tela bloqueada e na Dynamic Island.') : `${t('Prévia da Live Activity')} · ${capabilityNote('liveActivities')}`}
        </T>
        {!capabilities.liveActivities ? (
          <IslandPreview
            elapsedMs={elapsed}
            wind={fmtSpeed(session.windAlt, unit)}
            batteryPct={pct}
            statusColor={color}
            landBy={landBy}
          />
        ) : null}
      </View>
    </View>
  );
}

function Tool({ icon, title, subtitle, onPress, pro }: { icon: IconName; title: string; subtitle: string; onPress: () => void; pro?: boolean }) {
  const { c } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      haptic
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        backgroundColor: c.card,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        padding: space.lg,
        gap: space.sm,
        minHeight: 120,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, borderCurve: 'continuous', backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={c.accent} />
        </View>
        {pro ? <ProBadge /> : null}
      </View>
      <T v="headline">{title}</T>
      <T v="footnote" tone="secondary" numberOfLines={2}>
        {subtitle}
      </T>
    </PressableScale>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.card, borderRadius: radius.card, borderCurve: 'continuous', padding: space.md, gap: 2 }}>
      <T v="caption" tone="secondary">
        {label}
      </T>
      <T v="headline" num numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
    </View>
  );
}

function FlightRow({ f, last }: { f: FlightLog; last: boolean }) {
  const { c } = useTheme();
  const remove = useApp((s) => s.removeFlight);
  const unit = useApp((s) => s.speedUnit);
  const d = new Date(f.startedAt);
  return (
    <ListRow
      title={`${f.place} · ${fmtDuration(f.endedAt - f.startedAt)}`}
      subtitle={`${fmtShortDate(d)} ${fmtTime(d)} · ${f.droneName} · ${t('vento {speed}', { speed: fmtSpeed(f.windAlt, unit) })} · ${t('score {n}', { n: f.score })}`}
      icon="flight"
      iconColor={verdictColor(c, f.verdict)}
      last={last}
      onPress={() =>
        confirmAction({
          title: f.place,
          message: `${t('{date} às {time}', { date: fmtShortDate(d), time: fmtTime(d) })} · ${fmtDuration(f.endedAt - f.startedAt)} · ${f.droneName}`,
          cancel: t('Fechar'),
          confirm: t('Apagar voo'),
          destructive: true,
          onConfirm: () => remove(f.id),
        })
      }
    />
  );
}

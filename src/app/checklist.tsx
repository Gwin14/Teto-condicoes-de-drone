import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { SheetHeader } from '@/components/SheetHeader';
import { Button, Card, StatusPill, T } from '@/components/ui';
import { useConditions } from '@/hooks/useConditions';
import { useActiveLocation } from '@/hooks/useLocation';
import { t } from '@/i18n';
import { startFlight } from '@/lib/flight';
import { regionAt } from '@/lib/region';
import { verdictLabel } from '@/lib/scoring';
import { useApp } from '@/store/app';
import { space, useTheme } from '@/theme/tokens';

type Item = { id: string; label: string; hint?: string };

/** Uma vez só: valem para o drone, não para o voo. Não travam a decolagem. */
const SETUP_BR: (Item & { over250?: boolean })[] = [
  { id: 'sisant', label: t('Drone cadastrado no SISANT (ANAC)'), over250: true },
  { id: 'seguro', label: t('Seguro RETA válido'), hint: t('Uso não recreativo'), over250: true },
  { id: 'anatel', label: t('Drone homologado na Anatel') },
];

/** Fora do Brasil as exigências variam: o item lembra de conferir com a autoridade local. */
const SETUP_INTL: (Item & { over250?: boolean })[] = [
  { id: 'registro', label: t('Drone registrado na autoridade local'), hint: t('Se o país exigir') },
  { id: 'piloto', label: t('Certificado ou curso de piloto'), hint: t('Se o país exigir') },
  { id: 'seguroLocal', label: t('Seguro de responsabilidade civil'), hint: t('Se o país exigir') },
];

const COMMON: Item[] = [
  { id: 'aeronave', label: t('Baterias carregadas e hélices inteiras') },
  { id: 'area', label: t('Área livre e pessoas a mais de 30 m') },
  { id: 'home', label: t('Home gravado e RTH acima dos obstáculos') },
  { id: 'vlos', label: t('Drone sempre à vista (VLOS)') },
];

/** A cada voo: o essencial, todos obrigatórios para decolar. */
const FLIGHT_BR: Item[] = [
  { id: 'sarpas', label: t('Voo autorizado no SARPAS NG'), hint: t('Obrigatório para qualquer drone desde 1º/07/2026') },
  ...COMMON,
];

const FLIGHT_INTL: Item[] = [
  { id: 'zona', label: t('Local liberado nas zonas oficiais do país'), hint: t('E autorização obtida, se for exigida') },
  ...COMMON,
];

export default function ChecklistScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const checks = useApp((s) => s.checklist);
  const toggle = useApp((s) => s.toggleCheck);
  const reset = useApp((s) => s.resetChecklist);
  const checkAll = useApp((s) => s.checkAll);
  const setup = useApp((s) => s.setupChecks);
  const toggleSetup = useApp((s) => s.toggleSetup);
  const { location } = useActiveLocation();
  const { data, drone } = useConditions(location?.lat, location?.lon, location?.country);
  const [starting, setStarting] = useState(false);

  const region = data?.region ?? (location ? regionAt(location.lat, location.lon, location.country) : 'BR');
  const SETUP = region === 'BR' ? SETUP_BR : SETUP_INTL;
  const FLIGHT = region === 'BR' ? FLIGHT_BR : FLIGHT_INTL;
  const setupItems = SETUP.filter((i) => !i.over250 || drone.weightG > 250);
  const setupDone = setupItems.every((i) => setup[i.id]);
  const [editSetup, setEditSetup] = useState(!setupDone);
  const done = FLIGHT.filter((i) => checks[i.id]).length;
  const ready = done === FLIGHT.length && !!data && !!location;

  const takeoff = async () => {
    if (!data || !location || starting) return;
    setStarting(true);
    await startFlight(data, location, drone);
    // Porta de mão única: o checklist não volta para a pilha.
    router.dismissTo('/flight');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SheetHeader title={t('Checklist pré-voo')} right={done > 0 ? t('Limpar') : undefined} onRight={reset} modal />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, gap: space.lg, paddingBottom: 140 }}>
        {data ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1, gap: 4 }}>
              <T v="headline">{location?.name}</T>
              <T v="footnote" tone="secondary">
                {drone.brand} {drone.name} · {t('score {n}', { n: data.now.score })}
              </T>
            </View>
            <StatusPill v={data.now.verdict} label={verdictLabel[data.now.verdict]} small />
          </Card>
        ) : null}

        {/* ----------------------------------------------------- Neste voo */}
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs }}>
            <T v="footnote" tone="secondary" style={{ flex: 1, textTransform: 'uppercase' }}>
              {t('Neste voo')}
            </T>
            {done < FLIGHT.length ? (
              <Pressable
                hitSlop={10}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  checkAll(FLIGHT.map((i) => i.id));
                }}
                accessibilityRole="button">
                <T v="footnote" tone="accent" style={{ fontWeight: '600' }}>
                  {t('Marcar tudo')}
                </T>
              </Pressable>
            ) : null}
          </View>
          <Card padded={false}>
            {FLIGHT.map((it, i) => (
              <CheckRow key={it.id} item={it} on={!!checks[it.id]} last={i === FLIGHT.length - 1} onPress={() => toggle(it.id)} />
            ))}
          </Card>
        </View>

        {/* ------------------------------------------------ Uma vez só */}
        {setupItems.length > 0 ? (
          setupDone && !editSetup ? (
            <Pressable onPress={() => setEditSetup(true)} accessibilityRole="button" accessibilityLabel={t('Editar documentação do drone')}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Icon name="check" size={20} color={c.go} />
                <T v="subhead" tone="secondary" style={{ flex: 1 }}>
                  {t('Documentação do drone em dia')}
                </T>
                <T v="subhead" tone="accent">
                  {t('Editar')}
                </T>
              </Card>
            </Pressable>
          ) : (
            <View style={{ gap: space.sm }}>
              <T v="footnote" tone="secondary" style={{ paddingHorizontal: space.xs, textTransform: 'uppercase' }}>
                {t('Uma vez só · fica salvo')}
              </T>
              <Card padded={false}>
                {setupItems.map((it, i) => (
                  <CheckRow key={it.id} item={it} on={!!setup[it.id]} last={i === setupItems.length - 1} onPress={() => toggleSetup(it.id)} />
                ))}
              </Card>
            </View>
          )
        ) : null}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          paddingBottom: Math.max(insets.bottom, space.lg),
          backgroundColor: c.background,
          borderTopWidth: 0.5,
          borderTopColor: c.separator,
          gap: space.sm,
        }}>
        <T v="footnote" tone="secondary" num style={{ textAlign: 'center' }}>
          {t('{done} de {total} itens deste voo', { done, total: FLIGHT.length })}
        </T>
        <Button title={t('Decolar')} icon="flight" onPress={takeoff} disabled={!ready} loading={starting} />
      </View>
    </View>
  );
}

function CheckRow({ item, on, last, onPress }: { item: Item; on: boolean; last: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}>
      {({ pressed }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg, backgroundColor: pressed ? c.fill : 'transparent' }}>
          <Icon name={on ? 'check' : 'circle'} size={24} color={on ? c.go : c.tertiary} />
          <View
            style={{
              flex: 1,
              paddingVertical: space.md,
              paddingRight: space.lg,
              borderBottomWidth: last ? 0 : 0.5,
              borderBottomColor: c.separator,
              gap: 2,
            }}>
            <T v="body" tone={on ? 'secondary' : 'label'}>
              {item.label}
            </T>
            {item.hint ? (
              <T v="footnote" tone="tertiary">
                {item.hint}
              </T>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

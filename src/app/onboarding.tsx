import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  type SharedValue,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnUI } from 'react-native-worklets';

import { Icon, type IconName } from '@/components/Icon';
import { AirspaceHero, CeilingHero, ScoreHero } from '@/components/onboarding/Heroes';
import { Button, Card, T } from '@/components/ui';
import { requestGps } from '@/hooks/useLocation';
import { t } from '@/i18n';
import { capabilities } from '@/native/capabilities';
import { ensurePermission } from '@/native/notifications';
import { useApp } from '@/store/app';
import { radius, space, useTheme } from '@/theme/tokens';

type Page = { key: string; title: string; body: string };

const PAGES: Page[] = [
  {
    key: 'score',
    title: t('Dá pra voar agora?'),
    body: t('Vento, rajadas, chuva, visibilidade e o limite do seu drone viram um score de 0 a 100. Uma resposta, sem planilha.'),
  },
  {
    key: 'teto',
    title: t('O vento lá em cima'),
    body: t('A 120 m o vento costuma ser bem mais forte do que no chão. O Teto mostra cada altura até o limite legal.'),
  },
  {
    key: 'airspace',
    title: t('Onde pode voar'),
    body: t('Zonas de aeródromos, regras da ANAC e os satélites GNSS que o seu drone vai enxergar, no mesmo lugar.'),
  },
  {
    key: 'permissions',
    title: t('Quase pronto'),
    body: t('Duas permissões deixam o Teto mais útil. Dá para mudar depois em Ajustes.'),
  },
];
const LAST = PAGES.length - 1;

type PermState = 'unknown' | 'granted' | 'denied';

function Dot({ index, x, width }: { index: number; x: SharedValue<number>; width: number }) {
  const { c } = useTheme();
  const style = useAnimatedStyle(() => {
    const p = x.get() / width;
    const t = interpolate(Math.abs(p - index), [0, 1], [1, 0], Extrapolation.CLAMP);
    return {
      width: 8 + t * 14,
      backgroundColor: interpolateColor(t, [0, 1], [c.fillStrong, c.accent]),
    };
  });
  return <Animated.View style={[{ height: 8, borderRadius: radius.pill }, style]} />;
}

function PermissionRow({
  icon,
  title,
  subtitle,
  right,
  last,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  right: React.ReactNode;
  last?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        borderBottomWidth: last ? 0 : 0.5,
        borderBottomColor: c.separator,
      }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          borderCurve: 'continuous',
          backgroundColor: c.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} size={18} color={c.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="headline">{title}</T>
        <T v="footnote" tone="secondary">
          {subtitle}
        </T>
      </View>
      {right}
    </View>
  );
}

function PermissionsHero() {
  const { c } = useTheme();
  const notify = useApp((s) => s.notifyWindows);
  const set = useApp((s) => s.set);
  const [loc, setLoc] = useState<PermState>('unknown');

  useEffect(() => {
    if (process.env.EXPO_OS === 'web') return;
    Location.getForegroundPermissionsAsync()
      .then((p) => setLoc(p.granted ? 'granted' : p.canAskAgain === false ? 'denied' : 'unknown'))
      .catch(() => {});
  }, []);

  const askLocation = async () => {
    await requestGps(true);
    const p = await Location.getForegroundPermissionsAsync().catch(() => null);
    const ok = !!p?.granted;
    setLoc(ok ? 'granted' : 'denied');
    Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };

  return (
    <Card style={{ width: '100%', maxWidth: 360, paddingVertical: space.xs }}>
      <PermissionRow
        icon="location"
        title={t('Localização')}
        subtitle={
          loc === 'denied'
            ? t('Negada. Você ainda pode escolher um local manualmente.')
            : t('Condições e aeródromos exatamente onde você está.')
        }
        right={
          loc === 'granted' ? (
            <Icon name="check" size={24} color={c.go} />
          ) : loc === 'denied' ? null : (
            <Button kind="secondary" title={t('Permitir')} onPress={askLocation} style={{ minHeight: 36, paddingHorizontal: space.lg }} />
          )
        }
      />
      <PermissionRow
        icon="bell"
        title={t('Janelas de voo')}
        subtitle={
          capabilities.localNotifications
            ? t('Um aviso antes das horas boas para voar.')
            : t('Disponível na versão instalada do app.')
        }
        last
        right={
          <Switch
            value={notify}
            disabled={!capabilities.localNotifications}
            trackColor={{ true: c.accent }}
            onValueChange={async (v) => {
              if (!v) return set('notifyWindows', false);
              const ok = await ensurePermission();
              set('notifyWindows', ok);
            }}
          />
        }
      />
    </Card>
  );
}

export default function OnboardingScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const set = useApp((s) => s.set);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const x = useSharedValue(0);
  const [page, setPage] = useState(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    x.set(e.contentOffset.x);
  });

  const goTo = (i: number) => {
    scheduleOnUI(() => {
      'worklet';
      scrollTo(scrollRef, i * width, 0, true);
    });
    setPage(i);
  };

  // Porta de mão única: o Stack.Protected do layout raiz tira esta rota da pilha.
  const finish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    set('onboarded', true);
  };

  const isLast = page === LAST;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.lg,
          height: insets.top + 52,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
        {!isLast ? (
          <Pressable
            onPress={() => goTo(LAST)}
            hitSlop={12}
            accessibilityRole="button"
            style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, minHeight: 44, justifyContent: 'center' })}>
            <T v="body" tone="secondary">
              {t('Pular')}
            </T>
          </Pressable>
        ) : null}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}>
        {PAGES.map((p, i) => (
          <ScrollView
            key={p.key}
            style={{ width }}
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.xxl, paddingBottom: space.xl, gap: space.xxxl }}
            showsVerticalScrollIndicator={false}>
            <View style={{ flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center' }}>
              {i === 0 ? <ScoreHero active={page === 0} /> : null}
              {i === 1 ? <CeilingHero active={page === 1} /> : null}
              {i === 2 ? <AirspaceHero active={page === 2} /> : null}
              {i === 3 ? <PermissionsHero /> : null}
            </View>
            <View style={{ gap: space.sm }}>
              <T v="largeTitle" accessibilityRole="header">
                {p.title}
              </T>
              <T v="body" tone="secondary">
                {p.body}
              </T>
            </View>
          </ScrollView>
        ))}
      </Animated.ScrollView>

      <View style={{ paddingHorizontal: space.xxl, paddingBottom: insets.bottom + space.lg, gap: space.xl }}>
        <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityLabel={t('Página {n} de {total}', { n: page + 1, total: PAGES.length })}>
          {PAGES.map((p, i) => (
            <Dot key={p.key} index={i} x={x} width={width} />
          ))}
        </View>
        <Button title={isLast ? t('Começar') : t('Continuar')} onPress={() => (isLast ? finish() : goTo(page + 1))} />
      </View>
    </View>
  );
}

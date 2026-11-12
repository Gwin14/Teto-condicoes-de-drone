import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { SheetHeader } from '@/components/SheetHeader';
import { Button, Card, T } from '@/components/ui';
import { lang, t } from '@/i18n';
import { buy, purchasesAvailable, restore, useIsPro, useOffering } from '@/lib/purchases';
import { radius, space, useTheme } from '@/theme/tokens';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'forecast', title: t('Previsão de 7 dias'), body: t('As horas boas de cada dia da semana, no estilo go/no-go.') },
  { icon: 'bell', title: t('Alertas de janela ideal'), body: t('Um aviso 30 minutos antes das melhores horas para voar.') },
  { icon: 'widgets', title: t('Widgets e Live Activity'), body: t('Score e vento na tela inicial, na tela bloqueada e na Dynamic Island.') },
  { icon: 'satellite', title: t('Satélites e clima espacial'), body: t('Carta do céu, PDOP nas próximas 24 h, Kp, escalas da NOAA e cintilação.') },
  { icon: 'compass', title: t('Ferramentas de voo'), body: t('Bússola de vento, retorno seguro e planejador de luz.') },
  { icon: 'edit', title: t('Drone personalizado'), body: t('Os limites exatos do seu equipamento no cálculo do score.') },
];

const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = `https://gwin14.github.io/Teto-condicoes-de-drone/${lang}/privacy.html`;

function trialDays(p: PurchasesPackage) {
  const intro = p.product.introPrice;
  if (!intro || intro.price > 0) return 0;
  const unit = intro.periodUnit.toUpperCase();
  const n = intro.periodNumberOfUnits;
  return unit === 'DAY' ? n : unit === 'WEEK' ? n * 7 : unit === 'MONTH' ? n * 30 : 0;
}

export default function PaywallScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const isPro = useIsPro();
  const { offering, loading, error } = useOffering();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  const packages = useMemo(() => {
    const order = ['ANNUAL', 'MONTHLY', 'LIFETIME'];
    return [...(offering?.availablePackages ?? [])].sort((a, b) => order.indexOf(a.packageType) - order.indexOf(b.packageType));
  }, [offering]);
  const monthly = packages.find((p) => p.packageType === 'MONTHLY');
  const chosen = packages.find((p) => p.identifier === selected) ?? packages[0];

  // Já é Pro (comprou agora ou restaurou): segue para onde o usuário queria ir.
  useEffect(() => {
    if (!isPro) return;
    router.back();
    if (next) setTimeout(() => router.push(next as never), 300);
  }, [isPro, next]);

  const onBuy = async () => {
    if (!chosen || busy) return;
    setBusy('buy');
    const r = await buy(chosen);
    setBusy(null);
    if (r.outcome === 'purchased') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else if (r.outcome === 'error') Alert.alert(t('Não foi possível concluir a compra'), r.message ?? t('Tente de novo em instantes.'));
  };

  const onRestore = async () => {
    if (busy) return;
    setBusy('restore');
    try {
      const ok = await restore();
      if (!ok) Alert.alert(t('Nada para restaurar'), t('Não encontramos uma compra do Teto Pro nesta conta Apple.'));
    } catch (e) {
      Alert.alert(t('Não foi possível restaurar'), e instanceof Error ? e.message : '');
    } finally {
      setBusy(null);
    }
  };

  const trial = chosen ? trialDays(chosen) : 0;
  const cta = !chosen
    ? t('Continuar')
    : trial > 0
      ? t('Começar {n} dias grátis', { n: trial })
      : chosen.packageType === 'LIFETIME'
        ? t('Comprar por {price}', { price: chosen.product.priceString })
        : t('Assinar por {price}', { price: chosen.product.priceString });

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SheetHeader title="" left={t('Fechar')} modal />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 220, gap: space.xl }}>
        <View style={{ alignItems: 'center', gap: space.sm, paddingTop: space.sm }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, borderCurve: 'continuous', backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="drone" size={30} color={c.onAccent} />
          </View>
          <T v="largeTitle" style={{ textAlign: 'center' }} accessibilityRole="header">
            Teto Pro
          </T>
          <T v="body" tone="secondary" style={{ textAlign: 'center', maxWidth: 320 }}>
            {t('Planeje a semana, receba o aviso na hora certa e voe com tudo o que o Teto sabe.')}
          </T>
        </View>

        <Card style={{ gap: space.lg }}>
          {FEATURES.map((f) => (
            <View key={f.title} style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ width: 32, height: 32, borderRadius: 9, borderCurve: 'continuous', backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={f.icon} size={16} color={c.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="headline">{f.title}</T>
                <T v="subhead" tone="secondary">
                  {f.body}
                </T>
              </View>
            </View>
          ))}
        </Card>

        {!purchasesAvailable ? (
          <Card>
            <T v="subhead" tone="secondary">
              {t('O Teto Pro é vendido pela App Store, no app para iPhone.')}
            </T>
          </Card>
        ) : loading ? (
          <ActivityIndicator color={c.secondary} />
        ) : error || packages.length === 0 ? (
          <Card>
            <T v="subhead" tone="secondary">
              {t('Os planos não carregaram. Verifique sua conexão e tente de novo.')}
            </T>
          </Card>
        ) : (
          <View style={{ gap: space.md }} accessibilityRole="radiogroup">
            {packages.map((p) => {
              const on = p.identifier === chosen?.identifier;
              const days = trialDays(p);
              const save =
                p.packageType === 'ANNUAL' && monthly ? Math.round((1 - p.product.price / (monthly.product.price * 12)) * 100) : 0;
              const title =
                p.packageType === 'ANNUAL' ? t('Anual') : p.packageType === 'MONTHLY' ? t('Mensal') : p.packageType === 'LIFETIME' ? t('Vitalício') : p.product.title;
              const sub =
                p.packageType === 'ANNUAL'
                  ? [p.product.pricePerMonthString ? t('{price}/mês', { price: p.product.pricePerMonthString }) : null, days > 0 ? t('{n} dias grátis', { n: days }) : null]
                      .filter(Boolean)
                      .join(' · ')
                  : p.packageType === 'MONTHLY'
                    ? t('Cancele quando quiser')
                    : t('Pague uma vez, use para sempre');
              const price =
                p.packageType === 'ANNUAL'
                  ? t('{price}/ano', { price: p.product.priceString })
                  : p.packageType === 'MONTHLY'
                    ? t('{price}/mês', { price: p.product.priceString })
                    : p.product.priceString;
              return (
                <Pressable
                  key={p.identifier}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelected(p.identifier);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${title}, ${price}. ${sub}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    padding: space.lg,
                    borderRadius: radius.card,
                    borderCurve: 'continuous',
                    backgroundColor: c.card,
                    borderWidth: 2,
                    borderColor: on ? c.accent : 'transparent',
                  }}>
                  <Icon name={on ? 'check' : 'circle'} size={24} color={on ? c.accent : c.tertiary} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <T v="headline">{title}</T>
                      {save >= 10 ? (
                        <View style={{ backgroundColor: c.goSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <T v="caption" style={{ color: c.go, fontWeight: '700' }}>
                            {t('Economize {pct}%', { pct: save })}
                          </T>
                        </View>
                      ) : null}
                    </View>
                    <T v="footnote" tone="secondary">
                      {sub}
                    </T>
                  </View>
                  <T v="headline" num>
                    {price}
                  </T>
                </Pressable>
              );
            })}
          </View>
        )}
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
        <Button title={cta} onPress={onBuy} loading={busy === 'buy'} disabled={!chosen || !purchasesAvailable} />
        <T v="caption" tone="tertiary" style={{ textAlign: 'center' }}>
          {chosen?.packageType === 'LIFETIME'
            ? t('Compra única, sem renovação.')
            : trial > 0
              ? t('Grátis por {n} dias, depois {price}. Renova automaticamente; cancele quando quiser nos Ajustes do iPhone.', {
                  n: trial,
                  price: chosen ? t('{price}/ano', { price: chosen.product.priceString }) : '',
                })
              : t('Renova automaticamente; cancele quando quiser nos Ajustes do iPhone.')}
        </T>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg }}>
          <Pressable onPress={onRestore} hitSlop={8} accessibilityRole="button">
            <T v="footnote" tone="accent">
              {busy === 'restore' ? t('Restaurando…') : t('Restaurar compras')}
            </T>
          </Pressable>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} hitSlop={8} accessibilityRole="link">
            <T v="footnote" tone="secondary">
              {t('Termos de uso')}
            </T>
          </Pressable>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} hitSlop={8} accessibilityRole="link">
            <T v="footnote" tone="secondary">
              {t('Privacidade')}
            </T>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

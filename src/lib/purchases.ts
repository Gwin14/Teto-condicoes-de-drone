/**
 * Teto Pro via RevenueCat.
 *
 * - Entitlement `pro`, offering `default` com os pacotes $rc_annual (7 dias grátis), $rc_monthly e $rc_lifetime.
 * - O estado `pro` fica salvo no store para a interface não "piscar" bloqueada ao abrir o app;
 *   o RevenueCat confirma logo depois e mantém tudo em dia pelo listener.
 * - Na web o SDK da App Store não existe: o app fica no plano grátis.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import Purchases, { type CustomerInfo, LOG_LEVEL, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases';

import { useApp } from '@/store/app';

export const ENTITLEMENT = 'pro';
const IOS_KEY = 'appl_rTalAWSCYtyZUosLZLsHTpubDsV';

export const purchasesAvailable = process.env.EXPO_OS === 'ios';

let configured = false;

function apply(info: CustomerInfo) {
  useApp.getState().set('pro', info.entitlements.active[ENTITLEMENT] != null);
}

/** Chamado uma vez no layout raiz. */
export function configurePurchases() {
  if (!purchasesAvailable || configured) return;
  configured = true;
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN).catch(() => {});
    Purchases.configure({ apiKey: IOS_KEY });
    Purchases.addCustomerInfoUpdateListener(apply);
    Purchases.getCustomerInfo().then(apply).catch(() => {});
  } catch (e) {
    configured = false;
    console.warn('[teto] RevenueCat indisponível', e);
  }
}

export function useIsPro() {
  return useApp((s) => s.pro);
}

/** Abre a rota se o usuário for Pro; senão, o paywall (que volta para a rota depois da compra). */
export function openPro(route: string) {
  if (useApp.getState().pro) router.push(route as never);
  else router.push({ pathname: '/paywall', params: { next: route } });
}

/** Executa a ação se o usuário for Pro; senão, abre o paywall. Retorna se executou. */
export function requirePro(action: () => void) {
  if (useApp.getState().pro) {
    action();
    return true;
  }
  router.push('/paywall');
  return false;
}

export function useOffering() {
  const [state, setState] = useState<{ offering: PurchasesOffering | null; loading: boolean; error: string | null }>({
    offering: null,
    loading: purchasesAvailable,
    error: null,
  });
  useEffect(() => {
    if (!purchasesAvailable) return;
    configurePurchases();
    let alive = true;
    Purchases.getOfferings()
      .then((o) => alive && setState({ offering: o.current, loading: false, error: o.current ? null : 'empty' }))
      .catch((e: Error) => alive && setState({ offering: null, loading: false, error: e.message }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'error';

export async function buy(pkg: PurchasesPackage): Promise<{ outcome: PurchaseOutcome; message?: string }> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    apply(customerInfo);
    return { outcome: customerInfo.entitlements.active[ENTITLEMENT] ? 'purchased' : 'error' };
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) return { outcome: 'cancelled' };
    return { outcome: 'error', message: err.message };
  }
}

export async function restore(): Promise<boolean> {
  const info = await Purchases.restorePurchases();
  apply(info);
  return info.entitlements.active[ENTITLEMENT] != null;
}

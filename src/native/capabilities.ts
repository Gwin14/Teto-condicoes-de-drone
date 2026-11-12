import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';

import { t } from '@/i18n';

/**
 * Detecção de capacidades nativas.
 *
 * Tudo que depende de código nativo que NÃO existe no Expo Go (widgets,
 * Live Activities) passa por aqui. No Expo Go essas flags ficam `false`,
 * os módulos nunca são carregados e o app usa as prévias em React Native.
 */
const OS = process.env.EXPO_OS;

export const inExpoGo = OS !== 'web' && isRunningInExpoGo();

function hasModule(name: string) {
  if (OS === 'web') return false;
  try {
    return requireOptionalNativeModule(name) != null;
  } catch {
    return false;
  }
}

export const capabilities = {
  /** Widgets de tela inicial (iOS + Android) e de tela bloqueada (iOS). */
  widgets: !inExpoGo && hasModule('ExpoWidgets'),
  /** Live Activities + Dynamic Island (somente iOS 16.2+). */
  liveActivities: OS === 'ios' && !inExpoGo && hasModule('ExpoWidgets'),
  /** Notificações locais funcionam no Expo Go e em builds (não na web). */
  localNotifications: OS !== 'web',
  /** Bússola por magnetômetro. */
  heading: OS !== 'web',
  maps: OS !== 'web',
};

/** Texto para o usuário final: como usar o recurso, ou por que ele não está disponível. */
export function capabilityNote(kind: 'widgets' | 'lockWidgets' | 'liveActivities') {
  if (OS === 'web') return t('Indisponível na web.');
  if (inExpoGo) return t('Requer development build — no Expo Go você vê a prévia.');
  if (kind !== 'widgets' && OS !== 'ios') return t('Exclusivo do iOS');
  const available = kind === 'liveActivities' ? capabilities.liveActivities : capabilities.widgets;
  if (!available) return t('Indisponível neste aparelho.');
  if (kind === 'widgets')
    return OS === 'ios'
      ? t('Toque e segure a tela de início, toque em Editar › Adicionar widget e procure Teto.')
      : t('Toque e segure a tela inicial, toque em Widgets e procure Teto.');
  if (kind === 'lockWidgets') return t('Toque e segure a tela bloqueada, toque em Personalizar e adicione o Teto.');
  return t('Aparece sozinha quando você decola pelo Checklist e decolagem.');
}

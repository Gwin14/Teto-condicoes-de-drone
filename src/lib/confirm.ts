import { Alert } from 'react-native';

import { t } from '@/i18n';

/** Confirmação nativa (Alert) com fallback para a web, onde Alert não existe. */
export function confirmAction(opts: {
  title: string;
  message?: string;
  confirm: string;
  cancel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  if (process.env.EXPO_OS === 'web') {
    if (globalThis.confirm?.(`${opts.title}${opts.message ? `\n\n${opts.message}` : ''}`)) opts.onConfirm();
    return;
  }
  Alert.alert(opts.title, opts.message, [
    { text: opts.cancel ?? t('Cancelar'), style: 'cancel' },
    { text: opts.confirm, style: opts.destructive ? 'destructive' : 'default', onPress: opts.onConfirm },
  ]);
}

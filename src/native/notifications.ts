import { t } from '@/i18n';
import { fmtHour, fmtWeekday } from '@/lib/format';
import type { FlightWindow } from '@/lib/scoring';

import { capabilities } from './capabilities';

/**
 * Notificações LOCAIS (funcionam no Expo Go e em builds). O módulo é carregado
 * sob demanda para não registrar nada de push no Expo Go.
 */
type NotificationsModule = typeof import('expo-notifications');
let N: NotificationsModule | null = null;

function load() {
  if (!capabilities.localNotifications) return null;
  if (!N) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      N = require('expo-notifications') as NotificationsModule;
      N.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    } catch {
      N = null;
    }
  }
  return N;
}

export async function ensurePermission() {
  const n = load();
  if (!n) return false;
  const cur = await n.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await n.requestPermissionsAsync();
  return req.granted;
}

export function windowKey(w: FlightWindow) {
  return `${w.start.getTime()}`;
}

/** Agenda um alerta 30 min antes da janela (ou agora+1min se já estiver perto). */
export async function scheduleWindowAlert(w: FlightWindow, place: string) {
  const n = load();
  if (!n) return null;
  const ok = await ensurePermission();
  if (!ok) return null;
  const fireAt = new Date(Math.max(Date.now() + 60_000, w.start.getTime() - 30 * 60_000));
  const id = await n.scheduleNotificationAsync({
    content: {
      title: t('Janela de voo em {place}', { place }),
      body: t('{day} das {from} às {to} · score médio {score}. Bons voos!', {
        day: fmtWeekday(w.start),
        from: fmtHour(w.start),
        to: fmtHour(w.end),
        score: w.avgScore,
      }),
      data: { url: '/' },
    },
    trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: fireAt },
  });
  return id;
}

export async function cancelAlert(id: string) {
  const n = load();
  if (!n) return;
  await n.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** Lembrete de bateria durante o voo. */
export async function scheduleBatteryReminder(atMs: number) {
  const n = load();
  if (!n) return null;
  const ok = await ensurePermission();
  if (!ok || atMs < Date.now() + 30_000) return null;
  return n.scheduleNotificationAsync({
    content: {
      title: t('Hora de voltar'),
      body: t('A bateria útil estimada está acabando. Inicie o retorno e pouse com folga.'),
      data: { url: '/flight' },
    },
    trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: new Date(atMs) },
  });
}

export function addResponseListener(cb: (url: string) => void) {
  const n = load();
  if (!n) return () => {};
  const sub = n.addNotificationResponseReceivedListener((r) => {
    const url = r.notification.request.content.data?.url;
    if (typeof url === 'string') cb(url);
  });
  return () => sub.remove();
}

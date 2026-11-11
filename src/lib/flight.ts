import * as Haptics from 'expo-haptics';

import type { Conditions } from '@/hooks/useConditions';
import type { ResolvedLocation } from '@/hooks/useLocation';
import { cancelAlert, scheduleBatteryReminder } from '@/native/notifications';
import { buildActivityProps, endFlightActivity, startFlightActivity } from '@/native/widgets';
import { useApp } from '@/store/app';

import type { DroneProfile } from './drones';

let batteryReminderId: string | null = null;

/** Inicia sessão de voo: grava no diário, liga Live Activity e lembrete de bateria. */
export async function startFlight(data: Conditions, loc: ResolvedLocation, drone: DroneProfile) {
  const st = useApp.getState();
  const session = st.startSession({
    place: loc.name,
    lat: loc.lat,
    lon: loc.lon,
    droneId: drone.id,
    droneName: `${drone.brand} ${drone.name}`,
    score: data.now.score,
    verdict: data.now.verdict,
    windAlt: data.now.windAlt,
    gust: data.now.gustAlt,
    temp: data.forecast.current.temp,
    usableMinutes: Math.max(3, data.usable),
  });
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  // Live Activity é do Teto Pro; o cronômetro e o diário de bordo continuam grátis.
  const liveActivity = st.pro ? startFlightActivity(buildActivityProps(session, st.speedUnit, data.now.dirAlt)) : false;
  batteryReminderId = !st.notifyWindows ? null : await scheduleBatteryReminder(session.startedAt + session.usableMinutes * 60_000).catch(() => null);
  return { session, liveActivity };
}

export function endFlight(notes?: string) {
  const log = useApp.getState().endSession(notes);
  endFlightActivity();
  if (batteryReminderId) {
    cancelAlert(batteryReminderId);
    batteryReminderId = null;
  }
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  return log;
}

import type { Conditions } from '@/hooks/useConditions';
import { fmtNum, t } from '@/i18n';
import { cardinal, convertSpeed, fmtHour, fmtTemp, fmtTime, fmtWeekday, speedUnitLabel, type SpeedUnit, type TempUnit } from '@/lib/format';
import { type FlightWindow, verdictLabel, verdictShort } from '@/lib/scoring';
import type { FlightSession } from '@/store/app';
import type { ConditionsWidgetProps, FlightActivityProps } from '@/widgets/types';

import { capabilities } from './capabilities';

import type { LiveActivityFactory, Widget } from 'expo-widgets';

type WidgetsModule = {
  ConditionsWidget: Widget<ConditionsWidgetProps> | null;
  LockScreenWidget: Widget<ConditionsWidgetProps> | null;
  FlightActivity: LiveActivityFactory<FlightActivityProps> | null;
};

let mod: WidgetsModule | null | undefined;

/** Carrega os módulos de widget só quando o binário nativo existe (nunca no Expo Go). */
function load(): WidgetsModule | null {
  if (mod !== undefined) return mod;
  if (!capabilities.widgets) {
    mod = null;
    return mod;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/widgets') as WidgetsModule;
  } catch (e) {
    console.warn('[teto] widgets indisponíveis', e);
    mod = null;
  }
  return mod;
}

function windowLabel(w: FlightWindow | undefined) {
  if (!w) return t('Sem janela boa nas próximas 48 h');
  return `${fmtWeekday(w.start)} ${fmtHour(w.start)}–${fmtHour(w.end)} · ${w.avgScore}`;
}

const speed = (kmh: number, u: SpeedUnit) => String(Math.round(convertSpeed(kmh, u)));

export function buildWidgetProps(
  c: Conditions,
  placeName: string,
  droneName: string,
  altitude: number,
  unit: SpeedUnit,
  tempUnit: TempUnit,
  fromIndex = -1
): ConditionsWidgetProps {
  const s = fromIndex < 0 ? c.now : c.hours[fromIndex];
  const nextHours = c.hours.slice(Math.max(0, fromIndex < 0 ? 0 : fromIndex), (fromIndex < 0 ? 0 : fromIndex) + 6);
  const refTime = s.hour.time.getTime();
  const nextWindow = c.windows.filter((w) => w.end.getTime() > refTime).sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  return {
    place: placeName,
    score: s.score,
    verdict: s.verdict,
    verdictLabel: verdictLabel[s.verdict],
    verdictShort: verdictShort[s.verdict],
    wind: speed(s.windAlt, unit),
    gust: speed(s.gustAlt, unit),
    unit: speedUnitLabel[unit],
    dir: cardinal(s.dirAlt),
    temp: fmtTemp(s.hour.temp, tempUnit),
    rain: `${Math.round(s.hour.precipProb)}%`,
    kp: fmtNum(s.kp, 1),
    altitude,
    next: windowLabel(nextWindow),
    updated: fmtTime(new Date(c.forecast.fetchedAt)),
    drone: droneName,
    hours: nextHours.map((h) => ({ t: fmtHour(h.hour.time), s: h.score, v: h.verdict, w: speed(h.windAlt, unit) })),
    l: {
      gust: t('raj'),
      next: t('PRÓXIMAS HORAS'),
      windAt: t('Vento a {alt} m', { alt: altitude }),
      gusts: t('Rajadas'),
      rain: t('Chuva'),
      temp: t('Temperatura'),
      kp: t('Índice Kp'),
    },
  };
}

let lastSignature = '';

/** Atualiza widgets com o agora + timeline horária (iOS) para continuar correto sem abrir o app. */
export function syncWidgets(
  c: Conditions,
  placeName: string,
  droneName: string,
  altitude: number,
  unit: SpeedUnit,
  tempUnit: TempUnit
) {
  const m = load();
  if (!m) return;
  const sig = `${c.forecast.fetchedAt}|${placeName}|${droneName}|${altitude}|${unit}|${tempUnit}|${c.now.score}`;
  if (sig === lastSignature) return;
  lastSignature = sig;
  try {
    const now = buildWidgetProps(c, placeName, droneName, altitude, unit, tempUnit);
    if (process.env.EXPO_OS === 'ios') {
      const entries = [{ date: new Date(), props: now }];
      c.hours.forEach((h, i) => {
        if (h.hour.time.getTime() > Date.now() && entries.length < 13) {
          entries.push({ date: h.hour.time, props: buildWidgetProps(c, placeName, droneName, altitude, unit, tempUnit, i) });
        }
      });
      m.ConditionsWidget?.updateTimeline(entries);
      m.LockScreenWidget?.updateTimeline(entries);
    } else {
      m.ConditionsWidget?.updateSnapshot(now);
    }
  } catch (e) {
    console.warn('[teto] falha ao atualizar widgets', e);
  }
}

/* ------------------------------------------------------------ Live Activity */

export function buildActivityProps(s: FlightSession, unit: SpeedUnit, dirDeg: number): FlightActivityProps {
  const batteryEndMs = s.startedAt + s.usableMinutes * 60_000;
  const landBy = fmtTime(new Date(batteryEndMs));
  return {
    place: s.place,
    drone: s.droneName,
    startMs: s.startedAt,
    batteryEndMs,
    landBy,
    score: s.score,
    verdict: s.verdict,
    verdictLabel: verdictLabel[s.verdict],
    wind: speed(s.windAlt, unit),
    gust: speed(s.gust, unit),
    unit: speedUnitLabel[unit],
    dir: cardinal(dirDeg),
    l: {
      inFlight: t('Em voo'),
      stale: t('Desatualizado'),
      wind: t('vento'),
      windCap: t('Vento'),
      gust: t('raj'),
      battery: t('Bateria útil estimada · pouse até {time}', { time: landBy }),
      landBy: t('Pouse até {time}', { time: landBy }),
    },
  };
}

export function startFlightActivity(props: FlightActivityProps) {
  const m = load();
  if (!m?.FlightActivity || !capabilities.liveActivities) return false;
  try {
    // Encerra instâncias antigas antes de iniciar uma nova.
    m.FlightActivity.getInstances().forEach((i) => i.end('immediate').catch(() => {}));
    m.FlightActivity.start(props, 'teto://flight', new Date(props.batteryEndMs + 30 * 60_000));
    return true;
  } catch (e) {
    console.warn('[teto] Live Activity indisponível', e);
    return false;
  }
}

export function updateFlightActivity(props: FlightActivityProps) {
  const m = load();
  if (!m?.FlightActivity) return;
  try {
    m.FlightActivity.getInstances().forEach((i) => i.update(props).catch(() => {}));
  } catch {
    // ignorado
  }
}

export function endFlightActivity() {
  const m = load();
  if (!m?.FlightActivity) return;
  try {
    m.FlightActivity.getInstances().forEach((i) => i.end('default').catch(() => {}));
  } catch {
    // ignorado
  }
}

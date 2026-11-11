/**
 * Posição do Sol e horários (hora dourada, azul, crepúsculo civil).
 * Baseado nas fórmulas do NOAA / algoritmo clássico do SunCalc.
 */
import { t } from '@/i18n';

const rad = Math.PI / 180;
const dayMs = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const e = rad * 23.4397;

const toJulian = (d: Date) => d.getTime() / dayMs - 0.5 + J1970;
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * dayMs);
const toDays = (d: Date) => toJulian(d) - J2000;

const rightAscension = (l: number, b: number) =>
  Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
const declination = (l: number, b: number) =>
  Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
const azimuthOf = (H: number, phi: number, dec: number) =>
  Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
const altitudeOf = (H: number, phi: number, dec: number) =>
  Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
const siderealTime = (d: number, lw: number) => rad * (280.16 + 360.9856235 * d) - lw;
const solarMeanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d);
const eclipticLongitude = (M: number) => {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = rad * 102.9372;
  return M + C + P + Math.PI;
};

function sunCoords(d: number) {
  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}

/** Azimute (graus a partir do Norte, horário) e elevação (graus). */
export function sunPosition(date: Date, lat: number, lon: number) {
  const lw = rad * -lon;
  const phi = rad * lat;
  const d = toDays(date);
  const c = sunCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  const az = azimuthOf(H, phi, c.dec) / rad + 180;
  return { azimuth: (az + 360) % 360, elevation: altitudeOf(H, phi, c.dec) / rad };
}

const J0 = 0.0009;
const julianCycle = (d: number, lw: number) => Math.round(d - J0 - lw / (2 * Math.PI));
const approxTransit = (Ht: number, lw: number, n: number) => J0 + (Ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds: number, M: number, L: number) =>
  J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
const hourAngle = (h: number, phi: number, d: number) =>
  Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)));

function setJ(h: number, lw: number, phi: number, dec: number, n: number, M: number, L: number) {
  const w = hourAngle(h, phi, dec);
  const a = approxTransit(w, lw, n);
  return solarTransitJ(a, M, L);
}

export type SunTimes = {
  solarNoon: Date;
  sunrise: Date;
  sunset: Date;
  goldenMorningEnd: Date;
  goldenEveningStart: Date;
  blueMorningStart: Date;
  blueEveningEnd: Date;
  dawn: Date;
  dusk: Date;
};

export function sunTimes(date: Date, lat: number, lon: number): SunTimes {
  const lw = rad * -lon;
  const phi = rad * lat;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L, 0);
  const Jnoon = solarTransitJ(ds, M, L);
  const pair = (angle: number) => {
    const Jset = setJ(angle * rad, lw, phi, dec, n, M, L);
    const Jrise = Jnoon - (Jset - Jnoon);
    return [fromJulian(Jrise), fromJulian(Jset)] as const;
  };
  const [sunrise, sunset] = pair(-0.833);
  const [dawn, dusk] = pair(-6);
  const [goldenMorningEnd, goldenEveningStart] = pair(6);
  const [blueMorningStart, blueEveningEnd] = pair(-6);
  return {
    solarNoon: fromJulian(Jnoon),
    sunrise,
    sunset,
    goldenMorningEnd,
    goldenEveningStart,
    blueMorningStart,
    blueEveningEnd,
    dawn,
    dusk,
  };
}

export type LightPhase = 'night' | 'blue' | 'golden' | 'day';

export function lightPhase(date: Date, lat: number, lon: number): LightPhase {
  const el = sunPosition(date, lat, lon).elevation;
  if (el < -6) return 'night';
  if (el < -0.833) return 'blue';
  if (el < 6) return 'golden';
  return 'day';
}

export const lightPhaseLabel: Record<LightPhase, string> = {
  night: t('Noite'),
  blue: t('Hora azul'),
  golden: t('Hora dourada'),
  day: t('Luz do dia'),
};

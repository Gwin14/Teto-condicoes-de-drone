/**
 * Satélites GNSS visíveis a partir de elementos orbitais públicos (CelesTrak, formato OMM/JSON).
 *
 * Propagação kepleriana com perturbação secular J2 — precisão de poucos graus de
 * elevação para órbitas MEO/GEO ao longo de alguns dias, suficiente para contar
 * satélites acima da máscara e estimar a geometria (DOP). Não substitui o receptor
 * do drone, que vê obstruções reais (prédios, árvores, relevo).
 */
import { fmtNum } from '@/i18n';


export type Constellation = 'gps' | 'galileo' | 'glonass' | 'beidou';

export const CONSTELLATIONS: { id: Constellation; label: string; letter: string; group: string }[] = [
  { id: 'gps', label: 'GPS', letter: 'G', group: 'gps-ops' },
  { id: 'galileo', label: 'Galileo', letter: 'E', group: 'galileo' },
  { id: 'glonass', label: 'GLONASS', letter: 'R', group: 'glo-ops' },
  { id: 'beidou', label: 'BeiDou', letter: 'C', group: 'beidou' },
];

export type OrbitalElements = {
  name: string;
  id: number;
  constellation: Constellation;
  epochMs: number;
  /** rev/dia */
  meanMotion: number;
  ecc: number;
  incDeg: number;
  raanDeg: number;
  argpDeg: number;
  meanAnomDeg: number;
};

export type SatPosition = {
  sat: OrbitalElements;
  azimuth: number;
  elevation: number;
};

const MU = 398600.4418; // km³/s²
const RE = 6378.137; // km
const J2 = 1.08262668e-3;
const F = 1 / 298.257223563;
const D2R = Math.PI / 180;

type OMM = {
  OBJECT_NAME: string;
  NORAD_CAT_ID: number;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
};

export async function fetchConstellation(c: (typeof CONSTELLATIONS)[number], signal?: AbortSignal): Promise<OrbitalElements[]> {
  const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${c.group}&FORMAT=json`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const list = (await res.json()) as OMM[];
  return list
    .filter((o) => Number.isFinite(o.MEAN_MOTION))
    .map((o) => ({
      name: o.OBJECT_NAME,
      id: o.NORAD_CAT_ID,
      constellation: c.id,
      epochMs: Date.parse(o.EPOCH.endsWith('Z') ? o.EPOCH : `${o.EPOCH}Z`),
      meanMotion: o.MEAN_MOTION,
      ecc: o.ECCENTRICITY,
      incDeg: o.INCLINATION,
      raanDeg: o.RA_OF_ASC_NODE,
      argpDeg: o.ARG_OF_PERICENTER,
      meanAnomDeg: o.MEAN_ANOMALY,
    }));
}

/** Todas as constelações em paralelo; uma que falhe não derruba as outras. */
export async function fetchAllConstellations(signal?: AbortSignal) {
  const results = await Promise.allSettled(CONSTELLATIONS.map((c) => fetchConstellation(c, signal)));
  const sats = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const failed = CONSTELLATIONS.filter((_, i) => results[i].status === 'rejected').map((c) => c.id);
  if (sats.length === 0) throw new Error('CelesTrak: no orbital elements');
  return { sats, failed, fetchedAt: Date.now() };
}

/** Posição ECI (km) no instante t. */
function eci(s: OrbitalElements, t: number) {
  const n = (s.meanMotion * 2 * Math.PI) / 86400; // rad/s
  const a = Math.cbrt(MU / (n * n));
  const e = s.ecc;
  const i = s.incDeg * D2R;
  const dt = (t - s.epochMs) / 1000;
  const p = a * (1 - e * e);
  const k = n * J2 * (RE / p) ** 2;
  const raan = s.raanDeg * D2R - 1.5 * k * Math.cos(i) * dt;
  const argp = s.argpDeg * D2R + 0.75 * k * (5 * Math.cos(i) ** 2 - 1) * dt;
  let M = (s.meanAnomDeg * D2R + n * dt) % (2 * Math.PI);
  if (M < 0) M += 2 * Math.PI;
  let E = M;
  for (let j = 0; j < 8; j++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const u = argp + nu;
  const cO = Math.cos(raan);
  const sO = Math.sin(raan);
  const cu = Math.cos(u);
  const su = Math.sin(u);
  const ci = Math.cos(i);
  const si = Math.sin(i);
  return [r * (cO * cu - sO * su * ci), r * (sO * cu + cO * su * ci), r * (su * si)] as const;
}

function gmst(t: number) {
  const jd = t / 86400000 + 2440587.5;
  const deg = 280.46061837 + 360.98564736629 * (jd - 2451545);
  return (((deg % 360) + 360) % 360) * D2R;
}

function observerEcef(latDeg: number, lonDeg: number, hM: number) {
  const lat = latDeg * D2R;
  const lon = lonDeg * D2R;
  const e2 = F * (2 - F);
  const N = RE / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const h = hM / 1000;
  return [(N + h) * Math.cos(lat) * Math.cos(lon), (N + h) * Math.cos(lat) * Math.sin(lon), (N * (1 - e2) + h) * Math.sin(lat)] as const;
}

/** Azimute/elevação de todos os satélites acima do horizonte. */
export function satellitePositions(sats: OrbitalElements[], lat: number, lon: number, hM: number, t: number): SatPosition[] {
  const th = gmst(t);
  const ct = Math.cos(th);
  const st = Math.sin(th);
  const [ox, oy, oz] = observerEcef(lat, lon, hM);
  const la = lat * D2R;
  const lo = lon * D2R;
  const sl = Math.sin(la);
  const cl = Math.cos(la);
  const so = Math.sin(lo);
  const co = Math.cos(lo);
  const out: SatPosition[] = [];
  for (const s of sats) {
    const [x, y, z] = eci(s, t);
    // ECI → ECEF
    const ex = ct * x + st * y;
    const ey = -st * x + ct * y;
    const dx = ex - ox;
    const dy = ey - oy;
    const dz = z - oz;
    // ECEF → ENU
    const east = -so * dx + co * dy;
    const north = -sl * co * dx - sl * so * dy + cl * dz;
    const up = cl * co * dx + cl * so * dy + sl * dz;
    const range = Math.hypot(east, north, up);
    const el = Math.asin(up / range) / D2R;
    if (el < 0) continue;
    const az = ((Math.atan2(east, north) / D2R) + 360) % 360;
    out.push({ sat: s, azimuth: az, elevation: el });
  }
  return out;
}

/** Diluição de precisão a partir da geometria (relógio único, estimativa). */
export function dop(visible: SatPosition[]) {
  if (visible.length < 4) return { pdop: Infinity, hdop: Infinity, vdop: Infinity };
  const N = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (const v of visible) {
    const el = v.elevation * D2R;
    const az = v.azimuth * D2R;
    const row = [-Math.cos(el) * Math.sin(az), -Math.cos(el) * Math.cos(az), -Math.sin(el), 1];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) N[r][c] += row[r] * row[c];
  }
  const Q = invert4(N);
  if (!Q) return { pdop: Infinity, hdop: Infinity, vdop: Infinity };
  return {
    pdop: Math.sqrt(Q[0][0] + Q[1][1] + Q[2][2]),
    hdop: Math.sqrt(Q[0][0] + Q[1][1]),
    vdop: Math.sqrt(Q[2][2]),
  };
}

function invert4(m: number[][]): number[][] | null {
  const a = m.map((r, i) => [...r, ...[0, 1, 2, 3].map((j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return null;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c];
    for (let j = 0; j < 8; j++) a[c][j] /= d;
    for (let r = 0; r < 4; r++) {
      if (r === c) continue;
      const f = a[r][c];
      for (let j = 0; j < 8; j++) a[r][j] -= f * a[c][j];
    }
  }
  return a.map((r) => r.slice(4));
}

export type GnssSnapshot = {
  time: Date;
  visible: SatPosition[];
  byConstellation: Record<Constellation, number>;
  pdop: number;
  hdop: number;
};

export function snapshot(sats: OrbitalElements[], lat: number, lon: number, hM: number, t: number, mask: number): GnssSnapshot {
  const visible = satellitePositions(sats, lat, lon, hM, t).filter((p) => p.elevation >= mask);
  const byConstellation = { gps: 0, galileo: 0, glonass: 0, beidou: 0 } as Record<Constellation, number>;
  for (const v of visible) byConstellation[v.sat.constellation]++;
  const d = dop(visible);
  return { time: new Date(t), visible, byConstellation, pdop: d.pdop, hdop: d.hdop };
}

export function fmtDop(v: number) {
  return fmtNum(v, 1);
}

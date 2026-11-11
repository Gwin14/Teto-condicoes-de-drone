/**
 * Aeródromos cadastrados e afastamento mínimo exigido pelo DECEA.
 *
 * Fonte dos aeródromos: cadastros oficiais da ANAC (públicos + privados), mais as bases
 * listadas pelo aviationweather.gov que não aparecem na ANAC (militares). O snapshot em
 * src/data/aerodromes.json é gerado por scripts/update-aerodromes.ts e, no app, é
 * substituído pela versão baixada da ANAC quando disponível (ver useAerodromes).
 *
 * Regra (ICA 100-40, Central de Ajuda do DECEA, atualizada em 19/08/2026):
 * - voos até 100 ft (~30 m): no mínimo 3 NM (~5,4 km) do aeródromo;
 * - voos de 100 a 400 ft (30–120 m): no mínimo 5 NM (~9 km) do aeródromo.
 * A autorização oficial continua sendo a do DECEA, pelo SARPAS NG.
 */
import snapshot from '@/data/aerodromes.json';

import { t } from '@/i18n';

import type { AerodromeKind, AerodromeRow } from './anac';
import type { Region } from './region';

export type Airport = { icao: string; name: string; city: string; uf: string; lat: number; lon: number; kind: AerodromeKind };

export const NM = 1852;
/** Afastamento mínimo para voos até 100 ft. */
export const MIN_DIST_LOW = 3 * NM;
/** Afastamento mínimo para voos entre 100 e 400 ft. */
export const MIN_DIST_HIGH = 5 * NM;
/** 100 ft em metros. */
export const LOW_CEILING_M = 30.48;


export function rowsToAirports(rows: AerodromeRow[]): Airport[] {
  return rows.map(([icao, name, city, uf, lat, lon, kind]) => ({ icao, name, city, uf, lat, lon, kind }));
}

export const SNAPSHOT_AIRPORTS: Airport[] = rowsToAirports(snapshot.rows as unknown as AerodromeRow[]);
export const SNAPSHOT_INFO = snapshot.sources;

/**
 * Brasil: raios oficiais — vermelho = 3 NM (proibido em qualquer altura), âmbar = 5 NM (proibido acima de 30 m).
 * Fora do Brasil não há regra única: só o círculo de atenção de 5 NM, sem zona "proibida".
 */
export function zoneRadii(region: Region = 'BR') {
  return region === 'BR' ? { critical: MIN_DIST_LOW, caution: MIN_DIST_HIGH } : { critical: 0, caution: MIN_DIST_HIGH };
}

/** Distância mínima exigida para a altura planejada (m AGL). */
export function requiredDistance(altitudeM: number) {
  return altitudeM <= LOW_CEILING_M ? MIN_DIST_LOW : MIN_DIST_HIGH;
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function bearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * clear    — fora de 5 NM: atende o afastamento em qualquer altura até 120 m.
 * caution  — entre 3 e 5 NM: só até 30 m de altura.
 * critical — abaixo do afastamento exigido para a altura planejada.
 */
export type AirspaceStatus = 'clear' | 'caution' | 'critical';

export type NearbyAirport = Airport & { distance: number; bearing: number; zone: AirspaceStatus };

function zoneFor(distance: number, altitudeM: number, region: Region): AirspaceStatus {
  if (region !== 'BR') return distance < MIN_DIST_HIGH ? 'caution' : 'clear';
  if (distance < requiredDistance(altitudeM)) return 'critical';
  if (distance < MIN_DIST_HIGH) return 'caution';
  return 'clear';
}

export function nearbyAirports(list: Airport[], lat: number, lon: number, maxKm: number, altitudeM: number, region: Region = 'BR'): NearbyAirport[] {
  const max = maxKm * 1000;
  // Pré-filtro barato por caixa antes do haversine.
  const dLat = maxKm / 111;
  const dLon = maxKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const out: NearbyAirport[] = [];
  for (const a of list) {
    if (Math.abs(a.lat - lat) > dLat || Math.abs(a.lon - lon) > dLon) continue;
    const distance = haversine(lat, lon, a.lat, a.lon);
    if (distance > max) continue;
    out.push({ ...a, distance, bearing: bearing(lat, lon, a.lat, a.lon), zone: zoneFor(distance, altitudeM, region) });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

export function airspaceAt(
  list: Airport[],
  lat: number,
  lon: number,
  altitudeM: number,
  region: Region = 'BR'
): { status: AirspaceStatus; nearest: NearbyAirport | null } {
  const near = nearbyAirports(list, lat, lon, 50, altitudeM, region);
  const worst = near.find((a) => a.zone === 'critical') ?? near.find((a) => a.zone === 'caution');
  return { status: worst?.zone ?? 'clear', nearest: worst ?? near[0] ?? null };
}

export const kindLabel: Record<AerodromeKind, string> = {
  publico: t('Público'),
  privado: t('Privado'),
  militar: t('Militar'),
  aeroporto: t('Aeroporto'),
};

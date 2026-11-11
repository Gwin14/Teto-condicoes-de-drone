import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { airspaceAt, type Airport, haversine, nearbyAirports, rowsToAirports, SNAPSHOT_AIRPORTS } from '@/lib/airports';
import { ANAC_PRIVATE_URL, ANAC_PUBLIC_URL, decodeLatin1, parseAnacCsv } from '@/lib/anac';
import { findDrone } from '@/lib/drones';
import { fmtSpeed } from '@/lib/format';
import { type Region, regionAt } from '@/lib/region';
import { densityAltitude, findWindows, scoreHour, usableFlightMinutes } from '@/lib/scoring';
import { fetchAllConstellations, snapshot } from '@/lib/gnss';
import { fetchS4Map, fetchSpaceWeather, isS4Fresh, s4At } from '@/lib/spaceWeather';
import { fetchAirportsNear, fetchForecast, fetchKp, fetchMetar, fetchObservationsNear, kpAt } from '@/lib/weather';
import { useApp } from '@/store/app';

export function useForecast(lat?: number, lon?: number) {
  return useQuery({
    queryKey: ['forecast', lat?.toFixed(3), lon?.toFixed(3)],
    queryFn: ({ signal }) => fetchForecast(lat!, lon!, signal),
    enabled: lat != null && lon != null,
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
  });
}

export function useKp() {
  return useQuery({
    queryKey: ['kp'],
    queryFn: ({ signal }) => fetchKp(signal),
    staleTime: 30 * 60_000,
    retry: 1,
  });
}

export function useMetar(icaos: string[]) {
  return useQuery({
    queryKey: ['metar', icaos.join(',')],
    queryFn: ({ signal }) => fetchMetar(icaos, signal),
    enabled: icaos.length > 0,
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

/** Raio e idade máximos para uma estação METAR valer como "condição atual" no ponto. */
const OBS_RADIUS_KM = 25;
const OBS_MAX_AGE_MIN = 90;

/**
 * METARs das estações num raio de 25 km: corrigem nevoeiro, chuva e trovoada da hora corrente.
 * Só no app nativo: o aviationweather.gov não libera CORS para navegadores (na web vale só o modelo).
 */
export function useObservations(lat?: number, lon?: number) {
  return useQuery({
    queryKey: ['metar-near', lat?.toFixed(2), lon?.toFixed(2)],
    queryFn: ({ signal }) => fetchObservationsNear(lat!, lon!, OBS_RADIUS_KM, signal),
    enabled: lat != null && lon != null && process.env.EXPO_OS !== 'web',
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
  });
}

/** Elementos orbitais GNSS (CelesTrak). Mudam devagar: cache longo. */
export function useConstellations() {
  return useQuery({
    queryKey: ['gnss-elements'],
    queryFn: ({ signal }) => fetchAllConstellations(signal),
    staleTime: 6 * 3600_000,
    gcTime: 24 * 3600_000,
    retry: 1,
  });
}

export function useSpaceWeather() {
  return useQuery({
    queryKey: ['space-weather'],
    queryFn: ({ signal }) => fetchSpaceWeather(signal),
    staleTime: 30 * 60_000,
    retry: 1,
  });
}

/**
 * Cintilação medida (mapa S4 do INPE, atualizado a cada minuto com ~40 min de atraso).
 * Só no app nativo: o servidor do INPE não libera CORS para navegadores.
 */
export const S4_AVAILABLE = process.env.EXPO_OS !== 'web';

export function useScintillation() {
  return useQuery({
    queryKey: ['inpe-s4'],
    queryFn: ({ signal }) => fetchS4Map(signal),
    enabled: S4_AVAILABLE,
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
  });
}

async function fetchAnacAerodromes(signal?: AbortSignal): Promise<Airport[]> {
  const get = async (url: string, kind: 'publico' | 'privado') => {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`ANAC: HTTP ${res.status}`);
    return parseAnacCsv(decodeLatin1(await res.arrayBuffer()), kind);
  };
  const [pub, priv] = await Promise.all([get(ANAC_PUBLIC_URL, 'publico'), get(ANAC_PRIVATE_URL, 'privado')]);
  const codes = new Set<string>();
  const list = rowsToAirports([...pub, ...priv]).filter((a) => !codes.has(a.icao) && codes.add(a.icao));
  if (list.length < 1000) throw new Error('ANAC: incomplete registry');
  // Mantém as bases que só existem no aviationweather.gov (militares).
  return [...list, ...SNAPSHOT_AIRPORTS.filter((a) => !codes.has(a.icao))];
}

/**
 * Aeródromos do regime do ponto.
 * - Brasil: começa pelo snapshot oficial embutido e, no app nativo, troca pelo cadastro atual
 *   baixado da ANAC (a web não pode: o servidor não libera CORS).
 * - Fora do Brasil: aeroportos num raio de 160 km pelo aviationweather.gov (só no app nativo).
 */
export function useAerodromes(lat?: number, lon?: number, country?: string): { region: Region; list: Airport[] } {
  const region: Region = lat != null && lon != null ? regionAt(lat, lon, country) : 'BR';
  const anac = useQuery({
    queryKey: ['anac-aerodromes'],
    queryFn: ({ signal }) => fetchAnacAerodromes(signal),
    enabled: region === 'BR' && process.env.EXPO_OS !== 'web',
    staleTime: 7 * 24 * 3600_000,
    gcTime: 7 * 24 * 3600_000,
    retry: 1,
  });
  // Grade de 0,5° para reaproveitar a consulta enquanto o usuário se move pela região.
  const gLat = lat != null ? Math.round(lat * 2) / 2 : undefined;
  const gLon = lon != null ? Math.round(lon * 2) / 2 : undefined;
  const intl = useQuery({
    queryKey: ['airports-near', gLat, gLon],
    queryFn: ({ signal }) => fetchAirportsNear(gLat!, gLon!, 160, signal),
    enabled: region === 'INTL' && gLat != null && gLon != null && process.env.EXPO_OS !== 'web',
    staleTime: 7 * 24 * 3600_000,
    gcTime: 7 * 24 * 3600_000,
    retry: 1,
  });
  return region === 'BR' ? { region, list: anac.data ?? SNAPSHOT_AIRPORTS } : { region, list: intl.data ?? [] };
}

export function useDrone() {
  const droneId = useApp((s) => s.droneId);
  const custom = useApp((s) => s.customDrone);
  return findDrone(droneId, custom);
}

/** Combina previsão + Kp + perfil de drone + altitude planejada em um quadro completo. */
export function useConditions(lat?: number, lon?: number, country?: string) {
  const forecast = useForecast(lat, lon);
  const kp = useKp();
  const sats = useConstellations();
  const space = useSpaceWeather();
  const s4 = useScintillation();
  const metarNear = useObservations(lat, lon);
  const { region, list: aerodromes } = useAerodromes(lat, lon, country);
  const mask = useApp((s) => s.gnssMask);
  const drone = useDrone();
  const altitude = useApp((s) => s.altitude);
  const unit = useApp((s) => s.speedUnit);

  const data = useMemo(() => {
    const f = forecast.data;
    if (!f) return null;
    const fmt = (v: number) => fmtSpeed(v, unit);
    const airspace = airspaceAt(aerodromes, f.lat, f.lon, altitude, region);
    const air = { status: airspace.status, icao: airspace.nearest?.icao, distanceM: airspace.nearest?.distance, region };
    const elements = sats.data?.sats;
    const sw = space.data;
    // Satélites e ionosfera por hora. Elementos orbitais valem bem por ~3 dias.
    const ref = f.fetchedAt;
    const compute = (t: Date) => {
      const ms = t.getTime();
      let gnss;
      if (elements && Math.abs(ms - ref) < 72 * 3600_000) {
        const snap = snapshot(elements, f.lat, f.lon, f.elevation + altitude, ms, mask);
        gnss = { visible: snap.visible.length, gps: snap.byConstellation.gps, pdop: snap.pdop };
      }
      const day = sw ? [sw.now, ...sw.forecast].find((d) => d.date.toDateString() === t.toDateString()) ?? sw.now : null;
      // Cintilação: só existe medição (não há previsão oficial). Vale para a hora corrente.
      const nowish = Math.abs(ms - ref) < 3600_000;
      const reading = nowish ? s4At(s4.data, f.lat, f.lon) : null;
      const spaceIn = { scint: isS4Fresh(reading, ref) ? reading : null, r: day?.r ?? 0, s: day?.s ?? 0 };
      return { gnss, space: spaceIn };
    };
    const cache = new Map<number, ReturnType<typeof compute>>();
    const extraAt = (t: Date) => {
      const key = t.getTime();
      if (!cache.has(key)) cache.set(key, compute(t));
      return cache.get(key)!;
    };
    const hours = f.hours.map((h) => {
      const kpv = kpAt(kp.data, h.time);
      return scoreHour(h, drone, altitude, kpv, fmt, { airspace: air, ...extraAt(h.time) });
    });
    const nowKp = kp.data?.now ?? 0;
    // Estação mais próxima com observação recente: só a hora corrente usa o que foi medido.
    const obs = (metarNear.data ?? [])
      .filter((m) => f.fetchedAt - m.obsTime.getTime() <= OBS_MAX_AGE_MIN * 60_000)
      .map((m) => ({ m, d: haversine(f.lat, f.lon, m.lat, m.lon) }))
      .filter((x) => x.d <= OBS_RADIUS_KM * 1000)
      .sort((a, b) => a.d - b.d)[0];
    const obsIn = obs
      ? {
          icao: obs.m.icao,
          distanceM: obs.d,
          visibilityM: obs.m.visibilityM,
          fog: obs.m.fog,
          thunder: obs.m.thunder,
          rain: obs.m.rain,
          heavyRain: obs.m.heavyRain,
          gustKmh: obs.m.gustKmh,
        }
      : undefined;
    const now = scoreHour(f.current, drone, altitude, nowKp, fmt, { airspace: air, obs: obsIn, ...extraAt(f.current.time) });
    // Janelas consideram só o tempo: a restrição de espaço aéreo vale para o dia todo.
    const weatherOnly = f.hours.map((h) => {
      const kpv = kpAt(kp.data, h.time);
      return scoreHour(h, drone, altitude, kpv, fmt, extraAt(h.time));
    });
    const windows = findWindows(weatherOnly);
    const airports = nearbyAirports(aerodromes, f.lat, f.lon, 60, altitude, region).slice(0, 5);
    const usable = usableFlightMinutes(drone, now.windAlt, f.current.temp);
    const da = densityAltitude(f.current.pressure, f.current.temp);
    return { forecast: f, now, hours, windows, airspace, airports, usable, densityAlt: da, region };
  }, [forecast.data, kp.data, sats.data, space.data, s4.data, metarNear.data, aerodromes, region, mask, drone, altitude, unit]);

  return {
    data,
    drone,
    altitude,
    isLoading: forecast.isLoading,
    isFetching: forecast.isFetching || kp.isFetching,
    error: forecast.error as Error | null,
    kpError: kp.error as Error | null,
    refetch: async () => {
      await Promise.all([forecast.refetch(), kp.refetch()]);
    },
  };
}

export type Conditions = NonNullable<ReturnType<typeof useConditions>['data']>;

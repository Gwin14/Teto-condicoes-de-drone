/**
 * Clientes das fontes de dados públicas (sem chave de API):
 * - Open-Meteo: previsão horária, vento em 10/80/120/180 m, geocodificação.
 * - NOAA SWPC: índice Kp planetário (interferência no GNSS).
 * - aviationweather.gov: METAR dos aeródromos próximos e aeroportos fora do Brasil.
 */
import { lang, t } from '@/i18n';

import type { Airport } from './airports';

export type Hour = {
  time: Date;
  temp: number;
  humidity: number;
  dewPoint: number;
  apparent: number;
  precipProb: number;
  precip: number;
  code: number;
  cloud: number;
  cloudLow: number;
  visibility: number;
  wind10: number;
  wind80: number;
  wind120: number;
  wind180: number;
  dir10: number;
  dir80: number;
  dir120: number;
  dir180: number;
  gust10: number;
  isDay: boolean;
  pressure: number;
  cape: number;
  uv: number;
};

export type Day = {
  date: Date;
  sunrise: Date;
  sunset: Date;
  code: number;
  tMax: number;
  tMin: number;
  precipProbMax: number;
  windMax: number;
  gustMax: number;
  uvMax: number;
  daylightSec: number;
};

export type Forecast = {
  lat: number;
  lon: number;
  elevation: number;
  timezone: string;
  utcOffsetSec: number;
  fetchedAt: number;
  current: Hour;
  hours: Hour[];
  days: Day[];
};

const HOURLY = [
  'temperature_2m',
  'relative_humidity_2m',
  'dew_point_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'cloud_cover_low',
  'visibility',
  'wind_speed_10m',
  'wind_speed_80m',
  'wind_speed_120m',
  'wind_speed_180m',
  'wind_direction_10m',
  'wind_direction_80m',
  'wind_direction_120m',
  'wind_direction_180m',
  'wind_gusts_10m',
  'is_day',
  'surface_pressure',
  'cape',
  'uv_index',
] as const;

const CURRENT = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
] as const;

const DAILY = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'sunrise',
  'sunset',
  'daylight_duration',
  'uv_index_max',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
] as const;

/** Converte "2026-11-06T14:00" (horário local do ponto) para Date absoluto. */
function parseLocal(s: string, utcOffsetSec: number) {
  const [d, t = '00:00'] = s.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, da, h, mi) - utcOffsetSec * 1000);
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

type OMResponse = {
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  utc_offset_seconds: number;
  current: Record<string, number | string>;
  hourly: Record<string, (number | null)[]> & { time: string[] };
  daily: Record<string, (number | string | null)[]> & { time: string[] };
};

export async function fetchForecast(lat: number, lon: number, signal?: AbortSignal): Promise<Forecast> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    `&hourly=${HOURLY.join(',')}&current=${CURRENT.join(',')}&daily=${DAILY.join(',')}` +
    `&timezone=auto&forecast_days=7&past_hours=1&wind_speed_unit=kmh`;
  const r = await getJson<OMResponse>(url, signal);
  const off = r.utc_offset_seconds;
  const H = r.hourly;
  const n = (k: string, i: number, fallback = 0) => {
    const v = H[k]?.[i];
    return v == null || Number.isNaN(v) ? fallback : (v as number);
  };
  // Sem valores inventados: se um nível de vento faltar, usa o nível real logo abaixo.
  const hours: Hour[] = H.time.map((t, i) => {
    const w10 = n('wind_speed_10m', i);
    const w80 = n('wind_speed_80m', i, w10);
    const w120 = n('wind_speed_120m', i, w80);
    const d10 = n('wind_direction_10m', i);
    const d80 = n('wind_direction_80m', i, d10);
    const d120 = n('wind_direction_120m', i, d80);
    return {
      time: parseLocal(t, off),
      temp: n('temperature_2m', i),
      humidity: n('relative_humidity_2m', i),
      dewPoint: n('dew_point_2m', i),
      apparent: n('apparent_temperature', i),
      precipProb: n('precipitation_probability', i),
      precip: n('precipitation', i),
      code: n('weather_code', i),
      cloud: n('cloud_cover', i),
      cloudLow: n('cloud_cover_low', i),
      visibility: n('visibility', i, NaN),
      wind10: w10,
      wind80: w80,
      wind120: w120,
      wind180: n('wind_speed_180m', i, w120),
      dir10: d10,
      dir80: d80,
      dir120: d120,
      dir180: n('wind_direction_180m', i, d120),
      gust10: n('wind_gusts_10m', i),
      isDay: n('is_day', i) === 1,
      pressure: n('surface_pressure', i, NaN),
      cape: n('cape', i),
      uv: n('uv_index', i),
    };
  });

  const D = r.daily;
  const dn = (k: string, i: number) => Number(D[k]?.[i] ?? 0);
  const days: Day[] = D.time.map((t, i) => ({
    date: parseLocal(t, off),
    sunrise: parseLocal(String(D.sunrise[i]), off),
    sunset: parseLocal(String(D.sunset[i]), off),
    code: dn('weather_code', i),
    tMax: dn('temperature_2m_max', i),
    tMin: dn('temperature_2m_min', i),
    precipProbMax: dn('precipitation_probability_max', i),
    windMax: dn('wind_speed_10m_max', i),
    gustMax: dn('wind_gusts_10m_max', i),
    uvMax: dn('uv_index_max', i),
    daylightSec: dn('daylight_duration', i),
  }));

  // "current" do Open-Meteo não traz vento em altitude: os níveis de 80–180 m vêm da hora vigente, sem ajuste.
  const now = Date.now();
  let idx = hours.findIndex((h) => h.time.getTime() > now) - 1;
  if (idx < 0) idx = 0;
  const base = hours[idx];
  const C = r.current;
  const c = (k: string, fb: number) => (C[k] == null ? fb : Number(C[k]));
  const current: Hour = {
    ...base,
    time: new Date(now),
    temp: c('temperature_2m', base.temp),
    humidity: c('relative_humidity_2m', base.humidity),
    apparent: c('apparent_temperature', base.apparent),
    precip: c('precipitation', base.precip),
    code: c('weather_code', base.code),
    cloud: c('cloud_cover', base.cloud),
    pressure: c('surface_pressure', base.pressure),
    wind10: c('wind_speed_10m', base.wind10),
    dir10: c('wind_direction_10m', base.dir10),
    gust10: c('wind_gusts_10m', base.gust10),
    isDay: c('is_day', base.isDay ? 1 : 0) === 1,
  };

  return {
    lat: r.latitude,
    lon: r.longitude,
    elevation: r.elevation,
    timezone: r.timezone,
    utcOffsetSec: off,
    fetchedAt: now,
    current,
    hours: hours.filter((h) => h.time.getTime() >= now - 3600_000),
    days,
  };
}

/* ---------------------------------------------------------------- Kp (NOAA) */

export type KpPoint = { time: Date; kp: number; observed: boolean };
export type KpData = { now: number; points: KpPoint[]; max24h: number };

function parseSwpcTime(s: string) {
  // "2026-11-06 12:00:00.000" ou "2026-11-06T12:00:00" (UTC)
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  return new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
}

/** Aceita tanto o formato antigo (matriz com cabeçalho) quanto o de objetos. */
function normalizeKp(raw: unknown, forecast: boolean): KpPoint[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (Array.isArray(raw[0])) {
    const [header, ...rows] = raw as string[][];
    const ti = header.findIndex((h) => /time/i.test(h));
    const ki = header.findIndex((h) => /^kp$/i.test(h) || /kp/i.test(h));
    const oi = header.findIndex((h) => /observed/i.test(h));
    return rows.map((r) => ({
      time: parseSwpcTime(String(r[ti])),
      kp: Number(r[ki]),
      observed: forecast ? String(r[oi]) === 'observed' : true,
    }));
  }
  return (raw as Record<string, unknown>[]).map((o) => ({
    time: parseSwpcTime(String(o.time_tag ?? o.time ?? '')),
    kp: Number(o.kp ?? o.kp_index ?? o.Kp ?? o.estimated_kp ?? 0),
    observed: forecast ? String(o.observed ?? 'predicted') === 'observed' : true,
  }));
}

export async function fetchKp(signal?: AbortSignal): Promise<KpData> {
  const raw = await getJson<unknown>(
    'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json',
    signal
  );
  const points = normalizeKp(raw, true).filter((p) => Number.isFinite(p.kp));
  const now = Date.now();
  const past = points.filter((p) => p.time.getTime() <= now);
  const current = past.length ? past[past.length - 1].kp : (points[0]?.kp ?? 0);
  const next24 = points.filter((p) => p.time.getTime() > now - 3 * 3600_000 && p.time.getTime() < now + 24 * 3600_000);
  return {
    now: current,
    points: points.filter((p) => p.time.getTime() > now - 24 * 3600_000 && p.time.getTime() < now + 72 * 3600_000),
    max24h: next24.reduce((m, p) => Math.max(m, p.kp), current),
  };
}

export function kpAt(kp: KpData | undefined, t: Date) {
  if (!kp || kp.points.length === 0) return kp?.now ?? 0;
  let best = kp.points[0];
  for (const p of kp.points) {
    if (p.time.getTime() <= t.getTime()) best = p;
  }
  return best.kp;
}

/* --------------------------------------------------------------- Geocoding */

export type Place = {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lon: number;
  /** ISO 3166-1 alfa-2, quando o geocodificador informa. */
  country?: string;
};

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  if (q.trim().length < 2) return [];
  const r = await getJson<{
    results?: { id: number; name: string; admin1?: string; country?: string; country_code?: string; latitude: number; longitude: number }[];
  }>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=12&language=${lang}&format=json`,
    signal
  );
  return (r.results ?? []).map((p) => ({
    id: String(p.id),
    name: p.name,
    detail: [p.admin1, p.country].filter(Boolean).join(', '),
    lat: p.latitude,
    lon: p.longitude,
    country: p.country_code,
  }));
}

/* ------------------------------------------------- Aeroportos fora do Brasil */

/**
 * Aeroportos num raio de `km` pelo aviationweather.gov (base global da FAA). Cobre bem os
 * aeroportos com operação regular; pistas pequenas e helipontos podem faltar.
 */
export async function fetchAirportsNear(lat: number, lon: number, km: number, signal?: AbortSignal): Promise<Airport[]> {
  const dLat = km / 111;
  const dLon = km / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((v) => v.toFixed(3)).join(',');
  // `airport` só devolve os aeroportos principais; `stationinfo` cobre os aeródromos menores com METAR.
  const [major, stations] = await Promise.allSettled([
    getJson<Record<string, unknown>[]>(`https://aviationweather.gov/api/data/airport?bbox=${bbox}&format=json`, signal),
    getJson<Record<string, unknown>[]>(`https://aviationweather.gov/api/data/stationinfo?bbox=${bbox}&format=json`, signal),
  ]);
  const title = (s: string) => s.trim().toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (_, p: string, l: string) => p + l.toUpperCase());
  const out = new Map<string, Airport>();
  const add = (icao: unknown, name: unknown, country: unknown, lat: unknown, lon: unknown) => {
    const code = String(icao ?? '');
    if (!/^[A-Z0-9]{4}$/.test(code) || typeof lat !== 'number' || typeof lon !== 'number' || out.has(code)) return;
    out.set(code, { icao: code, name: title(String(name ?? code)), city: '', uf: String(country ?? ''), lat, lon, kind: 'aeroporto' });
  };
  if (major.status === 'fulfilled') for (const a of major.value) add(a.icaoId, a.name, a.country, a.lat, a.lon);
  if (stations.status === 'fulfilled') {
    for (const s of stations.value) {
      const types = Array.isArray(s.siteType) ? (s.siteType as string[]) : [];
      if (types.includes('METAR')) add(s.icaoId, s.site, s.country, s.lat, s.lon);
    }
  }
  if (out.size === 0 && major.status === 'rejected' && stations.status === 'rejected') throw major.reason;
  return [...out.values()];
}

/* ------------------------------------------------------------------- METAR */

export type Metar = {
  icao: string;
  name: string;
  raw: string;
  obsTime: Date;
  windKt: number | null;
  windDir: number | null;
  gustKt: number | null;
  visibility: string | null;
  temp: number | null;
  dew: number | null;
  qnh: number | null;
  category: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | null;
};

export async function fetchMetar(icaos: string[], signal?: AbortSignal): Promise<Metar[]> {
  if (icaos.length === 0) return [];
  const r = await getJson<Record<string, unknown>[]>(
    `https://aviationweather.gov/api/data/metar?ids=${icaos.join(',')}&format=json`,
    signal
  );
  return r.map((m) => ({
    icao: String(m.icaoId ?? ''),
    name: String(m.name ?? ''),
    raw: String(m.rawOb ?? ''),
    obsTime: new Date(typeof m.obsTime === 'number' ? m.obsTime * 1000 : String(m.reportTime ?? Date.now())),
    windKt: typeof m.wspd === 'number' ? m.wspd : null,
    windDir: typeof m.wdir === 'number' ? m.wdir : null,
    gustKt: typeof m.wgst === 'number' ? m.wgst : null,
    visibility: m.visib == null ? null : String(m.visib),
    temp: typeof m.temp === 'number' ? m.temp : null,
    dew: typeof m.dewp === 'number' ? m.dewp : null,
    qnh: typeof m.altim === 'number' ? m.altim : null,
    category: (['VFR', 'MVFR', 'IFR', 'LIFR'].includes(String(m.fltCat)) ? m.fltCat : null) as Metar['category'],
  }));
}

/* ---------------------------------------------------- Observação próxima */

export type NearObservation = {
  icao: string;
  lat: number;
  lon: number;
  obsTime: Date;
  raw: string;
  windKmh: number | null;
  gustKmh: number | null;
  /** Metros, lidos do METAR bruto (9999 e CAVOK = 10 000). */
  visibilityM: number | null;
  fog: boolean;
  thunder: boolean;
  rain: boolean;
  heavyRain: boolean;
};

/** Decodifica visibilidade e tempo presente do corpo do METAR (sem a parte RMK). */
export function decodeMetarWeather(raw: string) {
  const body = raw.replace(/\sRMK\b.*$/, '');
  const toks = body.split(/\s+/).slice(2);
  let visibilityM: number | null = null;
  if (/\bCAVOK\b/.test(body)) visibilityM = 10000;
  else {
    const v = toks.find((t) => /^\d{4}$/.test(t));
    if (v) visibilityM = v === '9999' ? 10000 : Number(v);
  }
  // Grupos de tempo presente: intensidade/proximidade + descritor + fenômeno (ex.: -TSRA, VCSH, BR).
  const wx = toks.filter((t) => /^(\+|-|VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|PL|GR|GS|UP|BR|FG|FU|HZ|SA|DU|SQ|FC)*$/.test(t) && /[A-Z]{2}/.test(t) && !/^(NSC|NCD|SKC|CLR|NOSIG|AUTO|COR|CAVOK)$/.test(t));
  const here = wx.filter((t) => !t.startsWith('VC'));
  return {
    visibilityM,
    fog: here.some((t) => /FG/.test(t) && !/^(MI|BC|PR)FG$/.test(t)),
    thunder: wx.some((t) => /TS/.test(t)),
    rain: here.some((t) => /(RA|DZ)/.test(t)),
    heavyRain: here.some((t) => /^\+.*RA/.test(t)),
  };
}

/** METARs das estações num raio de `km` (consulta por caixa no aviationweather.gov). */
export async function fetchObservationsNear(lat: number, lon: number, km: number, signal?: AbortSignal): Promise<NearObservation[]> {
  const dLat = km / 111;
  const dLon = km / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((v) => v.toFixed(3)).join(',');
  const r = await getJson<Record<string, unknown>[]>(`https://aviationweather.gov/api/data/metar?bbox=${bbox}&format=json`, signal);
  return r
    .filter((m) => typeof m.lat === 'number' && typeof m.lon === 'number' && typeof m.obsTime === 'number')
    .map((m) => {
      const raw = String(m.rawOb ?? '');
      return {
        icao: String(m.icaoId ?? ''),
        lat: m.lat as number,
        lon: m.lon as number,
        obsTime: new Date((m.obsTime as number) * 1000),
        raw,
        windKmh: typeof m.wspd === 'number' ? m.wspd * 1.852 : null,
        gustKmh: typeof m.wgst === 'number' ? m.wgst * 1.852 : null,
        ...decodeMetarWeather(raw),
      };
    });
}

/* -------------------------------------------------------------- WMO codes */

export function weatherLabel(code: number) {
  if (code === 0) return t('Céu limpo');
  if (code === 1) return t('Predomínio de sol');
  if (code === 2) return t('Parcialmente nublado');
  if (code === 3) return t('Nublado');
  if (code === 45 || code === 48) return t('Nevoeiro');
  if (code >= 51 && code <= 57) return t('Garoa');
  if (code >= 61 && code <= 67) return t('Chuva');
  if (code >= 71 && code <= 77) return t('Neve');
  if (code >= 80 && code <= 82) return t('Pancadas de chuva');
  if (code >= 85 && code <= 86) return t('Pancadas de neve');
  if (code >= 95) return t('Trovoada');
  return t('Tempo variável');
}

export type WeatherIcon = 'sun' | 'moon' | 'cloudSun' | 'cloudMoon' | 'cloud' | 'fog' | 'rain' | 'storm' | 'snow';

export function weatherIcon(code: number, isDay: boolean): WeatherIcon {
  if (code === 0 || code === 1) return isDay ? 'sun' : 'moon';
  if (code === 2) return isDay ? 'cloudSun' : 'cloudMoon';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloud';
}

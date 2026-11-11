/**
 * Clima espacial que afeta GNSS e rádio:
 * - Escalas NOAA: R (rádio/erupções solares), S (radiação), G (geomagnética).
 * - Fluxo solar F10.7 (atividade do ciclo solar).
 * - Cintilação ionosférica MEDIDA: mapas S4 do Programa EMBRACE/INPE, gerados a partir
 *   das redes de monitoramento GNSS do INPE, IBGE, INCT GNSS-NavAer/UNESP e NSSC/CAS.
 *   O Brasil fica sob a Anomalia de Ionização Equatorial: após o pôr do sol surgem
 *   "bolhas de plasma" que fazem o sinal GNSS oscilar e o receptor perder satélites.
 */
import { t } from '@/i18n';


export type ScaleLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type ScaleDay = {
  date: Date;
  r: ScaleLevel;
  s: ScaleLevel;
  g: ScaleLevel;
  /** Probabilidades (%) de R1–R2, R3+ e S1+ quando é previsão. */
  rMinorProb?: number;
  rMajorProb?: number;
  sProb?: number;
};

export type SpaceWeather = {
  now: ScaleDay;
  forecast: ScaleDay[];
  f107: number | null;
  fetchedAt: number;
};

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const lvl = (v: unknown): ScaleLevel => {
  const n = Number(v);
  return (Number.isFinite(n) ? Math.max(0, Math.min(5, Math.round(n))) : 0) as ScaleLevel;
};
const num = (v: unknown) => (v == null || v === '' ? undefined : Number(v));

type ScalesEntry = {
  DateStamp?: string;
  TimeStamp?: string;
  R?: { Scale?: string | null; MinorProb?: string | null; MajorProb?: string | null };
  S?: { Scale?: string | null; Prob?: string | null };
  G?: { Scale?: string | null };
};

export async function fetchSpaceWeather(signal?: AbortSignal): Promise<SpaceWeather> {
  const [scales, flux] = await Promise.allSettled([
    getJson<Record<string, ScalesEntry>>('https://services.swpc.noaa.gov/products/noaa-scales.json', signal),
    getJson<{ Flux?: string | number } | { Flux?: string | number }[]>('https://services.swpc.noaa.gov/products/summary/10cm-flux.json', signal),
  ]);
  if (scales.status === 'rejected') throw scales.reason;
  const toDay = (e: ScalesEntry | undefined): ScaleDay => ({
    date: e?.DateStamp ? new Date(`${e.DateStamp}T${e.TimeStamp ?? '00:00:00'}Z`) : new Date(),
    r: lvl(e?.R?.Scale),
    s: lvl(e?.S?.Scale),
    g: lvl(e?.G?.Scale),
    rMinorProb: num(e?.R?.MinorProb),
    rMajorProb: num(e?.R?.MajorProb),
    sProb: num(e?.S?.Prob),
  });
  let f107: number | null = null;
  if (flux.status === 'fulfilled') {
    const v = Array.isArray(flux.value) ? flux.value[0]?.Flux : flux.value?.Flux;
    const n = Number(v);
    f107 = Number.isFinite(n) ? n : null;
  }
  return {
    now: toDay(scales.value['0']),
    forecast: ['1', '2', '3'].map((k) => toDay(scales.value[k])).filter((d) => !Number.isNaN(d.date.getTime())),
    f107,
    fetchedAt: Date.now(),
  };
}

export const scaleText = {
  r: [t('Sem apagões de rádio'), t('Menor'), t('Moderado'), t('Forte'), t('Severo'), t('Extremo')],
  s: [t('Sem tempestade de radiação'), t('Menor'), t('Moderada'), t('Forte'), t('Severa'), t('Extrema')],
  g: [t('Sem tempestade geomagnética'), t('Menor'), t('Moderada'), t('Forte'), t('Severa'), t('Extrema')],
};


/* -------------------------------------------- Cintilação ionosférica (INPE) */

/**
 * Mapas S4 do EMBRACE/INPE: grade regular de 0,5° cobrindo lon −140°…−20° e
 * lat −60°…50° (240 colunas × 220 linhas, primeira linha no sul), um arquivo por
 * minuto, publicados com ~40 min de atraso. Células sem dado valem −1.
 * Documentação: https://embracedata.inpe.br/scintillation/maps/readme_scintillation_maps.html
 */
const S4_BASE = 'https://embracedata.inpe.br/scintillation/maps/s4';
const GRID = { lon0: -140, lat0: -60, step: 0.5, cols: 240, rows: 220 };

export type S4Map = { time: Date; grid: Float32Array; fetchedAt: number };

/** Classificação do INPE para o índice S4. */
export type ScintLevel = 'fraca' | 'moderada' | 'forte';

export function s4Level(s4: number): ScintLevel {
  return s4 >= 0.8 ? 'forte' : s4 >= 0.5 ? 'moderada' : 'fraca';
}

function dayOfYear(d: Date) {
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400_000) + 1;
}

async function latestS4File(signal?: AbortSignal) {
  const now = new Date();
  for (const back of [0, 1]) {
    const d = new Date(now.getTime() - back * 86400_000);
    const dir = `${S4_BASE}/${d.getUTCFullYear()}/${String(dayOfYear(d)).padStart(3, '0')}/`;
    const res = await fetch(`${dir}?C=N;O=D`, { signal });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`INPE: HTTP ${res.status}`);
    const m = /S4_MAP_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})\.txt/.exec(await res.text());
    if (m) {
      const [name, y, mo, da, h, mi] = m;
      return { url: dir + name, time: new Date(Date.UTC(+y, +mo - 1, +da, +h, +mi)) };
    }
  }
  throw new Error('INPE: no recent S4 map');
}

export async function fetchS4Map(signal?: AbortSignal): Promise<S4Map> {
  const file = await latestS4File(signal);
  const res = await fetch(file.url, { signal });
  if (!res.ok) throw new Error(`INPE: HTTP ${res.status}`);
  const text = await res.text();
  const grid = new Float32Array(GRID.cols * GRID.rows).fill(NaN);
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < GRID.rows) throw new Error('INPE: incomplete S4 map');
  for (let r = 0; r < GRID.rows; r++) {
    const cells = lines[r].split(';');
    for (let c = 0; c < GRID.cols; c++) {
      const v = Number(cells[c]);
      if (Number.isFinite(v) && v >= 0) grid[r * GRID.cols + c] = v;
    }
  }
  return { time: file.time, grid, fetchedAt: Date.now() };
}

export type ScintReading = {
  s4: number;
  level: ScintLevel;
  /** Momento da medição (UTC). */
  time: Date;
  /** Distância (km) da célula com dado mais próxima. */
  distanceKm: number;
};

/**
 * Valor S4 medido no ponto: célula da grade ou, se vazia, a mais próxima com dado
 * num raio de 1° (as estações enxergam a ionosfera em volta, não só a vertical).
 * Sem cobertura → null: o app não inventa um valor.
 */
export function s4At(map: S4Map | undefined, lat: number, lon: number): ScintReading | null {
  if (!map) return null;
  const c0 = Math.floor((lon - GRID.lon0) / GRID.step);
  const r0 = Math.floor((lat - GRID.lat0) / GRID.step);
  let best: { v: number; d: number } | null = null;
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const r = r0 + dr;
      const c = c0 + dc;
      if (r < 0 || c < 0 || r >= GRID.rows || c >= GRID.cols) continue;
      const v = map.grid[r * GRID.cols + c];
      if (Number.isNaN(v)) continue;
      const cLat = GRID.lat0 + (r + 0.5) * GRID.step;
      const cLon = GRID.lon0 + (c + 0.5) * GRID.step;
      const d = Math.hypot(cLat - lat, (cLon - lon) * Math.cos((lat * Math.PI) / 180)) * 111;
      if (!best || d < best.d) best = { v, d };
    }
  }
  if (!best) return null;
  return { s4: best.v, level: s4Level(best.v), time: map.time, distanceKm: best.d };
}

/** Medição com mais de 3 h não representa mais "agora". */
export function isS4Fresh(r: ScintReading | null, now = Date.now()) {
  return !!r && now - r.time.getTime() < 3 * 3600_000;
}

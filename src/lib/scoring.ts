import { fmtNum, t } from '@/i18n';
import type { Verdict } from '@/theme/tokens';

import type { DroneProfile } from './drones';
import { clamp } from './format';
import type { ScintReading } from './spaceWeather';
import type { Hour } from './weather';

export type FactorId =
  | 'wind'
  | 'gust'
  | 'precip'
  | 'visibility'
  | 'cloudbase'
  | 'temperature'
  | 'kp'
  | 'daylight'
  | 'storm'
  | 'airspace'
  | 'satellites'
  | 'ionosphere';

export type Factor = {
  id: FactorId;
  label: string;
  status: Verdict;
  penalty: number;
  /** Valor principal já interpretado, ex.: "18 km/h · 47% do limite". */
  detail: string;
};

export type HourScore = {
  hour: Hour;
  score: number;
  verdict: Verdict;
  windAlt: number;
  gustAlt: number;
  dirAlt: number;
  cloudBase: number;
  kp: number;
  gnss?: GnssInput;
  factors: Factor[];
};

/** Interpolação linear por trechos: `knots` são pares [x, y] em ordem crescente de x. */
function ramp(x: number, knots: [number, number][]) {
  if (x <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    const [x1, y1] = knots[i];
    if (x <= x1) {
      const [x0, y0] = knots[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  // Além do último ponto, segue a inclinação do último trecho.
  const [xa, ya] = knots[knots.length - 2];
  const [xb, yb] = knots[knots.length - 1];
  return yb + ((x - xb) / (xb - xa)) * (yb - ya);
}

/**
 * Interpola o vento entre os níveis do modelo (10/80/120/180 m) em escala logarítmica de altura:
 * o perfil de vento na camada limite cresce com ln(z), então a interpolação linear em metros
 * subestimava o vento entre 10 e 80 m (~8% a 30 m).
 */
export function windAtAltitude(h: Hour, alt: number) {
  const levels = [
    { a: 10, v: h.wind10, d: h.dir10 },
    { a: 80, v: h.wind80, d: h.dir80 },
    { a: 120, v: h.wind120, d: h.dir120 },
    { a: 180, v: h.wind180, d: h.dir180 },
  ];
  if (alt <= 10) return { speed: h.wind10, dir: h.dir10 };
  for (let i = 0; i < levels.length - 1; i++) {
    const lo = levels[i];
    const hi = levels[i + 1];
    if (alt <= hi.a) {
      const t = Math.log(alt / lo.a) / Math.log(hi.a / lo.a);
      return { speed: lo.v + (hi.v - lo.v) * t, dir: interpAngle(lo.d, hi.d, t) };
    }
  }
  return { speed: h.wind180, dir: h.dir180 };
}

function interpAngle(a: number, b: number, t: number) {
  const diff = ((b - a + 540) % 360) - 180;
  return (a + diff * t + 360) % 360;
}

/** Base de nuvens estimada (fórmula do spread: ~125 m por °C entre temperatura e orvalho). */
export function cloudBaseMeters(h: Hour) {
  return Math.max(0, (h.temp - h.dewPoint) * 125);
}

export type AirspaceInput = { status: 'clear' | 'caution' | 'critical'; icao?: string; distanceM?: number; region?: 'BR' | 'INTL' };

/** Satélites visíveis (céu aberto, acima da máscara) e geometria estimada. */
export type GnssInput = { visible: number; gps: number; pdop: number };

/** Clima espacial: cintilação medida pelo INPE (só na hora corrente) e escalas NOAA de rádio (R) e radiação (S). */
export type SpaceInput = { scint: ScintReading | null; r: number; s: number };

/**
 * Observação real (METAR) de uma estação próxima, usada só na hora corrente.
 * Corrige os campos em que o modelo mais erra: nevoeiro/visibilidade, chuva e trovoada presentes.
 */
export type ObservationInput = {
  icao: string;
  distanceM: number;
  /** Visibilidade horizontal em metros (9999/CAVOK = 10 000). */
  visibilityM: number | null;
  fog: boolean;
  thunder: boolean;
  rain: boolean;
  heavyRain: boolean;
  gustKmh: number | null;
};

export type ExtraInputs = { airspace?: AirspaceInput; gnss?: GnssInput; space?: SpaceInput; obs?: ObservationInput };

/** Garoa/chuva/pancada fraca (WMO 51–61, 80) vs. chuva moderada ou forte (63+, 81+). */
const HEAVY_CODES = new Set([63, 65, 66, 67, 81, 82]);
const RAIN_CODES = new Set([53, 55, 56, 57, 61, 80]);

export function scoreHour(
  h: Hour,
  drone: DroneProfile,
  altitude: number,
  kp: number,
  fmtWind: (kmh: number) => string,
  extra: ExtraInputs = {}
): HourScore {
  const { airspace, gnss, space, obs } = extra;
  const factors: Factor[] = [];
  const w = windAtAltitude(h, altitude);
  // Rajadas em altitude: a parcela turbulenta (rajada − vento médio) quase não muda com a altura
  // na camada de superfície (σu ≈ constante), então soma-se ao vento médio da altitude.
  // Multiplicar a rajada de 10 m pelo gradiente do vento contava o aumento duas vezes.
  // A rajada do modelo é o pico da hora inteira; num voo de 20–30 min o pico esperado é menor
  // (×0,8 calibrado contra METAR). Rajada medida pela estação entra sem desconto.
  const obsGust = obs?.gustKmh != null && obs.gustKmh > h.gust10 * 0.8 ? obs.gustKmh : null;
  const gustExcess = obsGust != null ? Math.max(0, obsGust - h.wind10) : Math.max(0, h.gust10 - h.wind10) * 0.8;
  const gustAlt = w.speed + gustExcess;
  const base = cloudBaseMeters(h);

  // Vento sustentado: curva contínua (sem saltos entre faixas). 60% do limite já pede cautela;
  // a partir de 90% o drone fica sem margem para voltar contra o vento.
  const rw = w.speed / drone.maxWind;
  const pw = Math.max(
    0,
    ramp(rw, [
      [0, 0],
      [0.5, 5],
      [0.6, 10],
      [0.7, 18],
      [0.8, 32],
      [0.9, 50],
      [1, 65],
    ])
  );
  const sw: Verdict = rw >= 0.9 ? 'nogo' : rw >= 0.6 ? 'caution' : 'go';
  factors.push({
    id: 'wind',
    label: t('Vento'),
    status: sw,
    penalty: pw,
    detail: t('{wind} a {alt} m · {pct}% do limite', { wind: fmtWind(w.speed), alt: altitude, pct: Math.round(rw * 100) }),
  });

  // Rajadas: picos de poucos segundos toleram um pouco acima do limite sustentado (×1,2);
  // o drone deriva, mas não perde o controle.
  const rg = gustAlt / (drone.maxWind * 1.2);
  const pg = ramp(rg, [
    [0, 0],
    [0.6, 0],
    [0.75, 6],
    [0.9, 18],
    [1, 35],
    [1.2, 60],
  ]);
  const sg: Verdict = rg >= 1 ? 'nogo' : rg >= 0.75 ? 'caution' : 'go';
  factors.push({
    id: 'gust',
    label: t('Rajadas'),
    status: sg,
    penalty: pg,
    detail:
      t('{gust} · variação de {delta}', { gust: fmtWind(gustAlt), delta: fmtWind(gustExcess) }) +
      (obsGust != null ? ` · ${t('medida em {icao}', { icao: obs!.icao })}` : ''),
  });

  // Trovoada / instabilidade. CAPE sozinho não é trovoada: no Brasil ele passa de 1500 em muitas
  // noites limpas. Comparado com METAR, "CAPE ≥ 1000 com chuva ≥ 60%" acertou as trovoadas
  // observadas com bem menos alarmes falsos que "CAPE > 1500".
  const thunderObs = obs?.thunder ?? false;
  const storm = thunderObs || h.code >= 95 || (h.cape >= 1000 && h.precipProb >= 60);
  const showers = !storm && h.cape >= 800 && h.precipProb >= 30;
  const unstable = !storm && !showers && h.cape >= 1500 && h.isDay;
  if (storm || showers || unstable) {
    factors.push({
      id: 'storm',
      label: t('Instabilidade'),
      status: storm ? 'nogo' : 'caution',
      penalty: storm ? 80 : showers ? 12 : 4,
      detail: thunderObs
        ? t('Trovoada observada em {icao}', { icao: obs!.icao })
        : storm
          ? t('Risco de trovoada e descargas')
          : showers
            ? t('Pancadas isoladas possíveis (CAPE {cape})', { cape: Math.round(h.cape) })
            : t('Ar instável, térmicas fortes (CAPE {cape})', { cape: Math.round(h.cape) }),
    });
  }

  // Precipitação. O código WMO 51 (garoa fraca) aparece com frequência sem chuva medida,
  // por isso só conta como chuva com volume (≥ 0,2 mm/h) ou código de chuva de fato.
  // Chuva leve prevista com probabilidade baixa vira cautela, não proibição.
  const heavy = h.precip >= 1 || HEAVY_CODES.has(h.code) || (obs?.heavyRain ?? false);
  let raining = heavy || h.precip >= 0.2 || RAIN_CODES.has(h.code) || (obs?.rain ?? false);
  // Estação próxima seca agora: o modelo provavelmente errou o horário/local da chuva.
  const obsDry = obs != null && !obs.rain && !obs.thunder && obs.distanceM <= 15000;
  const likely = heavy || obs?.rain || h.precipProb >= 50;
  let pp = 0;
  let sp: Verdict = 'go';
  if (raining && obsDry && !heavy) raining = false;
  if (raining && likely) {
    pp = drone.rainProof ? (heavy ? 20 : 10) : 55;
    sp = drone.rainProof ? 'caution' : 'nogo';
  } else if (raining) {
    pp = drone.rainProof ? 6 : 25;
    sp = 'caution';
  } else {
    const p = ramp(h.precipProb, [
      [0, 0],
      [20, 0],
      [60, 15],
      [100, 30],
    ]);
    pp = drone.rainProof ? p / 4 : p;
    sp = h.precipProb >= 40 ? 'caution' : 'go';
  }
  factors.push({
    id: 'precip',
    label: t('Chuva'),
    status: sp,
    penalty: pp,
    detail: obs?.rain
      ? t('Chovendo em {icao}', { icao: obs.icao })
      : raining
        ? t('{mm} mm/h previstos · {pct}% de chance', { mm: fmtNum(h.precip, 1), pct: Math.round(h.precipProb) })
        : t('{pct}% de chance', { pct: Math.round(h.precipProb) }),
  });

  // Visibilidade (VLOS). A visibilidade do modelo é o campo menos confiável da previsão:
  // na comparação com METAR, todo nevoeiro previsto foi alarme falso. Sem observação, nevoeiro
  // previsto é cautela forte; com METAR, vale o que a estação mede.
  const visM = obs?.visibilityM ?? h.visibility;
  const fogModel = h.code === 45 || h.code === 48 || h.visibility < 1000;
  const fog = obs ? obs.fog || (obs.visibilityM != null && obs.visibilityM < 1000) : fogModel;
  let pv = 0;
  let sv: Verdict = 'go';
  if (fog) {
    pv = obs ? 50 : 35;
    sv = obs ? 'nogo' : 'caution';
  } else if (visM < 3000) {
    pv = obs ? 20 : 12;
    sv = 'caution';
  } else if (visM < 5000) {
    pv = 3;
  }
  const visSrc = obs?.visibilityM != null ? ` · ${obs.icao}` : '';
  factors.push({
    id: 'visibility',
    label: t('Visibilidade'),
    status: sv,
    penalty: pv,
    detail: fog
      ? obs
        ? t('Nevoeiro em {icao}', { icao: obs.icao })
        : t('Nevoeiro previsto')
      : Number.isNaN(visM)
        ? t('Sem dado do modelo')
        : visM >= 20000
          ? t('Acima de 20 km')
          : visM >= 10000 && obs?.visibilityM != null
            ? t('10 km ou mais') + visSrc
            : `${fmtNum(visM / 1000, 1)} km${visSrc}`,
  });

  // Base de nuvens vs altitude planejada
  let pc = 0;
  let sc: Verdict = 'go';
  if (h.cloudLow >= 50 && base < altitude + 30) {
    pc = 40;
    sc = 'nogo';
  } else if (h.cloudLow >= 30 && base < altitude + 150) {
    pc = 10;
    sc = 'caution';
  }
  factors.push({
    id: 'cloudbase',
    label: t('Base de nuvens'),
    status: sc,
    penalty: pc,
    detail: t('~{base} m · nuvens baixas {pct}%', { base: Math.round(base / 10) * 10, pct: Math.round(h.cloudLow) }),
  });

  // Temperatura (bateria e eletrônica)
  let pt = 0;
  let st: Verdict = 'go';
  if (h.temp < drone.minTemp || h.temp > drone.maxTemp) {
    pt = 40;
    st = 'nogo';
  } else if (h.temp < 5) {
    pt = 12;
    st = 'caution';
  } else if (h.temp > 36) {
    pt = 10;
    st = 'caution';
  }
  factors.push({
    id: 'temperature',
    label: t('Temperatura'),
    status: st,
    penalty: pt,
    detail:
      `${Math.round(h.temp)}° · ` +
      (h.temp < 10 ? t('aqueça as baterias') : h.temp > 33 ? t('risco de superaquecimento') : t('faixa ideal')),
  });

  // Kp — atividade geomagnética
  // No Brasil (baixa latitude geomagnética) tempestades G1–G2 pouco afetam receptores
  // multiconstelação; o risco real começa em G3 (Kp 7) e fica sério em G4+ (Kp ≥ 8).
  const pk = ramp(kp, [
    [0, 0],
    [4, 0],
    [5, 8],
    [6, 14],
    [7, 25],
    [8, 45],
    [9, 60],
  ]);
  const sk: Verdict = kp >= 8 ? 'nogo' : kp >= 5 ? 'caution' : 'go';
  factors.push({
    id: 'kp',
    label: t('GNSS / Kp'),
    status: sk,
    penalty: pk,
    detail: `Kp ${fmtNum(kp, 1)} · ${kpLabel(kp)}`,
  });

  // Satélites GNSS disponíveis (contagem e geometria em céu aberto)
  if (gnss) {
    let pn = 0;
    let sn: Verdict = 'go';
    if (gnss.visible < 6 || gnss.pdop > 6) {
      pn = 40;
      sn = 'nogo';
    } else if (gnss.visible < 12 || gnss.pdop > 3) {
      pn = 12;
      sn = 'caution';
    } else if (gnss.pdop > 2) {
      pn = 4;
    }
    factors.push({
      id: 'satellites',
      label: t('Satélites'),
      status: sn,
      penalty: pn,
      detail: t('{n} visíveis ({gps} GPS) · PDOP {pdop}', { n: gnss.visible, gps: gnss.gps, pdop: fmtNum(gnss.pdop, 1) }),
    });
  }

  // Ionosfera e rádio (cintilação, erupções solares, radiação)
  if (space) {
    let pi = 0;
    let si: Verdict = 'go';
    const parts: string[] = [];
    if (space.scint) {
      parts.push(t('Cintilação {level} (S4 {s4})', { level: scintLabel[space.scint.level], s4: fmtNum(space.scint.s4, 2) }));
      if (space.scint.level === 'forte') {
        pi += 14;
        si = 'caution';
      } else if (space.scint.level === 'moderada') {
        pi += 5;
      }
    }
    if (space.r >= 3) {
      pi += 12;
      si = 'caution';
    } else if (space.r >= 1) pi += 3;
    if (space.s >= 3) {
      pi += 6;
      si = 'caution';
    }
    if (space.r > 0) parts.push(t('rádio R{n}', { n: space.r }));
    if (space.s > 0) parts.push(t('radiação S{n}', { n: space.s }));
    if (parts.length === 0) parts.push(t('Sem alertas da NOAA'));
    factors.push({ id: 'ionosphere', label: t('Ionosfera'), status: si, penalty: pi, detail: parts.join(' · ') });
  }

  // Luz do dia
  factors.push({
    id: 'daylight',
    label: t('Luz do dia'),
    status: h.isDay ? 'go' : 'caution',
    penalty: h.isDay ? 0 : 15,
    detail: h.isDay ? t('Dia claro') : t('Noite · exige luzes e autorização'),
  });

  // Espaço aéreo: no Brasil, afastamento mínimo de aeródromos cadastrados (ICA 100-40 / DECEA).
  // Fora do Brasil não há regra única: aeroporto a menos de 5 NM vira cautela, nunca proibição.
  if (airspace && airspace.status !== 'clear') {
    const km = airspace.distanceM != null ? ` ${t('a {km} km', { km: fmtNum(airspace.distanceM / 1000, 1) })}` : '';
    const intl = airspace.region === 'INTL';
    factors.push({
      id: 'airspace',
      label: t('Espaço aéreo'),
      status: airspace.status === 'critical' ? 'nogo' : 'caution',
      penalty: airspace.status === 'critical' ? 40 : intl ? 10 : 6,
      detail:
        `${airspace.icao}${km} · ` +
        (intl
          ? t('aeroporto próximo: confira as regras locais')
          : airspace.status === 'critical'
            ? altitude <= 30.48
              ? t('abaixo do afastamento do DECEA para até 30 m (5,6 km)')
              : t('abaixo do afastamento do DECEA para acima de 30 m (9,3 km)')
            : t('voo permitido só até 30 m')),
    });
  }

  // Combinação multiplicativa: cada fator tira uma fração do que sobrou. Um fator sozinho pesa
  // igual à soma simples, mas várias cautelas pequenas não se acumulam até derrubar a nota
  // (cinco penalidades de 10 davam 50; assim dão 59).
  const keep = factors.reduce((k, f) => k * (1 - clamp(f.penalty, 0, 100) / 100), 1);
  let score = Math.round(clamp(100 * keep, 0, 100));
  const hasNoGo = factors.some((f) => f.status === 'nogo');
  if (hasNoGo) score = Math.min(score, 35);
  // À noite o melhor veredito possível é "cautela" (luzes + autorização).
  if (!h.isDay) score = Math.min(score, 69);
  const verdict: Verdict = score >= 70 ? 'go' : score >= 40 ? 'caution' : 'nogo';

  return {
    hour: h,
    score,
    verdict,
    windAlt: w.speed,
    gustAlt,
    dirAlt: w.dir,
    cloudBase: base,
    kp,
    gnss,
    factors: factors.sort((a, b) => b.penalty - a.penalty),
  };
}

export function kpLabel(kp: number) {
  if (kp >= 7) return t('tempestade forte');
  if (kp >= 5) return t('tempestade geomagnética');
  if (kp >= 4) return t('atividade elevada');
  return t('GPS estável');
}

/** Rótulo do nível de cintilação do INPE no idioma do app. */
export const scintLabel: Record<'fraca' | 'moderada' | 'forte', string> = {
  fraca: t('fraca'),
  moderada: t('moderada'),
  forte: t('forte'),
};

export const verdictLabel: Record<Verdict, string> = {
  go: t('Bom para voar'),
  caution: t('Voe com cautela'),
  nogo: t('Não recomendado'),
};

export const verdictShort: Record<Verdict, string> = {
  go: t('Bom'),
  caution: t('Cautela'),
  nogo: t('Evite'),
};

/* ------------------------------------------------------------------ Janelas */

export type FlightWindow = {
  start: Date;
  end: Date;
  avgScore: number;
  peak: number;
  hours: number;
};

/** Encontra blocos contínuos de horas "boas" (score ≥ 70, com luz) nas próximas N horas. */
export function findWindows(scores: HourScore[], horizonHours = 48, minScore = 70): FlightWindow[] {
  const now = Date.now();
  const limit = now + horizonHours * 3600_000;
  const out: FlightWindow[] = [];
  let cur: HourScore[] = [];
  const flush = () => {
    if (cur.length >= 1) {
      const avg = cur.reduce((s, x) => s + x.score, 0) / cur.length;
      out.push({
        start: cur[0].hour.time,
        end: new Date(cur[cur.length - 1].hour.time.getTime() + 3600_000),
        avgScore: Math.round(avg),
        peak: Math.max(...cur.map((x) => x.score)),
        hours: cur.length,
      });
    }
    cur = [];
  };
  for (const s of scores) {
    const t = s.hour.time.getTime();
    if (t + 3600_000 < now || t > limit) continue;
    if (s.score >= minScore && s.hour.isDay) cur.push(s);
    else flush();
  }
  flush();
  return out.sort((a, b) => b.avgScore * Math.sqrt(b.hours) - a.avgScore * Math.sqrt(a.hours));
}

/* ----------------------------------------------------------------- Bateria */

/** Autonomia útil estimada (min) considerando vento, frio e reserva de 20%. */
export function usableFlightMinutes(drone: DroneProfile, windKmh: number, tempC: number) {
  const rw = clamp(windKmh / drone.maxWind, 0, 1.2);
  const windFactor = 1 - 0.35 * Math.pow(rw, 1.5);
  const coldFactor = tempC < 10 ? 1 - (10 - tempC) * 0.012 : tempC > 35 ? 0.95 : 1;
  return Math.max(0, drone.flightTime * windFactor * coldFactor * 0.8);
}

/** Altitude-densidade aproximada (m) a partir de pressão de superfície e temperatura. */
export function densityAltitude(surfacePressureHpa: number, tempC: number) {
  // Altitude-pressão (ft) a partir da pressão de superfície
  const paFt = (1 - Math.pow(surfacePressureHpa / 1013.25, 0.190284)) * 145366.45;
  const isaC = 15 - 1.98 * (paFt / 1000);
  const daFt = paFt + 118.8 * (tempC - isaC);
  const da = daFt * 0.3048;
  return Number.isFinite(da) ? da : NaN;
}

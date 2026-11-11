/**
 * Em que regime de regras o ponto está.
 *
 * As regras detalhadas do Teto (afastamento da ICA 100-40, SARPAS, SISANT, Anatel) e o cadastro
 * de aeródromos da ANAC valem só no Brasil. Fora dele o app usa os aeroportos do
 * aviationweather.gov e indica a autoridade local, sem afirmar o que a lei permite.
 *
 * O país vem do geocodificador quando existe; sem ele, um contorno simplificado do Brasil
 * (erro de dezenas de km perto das fronteiras) decide.
 */
export type Region = 'BR' | 'INTL';

/** Contorno aproximado do Brasil, [lon, lat]. */
const BRAZIL: [number, number][] = [
  [-51.6, 4.4], [-50.0, 1.8], [-48.5, -1.2], [-44.3, -2.4], [-41.0, -2.8], [-38.4, -3.6], [-35.1, -5.3],
  [-34.7, -7.1], [-35.0, -9.0], [-37.0, -11.0], [-38.6, -13.0], [-38.9, -15.0], [-39.1, -17.7], [-40.2, -20.3],
  [-41.0, -22.0], [-43.2, -23.1], [-44.7, -23.5], [-46.4, -24.1], [-48.4, -25.9], [-48.5, -28.5], [-50.1, -30.6],
  [-52.0, -32.3], [-53.55, -33.8], [-53.6, -33.0], [-53.2, -32.5], [-55.4, -30.9], [-56.0, -30.8], [-57.6, -30.2],
  [-56.0, -28.6], [-55.0, -27.4], [-53.8, -27.1], [-53.7, -26.2], [-54.6, -25.6], [-54.3, -24.0], [-55.4, -23.9],
  [-55.7, -22.6], [-57.9, -22.1], [-57.8, -20.0], [-57.85, -19.0], [-58.2, -17.4], [-60.2, -16.3], [-60.4, -13.8],
  [-62.0, -13.4], [-65.3, -10.8], [-66.6, -9.9], [-68.6, -11.0], [-70.6, -11.0], [-70.5, -9.4], [-72.4, -9.5],
  [-73.2, -9.4], [-74.0, -7.4], [-73.0, -5.0], [-69.9, -4.2], [-69.4, -1.1], [-69.6, 0.6], [-70.1, 1.1],
  [-66.9, 1.2], [-64.0, 2.0], [-63.4, 4.0], [-60.7, 5.2], [-59.8, 4.5], [-59.5, 2.0], [-58.0, 1.5], [-56.5, 1.9],
  [-55.0, 2.4], [-54.0, 2.2], [-52.3, 2.3], [-51.95, 3.9],
];

function inside(lon: number, lat: number, poly: [number, number][]) {
  let ok = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}

export function regionAt(lat: number, lon: number, countryCode?: string | null): Region {
  if (countryCode) return countryCode.toUpperCase() === 'BR' ? 'BR' : 'INTL';
  return inside(lon, lat, BRAZIL) ? 'BR' : 'INTL';
}

/** Autoridade de aviação civil para drones por país (ISO 3166-1 alfa-2). */
export const AUTHORITIES: Record<string, { name: string; url: string }> = {
  US: { name: 'FAA — B4UFLY', url: 'https://www.faa.gov/uas/getting_started/b4ufly' },
  CA: { name: 'Transport Canada — Drone safety', url: 'https://tc.canada.ca/en/aviation/drone-safety' },
  GB: { name: 'UK CAA — Drone code', url: 'https://register-drones.caa.co.uk/drone-code' },
  AU: { name: 'CASA — Drone rules', url: 'https://www.casa.gov.au/knowyourdrone/drone-rules' },
  NZ: { name: 'CAA NZ — Drones', url: 'https://www.aviation.govt.nz/drones/' },
  IE: { name: 'IAA — Drones', url: 'https://www.iaa.ie/general-aviation/drones' },
  ES: { name: 'AESA — Drones', url: 'https://www.seguridadaerea.gob.es/es/ambitos/drones' },
  PT: { name: 'ANAC Portugal — Drones', url: 'https://www.anac.pt/vPT/Generico/drones/Paginas/Drones.aspx' },
  MX: { name: 'AFAC — Drones', url: 'https://www.gob.mx/afac' },
  AR: { name: 'ANAC Argentina — VANT', url: 'https://www.argentina.gob.ar/anac/vant' },
  CL: { name: 'DGAC Chile — Drones', url: 'https://www.dgac.gob.cl/' },
  CO: { name: 'Aerocivil — RPAS', url: 'https://www.aerocivil.gov.co/' },
  PE: { name: 'MTC Perú — RPAS', url: 'https://www.gob.pe/mtc' },
  UY: { name: 'DINACIA — Drones', url: 'https://www.dinacia.gub.uy/' },
};

/** Países da UE/AELE seguem as regras da EASA. */
const EASA = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'RO', 'SK', 'SI', 'SE', 'NO', 'IS', 'LI', 'CH',
]);

export function authorityFor(countryCode?: string | null) {
  const cc = countryCode?.toUpperCase();
  if (!cc) return null;
  if (AUTHORITIES[cc]) return AUTHORITIES[cc];
  if (EASA.has(cc)) return { name: 'EASA — Drones (UAS)', url: 'https://www.easa.europa.eu/en/domains/drones-air-mobility' };
  return null;
}

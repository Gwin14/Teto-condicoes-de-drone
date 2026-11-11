/**
 * Leitura dos cadastros oficiais de aeródromos da ANAC (dados abertos, CSV em ISO-8859-1).
 * - Públicos: https://sistemas.anac.gov.br/dadosabertos/Aerodromos/Aeródromos Públicos/…
 * - Privados: https://sistemas.anac.gov.br/dadosabertos/Aerodromos/Aeródromos Privados/…
 *
 * Sem imports: este arquivo também roda no Node (scripts/update-aerodromes.ts).
 */

/** `aeroporto` = fora do Brasil, vindo do aviationweather.gov. */
export type AerodromeKind = 'publico' | 'privado' | 'militar' | 'aeroporto';

/** [código, nome, município, UF, lat, lon, tipo] — compacto para o snapshot embutido. */
export type AerodromeRow = [string, string, string, string, number, number, AerodromeKind];

const ANAC = 'https://sistemas.anac.gov.br/dadosabertos/Aerodromos';
export const ANAC_PUBLIC_URL = `${ANAC}/${encodeURIComponent('Aeródromos Públicos')}/${encodeURIComponent('Lista de aeródromos públicos')}/AerodromosPublicos.csv`;
export const ANAC_PRIVATE_URL = `${ANAC}/${encodeURIComponent('Aeródromos Privados')}/${encodeURIComponent('Lista de aeródromos privados')}/${encodeURIComponent('Aerodromos Privados')}/AerodromosPrivados.csv`;

/** ISO-8859-1 mapeia 1:1 para Unicode; evita depender de TextDecoder('latin1') no Hermes. */
export function decodeLatin1(buf: ArrayBuffer) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
}

const num = (s: string | undefined) => {
  if (!s) return NaN;
  return Number(s.trim().replace(',', '.'));
};

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s/(-])(\p{L})/gu, (_, p: string, l: string) => p + l.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase());

/** Retorna a data "Atualizado em: AAAA-MM-DD" da primeira linha, se houver. */
export function anacUpdatedAt(csv: string) {
  return /Atualizado em:\s*(\d{4}-\d{2}-\d{2})/.exec(csv.slice(0, 200))?.[1] ?? null;
}

export function parseAnacCsv(csv: string, kind: 'publico' | 'privado'): AerodromeRow[] {
  const lines = csv.split(/\r?\n/);
  const hi = lines.findIndex((l) => l.startsWith('Código OACI') || l.startsWith('Código OACI'));
  if (hi < 0) throw new Error('CSV da ANAC em formato inesperado');
  const header = lines[hi].split(';').map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const iIcao = col('Código OACI');
  const iCiad = col('CIAD');
  const iName = col('Nome');
  const iCity = col('Município');
  const iUf = col('UF');
  const iLat = col('LATGEOPOINT');
  const iLon = col('LONGEOPOINT');
  const out: AerodromeRow[] = [];
  for (const line of lines.slice(hi + 1)) {
    if (!line.trim()) continue;
    const f = line.split(';');
    const lat = num(f[iLat]);
    const lon = num(f[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 40 || lon > -25 || lon < -80) continue;
    const code = (f[iIcao] || f[iCiad] || '').trim();
    if (!code) continue;
    out.push([code, titleCase((f[iName] ?? '').trim()), titleCase((f[iCity] ?? '').trim()), ufCode(f[iUf] ?? ''), round5(lat), round5(lon), kind]);
  }
  return out;
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

const UF: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapá: 'AP', amazonas: 'AM', bahia: 'BA', ceará: 'CE', 'distrito federal': 'DF',
  'espírito santo': 'ES', goiás: 'GO', maranhão: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', pará: 'PA', paraíba: 'PB', paraná: 'PR', pernambuco: 'PE', piauí: 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondônia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'são paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

/** O CSV de públicos traz o nome do estado; o de privados, a sigla. */
function ufCode(s: string) {
  const t = s.trim();
  return t.length === 2 ? t.toUpperCase() : (UF[t.toLowerCase()] ?? t);
}

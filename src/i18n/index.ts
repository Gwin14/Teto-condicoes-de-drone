/**
 * Internacionalização.
 *
 * O texto-fonte é o português do Brasil: `t('Bom para voar')` devolve a própria chave em pt
 * e a tradução de `en.ts`/`es.ts` nos outros idiomas. Parâmetros usam `{nome}`.
 * O idioma é lido uma vez na inicialização (o iOS reinicia o app quando o usuário troca o
 * idioma do sistema ou o idioma por app em Ajustes).
 *
 * `npm run i18n:check` confere se toda chave usada no código tem tradução.
 */
import { getLocales } from 'expo-localization';

import en from './en';
import es from './es';

export type Lang = 'pt' | 'en' | 'es';

function detect() {
  try {
    const l = getLocales()[0];
    return { code: l?.languageCode ?? 'en', tag: l?.languageTag ?? 'en-US', measurement: l?.measurementSystem ?? null, temp: l?.temperatureUnit ?? null, region: l?.regionCode ?? null };
  } catch {
    return { code: 'en', tag: 'en-US', measurement: null, temp: null, region: null };
  }
}

const device = detect();

export const lang: Lang = device.code === 'pt' ? 'pt' : device.code === 'es' ? 'es' : 'en';

/** Tag BCP 47 para Intl (datas, números). Mantém a região do aparelho quando o idioma bate. */
export const localeTag =
  lang === 'pt' ? (device.code === 'pt' ? device.tag : 'pt-BR') : lang === 'es' ? (device.code === 'es' ? device.tag : 'es-ES') : device.code === 'en' ? device.tag : 'en-US';

/** Região do aparelho (ex.: 'BR', 'US'). Usada só como palpite quando o local não diz o país. */
export const deviceRegion = device.region;

/** Unidades padrão do aparelho, para a primeira abertura. */
export const deviceUsesImperial = device.measurement === 'us';
export const deviceUsesFahrenheit = device.temp === 'fahrenheit';

const dicts: Record<Exclude<Lang, 'pt'>, Record<string, string>> = { en, es };

export function t(key: string, params?: Record<string, string | number>) {
  let s = lang === 'pt' ? key : (dicts[lang][key] ?? key);
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (params[k] != null ? String(params[k]) : m));
  return s;
}

/** Escolhe entre singular e plural (pt/en/es usam a mesma regra: 1 = singular). */
export function tn(n: number, one: string, other: string, params?: Record<string, string | number>) {
  return t(n === 1 ? one : other, { n, ...params });
}

/** Número com o separador decimal do idioma (1,5 em pt/es; 1.5 em en). */
export function fmtNum(v: number, digits = 1) {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(localeTag, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

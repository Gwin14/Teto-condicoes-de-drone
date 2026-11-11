/**
 * Perfis de drone. Os limites vêm das especificações oficiais dos fabricantes
 * (resistência máxima ao vento, faixa de temperatura e autonomia).
 */
import { t } from '@/i18n';

export type DroneProfile = {
  id: string;
  name: string;
  brand: string;
  /** Resistência máxima ao vento em km/h. */
  maxWind: number;
  /** Autonomia nominal em minutos (bateria padrão, sem vento). */
  flightTime: number;
  /** Velocidade de cruzeiro (modo normal) em km/h. Usada no cálculo de retorno (RTH). */
  cruiseSpeed: number;
  /** false = o fabricante não publica a velocidade do modo normal (valor aproximado). Perfis do usuário não usam. */
  cruiseOfficial?: boolean;
  weightG: number;
  minTemp: number;
  maxTemp: number;
  /** Proteção contra chuva (IP45+). */
  rainProof: boolean;
  category: 'mini' | 'consumer' | 'pro' | 'fpv' | 'enterprise';
};

export const DRONES: DroneProfile[] = [
  {
    id: 'mini4pro',
    name: 'Mini 4 Pro',
    brand: 'DJI',
    maxWind: 38,
    flightTime: 34,
    cruiseSpeed: 43, // 12 m/s (modo N)
    cruiseOfficial: true,
    weightG: 249,
    minTemp: -10,
    maxTemp: 40,
    rainProof: false,
    category: 'mini',
  },
  {
    id: 'mini5pro',
    name: 'Mini 5 Pro',
    brand: 'DJI',
    maxWind: 43,
    flightTime: 36,
    cruiseSpeed: 36,
    cruiseOfficial: false,
    weightG: 249,
    minTemp: -10,
    maxTemp: 40,
    rainProof: false,
    category: 'mini',
  },
  {
    id: 'mini3',
    name: 'Mini 3',
    brand: 'DJI',
    maxWind: 38,
    flightTime: 38,
    cruiseSpeed: 36,
    cruiseOfficial: false,
    weightG: 248,
    minTemp: -10,
    maxTemp: 40,
    rainProof: false,
    category: 'mini',
  },
  {
    id: 'air3s',
    name: 'Air 3S',
    brand: 'DJI',
    maxWind: 43,
    flightTime: 45,
    cruiseSpeed: 43,
    cruiseOfficial: false,
    weightG: 724,
    minTemp: -10,
    maxTemp: 40,
    rainProof: false,
    category: 'consumer',
  },
  {
    id: 'air2s',
    name: 'Air 2S',
    brand: 'DJI',
    maxWind: 38, // 10,7 m/s
    flightTime: 31,
    cruiseSpeed: 54, // 15 m/s (modo N)
    cruiseOfficial: true,
    weightG: 595,
    minTemp: 0,
    maxTemp: 40,
    rainProof: false,
    category: 'consumer',
  },
  {
    id: 'mavic4pro',
    name: 'Mavic 4 Pro',
    brand: 'DJI',
    maxWind: 43,
    flightTime: 51,
    cruiseSpeed: 43,
    cruiseOfficial: false,
    weightG: 1063,
    minTemp: -10,
    maxTemp: 40,
    rainProof: false,
    category: 'pro',
  },
  {
    id: 'mavic3pro',
    name: 'Mavic 3 Pro',
    brand: 'DJI',
    maxWind: 43,
    flightTime: 43,
    cruiseSpeed: 43,
    cruiseOfficial: false,
    weightG: 958,
    minTemp: -10,
    maxTemp: 40,
    rainProof: false,
    category: 'pro',
  },
  {
    id: 'avata2',
    name: 'Avata 2',
    brand: 'DJI',
    maxWind: 38,
    flightTime: 23,
    cruiseSpeed: 29, // 8 m/s (modo Normal)
    cruiseOfficial: true,
    weightG: 377,
    minTemp: -10,
    maxTemp: 40,
    rainProof: false,
    category: 'fpv',
  },
  {
    id: 'neo',
    name: 'Neo',
    brand: 'DJI',
    maxWind: 29,
    flightTime: 18,
    cruiseSpeed: 22, // 6 m/s (modo Normal)
    cruiseOfficial: true,
    weightG: 135,
    minTemp: -10,
    maxTemp: 40,
    rainProof: false,
    category: 'mini',
  },
  {
    id: 'evo2pro',
    name: 'EVO II Pro V3',
    brand: 'Autel',
    maxWind: 61, // nível 8 (~17 m/s), ficha da Autel
    flightTime: 40,
    cruiseSpeed: 43,
    cruiseOfficial: false,
    weightG: 1191,
    minTemp: -10,
    maxTemp: 40,
    rainProof: false,
    category: 'pro',
  },
  {
    id: 'matrice4',
    name: 'Matrice 4E',
    brand: 'DJI',
    maxWind: 43,
    flightTime: 49,
    cruiseSpeed: 32, // 9 m/s, velocidade do teste de autonomia
    cruiseOfficial: true,
    weightG: 1219,
    minTemp: -10,
    maxTemp: 40,
    rainProof: false,
    category: 'enterprise',
  },
  {
    id: 'matrice350',
    name: 'Matrice 350 RTK',
    brand: 'DJI',
    // DJI: resistência máxima ao vento de 12 m/s.
    maxWind: 43,
    flightTime: 55,
    cruiseSpeed: 29, // 8 m/s, velocidade do teste de autonomia
    cruiseOfficial: true,
    weightG: 6470,
    minTemp: -20,
    maxTemp: 50,
    rainProof: true,
    category: 'enterprise',
  },
  {
    id: 'fpv5',
    name: 'FPV 5" (custom)',
    brand: t('Montado'),
    maxWind: 50,
    flightTime: 6,
    cruiseSpeed: 80,
    cruiseOfficial: false,
    weightG: 650,
    minTemp: -5,
    maxTemp: 40,
    rainProof: false,
    category: 'fpv',
  },
];

export const DEFAULT_DRONE_ID = 'mini4pro';

export function findDrone(id: string, custom?: DroneProfile | null): DroneProfile {
  if (custom && id === custom.id) return custom;
  return DRONES.find((d) => d.id === id) ?? DRONES[0];
}

export const categoryLabel: Record<DroneProfile['category'], string> = {
  mini: t('Até 250 g'),
  consumer: t('Consumo'),
  pro: t('Profissional'),
  fpv: 'FPV',
  enterprise: 'Enterprise',
};

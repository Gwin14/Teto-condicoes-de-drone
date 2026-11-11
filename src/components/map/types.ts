import type { NearbyAirport } from '@/lib/airports';
import type { Region } from '@/lib/region';
import type { SavedSpot } from '@/store/app';

export type LatLon = { lat: number; lon: number };

export type MapSurfaceProps = {
  center: LatLon;
  user?: LatLon | null;
  airports: NearbyAirport[];
  spots: SavedSpot[];
  selected: LatLon | null;
  showZones: boolean;
  region: Region;
  dark: boolean;
  onLongPress: (p: LatLon) => void;
  onSelectSpot: (s: SavedSpot) => void;
  onSelectAirport: (a: NearbyAirport) => void;
  recenterKey: number;
  bottomInset: number;
};

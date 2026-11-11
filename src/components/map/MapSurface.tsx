import { useEffect, useRef } from 'react';
import MapView, { Circle, Marker } from 'react-native-maps';

import { t } from '@/i18n';
import { zoneRadii } from '@/lib/airports';
import { useTheme } from '@/theme/tokens';

import type { MapSurfaceProps } from './types';

/** Mapa nativo (Apple Maps no iOS, Google Maps no Android) — disponível no Expo Go. */
export function MapSurface(p: MapSurfaceProps) {
  const { c } = useTheme();
  const ref = useRef<MapView>(null);

  useEffect(() => {
    ref.current?.animateToRegion(
      { latitude: p.center.lat, longitude: p.center.lon, latitudeDelta: 0.25, longitudeDelta: 0.25 },
      350
    );
  }, [p.recenterKey, p.center.lat, p.center.lon]);

  return (
    <MapView
      ref={ref}
      style={{ flex: 1 }}
      initialRegion={{ latitude: p.center.lat, longitude: p.center.lon, latitudeDelta: 0.25, longitudeDelta: 0.25 }}
      showsUserLocation
      showsCompass
      showsScale
      userInterfaceStyle={p.dark ? 'dark' : 'light'}
      mapPadding={{ top: 0, right: 0, bottom: p.bottomInset, left: 0 }}
      onLongPress={(e) => p.onLongPress({ lat: e.nativeEvent.coordinate.latitude, lon: e.nativeEvent.coordinate.longitude })}>
      {p.showZones
        ? p.airports.map((a) => {
            const r = zoneRadii(p.region);
            return [
              <Circle
                key={`${a.icao}-c`}
                center={{ latitude: a.lat, longitude: a.lon }}
                radius={r.caution}
                fillColor={c.mapZoneCaution}
                strokeColor={c.caution}
                strokeWidth={1}
              />,
              r.critical > 0 ? (
              <Circle
                key={`${a.icao}-r`}
                center={{ latitude: a.lat, longitude: a.lon }}
                radius={r.critical}
                fillColor={c.mapZoneCritical}
                strokeColor={c.nogo}
                strokeWidth={1.5}
              />
              ) : null,
            ];
          })
        : null}
      {p.airports.map((a) => (
        <Marker
          key={a.icao}
          coordinate={{ latitude: a.lat, longitude: a.lon }}
          title={`${a.icao} · ${a.name}`}
          description={[a.city, a.uf].filter(Boolean).join(', ')}
          pinColor={c.nogo}
          onPress={() => p.onSelectAirport(a)}
        />
      ))}
      {p.spots.map((s) => (
        <Marker
          key={s.id}
          coordinate={{ latitude: s.lat, longitude: s.lon }}
          title={s.name}
          pinColor={c.go}
          onPress={() => p.onSelectSpot(s)}
        />
      ))}
      {p.selected ? (
        <Marker coordinate={{ latitude: p.selected.lat, longitude: p.selected.lon }} pinColor={c.accent} title={t('Ponto selecionado')} />
      ) : null}
    </MapView>
  );
}

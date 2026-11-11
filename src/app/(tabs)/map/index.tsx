import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { MapSurface } from '@/components/map/MapSurface';
import type { LatLon } from '@/components/map/types';
import { Button, StatusPill, T } from '@/components/ui';
import { useAerodromes, useConditions } from '@/hooks/useConditions';
import { countryAt, useActiveLocation } from '@/hooks/useLocation';
import { t } from '@/i18n';
import { airspaceAt, nearbyAirports } from '@/lib/airports';
import { cardinal, fmtDistance, fmtSpeed } from '@/lib/format';
import { verdictLabel } from '@/lib/scoring';
import { useApp } from '@/store/app';
import { floatingShadow, radius, space, useTheme, verdictColor } from '@/theme/tokens';

const FALLBACK = { lat: -23.5505, lon: -46.6333 }; // São Paulo

export default function MapScreen() {
  const { c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const { location } = useActiveLocation();
  const spots = useApp((s) => s.spots);
  const addSpot = useApp((s) => s.addSpot);
  const showZones = useApp((s) => s.showZones);
  const set = useApp((s) => s.set);
  const unit = useApp((s) => s.speedUnit);
  const [selected, setSelected] = useState<(LatLon & { name?: string; country?: string }) | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);

  const center = location ?? FALLBACK;
  const altitude = useApp((s) => s.altitude);
  const centerCountry = location?.country;
  const { region, list: aerodromes } = useAerodromes(center.lat, center.lon, centerCountry);
  // Cadastro completo tem ~4.400 aeródromos: no mapa, os 60 mais próximos.
  const airports = nearbyAirports(aerodromes, center.lat, center.lon, 150, altitude, region).slice(0, 60);
  const here = useConditions(center.lat, center.lon, centerCountry);
  const point = useConditions(selected?.lat, selected?.lon, selected?.country);
  const pointRegion = point.data?.region ?? region;
  const pointAirspace = selected ? airspaceAt(aerodromes, selected.lat, selected.lon, altitude, pointRegion) : null;

  // País do ponto escolhido no mapa: decide entre regras do Brasil e regras locais.
  useEffect(() => {
    if (!selected || selected.country) return;
    let alive = true;
    countryAt(selected.lat, selected.lon).then((cc) => {
      if (alive && cc) setSelected((s) => (s && s.lat === selected.lat && s.lon === selected.lon ? { ...s, country: cc } : s));
    });
    return () => {
      alive = false;
    };
  }, [selected]);
  // A tab bar do iOS flutua sobre o mapa; no Android o conteúdo termina acima dela.
  const bottomOffset = process.env.EXPO_OS === 'ios' ? insets.bottom + 64 : process.env.EXPO_OS === 'web' ? 88 : space.lg;

  const onLongPress = (p: LatLon) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelected(p);
  };

  const saveSelected = () => {
    if (!selected) return;
    const n = spots.length + 1;
    addSpot({ name: selected.name ?? t('Ponto de voo {n}', { n }), lat: selected.lat, lon: selected.lon, country: selected.country, detail: `${selected.lat.toFixed(4)}, ${selected.lon.toFixed(4)}` });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSelected(null);
  };

  const useSelected = () => {
    if (!selected) return;
    set('location', { kind: 'place', name: selected.name ?? t('Ponto no mapa'), detail: `${selected.lat.toFixed(4)}, ${selected.lon.toFixed(4)}`, lat: selected.lat, lon: selected.lon, country: selected.country });
    setSelected(null);
    router.navigate('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <MapSurface
        center={center}
        user={location}
        airports={airports}
        spots={spots}
        selected={selected}
        showZones={showZones}
        region={region}
        dark={isDark}
        onLongPress={onLongPress}
        onSelectSpot={(s) => setSelected({ lat: s.lat, lon: s.lon, name: s.name, country: s.country })}
        onSelectAirport={() => {}}
        recenterKey={recenterKey}
        bottomInset={selected ? 220 : 0}
      />

      {/* Cartão superior: condição no local ativo */}
      <View style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, flexDirection: 'row', gap: space.sm }}>
        <Pressable
          onPress={() => router.push('/location')}
          accessibilityRole="button"
          accessibilityLabel={t('Escolher local')}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            backgroundColor: c.cardRaised,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            boxShadow: floatingShadow,
            opacity: pressed ? 0.85 : 1,
          })}>
          {here.data ? (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 3,
                borderColor: verdictColor(c, here.data.now.verdict),
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <T v="subhead" num style={{ fontWeight: '700' }}>
                {here.data.now.score}
              </T>
            </View>
          ) : (
            <ActivityIndicator color={c.secondary} />
          )}
          <View style={{ flex: 1 }}>
            <T v="headline" numberOfLines={1}>
              {location?.name ?? t('Escolha um local')}
            </T>
            <T v="footnote" tone="secondary" num numberOfLines={1}>
              {here.data
                ? `${fmtSpeed(here.data.now.windAlt, unit)} ${cardinal(here.data.now.dirAlt)} · ${t('raj.')} ${fmtSpeed(here.data.now.gustAlt, unit)}`
                : t('Carregando condições…')}
            </T>
          </View>
          {here.data ? (
            <View style={{ transform: [{ rotate: `${(here.data.now.dirAlt + 180) % 360}deg` }] }}>
              <Icon name="arrowUp" size={22} color={c.accent} />
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Controles flutuantes */}
      <View style={{ position: 'absolute', right: space.lg, top: insets.top + 96, gap: space.sm }}>
        <MapButton
          icon="location"
          label={t('Centralizar')}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setRecenterKey((k) => k + 1);
          }}
        />
        <MapButton
          icon="layers"
          label={showZones ? t('Ocultar zonas') : t('Mostrar zonas')}
          active={showZones}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            set('showZones', !showZones);
          }}
        />
      </View>

      {!selected ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: bottomOffset, alignItems: 'center' }} pointerEvents="none">
          <View style={{ backgroundColor: c.cardRaised, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6, boxShadow: floatingShadow }}>
            <T v="footnote" tone="secondary">
              {t('Mantenha pressionado para ver um ponto')}
            </T>
          </View>
        </View>
      ) : null}

      {selected ? (
        <Animated.View
          entering={reduce ? undefined : FadeInDown.duration(220)}
          exiting={reduce ? undefined : FadeOutDown.duration(150)}
          style={{
            position: 'absolute',
            left: space.lg,
            right: space.lg,
            bottom: bottomOffset,
            backgroundColor: c.cardRaised,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            padding: space.lg,
            gap: space.md,
            boxShadow: floatingShadow,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
            <View style={{ flex: 1, gap: 4 }}>
              <T v="headline" numberOfLines={1}>
                {selected.name ?? t('Ponto selecionado')}
              </T>
              <T v="footnote" tone="secondary" num selectable>
                {selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}
              </T>
            </View>
            <Pressable hitSlop={12} onPress={() => setSelected(null)} accessibilityLabel={t('Fechar')}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={13} color={c.secondary} weight="bold" />
              </View>
            </Pressable>
          </View>
          {point.data ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
              <StatusPill v={point.data.now.verdict} label={`${point.data.now.score} · ${verdictLabel[point.data.now.verdict]}`} />
              <T v="footnote" tone="secondary" num>
                {fmtSpeed(point.data.now.windAlt, unit)} · {t('raj.')} {fmtSpeed(point.data.now.gustAlt, unit)}
              </T>
            </View>
          ) : point.error ? (
            <T v="footnote" tone="nogo">
              {t('Não foi possível carregar a previsão deste ponto.')}
            </T>
          ) : (
            <ActivityIndicator color={c.secondary} style={{ alignSelf: 'flex-start' }} />
          )}
          {pointAirspace?.nearest ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Icon
                name="airport"
                size={16}
                color={pointAirspace.status === 'critical' ? c.nogo : pointAirspace.status === 'caution' ? c.caution : c.secondary}
              />
              <T v="footnote" tone="secondary" style={{ flex: 1 }} numberOfLines={2}>
                {t('{icao} a {dist}', { icao: pointAirspace.nearest.icao, dist: fmtDistance(pointAirspace.nearest.distance) })}
                {pointAirspace.status === 'critical'
                  ? ` · ${t('abaixo do afastamento do DECEA')}`
                  : pointAirspace.status === 'caution'
                    ? ` · ${pointRegion === 'BR' ? t('só até 30 m (DECEA)') : t('aeroporto próximo: confira as regras locais')}`
                    : ''}
              </T>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title={t('Salvar')} icon="bookmarkAdd" kind="secondary" onPress={saveSelected} style={{ flex: 1 }} />
            <Button title={t('Usar local')} icon="pin" onPress={useSelected} style={{ flex: 1 }} />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function MapButton({ icon, label, onPress, active }: { icon: IconName; label: string; onPress: () => void; active?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: c.cardRaised,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: floatingShadow,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Icon name={icon} size={19} color={active === false ? c.secondary : c.accent} />
    </Pressable>
  );
}

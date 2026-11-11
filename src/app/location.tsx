import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { SheetHeader } from '@/components/SheetHeader';
import { Card, InlineError, ListRow, T } from '@/components/ui';
import { requestGps } from '@/hooks/useLocation';
import { t } from '@/i18n';
import { confirmAction } from '@/lib/confirm';
import { searchPlaces } from '@/lib/weather';
import { useApp } from '@/store/app';
import { radius, space, useTheme } from '@/theme/tokens';

export default function LocationScreen() {
  const { c } = useTheme();
  const set = useApp((s) => s.set);
  const spots = useApp((s) => s.spots);
  const removeSpot = useApp((s) => s.removeSpot);
  const choice = useApp((s) => s.location);
  // Input não-controlado: digitação vai para um ref, a busca usa um valor "debounced".
  const textRef = useRef('');
  const [query, setQuery] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const results = useQuery({
    queryKey: ['places', query],
    queryFn: ({ signal }) => searchPlaces(query, signal),
    enabled: query.trim().length >= 2,
    staleTime: 60 * 60_000,
  });

  const pick = (p: { name: string; detail?: string; lat: number; lon: number; country?: string }) => {
    Haptics.selectionAsync().catch(() => {});
    set('location', { kind: 'place', ...p });
    router.back();
  };

  const useGps = () => {
    Haptics.selectionAsync().catch(() => {});
    set('location', { kind: 'gps' });
    requestGps(true);
    router.back();
  };

  const confirmRemove = (id: string, name: string) =>
    confirmAction({ title: t('Remover local salvo?'), message: name, confirm: t('Remover'), destructive: true, onConfirm: () => removeSpot(id) });

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SheetHeader title={t('Local de voo')} left={t('Fechar')} modal />
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            backgroundColor: c.fill,
            borderRadius: radius.inner,
            borderCurve: 'continuous',
            paddingHorizontal: space.md,
            height: 44,
          }}>
          <Icon name="search" size={16} color={c.secondary} />
          <TextInput
            placeholder={t('Cidade, bairro ou ponto turístico')}
            placeholderTextColor={c.tertiary}
            autoFocus={process.env.EXPO_OS !== 'web'}
            autoCorrect={false}
            returnKeyType="search"
            textContentType="addressCity"
            autoComplete="off"
            accessibilityLabel={t('Buscar local')}
            onChangeText={(text) => {
              textRef.current = text;
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => setQuery(textRef.current), 350);
            }}
            onSubmitEditing={() => setQuery(textRef.current)}
            style={{ flex: 1, fontSize: 17, color: c.label, height: 44 }}
          />
          {results.isFetching ? <ActivityIndicator size="small" color={c.secondary} /> : null}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingTop: 0, gap: space.lg, paddingBottom: 60 }}>
        {query.trim().length >= 2 ? (
          <View style={{ gap: space.sm }}>
            <T v="footnote" tone="secondary" style={{ paddingHorizontal: space.xs, textTransform: 'uppercase' }}>
              {t('Resultados')}
            </T>
            {results.error ? <InlineError message={t('Busca indisponível. Verifique a conexão.')} onRetry={() => results.refetch()} /> : null}
            {results.data && results.data.length === 0 ? (
              <Card>
                <T v="subhead" tone="secondary">
                  {t('Nada encontrado para “{query}”. Tente o nome da cidade.', { query })}
                </T>
              </Card>
            ) : null}
            {results.data && results.data.length > 0 ? (
              <Card padded={false}>
                {results.data.map((p, i) => (
                  <ListRow
                    key={p.id}
                    icon="pin"
                    iconColor={c.secondary}
                    title={p.name}
                    subtitle={p.detail}
                    onPress={() => pick(p)}
                    last={i === results.data!.length - 1}
                  />
                ))}
              </Card>
            ) : null}
          </View>
        ) : null}

        <Card padded={false}>
          <ListRow
            icon="location"
            title={t('Minha localização')}
            subtitle={t('Usar o GPS do aparelho')}
            onPress={useGps}
            last
            right={choice.kind === 'gps' ? <Icon name="check" size={20} color={c.accent} /> : null}
          />
        </Card>

        <View style={{ gap: space.sm }}>
          <T v="footnote" tone="secondary" style={{ paddingHorizontal: space.xs, textTransform: 'uppercase' }}>
            {t('Pontos salvos')}
          </T>
          {spots.length === 0 ? (
            <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <Icon name="bookmarkAdd" size={20} color={c.secondary} />
              <T v="subhead" tone="secondary" style={{ flex: 1 }}>
                {t('Salve seus pontos de voo favoritos no Mapa — mantenha pressionado sobre o local.')}
              </T>
            </Card>
          ) : (
            <Card padded={false}>
              {spots.map((s, i) => {
                const active = choice.kind === 'place' && choice.lat === s.lat && choice.lon === s.lon;
                return (
                  <ListRow
                    key={s.id}
                    icon="bookmark"
                    iconColor={c.go}
                    title={s.name}
                    subtitle={s.detail ?? `${s.lat.toFixed(4)}, ${s.lon.toFixed(4)}`}
                    onPress={() => pick({ name: s.name, detail: s.detail, lat: s.lat, lon: s.lon, country: s.country })}
                    last={i === spots.length - 1}
                    right={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                        {active ? <Icon name="check" size={20} color={c.accent} /> : null}
                        <Pressable
                          hitSlop={10}
                          onPress={() => confirmRemove(s.id, s.name)}
                          accessibilityRole="button"
                          accessibilityLabel={t('Remover {name}', { name: s.name })}
                          style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: 4 })}>
                          <Icon name="trash" size={18} color={c.tertiary} />
                        </Pressable>
                      </View>
                    }
                  />
                );
              })}
            </Card>
          )}
          {spots.length > 0 ? (
            <T v="caption" tone="tertiary" style={{ paddingHorizontal: space.xs }}>
              {t('Toque para usar como local de voo.')}
            </T>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}


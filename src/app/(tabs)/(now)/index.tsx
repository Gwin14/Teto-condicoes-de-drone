import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { GnssCard } from '@/components/gnss/GnssCard';
import { AirspaceCard } from '@/components/now/AirspaceCard';
import { FactorsCard } from '@/components/now/FactorsCard';
import { HeroCard } from '@/components/now/HeroCard';
import { HourlyStrip } from '@/components/now/HourlyStrip';
import { MetricsGrid } from '@/components/now/MetricsGrid';
import { SunCard } from '@/components/now/SunCard';
import { WindowCard } from '@/components/now/WindowCard';
import { WindProfileCard } from '@/components/now/WindProfileCard';
import { NowSkeleton } from '@/components/now/NowSkeleton';
import { Card, EmptyState, InlineError, SectionHeader, T } from '@/components/ui';
import { useConditions } from '@/hooks/useConditions';
import { useActiveLocation } from '@/hooks/useLocation';
import { t } from '@/i18n';
import { fmtRelative } from '@/lib/format';
import { openPro } from '@/lib/purchases';
import { weatherLabel } from '@/lib/weather';
import { useApp } from '@/store/app';
import { space, useTheme } from '@/theme/tokens';

export default function NowScreen() {
  const { c } = useTheme();
  const { location, gps, retry } = useActiveLocation();
  const { data, drone, altitude, isLoading, error, kpError, refetch } = useConditions(location?.lat, location?.lon, location?.country);
  const unit = useApp((s) => s.speedUnit);
  const tempUnit = useApp((s) => s.tempUnit);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    if (location?.source === 'gps') retry();
    await refetch().catch(() => {});
    setRefreshing(false);
  };

  const headerRight = () => (
    <Pressable
      onPress={() => router.push('/location')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t('Escolher local')}
      style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: 4 })}>
      <Icon name={location?.source === 'place' ? 'pin' : 'location'} size={20} color={c.accent} />
    </Pressable>
  );

  const title = location?.name ?? t('Agora');

  let body: React.ReactNode;
  if (!location) {
    if (gps.status === 'denied') {
      body = (
        <EmptyState
          icon="location"
          title={t('Onde você vai voar?')}
          message={t('Permita a localização para ver as condições exatamente onde você está, ou escolha uma cidade ou ponto de voo.')}
          action={t('Escolher local')}
          onAction={() => router.push('/location')}
          secondary={t('Tentar localização de novo')}
          onSecondary={retry}
        />
      );
    } else if (gps.status === 'error') {
      body = (
        <EmptyState
          icon="warning"
          tone="nogo"
          title={t('Não encontramos você')}
          message={t('O GPS não respondeu. Verifique se a localização está ativa ou escolha um local manualmente.')}
          action={t('Escolher local')}
          onAction={() => router.push('/location')}
          secondary={t('Tentar de novo')}
          onSecondary={retry}
        />
      );
    } else {
      body = <NowSkeleton />;
    }
  } else if (isLoading) {
    body = <NowSkeleton />;
  } else if (error && !data) {
    body = (
      <EmptyState
        icon="cloud"
        tone="nogo"
        title={t('Sem dados de previsão')}
        message={t('Não foi possível falar com o serviço meteorológico ({error}). Confira sua conexão.', { error: error.message })}
        action={t('Tentar de novo')}
        onAction={() => refetch()}
      />
    );
  } else if (data) {
    body = (
      <View style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.xs, marginTop: -space.sm }}>
          <T v="footnote" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {[location.detail, weatherLabel(data.forecast.current.code), t('atualizado {when}', { when: fmtRelative(data.forecast.fetchedAt) })]
              .filter(Boolean)
              .join(' · ')}
          </T>
        </View>

        {error ? <InlineError message={t('Mostrando a última previsão salva — falha ao atualizar.')} onRetry={() => refetch()} /> : null}

        <HeroCard data={data} drone={drone} altitude={altitude} unit={unit} />

        <View>
          <SectionHeader title={t('Próximas 24 horas')} icon="timer" action={t('Previsão')} onAction={() => router.navigate('/forecast')} />
          <HourlyStrip hours={data.hours} unit={unit} />
        </View>

        <View>
          <SectionHeader title={t('Janelas de tempo ideal')} icon="sparkle" />
          <WindowCard
            windows={data.windows}
            place={location.name}
            restrictedBy={data.airspace.status === 'critical' ? data.airspace.nearest?.icao : undefined}
            region={data.region}
          />
        </View>

        <View>
          <SectionHeader title={t('Fatores de voo')} icon="checklist" />
          <FactorsCard factors={data.now.factors} />
          {kpError ? (
            <T v="caption" tone="tertiary" style={{ marginTop: space.sm, paddingHorizontal: space.xs }}>
              {t('Índice Kp indisponível no momento — usando 0 como referência.')}
            </T>
          ) : null}
        </View>

        <View>
          <SectionHeader title={t('Satélites e interferência')} icon="satellite" action={t('Detalhes')} onAction={() => openPro('/gnss')} />
          <GnssCard lat={data.forecast.lat} lon={data.forecast.lon} elevation={data.forecast.elevation} kp={data.now.kp} />
        </View>

        <View>
          <SectionHeader title={t('Vento por altitude')} icon="altitude" />
          <WindProfileCard hour={data.forecast.current} drone={drone} altitude={altitude} unit={unit} />
        </View>

        <View>
          <SectionHeader title={t('Condições')} icon="gauge" />
          <MetricsGrid data={data} tempUnit={tempUnit} />
        </View>

        <View>
          <SectionHeader title={t('Luz')} icon="sun" />
          <SunCard lat={location.lat} lon={location.lon} />
        </View>

        <View>
          <SectionHeader title={t('Espaço aéreo')} icon="airport" />
          <AirspaceCard airports={data.airports} unit={unit} region={data.region} country={location.country} />
        </View>

        <Card style={{ backgroundColor: 'transparent', paddingHorizontal: space.xs }}>
          <T v="caption" tone="tertiary">
            {data.region === 'BR'
              ? t('O Teto é uma ferramenta de apoio. Antes de voar, confirme a autorização no SARPAS (DECEA), o cadastro no SISANT (ANAC) e a homologação na Anatel. Dados: Open-Meteo, NOAA SWPC, CelesTrak, aviationweather.gov, ANAC (aeródromos) e INPE/EMBRACE (cintilação).')
              : t('O Teto é uma ferramenta de apoio. Antes de voar, confira as regras, as zonas restritas e as autorizações exigidas pela autoridade de aviação do país. Dados: Open-Meteo, NOAA SWPC, CelesTrak, aviationweather.gov e INPE/EMBRACE (cintilação).')}
          </T>
        </Card>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title, headerRight }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: c.background }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl * 2 }}
        refreshControl={location ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
        {body}
      </ScrollView>
    </>
  );
}

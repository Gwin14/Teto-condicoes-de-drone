import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Card, StatusPill, T } from '@/components/ui';
import { useMetar } from '@/hooks/useConditions';
import { t } from '@/i18n';
import { kindLabel, type NearbyAirport } from '@/lib/airports';
import { cardinal, fmtDistance, fmtSpeed, fmtTime, type SpeedUnit } from '@/lib/format';
import { authorityFor, type Region } from '@/lib/region';
import { space, useTheme } from '@/theme/tokens';

const catColor = { VFR: 'go', MVFR: 'caution', IFR: 'nogo', LIFR: 'nogo' } as const;

/**
 * Espaço aéreo: aeródromos próximos e METAR decodificado.
 * Brasil: cadastro da ANAC e afastamento do DECEA. Fora: aeroportos do aviationweather.gov e a autoridade local.
 */
export function AirspaceCard({ airports, unit, region, country }: { airports: NearbyAirport[]; unit: SpeedUnit; region: Region; country?: string }) {
  const { c } = useTheme();
  const br = region === 'BR';
  const authority = authorityFor(country);
  const icaos = airports.slice(0, 3).map((a) => a.icao);
  const metar = useMetar(icaos);
  const nearest = airports[0];

  return (
    <Card style={{ gap: space.md }}>
      {nearest ? (
        airports.slice(0, 3).map((a, i) => {
          const m = metar.data?.find((x) => x.icao === a.icao);
          return (
            <View
              key={a.icao}
              style={{
                gap: space.sm,
                paddingBottom: i < Math.min(airports.length, 3) - 1 ? space.md : 0,
                borderBottomWidth: i < Math.min(airports.length, 3) - 1 ? 0.5 : 0,
                borderBottomColor: c.separator,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <Icon name="airport" size={22} color={a.zone === 'critical' ? c.nogo : a.zone === 'caution' ? c.caution : c.secondary} />
                <View style={{ flex: 1 }}>
                  <T v="headline" numberOfLines={1}>
                    {a.icao} · {a.name}
                  </T>
                  <T v="footnote" tone="secondary" num>
                    {t('{dist} a {dir}', { dist: fmtDistance(a.distance), dir: cardinal(a.bearing) })} · {kindLabel[a.kind]}
                    {a.city ? ` · ${a.city}` : ''}
                  </T>
                </View>
                {a.zone !== 'clear' ? (
                  <StatusPill v={a.zone === 'critical' ? 'nogo' : 'caution'} label={a.zone === 'critical' ? t('Restrita') : br ? t('Até 30 m') : t('Perto')} small />
                ) : null}
              </View>
              {m ? (
                <View style={{ gap: 4, paddingLeft: 34 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    {m.category ? <StatusPill v={catColor[m.category]} label={m.category} small /> : null}
                    <T v="footnote" tone="secondary" num>
                      {m.windKt != null
                        ? m.windDir != null
                          ? t('Vento {speed} de {dir}', { speed: fmtSpeed(m.windKt * 1.852, unit), dir: cardinal(m.windDir) })
                          : t('Vento {speed}', { speed: fmtSpeed(m.windKt * 1.852, unit) })
                        : ''}
                      {m.gustKt ? ` · ${t('raj.')} ${fmtSpeed(m.gustKt * 1.852, unit)}` : ''}
                      {` · ${fmtTime(m.obsTime)}`}
                    </T>
                  </View>
                  <T v="caption" tone="tertiary" selectable style={{ fontFamily: process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace' }}>
                    {m.raw}
                  </T>
                </View>
              ) : null}
            </View>
          );
        })
      ) : (
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Icon name="check" size={22} color={c.go} />
          <T v="subhead" tone="secondary" style={{ flex: 1 }}>
            {br
              ? t('Nenhum aeródromo cadastrado na ANAC num raio de 60 km. Ainda assim, confira helipontos e áreas restritas no SARPAS.')
              : process.env.EXPO_OS === 'web'
                ? t('A lista de aeroportos fora do Brasil só carrega no app do celular.')
                : t('Nenhum aeroporto encontrado num raio de 60 km. Ainda assim, confira helipontos, pistas pequenas e zonas restritas nas regras locais.')}
          </T>
        </View>
      )}
      <T v="caption" tone="tertiary">
        {br
          ? t('Aeródromos: cadastro da ANAC. Afastamento: ICA 100-40 (3 NM até 30 m, 5 NM até 120 m). Todo voo precisa de autorização no SARPAS NG.')
          : t('Aeroportos: aviationweather.gov (pode não incluir pistas pequenas e helipontos). O círculo de 5 NM é um alerta, não a regra local: confira zonas e autorizações com a autoridade do país.')}
      </T>
      {br ? (
        <Button title={t('Abrir SARPAS NG')} kind="secondary" icon="link" onPress={() => WebBrowser.openBrowserAsync('https://sarpas.decea.mil.br')} />
      ) : authority ? (
        <Button title={authority.name} kind="secondary" icon="link" onPress={() => WebBrowser.openBrowserAsync(authority.url)} />
      ) : null}
    </Card>
  );
}

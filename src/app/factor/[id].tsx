import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { factorIcon } from '@/components/now/FactorsCard';
import { SheetHeader } from '@/components/SheetHeader';
import { Button, Card, StatusPill, T } from '@/components/ui';
import { useConditions } from '@/hooks/useConditions';
import { useActiveLocation } from '@/hooks/useLocation';
import { t } from '@/i18n';
import { fmtSpeed } from '@/lib/format';
import { openPro } from '@/lib/purchases';
import type { FactorId } from '@/lib/scoring';
import { verdictShort } from '@/lib/scoring';
import { useApp } from '@/store/app';
import { space, useTheme, verdictColor } from '@/theme/tokens';

type Copy = { title: string; why: string; tips: string[] };

const COPY: Record<FactorId, Copy> = {
  wind: {
    title: t('Vento sustentado'),
    why: t('O vento em altitude costuma ser bem mais forte que no chão. Perto do limite do fabricante o drone gasta muita bateria para se manter e pode não conseguir voltar.'),
    tips: [
      t('Decole contra o vento: o retorno, com a bateria mais baixa, fica a favor.'),
      t('Acima de 70% do limite, mantenha o drone perto e baixo.'),
      t('Drones de até 250 g sentem o vento antes — tenha margem extra.'),
    ],
  },
  gust: {
    title: t('Rajadas e turbulência'),
    why: t('Rajadas são picos curtos de vento. O Teto soma a parcela turbulenta medida a 10 m ao vento médio da sua altitude e compara com o limite do fabricante, com tolerância de 20% para picos de poucos segundos. Ar turbulento desestabiliza a imagem e pode derrubar drones leves.'),
    tips: [t('Evite voar a sotavento de prédios, morros e árvores.'), t('Use o modo Cine/Tripé apenas com vento calmo.')],
  },
  precip: {
    title: t('Chuva'),
    why: t('A maioria dos drones de consumo não tem proteção contra água. Umidade nos motores e na eletrônica pode causar pane em voo.'),
    tips: [t('Garoa também conta: gotas acumulam nas hélices e na lente.'), t('Seque o drone antes de guardar.')],
  },
  visibility: {
    title: t('Visibilidade'),
    why: t('As regras de quase todos os países exigem voo em linha de visada (VLOS). Névoa, fumaça e nevoeiro reduzem quanto você consegue enxergar o drone. A visibilidade prevista pelo modelo erra bastante, então na hora atual o Teto usa a medida da estação METAR mais próxima (até 25 km) quando ela existe.'),
    tips: [t('Com visibilidade abaixo de 3 km, encurte a distância do voo.'), t('Nevoeiro também atrapalha os sensores de obstáculo.')],
  },
  cloudbase: {
    title: t('Base de nuvens'),
    why: t('Estimada pela diferença entre temperatura e ponto de orvalho (~125 m por °C). Entrar na nuvem significa perder a visão do drone e molhar a eletrônica.'),
    tips: [t('Mantenha pelo menos 30 m abaixo da base estimada.'), t('Nuvens baixas e espessas costumam vir com umidade alta.')],
  },
  temperature: {
    title: t('Temperatura'),
    why: t('Baterias de LiPo perdem capacidade no frio e podem desligar abruptamente. No calor, motores e eletrônica superaquecem.'),
    tips: [t('Abaixo de 10°, aqueça as baterias (no bolso ou no carro) antes de decolar.'), t('Paire 1 minuto após decolar para aquecer as células.')],
  },
  kp: {
    title: t('Índice Kp (geomagnético)'),
    why: t('O Kp mede a atividade geomagnética causada pelo Sol. Valores altos degradam a precisão do GPS/GNSS e podem afetar a bússola, o que leva a derivas e a um retorno impreciso.'),
    tips: [t('Kp ≥ 5: prefira voos curtos, com a posição de retorno bem gravada.'), t('Calibre a bússola longe de metais se o app pedir.')],
  },
  daylight: {
    title: t('Luz do dia'),
    why: t('Voo noturno exige luzes de navegação no drone e, dependendo do país e da operação, autorização específica.'),
    tips: [t('Hora dourada e hora azul rendem as melhores imagens.'), t('Ative as luzes de posição do drone ao entardecer.')],
  },
  satellites: {
    title: t('Satélites disponíveis'),
    why: t('O drone precisa de satélites suficientes e bem distribuídos no céu para manter a posição, segurar o pairado e voltar ao ponto Home. O Teto calcula quantos satélites GPS, Galileo, GLONASS e BeiDou estão acima da máscara de elevação e a diluição de precisão (PDOP): quanto menor, melhor.'),
    tips: [
      t('Os números são para céu aberto: prédios, morros e árvores bloqueiam parte do céu.'),
      t('Espere o drone confirmar 10 ou mais satélites e gravar o Home antes de decolar.'),
      t('PDOP acima de 3 indica geometria ruim — o pairado pode derivar.'),
    ],
  },
  ionosphere: {
    title: t('Ionosfera e rádio'),
    why: t('Perto do equador magnético, inclusive em todo o Brasil, atua a Anomalia de Ionização Equatorial. Depois do pôr do sol, principalmente de setembro a março, surgem bolhas de plasma que fazem o sinal dos satélites cintilar: o receptor perde satélites e a precisão cai. O Teto mostra o índice S4 medido pela rede de monitoramento do INPE (fraca < 0,5; moderada até 0,8; forte acima). Erupções solares (escala R da NOAA) também degradam sinais de rádio no lado iluminado da Terra.'),
    tips: [
      t('A cintilação só aparece na hora atual: não existe previsão oficial dela.'),
      t('Com cintilação forte, mantenha o drone próximo e esteja pronto para o modo ATTI.'),
      t('Escala R3 ou maior: espere instabilidade no GNSS e no link de rádio.'),
    ],
  },
  airspace: {
    title: t('Espaço aéreo'),
    why: t('Pela ICA 100-40, o drone deve ficar a pelo menos 3 milhas náuticas (5,6 km) de um aeródromo para voar até 30 m de altura, e a 5 milhas náuticas (9,3 km) para voar entre 30 e 120 m. O Teto mede a distância até todos os aeródromos do cadastro oficial da ANAC. Quem autoriza o voo é o DECEA, pelo SARPAS NG.'),
    tips: [
      t('Desde 1º de julho de 2026, todo voo de drone precisa de autorização no SARPAS NG, inclusive abaixo de 250 g.'),
      t('Helipontos não aparecem no mapa do Teto — confira no SARPAS.'),
      t('Consulte NOTAMs no AISWEB para restrições temporárias.'),
    ],
  },
  storm: {
    title: t('Instabilidade'),
    why: t('CAPE mede a energia disponível para nuvens de tempestade. Sozinho ele não garante trovoada (em regiões tropicais passa de 1500 em muitas noites limpas), então o Teto só aponta risco de trovoada quando há CAPE alto junto com chance de chuva alta, trovoada prevista pelo modelo ou trovoada observada numa estação próxima.'),
    tips: [t('Se ouvir trovões, pouse imediatamente.'), t('Frentes de rajada chegam antes da chuva.')],
  },
};


/** Fora do Brasil não há regra única: o texto aponta a autoridade local. */
const AIRSPACE_INTL: Copy = {
  title: t('Espaço aéreo'),
  why: t('Fora do Brasil, o Teto mostra os aeroportos próximos (aviationweather.gov) e alerta a menos de 5 milhas náuticas (9,3 km). As distâncias, zonas e autorizações mudam de país para país: nos EUA a FAA libera áreas controladas pelo LAANC, na Europa valem as zonas geográficas de cada país (EASA).'),
  tips: [
    t('Consulte o app ou o mapa oficial de zonas da autoridade local antes de voar.'),
    t('Pistas pequenas e helipontos podem não aparecer no mapa do Teto.'),
    t('Restrições temporárias (NOTAM/TFR) não aparecem no Teto.'),
  ],
};

export default function FactorSheet() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: FactorId }>();
  const { location } = useActiveLocation();
  const { data, drone } = useConditions(location?.lat, location?.lon, location?.country);
  const unit = useApp((s) => s.speedUnit);
  const copy = id === 'airspace' && data?.region === 'INTL' ? AIRSPACE_INTL : (COPY[id as FactorId] ?? COPY.wind);
  const factor = data?.now.factors.find((f) => f.id === id);
  const next = data?.hours.slice(0, 12).map((h) => ({ t: h.hour.time, f: h.factors.find((x) => x.id === id) })) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <SheetHeader title={copy.title} left={null} right={t('OK')} onRight={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, gap: space.lg, paddingBottom: 48 }}>
        {factor ? (
          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Icon name={factorIcon[factor.id]} size={26} color={verdictColor(c, factor.status)} />
              <View style={{ flex: 1, gap: 4 }}>
                <T v="title3" num>
                  {factor.detail}
                </T>
                <StatusPill v={factor.status} label={verdictShort[factor.status]} small />
              </View>
            </View>
            {id === 'wind' || id === 'gust' ? (
              <T v="footnote" tone="secondary">
                {t('Limite do {drone}: {limit}', { drone: `${drone.brand} ${drone.name}`, limit: fmtSpeed(drone.maxWind, unit) })}
              </T>
            ) : null}
            {next.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: 4, marginTop: space.xs }}>
                {next.map((n) => (
                  <View key={n.t.getTime()} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View
                      style={{
                        width: '100%',
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: n.f ? verdictColor(c, n.f.status) : c.fill,
                      }}
                    />
                    <T v="caption2" tone="tertiary" num>
                      {String(n.t.getHours()).padStart(2, '0')}
                    </T>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}
        <T v="body">{copy.why}</T>
        {id === 'satellites' || id === 'ionosphere' || id === 'kp' ? (
          <Button
            title={t('Ver satélites e interferências')}
            kind="secondary"
            icon="satellite"
            onPress={() => {
              router.back();
              setTimeout(() => openPro('/gnss'), 250);
            }}
          />
        ) : null}
        <View style={{ gap: space.md }}>
          {copy.tips.map((tip) => (
            <View key={tip} style={{ flexDirection: 'row', gap: space.md }}>
              <Icon name="check" size={18} color={c.go} />
              <T v="subhead" tone="secondary" style={{ flex: 1 }}>
                {tip}
              </T>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

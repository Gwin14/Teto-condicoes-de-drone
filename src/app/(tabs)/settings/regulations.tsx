import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Card, ListRow, T } from '@/components/ui';
import { useActiveLocation } from '@/hooks/useLocation';
import { t } from '@/i18n';
import { authorityFor, regionAt } from '@/lib/region';
import { space, useTheme } from '@/theme/tokens';

type Rule = { icon: IconName; title: string; body: string };

const RULES_BR: Rule[] = [
  {
    icon: 'check',
    title: t('Autorização no SARPAS NG para todo voo'),
    body: t('Pela nova ICA 100-40 (Portaria DECEA nº 2.094/DNOR8, em vigor desde 1º de julho de 2026), qualquer drone precisa de autorização prévia no SARPAS NG, inclusive os abaixo de 250 g.'),
  },
  {
    icon: 'altitude',
    title: t('Até 120 m (400 ft) acima do solo'),
    body: t('É a altura máxima usual para operações sem autorização especial do DECEA. Acima disso, a operação precisa de análise específica.'),
  },
  {
    icon: 'visibility',
    title: t('Linha de visada (VLOS)'),
    body: t('Mantenha o drone sempre à vista, sem binóculos. Voos além da linha de visada (BVLOS) exigem autorização.'),
  },
  {
    icon: 'people',
    title: t('30 m de pessoas não anuentes'),
    body: t('A ANAC exige distância mínima de 30 m de pessoas que não concordaram com a operação, salvo exceções do RBAC-E nº 94.'),
  },
  {
    icon: 'airport',
    title: t('Longe de aeródromos e helipontos'),
    body: t('Até 30 m de altura, fique a pelo menos 3 NM (5,6 km) do aeródromo; entre 30 e 120 m, a 5 NM (9,3 km), segundo o DECEA. O mapa do Teto usa o cadastro de aeródromos da ANAC, mas não inclui helipontos: confira sempre no SARPAS NG.'),
  },
  {
    icon: 'drone',
    title: t('Cadastro no SISANT acima de 250 g'),
    body: t('Drones com peso de decolagem acima de 250 g precisam ser cadastrados na ANAC (SISANT), com a identificação visível na aeronave.'),
  },
  {
    icon: 'satellite',
    title: t('Homologação na Anatel'),
    body: t('O radiocontrole e a transmissão de vídeo do drone precisam ser homologados pela Anatel.'),
  },
  {
    icon: 'warning',
    title: t('Seguro RETA'),
    body: t('Para uso não recreativo acima de 250 g, é obrigatório seguro de responsabilidade civil contra terceiros (RETA).'),
  },
];

const LINKS_BR = [
  { title: t('SARPAS NG — solicitar voo (DECEA)'), url: 'https://sarpas.decea.mil.br' },
  { title: t('SISANT — cadastro de drones (ANAC)'), url: 'https://sistemas.anac.gov.br/sisant' },
  { title: t('Drones na ANAC'), url: 'https://www.gov.br/anac/pt-br/assuntos/drones' },
  { title: t('Drones no DECEA'), url: 'https://www.gov.br/decea/pt-br/assuntos/drone' },
  { title: t('Homologação na Anatel'), url: 'https://www.gov.br/anatel/pt-br/regulado/certificacao-de-produtos/drones' },
  { title: t('AISWEB — NOTAMs e cartas'), url: 'https://aisweb.decea.mil.br' },
];

/** Regras que se repetem na maior parte dos países. Não substituem a lei local. */
const RULES_INTL: Rule[] = [
  {
    icon: 'altitude',
    title: t('Cerca de 120 m (400 ft) acima do solo'),
    body: t('É o teto usual para drones recreativos e da categoria aberta nos EUA, no Canadá, no Reino Unido, na União Europeia e na maioria dos países.'),
  },
  {
    icon: 'visibility',
    title: t('Linha de visada (VLOS)'),
    body: t('Mantenha o drone sempre à vista. Voos além da linha de visada (BVLOS) exigem autorização especial em praticamente todos os países.'),
  },
  {
    icon: 'airport',
    title: t('Zonas de aeroportos e áreas restritas'),
    body: t('Perto de aeroportos, bases militares e áreas sensíveis o voo costuma ser proibido ou exigir autorização. Use o mapa oficial de zonas do país: o Teto mostra só os aeroportos com dados públicos e não inclui todos os helipontos.'),
  },
  {
    icon: 'people',
    title: t('Distância de pessoas'),
    body: t('Não sobrevoe pessoas que não participam da operação nem aglomerações. A distância mínima depende do país e da categoria do drone.'),
  },
  {
    icon: 'drone',
    title: t('Registro do drone e do piloto'),
    body: t('Muitos países exigem registrar o drone ou o operador acima de 250 g (na UE, também drones leves com câmera) e um teste ou curso online para o piloto.'),
  },
  {
    icon: 'warning',
    title: t('Seguro'),
    body: t('Alguns países exigem seguro de responsabilidade civil, principalmente para uso comercial.'),
  },
];

const LINKS_INTL = [
  { title: 'FAA — B4UFLY (EUA)', url: 'https://www.faa.gov/uas/getting_started/b4ufly' },
  { title: 'EASA — Drones (UE)', url: 'https://www.easa.europa.eu/en/domains/drones-air-mobility' },
  { title: 'UK CAA — Drone code', url: 'https://register-drones.caa.co.uk/drone-code' },
  { title: 'Transport Canada — Drone safety', url: 'https://tc.canada.ca/en/aviation/drone-safety' },
  { title: 'AESA — Drones (España)', url: 'https://www.seguridadaerea.gob.es/es/ambitos/drones' },
  { title: 'AFAC (México)', url: 'https://www.gob.mx/afac' },
];

export default function RegulationsScreen() {
  const { c } = useTheme();
  const { location } = useActiveLocation();
  const br = location ? regionAt(location.lat, location.lon, location.country) === 'BR' : true;
  const authority = br ? null : authorityFor(location?.country);
  const rules = br ? RULES_BR : RULES_INTL;
  const links = br ? LINKS_BR : authority ? [authority, ...LINKS_INTL.filter((l) => l.url !== authority.url)] : LINKS_INTL;

  return (
    <>
      <Stack.Screen options={{ title: br ? t('Regras no Brasil') : t('Regras para drones') }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: c.background }}
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 80 }}>
        <T v="subhead" tone="secondary" style={{ paddingHorizontal: space.xs }}>
          {br
            ? t('Resumo das principais regras para drones no Brasil. Sempre confira as normas vigentes nos sites oficiais.')
            : t('Regras comuns na maioria dos países. A lei muda de um país para outro: confira sempre a autoridade de aviação do lugar onde você vai voar.')}
        </T>
        <Card style={{ gap: space.lg }}>
          {rules.map((r) => (
            <View key={r.title} style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ width: 32, height: 32, borderRadius: 9, borderCurve: 'continuous', backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={r.icon} size={16} color={c.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="headline">{r.title}</T>
                <T v="subhead" tone="secondary">
                  {r.body}
                </T>
              </View>
            </View>
          ))}
        </Card>
        <View style={{ gap: space.sm }}>
          <T v="footnote" tone="secondary" style={{ paddingHorizontal: space.lg, textTransform: 'uppercase' }}>
            {t('Fontes oficiais')}
          </T>
          <Card padded={false}>
            {links.map((l, i) => (
              <ListRow
                key={l.url}
                title={'title' in l ? l.title : l.name}
                right={<Icon name="link" size={14} color={c.tertiary} />}
                onPress={() => WebBrowser.openBrowserAsync(l.url)}
                last={i === links.length - 1}
              />
            ))}
          </Card>
        </View>
      </ScrollView>
    </>
  );
}

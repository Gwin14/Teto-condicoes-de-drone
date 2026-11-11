# Teto — condições de voo para drones

App em React Native + Expo (SDK 58, Expo Router) que diz se dá para voar agora, onde e até quando, com base no **seu drone** e na **altitude que você vai voar**.

## Funcionalidades

**Agora**
- Score de voo de 0 a 100 com veredito (Bom / Cautela / Não recomendado) calculado com os limites oficiais do drone escolhido.
- Fatores explicados um a um: vento e rajadas na altitude planejada, chuva, visibilidade (VLOS), base de nuvens estimada, temperatura da bateria, índice Kp (GNSS), luz do dia, instabilidade (CAPE) e espaço aéreo.
- Faixa das próximas 24 h, **janelas de tempo ideal** nas próximas 48 h com alerta 30 min antes, perfil de vento por altitude (10/80/120/180 m interpolados), autonomia útil estimada, altitude-densidade, UV, luz e METAR decodificado dos aeródromos próximos.

**Satélites e interferência**
- Satélites GNSS visíveis agora e nas próximas 24 h (GPS, Galileo, GLONASS e BeiDou), calculados a partir das órbitas publicadas pela CelesTrak, com carta do céu (skyplot), contagem por constelação, PDOP/HDOP e máscara de elevação ajustável.
- Cintilação ionosférica **medida** (índice S4 dos mapas do EMBRACE/INPE, atualizados a cada minuto). Não há previsão oficial, então ela só entra na hora atual. Funciona no app nativo; o servidor do INPE bloqueia navegadores (CORS).
- Clima espacial da NOAA: escalas R (rádio/erupções solares), S (radiação) e G (geomagnética), previsão de 3 dias, fluxo solar F10.7 e Kp observado/previsto.
- Dicas de interferência local (linhas de energia, torres, Wi-Fi 2,4/5,8 GHz, metal, radares).
- Satélites e ionosfera entram no score de voo.

**Mapa** — aeródromos do cadastro oficial da ANAC com os afastamentos do DECEA (3 NM até 30 m, 5 NM até 120 m), pontos de voo salvos e condições de qualquer ponto (mantenha pressionado). Usa `react-native-maps`, que já vem no Expo Go.

**Previsão** — tabela horária no estilo go/no-go (FlashList) e visão de 7 dias com as horas boas de cada dia.

**Voo**
- Checklist pré-voo (SARPAS, SISANT, RETA, hélices, RTH…) que libera a decolagem.
- Sessão ao vivo: cronômetro, bateria útil drenando e lembrete de retorno, com **Live Activity + Dynamic Island** no iOS e mini-player no acessório da tab bar (iOS 26).
- **Bússola de vento**: aponte o celular e veja vento de proa, de cauda e lateral.
- **Retorno seguro**: % de bateria necessária para voltar contra o vento, com reserva.
- **Planejador de luz**: hora dourada e azul, curva do Sol e direção das sombras.
- Diário de bordo.

**Ajustes** — 12 perfis de drone (DJI, Autel, FPV) mais um perfil personalizado, altitude planejada, unidades (km/h, m/s, kt, mph; °C/°F), regras ANAC/DECEA/Anatel com links oficiais e prévias dos widgets.

**Widgets** (via `expo-widgets`)
- iOS: tela inicial (pequeno, médio e grande), com **timeline horária de 12 h**, então o widget continua certo mesmo sem abrir o app.
- iOS: tela bloqueada (circular com gauge, retangular e inline).
- Android: widget de tela inicial (Glance / Jetpack Compose).
- Live Activity "Em voo" (tela bloqueada e Dynamic Island).

## Idiomas e regiões

- Português (Brasil), inglês e espanhol, escolhidos pelo idioma do aparelho (`src/i18n`). O texto-fonte é o português: `t('Bom para voar')`. Traduções em `src/i18n/en.ts` e `es.ts`; `npm run i18n:check` aponta chaves faltando.
- Regras por região (`src/lib/region.ts`): no Brasil valem ANAC/DECEA/SARPAS e o cadastro de aeródromos da ANAC; fora dele, aeroportos do aviationweather.gov com alerta de 5 NM e link para a autoridade local.

## Teto Pro (RevenueCat)

- Entitlement `pro`, offering `default`: `app.teto.drone.pro.annual` (7 dias grátis), `.monthly` e `.lifetime` (vitalício).
- `src/lib/purchases.ts` configura o SDK, guarda o estado em `useApp().pro` e expõe `openPro(rota)` / `requirePro(ação)`. Paywall em `src/app/paywall.tsx`.
- Grátis: condições de agora, 24 h, fatores, mapa, checklist, cronômetro e diário. Pro: 7 dias, alertas de janela, widgets e Live Activity, satélites/clima espacial, bússola, retorno seguro, planejador de luz e drone personalizado.

## Expo Go × development build

Tudo funciona no **Expo Go**, exceto widgets e Live Activities, que exigem código nativo:

| Recurso | Expo Go | Dev build |
|---|---|---|
| Telas, mapa, GPS, bússola, notificações locais, haptics | ✅ | ✅ |
| Widgets de tela inicial e tela bloqueada | Prévia em Ajustes › Widgets | ✅ |
| Live Activity / Dynamic Island | Prévia na aba Voo | ✅ (iOS) |

O isolamento fica em `src/native/capabilities.ts` e `src/native/widgets.ts`: no Expo Go os módulos de widget nunca são carregados (`require` preguiçoso, protegido por `isRunningInExpoGo()` e `requireOptionalNativeModule`), então nada quebra.

## Rodando

```bash
npm install
npx expo start            # abra no Expo Go
npx expo run:ios          # development build com widgets e Live Activity
npx expo run:android      # development build com widget Android
```

Para o Google Maps numa build Android própria, adicione a chave em `android.config.googleMaps.apiKey` no `app.json` (o Expo Go já traz a dele).

```bash
npm run typecheck
npm run lint
```

## Estrutura

```
src/app/            rotas (Expo Router): abas nativas + modais/sheets
src/components/     UI (cartões, anel de score, mapa, prévias)
src/lib/            score, clima, sol, aeródromos, drones, formatação
src/hooks/          localização ativa e condições (TanStack Query)
src/store/          estado persistido (Zustand + AsyncStorage)
src/native/         pontes nativas com guarda para Expo Go
src/widgets/        widgets e Live Activity (@expo/ui + diretiva 'widget')
```

## Fontes de dados (sem chave de API)

- [Open-Meteo](https://open-meteo.com): previsão horária, vento em altitude e geocodificação
- [NOAA SWPC](https://www.swpc.noaa.gov): índice Kp, escalas R/S/G e fluxo solar
- [aviationweather.gov](https://aviationweather.gov): METAR e as bases militares que não constam na ANAC
- [CelesTrak](https://celestrak.org): elementos orbitais das constelações GNSS
- [ANAC — dados abertos](https://www.gov.br/anac/pt-br/acesso-a-informacao/dados-abertos): cadastro de aeródromos públicos e privados
- [EMBRACE/INPE](https://embracedata.inpe.br/scintillation/maps/readme_scintillation_maps.html): mapas de cintilação S4 (redes INPE, IBGE, INCT GNSS-NavAer/UNESP e NSSC/CAS)
- [DECEA — Central de Ajuda](https://ajuda.decea.mil.br/artigos/qual-a-altura-e-distancia-ideal-de-aeroportos-e-heliportos-para-um-voo-de-drone): afastamento mínimo de aeródromos (ICA 100-40)

O app traz um snapshot do cadastro da ANAC em `src/data/aerodromes.json` (funciona offline e na web) e, no celular, baixa a versão atual da ANAC uma vez por semana. Para atualizar o snapshot:

```bash
npm run update:aerodromes
```

> Helipontos não estão no mapa. A autorização oficial é sempre a do DECEA, pelo SARPAS NG.

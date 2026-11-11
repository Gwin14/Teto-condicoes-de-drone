import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { SkyPlot } from '@/components/gnss/SkyPlot';
import { Icon, type IconName } from '@/components/Icon';
import { Segmented } from '@/components/Segmented';
import { Card, EmptyState, InlineError, SectionHeader, Skeleton, StatusPill, T } from '@/components/ui';
import { S4_AVAILABLE, useConstellations, useForecast, useKp, useScintillation, useSpaceWeather } from '@/hooks/useConditions';
import { useActiveLocation } from '@/hooks/useLocation';
import { useNow } from '@/hooks/useNow';
import { fmtNum, t } from '@/i18n';
import { fmtHour, fmtTime, fmtWeekday } from '@/lib/format';
import { CONSTELLATIONS, type Constellation, fmtDop, satellitePositions, snapshot } from '@/lib/gnss';
import { kpLabel, scintLabel } from '@/lib/scoring';
import { isS4Fresh, s4At, scaleText, type ScintLevel } from '@/lib/spaceWeather';
import { useApp } from '@/store/app';
import { radius, space, useConstellationColors, useTheme, type Verdict, verdictColor } from '@/theme/tokens';

const MASKS = [5, 10, 15, 20];
const scintVerdict: Record<ScintLevel, Verdict> = { fraca: 'go', moderada: 'caution', forte: 'nogo' };

export default function GnssScreen() {
  const { c } = useTheme();
  const colors = useConstellationColors();
  const { width } = useWindowDimensions();
  const { location } = useActiveLocation();
  const forecast = useForecast(location?.lat, location?.lon);
  const sats = useConstellations();
  const sw = useSpaceWeather();
  const kp = useKp();
  const s4 = useScintillation();
  const mask = useApp((s) => s.gnssMask);
  const altitude = useApp((s) => s.altitude);
  const set = useApp((s) => s.set);
  const [sel, setSel] = useState<number | null>(null);
  // Relógio em estado: o céu se move, a tela recalcula a cada minuto.
  const now = useNow(60_000);

  if (!location) {
    return <EmptyState icon="location" title={t('Escolha um local')} message={t('A contagem de satélites depende de onde você está.')} />;
  }
  const elevation = (forecast.data?.elevation ?? 0) + altitude;
  const W = Math.min(width, 600) - space.lg * 4;

  const all = sats.data ? satellitePositions(sats.data.sats, location.lat, location.lon, elevation, now) : [];
  const snapNow = sats.data ? snapshot(sats.data.sats, location.lat, location.lon, elevation, now, mask) : null;
  // Linha do tempo: 24 h a cada 30 min.
  const timeline = sats.data
    ? Array.from({ length: 48 }).map((_, i) => snapshot(sats.data!.sats, location.lat, location.lon, elevation, now + i * 30 * 60_000, mask))
    : [];
  const maxVisible = Math.max(1, ...timeline.map((x) => x.visible.length));
  const minVisible = timeline.length ? Math.min(...timeline.map((x) => x.visible.length)) : 0;
  const worstPdop = timeline.reduce((m, x) => Math.max(m, Number.isFinite(x.pdop) ? x.pdop : 99), 0);
  const selected = sel != null ? timeline[sel] : null;

  const kpNow = kp.data?.now ?? 0;
  const reading = s4At(s4.data, location.lat, location.lon);
  const scintNow = isS4Fresh(reading, now) ? reading : null;
  const s4Age = reading ? Math.round((now - reading.time.getTime()) / 60_000) : null;

  const kpPoints = (kp.data?.points ?? []).filter((p) => p.time.getTime() > now - 24 * 3600_000).slice(0, 24);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 80 }}>
      {/* --------------------------------------------------- Satélites agora */}
      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('Satélites agora')} icon="satellite" />
        <Card style={{ gap: space.lg }}>
          {sats.isLoading ? (
            <Skeleton style={{ height: W, borderRadius: W / 2 }} />
          ) : sats.error || !snapNow ? (
            <InlineError message={t('Não foi possível baixar os elementos orbitais (CelesTrak).')} onRetry={() => sats.refetch()} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
                <T v="largeTitle" num>
                  {snapNow.visible.length}
                </T>
                <T v="subhead" tone="secondary" style={{ flex: 1 }}>
                  {t('visíveis acima de {mask}° · {n} acima do horizonte', { mask, n: all.length })}
                </T>
              </View>
              <View style={{ alignItems: 'center' }}>
                <SkyPlot sats={all} mask={mask} size={Math.min(W, 320)} />
              </View>
              {/* Legenda + tabela (identidade nunca só pela cor) */}
              <View>
                <View style={{ flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: c.separator }}>
                  <T v="caption2" tone="tertiary" style={{ flex: 1 }}>
                    {t('CONSTELAÇÃO')}
                  </T>
                  <T v="caption2" tone="tertiary" style={{ width: 64, textAlign: 'right' }}>
                    {t('VISÍVEIS')}
                  </T>
                  <T v="caption2" tone="tertiary" style={{ width: 70, textAlign: 'right' }}>
                    {t('NA ÓRBITA')}
                  </T>
                </View>
                {CONSTELLATIONS.map((k) => {
                  const total = sats.data!.sats.filter((s) => s.constellation === k.id).length;
                  const failed = sats.data!.failed.includes(k.id);
                  return (
                    <View key={k.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: c.separator }}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors[k.id], alignItems: 'center', justifyContent: 'center' }}>
                          <T v="caption2" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                            {k.letter}
                          </T>
                        </View>
                        <T v="body">{k.label}</T>
                      </View>
                      <T v="body" num style={{ width: 64, textAlign: 'right', fontWeight: '600' }}>
                        {failed ? '—' : snapNow.byConstellation[k.id]}
                      </T>
                      <T v="body" num tone="secondary" style={{ width: 70, textAlign: 'right' }}>
                        {failed ? t('falhou') : total}
                      </T>
                    </View>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Metric label="PDOP" value={fmtDop(snapNow.pdop)} note={t('posição 3D')} />
                <Metric label="HDOP" value={fmtDop(snapNow.hdop)} note={t('horizontal')} />
                <Metric label="GPS" value={String(snapNow.byConstellation.gps)} note={t('só GPS')} />
              </View>
              <View style={{ gap: space.sm }}>
                <T v="subhead" tone="secondary">
                  {t('Máscara de elevação')}
                </T>
                <Segmented
                  values={MASKS.map((m) => `${m}°`)}
                  selectedIndex={Math.max(0, MASKS.indexOf(mask))}
                  onChange={(e) => {
                    Haptics.selectionAsync().catch(() => {});
                    set('gnssMask', MASKS[e.nativeEvent.selectedSegmentIndex]);
                  }}
                />
                <T v="caption" tone="tertiary">
                  {t('Satélites muito baixos no horizonte chegam com sinal fraco e mais erro. Em locais cercados por prédios ou árvores, use 15–20°.')}
                </T>
              </View>
            </>
          )}
        </Card>
      </View>

      {/* ------------------------------------------------- Próximas 24 horas */}
      {timeline.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SectionHeader title={t('Satélites nas próximas 24 h')} icon="timer" />
          <Card style={{ gap: space.md }}>
            <T v="subhead" tone="secondary" num>
              {selected
                ? t('{time} · {n} satélites · PDOP {pdop}', { time: fmtTime(selected.time), n: selected.visible.length, pdop: fmtDop(selected.pdop) })
                : t('Mínimo de {n} satélites · pior PDOP {pdop}. Toque numa barra.', { n: minVisible, pdop: fmtDop(worstPdop) })}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 2 }}>
              {timeline.map((snap, i) => {
                const h = (snap.visible.length / maxVisible) * 110;
                const active = sel === i;
                return (
                  <Pressable
                    key={snap.time.getTime()}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSel(active ? null : i);
                    }}
                    hitSlop={{ top: 20, bottom: 4 }}
                    accessibilityLabel={t('{time}: {n} satélites', { time: fmtTime(snap.time), n: snap.visible.length })}
                    style={{ flex: 1, height: 110, justifyContent: 'flex-end', opacity: sel == null || active ? 1 : 0.4 }}>
                    <View style={{ height: h, borderTopLeftRadius: 2, borderTopRightRadius: 2, overflow: 'hidden', gap: 1 }}>
                      {(['beidou', 'glonass', 'galileo', 'gps'] as Constellation[]).map((k) =>
                        snap.byConstellation[k] > 0 ? (
                          <View key={k} style={{ flex: snap.byConstellation[k], backgroundColor: colors[k] }} />
                        ) : null
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {[0, 12, 24, 36, 47].map((i) => (
                <T key={i} v="caption2" tone="tertiary" num>
                  {fmtHour(timeline[i].time)}
                </T>
              ))}
            </View>
            <Legend />
            <T v="footnote" tone="secondary" style={{ marginTop: space.xs }}>
              {t('PDOP a cada 30 min (menor é melhor; acima de 3 é ruim)')}
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 44, gap: 2 }}>
              {timeline.map((snap, i) => {
                const p = Number.isFinite(snap.pdop) ? snap.pdop : 6;
                const v: Verdict = p > 6 ? 'nogo' : p > 3 ? 'caution' : 'go';
                return (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: Math.max(3, Math.min(1, p / 6) * 44),
                      backgroundColor: verdictColor(c, v),
                      borderTopLeftRadius: 2,
                      borderTopRightRadius: 2,
                      opacity: sel == null || sel === i ? 1 : 0.4,
                    }}
                  />
                );
              })}
            </View>
            <T v="caption" tone="tertiary">
              {t('Calculado a partir das órbitas publicadas, para céu aberto. Obstáculos reduzem o número real.')}
            </T>
          </Card>
        </View>
      ) : null}

      {/* -------------------------------------------------- Cintilação */}
      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('Cintilação ionosférica')} icon="globe" />
        <Card style={{ gap: space.md }}>
          {!S4_AVAILABLE ? (
            <T v="subhead" tone="secondary">
              {t('A medição do INPE só pode ser baixada pelo app no celular: o servidor não permite acesso pelo navegador.')}
            </T>
          ) : s4.isLoading ? (
            <Skeleton style={{ height: 48 }} />
          ) : s4.error && !s4.data ? (
            <InlineError message={t('Mapa de cintilação do INPE indisponível agora.')} onRetry={() => s4.refetch()} />
          ) : scintNow ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="title3" num>
                    {t('S4 {s4} · cintilação {level}', { s4: fmtNum(scintNow.s4, 2), level: scintLabel[scintNow.level] })}
                  </T>
                  <T v="footnote" tone="secondary" num>
                    {t('Medido às {time} (há {n} min)', { time: fmtTime(scintNow.time), n: s4Age ?? 0 })}
                    {scintNow.distanceKm > 30 ? ` · ${t('célula a {km} km', { km: Math.round(scintNow.distanceKm) })}` : ''}
                  </T>
                </View>
                <StatusPill v={scintVerdict[scintNow.level]} label={scintLabel[scintNow.level]} small />
              </View>
              <T v="footnote" tone="secondary">
                {scintNow.level === 'fraca'
                  ? t('Sinal dos satélites estável na ionosfera sobre o seu local.')
                  : t('O sinal dos satélites está oscilando: o receptor pode perder satélites e a precisão cai. Mantenha o drone próximo.')}
              </T>
            </>
          ) : (
            <T v="subhead" tone="secondary">
              {reading
                ? t('A última medição perto daqui é das {time} e já não representa o momento atual.', { time: fmtTime(reading.time) })
                : t('Nenhuma estação de monitoramento cobre este local agora. A rede do INPE cobre principalmente o Brasil.')}
            </T>
          )}
          <T v="caption" tone="tertiary">
            {t('Índice S4 medido pela rede EMBRACE/INPE, IBGE, INCT GNSS-NavAer/UNESP e NSSC/CAS. Não existe previsão oficial de cintilação: a temporada de bolhas de plasma no Brasil vai de setembro a março, após o pôr do sol.')}
          </T>
        </Card>
      </View>

      {/* ---------------------------------------------------- Clima espacial */}
      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('Clima espacial (NOAA)')} icon="sunStorm" />
        {sw.error && !sw.data ? <InlineError message={t('Escalas da NOAA indisponíveis.')} onRetry={() => sw.refetch()} /> : null}
        <Card padded={false}>
          <ScaleRow icon="radio" code="R" label={t('Apagão de rádio')} level={sw.data?.now.r ?? 0} text={scaleText.r} effect={t('Erupções solares: degradam GNSS e rádio no lado iluminado')} />
          <ScaleRow icon="sunStorm" code="S" label={t('Radiação solar')} level={sw.data?.now.s ?? 0} text={scaleText.s} effect={t('Partículas energéticas: efeito pequeno no voo de drones')} />
          <ScaleRow icon="compass" code="G" label={t('Geomagnética')} level={sw.data?.now.g ?? 0} text={scaleText.g} effect={`Kp ${fmtNum(kpNow, 1)} · ${kpLabel(kpNow)}`} last />
        </Card>
        {sw.data && sw.data.forecast.length > 0 ? (
          <Card style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row' }}>
              <T v="caption2" tone="tertiary" style={{ flex: 1 }}>
                {t('PREVISÃO')}
              </T>
              <T v="caption2" tone="tertiary" style={{ width: 84, textAlign: 'right' }}>
                {t('ERUPÇÃO R1+')}
              </T>
              <T v="caption2" tone="tertiary" style={{ width: 70, textAlign: 'right' }}>
                R3+
              </T>
              <T v="caption2" tone="tertiary" style={{ width: 44, textAlign: 'right' }}>
                G
              </T>
            </View>
            {sw.data.forecast.map((d) => (
              <View key={d.date.getTime()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T v="subhead" style={{ flex: 1 }}>
                  {fmtWeekday(d.date)}
                </T>
                <T v="subhead" num tone="secondary" style={{ width: 84, textAlign: 'right' }}>
                  {d.rMinorProb != null ? `${d.rMinorProb}%` : '—'}
                </T>
                <T v="subhead" num tone="secondary" style={{ width: 70, textAlign: 'right' }}>
                  {d.rMajorProb != null ? `${d.rMajorProb}%` : '—'}
                </T>
                <T v="subhead" num style={{ width: 44, textAlign: 'right', fontWeight: '600' }}>
                  G{d.g}
                </T>
              </View>
            ))}
          </Card>
        ) : null}
      </View>

      {/* -------------------------------------------------------- Kp 72 h */}
      {kpPoints.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SectionHeader title={t('Índice Kp · últimas 24 h e próximos dias')} icon="gauge" />
          <Card style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 2 }}>
              {kpPoints.map((p) => {
                const v: Verdict = p.kp >= 7 ? 'nogo' : p.kp >= 5 ? 'caution' : 'go';
                return (
                  <View
                    key={p.time.getTime()}
                    accessible
                    accessibilityLabel={`${fmtWeekday(p.time)} ${fmtHour(p.time)}: Kp ${fmtNum(p.kp, 1)}${p.observed ? '' : ` ${t('previsto')}`}`}
                    style={{
                      flex: 1,
                      height: Math.max(4, (p.kp / 9) * 90),
                      backgroundColor: verdictColor(c, v),
                      opacity: p.observed ? 1 : 0.45,
                      borderTopLeftRadius: 3,
                      borderTopRightRadius: 3,
                    }}
                  />
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T v="caption2" tone="tertiary">
                {fmtWeekday(kpPoints[0].time)} {fmtHour(kpPoints[0].time)}
              </T>
              <T v="caption2" tone="tertiary">
                {fmtWeekday(kpPoints[kpPoints.length - 1].time)} {fmtHour(kpPoints[kpPoints.length - 1].time)}
              </T>
            </View>
            <T v="caption" tone="tertiary">
              {t('Barras cheias = observado · esmaecidas = previsão. Escala 0–9; a partir de 5 há tempestade geomagnética.')}
            </T>
          </Card>
        </View>
      ) : null}

      {/* ------------------------------------------------ Interferência local */}
      <View style={{ gap: space.sm }}>
        <SectionHeader title={t('Interferência no local')} icon="wifi" />
        <Card style={{ gap: space.lg }}>
          <Tip icon="powerline" title={t('Linhas de energia e subestações')} body={t('Campos fortes atrapalham a bússola. Decole a pelo menos 30 m de distância e nunca cruze fios.')} />
          <Tip icon="radio" title={t('Torres de celular e rádio')} body={t('Antenas potentes podem interferir no link de controle e vídeo. Evite voar colado a elas.')} />
          <Tip icon="wifi" title={t('Wi-Fi congestionado (2,4/5,8 GHz)')} body={t('Em centros urbanos e eventos, o link sofre. Prefira 5,8 GHz quando disponível e mantenha a antena do controle apontada.')} />
          <Tip icon="compass" title={t('Metal e concreto armado')} body={t('Carros, lajes, pontes e trilhos desviam a bússola. Calibre e decole longe deles, sobre o chão.')} />
          <Tip icon="airport" title={t('Radares e aeroportos')} body={t('Perto de radares o rádio pode oscilar — e costuma ser zona restrita. Confira as regras de espaço aéreo.')} />
        </Card>
      </View>
    </ScrollView>
  );
}

function Legend() {
  const colors = useConstellationColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {CONSTELLATIONS.map((k) => (
        <View key={k.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors[k.id] }} />
          <T v="caption" tone="secondary">
            {k.label}
          </T>
        </View>
      ))}
    </View>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.background, borderRadius: radius.inner, borderCurve: 'continuous', padding: space.md, gap: 2 }}>
      <T v="caption" tone="secondary">
        {label}
      </T>
      <T v="title3" num>
        {value}
      </T>
      <T v="caption2" tone="tertiary">
        {note}
      </T>
    </View>
  );
}

function ScaleRow({
  icon,
  code,
  label,
  level,
  text,
  effect,
  last,
}: {
  icon: IconName;
  code: string;
  label: string;
  level: number;
  text: string[];
  effect: string;
  last?: boolean;
}) {
  const { c } = useTheme();
  const v: Verdict = level >= 3 ? 'nogo' : level >= 1 ? 'caution' : 'go';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg }}>
      <Icon name={icon} size={18} color={c.secondary} />
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingVertical: space.md,
          paddingRight: space.lg,
          borderBottomWidth: last ? 0 : 0.5,
          borderBottomColor: c.separator,
        }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="body">{label}</T>
          <T v="footnote" tone="secondary">
            {text[level]} · {effect}
          </T>
        </View>
        <StatusPill v={v} label={`${code}${level}`} small />
      </View>
    </View>
  );
}

function Tip({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      <View style={{ width: 32, height: 32, borderRadius: 9, borderCurve: 'continuous', backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} color={c.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="headline">{title}</T>
        <T v="subhead" tone="secondary">
          {body}
        </T>
      </View>
    </View>
  );
}

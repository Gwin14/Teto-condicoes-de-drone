import * as Haptics from 'expo-haptics';
import { Alert, Pressable, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Card, T } from '@/components/ui';
import { t } from '@/i18n';
import { fmtHour, fmtWeekday } from '@/lib/format';
import { requirePro } from '@/lib/purchases';
import type { FlightWindow } from '@/lib/scoring';
import { capabilities } from '@/native/capabilities';
import { cancelAlert, scheduleWindowAlert, windowKey } from '@/native/notifications';
import { useApp } from '@/store/app';
import { radius, space, useTheme } from '@/theme/tokens';

/** "Janela ideal": o melhor bloco contínuo para voar nas próximas 48 h. */
export function WindowCard({ windows, place, restrictedBy, region = 'BR' }: { windows: FlightWindow[]; place: string; restrictedBy?: string; region?: 'BR' | 'INTL' }) {
  const { c } = useTheme();
  const alerts = useApp((s) => s.scheduledWindowAlerts);
  const set = useApp((s) => s.set);
  const chrono = [...windows].sort((a, b) => a.start.getTime() - b.start.getTime());
  const best = windows[0];

  if (!best) {
    return (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Icon name="warning" size={22} color={c.caution} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="headline">{t('Nenhuma janela boa em 48 h')}</T>
          <T v="footnote" tone="secondary">
            {t('Nenhuma sequência de horas com luz do dia e score acima de 70. Veja a previsão de 7 dias.')}
          </T>
        </View>
      </Card>
    );
  }

  const toggle = async (w: FlightWindow) => {
    const key = windowKey(w);
    if (!alerts[key] && !requirePro(() => {})) return;
    if (alerts[key]) {
      await cancelAlert(alerts[key]);
      const next = { ...alerts };
      delete next[key];
      set('scheduledWindowAlerts', next);
      Haptics.selectionAsync().catch(() => {});
      return;
    }
    if (!capabilities.localNotifications) {
      Alert.alert(t('Indisponível'), t('Alertas de janela funcionam no app para iOS e Android.'));
      return;
    }
    const id = await scheduleWindowAlert(w, place);
    if (id) {
      set('scheduledWindowAlerts', { ...alerts, [key]: id });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Alert.alert(t('Permissão necessária'), t('Ative as notificações do Teto nos Ajustes do sistema para receber o alerta.'));
    }
  };

  return (
    <Card padded={false}>
      {chrono.slice(0, 3).map((w, i, arr) => {
        const isBest = w === best;
        const on = !!alerts[windowKey(w)];
        return (
          <View
            key={w.start.getTime()}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              paddingVertical: space.md,
              paddingHorizontal: space.lg,
              borderBottomWidth: i === arr.length - 1 ? 0 : 0.5,
              borderBottomColor: c.separator,
            }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.inner,
                borderCurve: 'continuous',
                backgroundColor: isBest ? c.goSoft : c.fill,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <T v="headline" num style={{ color: isBest ? c.go : c.label }}>
                {w.avgScore}
              </T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <T v="headline" num>
                  {fmtWeekday(w.start)}, {fmtHour(w.start)}–{fmtHour(w.end)}
                </T>
              </View>
              <T v="footnote" tone="secondary">
                {isBest ? `${t('Melhor janela')} · ` : ''}
                {t('{n} h seguidas · pico {peak}', { n: w.hours, peak: w.peak })}
              </T>
            </View>
            <Pressable
              onPress={() => toggle(w)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={on ? t('Cancelar alerta desta janela') : t('Avisar 30 minutos antes')}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: on ? c.accent : c.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}>
              <Icon name={on ? 'bell' : 'bellAdd'} size={17} color={on ? c.onAccent : c.accent} />
            </Pressable>
          </View>
        );
      })}
      {restrictedBy ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
          <T v="caption" tone="tertiary">
            {region === 'BR'
              ? t('Janelas pelo tempo. Este local fica na zona estimada de {icao} e exige autorização no SARPAS.', { icao: restrictedBy })
              : t('Janelas pelo tempo. Este local fica perto de {icao}: confira as regras locais.', { icao: restrictedBy })}
          </T>
        </View>
      ) : null}
    </Card>
  );
}

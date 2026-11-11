import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { SheetHeader } from '@/components/SheetHeader';
import { Card, T } from '@/components/ui';
import { categoryLabel, DRONES } from '@/lib/drones';
import { t } from '@/i18n';
import { fmtSpeed } from '@/lib/format';
import { openPro } from '@/lib/purchases';
import { useApp } from '@/store/app';
import { space, useTheme } from '@/theme/tokens';

/** Hangar: o perfil do drone define limites de vento, temperatura e autonomia. */
export default function DroneSheet() {
  const { c } = useTheme();
  const droneId = useApp((s) => s.droneId);
  const custom = useApp((s) => s.customDrone);
  const unit = useApp((s) => s.speedUnit);
  const set = useApp((s) => s.set);
  const list = custom ? [custom, ...DRONES] : DRONES;

  const choose = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    set('droneId', id);
    router.back();
  };

  return (
    // ScrollView como raiz da sheet, com o cabeçalho fixo (sticky) e fundo opaco:
    // a lista rola por baixo do título, nunca por cima dele.
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      stickyHeaderIndices={[0]}
      contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={{ backgroundColor: c.background, zIndex: 1 }}>
        <SheetHeader title={t('Seu drone')} left={null} right={t('OK')} onRight={() => router.back()} />
      </View>
      <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
        <T v="footnote" tone="secondary" style={{ paddingHorizontal: space.xs }}>
          {t('O score usa os limites oficiais do fabricante: resistência ao vento, faixa de temperatura e autonomia.')}
        </T>
        <Card padded={false}>
          {list.map((d, i) => {
            const active = d.id === droneId;
            return (
              <Pressable key={d.id} onPress={() => choose(d.id)} accessibilityRole="button" accessibilityState={{ selected: active }}>
                {({ pressed }) => (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingLeft: space.lg,
                      backgroundColor: pressed ? c.fill : 'transparent',
                    }}>
                    <View
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: space.md,
                        paddingRight: space.lg,
                        borderBottomWidth: i === list.length - 1 ? 0 : 0.5,
                        borderBottomColor: c.separator,
                        gap: space.md,
                      }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <T v="body" style={{ fontWeight: active ? '600' : '400' }}>
                          {d.brand} {d.name}
                        </T>
                        <T v="footnote" tone="secondary" num>
                          {categoryLabel[d.category]} · {d.weightG} g · {t('vento até {speed}', { speed: fmtSpeed(d.maxWind, unit) })} · {d.flightTime} min
                        </T>
                      </View>
                      {active ? <Icon name="check" size={22} color={c.accent} /> : null}
                    </View>
                  </View>
                )}
              </Pressable>
            );
          })}
        </Card>
        <Pressable
          onPress={() => {
            router.back();
            setTimeout(() => openPro('/settings/drone-custom'), 250);
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingVertical: space.sm, alignItems: 'center' })}>
          <T v="body" tone="accent">
            {custom ? t('Editar drone personalizado') : t('Criar perfil personalizado')}
          </T>
        </Pressable>
      </View>
    </ScrollView>
  );
}

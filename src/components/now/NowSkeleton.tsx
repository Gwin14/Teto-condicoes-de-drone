import { View } from 'react-native';

import { Card, Skeleton } from '@/components/ui';
import { t } from '@/i18n';
import { space } from '@/theme/tokens';

/** Skeleton no formato exato da tela final (hero, faixa horária, fatores). */
export function NowSkeleton() {
  return (
    <View style={{ gap: space.lg }} accessibilityLabel={t('Carregando condições')}>
      <Skeleton style={{ height: 14, width: '60%' }} />
      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
          <Skeleton style={{ width: 132, height: 132, borderRadius: 66 }} />
          <View style={{ flex: 1, gap: space.sm }}>
            <Skeleton style={{ height: 24, width: '80%' }} />
            <Skeleton style={{ height: 14 }} />
            <Skeleton style={{ height: 14, width: '70%' }} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ flex: 1, height: 74 }} />
          ))}
        </View>
      </Card>
      <Skeleton style={{ height: 20, width: 160 }} />
      <Skeleton style={{ height: 168, borderRadius: 20 }} />
      <Skeleton style={{ height: 20, width: 140 }} />
      <Skeleton style={{ height: 140, borderRadius: 20 }} />
    </View>
  );
}

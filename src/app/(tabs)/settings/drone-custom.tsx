import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, Switch, TextInput, View } from 'react-native';

import { Button, Card, T } from '@/components/ui';
import type { DroneProfile } from '@/lib/drones';
import { t } from '@/i18n';
import { speedUnitLabel, toKmh, convertSpeed } from '@/lib/format';
import { useApp } from '@/store/app';
import { radius, space, useTheme } from '@/theme/tokens';

type Field = { key: keyof DroneProfile; label: string; suffix: string; hint?: string };

export default function DroneCustomScreen() {
  const { c } = useTheme();
  const custom = useApp((s) => s.customDrone);
  const unit = useApp((s) => s.speedUnit);
  const set = useApp((s) => s.set);
  const base: DroneProfile = custom ?? {
    id: 'custom',
    name: t('Meu drone'),
    brand: t('Personalizado'),
    maxWind: 38,
    flightTime: 30,
    cruiseSpeed: 36,
    weightG: 249,
    minTemp: -10,
    maxTemp: 40,
    rainProof: false,
    category: 'mini',
  };
  // Inputs não-controlados: valores iniciais fixos; edições vão para um ref e são salvas ao tocar em Salvar.
  const [initial] = useState<Record<string, string>>(() => ({
    name: base.name,
    maxWind: String(Math.round(convertSpeed(base.maxWind, unit))),
    flightTime: String(base.flightTime),
    cruiseSpeed: String(Math.round(convertSpeed(base.cruiseSpeed, unit))),
    weightG: String(base.weightG),
    minTemp: String(base.minTemp),
    maxTemp: String(base.maxTemp),
  }));
  const values = useRef<Record<string, string>>({ ...initial });
  const [rainProof, setRainProof] = useState(base.rainProof);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fields: Field[] = [
    { key: 'maxWind', label: t('Resistência ao vento'), suffix: speedUnitLabel[unit], hint: t('Veja “Max Wind Speed Resistance” no manual') },
    { key: 'flightTime', label: t('Autonomia nominal'), suffix: 'min' },
    { key: 'cruiseSpeed', label: t('Velocidade de cruzeiro'), suffix: speedUnitLabel[unit] },
    { key: 'weightG', label: t('Peso de decolagem'), suffix: 'g' },
    { key: 'minTemp', label: t('Temperatura mínima'), suffix: '°C' },
    { key: 'maxTemp', label: t('Temperatura máxima'), suffix: '°C' },
  ];

  const save = () => {
    const v = values.current;
    const num = (k: string) => Number(String(v[k]).replace(',', '.'));
    const errs: Record<string, string> = {};
    if (!v.name?.trim()) errs.name = t('Dê um nome ao drone');
    for (const f of fields) {
      if (!Number.isFinite(num(f.key)) || String(v[f.key]).trim() === '') errs[f.key] = t('Informe um número');
    }
    if (num('maxWind') <= 0) errs.maxWind = t('Precisa ser maior que zero');
    if (num('flightTime') <= 0) errs.flightTime = t('Precisa ser maior que zero');
    setErrors(errs);
    if (Object.keys(errs).length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    const weight = num('weightG');
    const profile: DroneProfile = {
      id: 'custom',
      name: v.name.trim(),
      brand: t('Personalizado'),
      maxWind: toKmh(num('maxWind'), unit),
      flightTime: num('flightTime'),
      cruiseSpeed: toKmh(num('cruiseSpeed'), unit),
      weightG: weight,
      minTemp: num('minTemp'),
      maxTemp: num('maxTemp'),
      rainProof,
      category: weight <= 250 ? 'mini' : 'consumer',
    };
    set('customDrone', profile);
    set('droneId', 'custom');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  const input = (key: string, props: Partial<React.ComponentProps<typeof TextInput>> = {}) => (
    <TextInput
      defaultValue={initial[key]}
      onChangeText={(text) => {
        values.current[key] = text;
      }}
      placeholderTextColor={c.tertiary}
      style={{ fontSize: 17, color: c.label, paddingVertical: 10, textAlign: 'right', minWidth: 80, fontVariant: ['tabular-nums'] }}
      {...props}
    />
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 80 }}>
      <View style={{ gap: space.sm }}>
        <T v="footnote" tone="secondary" style={{ paddingHorizontal: space.xs, textTransform: 'uppercase' }}>
          {t('Nome')}
        </T>
        <Card style={{ paddingVertical: 0 }}>
          <TextInput
            defaultValue={initial.name}
            onChangeText={(text) => {
              values.current.name = text;
            }}
            placeholder={t('Ex.: Meu FPV 5 polegadas')}
            placeholderTextColor={c.tertiary}
            autoCapitalize="sentences"
            returnKeyType="done"
            style={{ fontSize: 17, color: c.label, paddingVertical: 14 }}
          />
        </Card>
        {errors.name ? (
          <T v="footnote" tone="nogo" style={{ paddingHorizontal: space.xs }}>
            {errors.name}
          </T>
        ) : null}
      </View>

      <View style={{ gap: space.sm }}>
        <T v="footnote" tone="secondary" style={{ paddingHorizontal: space.xs, textTransform: 'uppercase' }}>
          {t('Especificações')}
        </T>
        <Card padded={false}>
          {fields.map((f, i) => (
            <View
              key={f.key}
              style={{
                paddingHorizontal: space.lg,
                borderBottomWidth: i === fields.length - 1 ? 0 : 0.5,
                borderBottomColor: c.separator,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52 }}>
                <View style={{ flex: 1 }}>
                  <T v="body">{f.label}</T>
                  {f.hint ? (
                    <T v="caption" tone="tertiary">
                      {f.hint}
                    </T>
                  ) : null}
                </View>
                {input(f.key, {
                  keyboardType: f.key === 'minTemp' || f.key === 'maxTemp' ? 'numbers-and-punctuation' : 'decimal-pad',
                  accessibilityLabel: f.label,
                })}
                <T v="body" tone="secondary" style={{ width: 44 }}>
                  {f.suffix}
                </T>
              </View>
              {errors[f.key] ? (
                <T v="footnote" tone="nogo" style={{ paddingBottom: space.sm }}>
                  {errors[f.key]}
                </T>
              ) : null}
            </View>
          ))}
        </Card>
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.card }}>
        <View style={{ flex: 1 }}>
          <T v="body">{t('Resistente à chuva')}</T>
          <T v="footnote" tone="secondary">
            {t('Certificação IP45 ou superior')}
          </T>
        </View>
        <Switch value={rainProof} onValueChange={setRainProof} trackColor={{ true: c.go }} />
      </Card>

      <Button title={t('Salvar e usar este drone')} onPress={save} />
    </ScrollView>
  );
}

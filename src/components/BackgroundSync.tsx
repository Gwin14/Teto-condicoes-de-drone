import { useEffect } from 'react';

import { useConditions } from '@/hooks/useConditions';
import { useActiveLocation } from '@/hooks/useLocation';
import { buildActivityProps, syncWidgets, updateFlightActivity } from '@/native/widgets';
import { useApp } from '@/store/app';

/**
 * Sem UI: mantém widgets (timeline horária) e a Live Activity em dia sempre
 * que a previsão é atualizada. No Expo Go é um no-op silencioso.
 */
export function BackgroundSync() {
  const { location } = useActiveLocation();
  const { data, drone, altitude } = useConditions(location?.lat, location?.lon, location?.country);
  const unit = useApp((s) => s.speedUnit);
  const tempUnit = useApp((s) => s.tempUnit);
  const session = useApp((s) => s.session);
  const pro = useApp((s) => s.pro);

  useEffect(() => {
    // Widgets são do Teto Pro: sem assinatura, ficam no estado "Abra o Teto".
    if (!data || !location || !pro) return;
    syncWidgets(data, location.name, `${drone.brand} ${drone.name}`, altitude, unit, tempUnit);
  }, [data, location, drone, altitude, unit, tempUnit, pro]);

  useEffect(() => {
    if (!data || !session || !pro) return;
    updateFlightActivity(
      buildActivityProps(
        { ...session, windAlt: data.now.windAlt, gust: data.now.gustAlt, score: data.now.score, verdict: data.now.verdict },
        unit,
        data.now.dirAlt
      )
    );
  }, [data, session, unit, pro]);

  return null;
}

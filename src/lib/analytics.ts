import type {
  AggregationKind,
  DayPoint,
  Direction,
  MetricKey,
  MetricMeta,
} from '../types';

/**
 * Capa de análisis pura, sin React.
 *
 * Notas de diseño:
 * - Todas las ventanas trabajan sobre arrays de DayPoint ya ordenados de
 *   más antiguo a más nuevo.
 * - Los nulls se preservan: nunca se reemplazan por 0, porque eso
 *   ensuciaría los promedios (un día sin leads no tiene tiempo de
 *   respuesta; no es lo mismo que tener tiempo de respuesta = 0).
 * - Cada métrica trae su `direction`. La función que decide "¿es
 *   bueno o malo este cambio?" está en un solo lugar.
 */

// ── Helpers de ventana ────────────────────────────────────────────────────

export const sliceWindow = (days: DayPoint[], n: number): DayPoint[] =>
  days.slice(Math.max(0, days.length - n));

export const slicePrevious = (days: DayPoint[], n: number): DayPoint[] => {
  const end = days.length - n;
  return days.slice(Math.max(0, end - n), end);
};

// ── Agregaciones básicas ──────────────────────────────────────────────────

const isNum = (x: unknown): x is number => typeof x === 'number' && !Number.isNaN(x);

export const sumValues = (xs: readonly (number | null | undefined)[]): number =>
  xs.reduce<number>((a, x) => a + (isNum(x) ? x : 0), 0);

export const avgValues = (xs: readonly (number | null | undefined)[]): number | null => {
  const valid = xs.filter(isNum);
  if (!valid.length) return null;
  return valid.reduce((a, x) => a + x, 0) / valid.length;
};

export const lastValue = (xs: readonly (number | null | undefined)[]): number | null => {
  for (let i = xs.length - 1; i >= 0; i -= 1) {
    const v = xs[i];
    if (isNum(v)) return v;
  }
  return null;
};

/**
 * Promedio ponderado por volumen. El glosario define varias métricas
 * `avg_*` como "promedio sobre los eventos que ocurrieron ese día"
 * (por ejemplo, avg_deal_cycle_days es sobre los deals que cerraron hoy).
 * Si juntamos varios días con un promedio simple, le damos el mismo peso
 * a un día con 1 deal y a uno con 20 — y eso miente. Ponderar por el
 * volumen diario nos devuelve el promedio real del período.
 */
export const weightedAvg = (
  values: readonly (number | null | undefined)[],
  weights: readonly (number | null | undefined)[],
): number | null => {
  let num = 0;
  let den = 0;
  const len = Math.min(values.length, weights.length);
  for (let i = 0; i < len; i += 1) {
    const v = values[i];
    const w = weights[i];
    if (isNum(v) && isNum(w) && w > 0) {
      num += v * w;
      den += w;
    }
  }
  if (den === 0) return null;
  return num / den;
};

const valuesOf = (days: DayPoint[], key: MetricKey): (number | null | undefined)[] =>
  days.map((d) => d.metrics[key]);

/**
 * Para cada métrica `avg_*`, qué métrica de volumen debe usarse como
 * peso al juntar varios días. Tener este mapeo en un solo lugar hace
 * que la decisión de "qué cuenta como peso" sea fácil de revisar.
 */
const WEIGHT_FOR_AVG: Partial<Record<MetricKey, MetricKey>> = {
  // Tiempo de respuesta es por lead nuevo → pesar por leads creados.
  avg_response_time_min: 'leads_created',
  // Deal cycle es por deal cerrado → pesar por deals cerrados.
  // Cerrado = ganados + perdidos; aquí ponemos won como referencia,
  // pero el agregador real (más abajo) suma ambos.
  avg_deal_cycle_days: 'deals_won',
  // Resolution hours es por ticket abierto → pesar por tickets abiertos.
  support_avg_resolution_hours: 'support_tickets_opened',
};

/**
 * Devuelve la estrategia de agregación correcta para cada métrica.
 *
 * Razonamiento:
 * - Métricas de volumen (eventos contables) → suma sobre la ventana.
 * - Promedios diarios (latencia, ratios) → promedio.
 * - Métricas de stock (foto al final del día, como stale_deals)
 *   → último valor disponible.
 *
 * Tener esto en un solo lugar evita el bug clásico de sumar promedios
 * sin querer y mostrarle al gerente un número que no significa nada.
 */
export const aggregationFor = (key: MetricKey): AggregationKind => {
  switch (key) {
    case 'avg_response_time_min':
    case 'avg_deal_cycle_days':
    case 'support_avg_resolution_hours':
      return 'avg';
    case 'stale_deals':
      return 'last';
    default:
      return 'sum';
  }
};

export const aggregate = (days: DayPoint[], key: MetricKey): number | null => {
  const xs = valuesOf(days, key);
  switch (aggregationFor(key)) {
    case 'sum':
      return xs.length ? sumValues(xs) : null;
    case 'avg': {
      // Caso especial: avg_deal_cycle_days es "promedio sobre los deals
      // que cerraron ese día", y "cerrado" significa ganados + perdidos.
      // No podemos meter una tupla de pesos en una sola columna, así que
      // sintetizamos el peso aquí.
      if (key === 'avg_deal_cycle_days') {
        const won = valuesOf(days, 'deals_won');
        const lost = valuesOf(days, 'deals_lost');
        const weights = won.map((w, i) => {
          const l = lost[i];
          const wn = isNum(w) ? w : 0;
          const ln = isNum(l) ? l : 0;
          return wn + ln;
        });
        return weightedAvg(xs, weights);
      }
      const weightKey = WEIGHT_FOR_AVG[key];
      if (weightKey) return weightedAvg(xs, valuesOf(days, weightKey));
      return avgValues(xs);
    }
    case 'last':
      return lastValue(xs);
  }
};

// ── Delta direccional ─────────────────────────────────────────────────────

export const pctChange = (current: number | null, prior: number | null): number | null => {
  if (current == null || prior == null) return null;
  if (prior === 0) return current === 0 ? 0 : null;
  return (current - prior) / Math.abs(prior);
};

/** ¿Un delta positivo es una mejora para esta métrica? */
export const isImprovementSign = (delta: number, direction: Direction): boolean => {
  if (delta === 0) return true;
  return direction === 'higher_is_better' ? delta > 0 : delta < 0;
};

// ── Funnel y win rate ─────────────────────────────────────────────────────

export interface Funnel {
  traffic: number;
  leads: number;
  qualified: number;
  deals: number;
  won: number;
  lost: number;
  /** Las tasas pueden ser null cuando la etapa anterior es 0 en la ventana. */
  rates: {
    trafficToLead: number | null;
    leadToQualified: number | null;
    qualifiedToDeal: number | null;
    dealToWon: number | null;
  };
}

export const computeFunnel = (days: DayPoint[]): Funnel => {
  const traffic = sumValues(valuesOf(days, 'traffic'));
  const leads = sumValues(valuesOf(days, 'leads_created'));
  const qualified = sumValues(valuesOf(days, 'leads_qualified'));
  const deals = sumValues(valuesOf(days, 'deals_created'));
  const won = sumValues(valuesOf(days, 'deals_won'));
  const lost = sumValues(valuesOf(days, 'deals_lost'));

  const safeRate = (num: number, den: number) => (den > 0 ? num / den : null);

  return {
    traffic,
    leads,
    qualified,
    deals,
    won,
    lost,
    rates: {
      trafficToLead: safeRate(leads, traffic),
      leadToQualified: safeRate(qualified, leads),
      qualifiedToDeal: safeRate(deals, qualified),
      dealToWon: safeRate(won, deals),
    },
  };
};

/** Win rate del período — solo deals cerrados (ganados / (ganados + perdidos)). */
export const computeWinRate = (days: DayPoint[]): number | null => {
  const won = sumValues(valuesOf(days, 'deals_won'));
  const lost = sumValues(valuesOf(days, 'deals_lost'));
  const closed = won + lost;
  return closed > 0 ? won / closed : null;
};

// ── Serie para sparklines ─────────────────────────────────────────────────

export const trendSeries = (days: DayPoint[], key: MetricKey): number[] =>
  days.map((d) => {
    const v = d.metrics[key];
    return isNum(v) ? v : 0;
  });

// ── Indexar metadata por llave ────────────────────────────────────────────

export const indexMetricMeta = (
  metrics: MetricMeta[],
): Record<MetricKey, MetricMeta> => {
  const out = {} as Record<MetricKey, MetricMeta>;
  for (const m of metrics) out[m.key] = m;
  return out;
};

import type { Dataset, DayPoint, Insight, MetricKey, Severity } from '../types';
import {
  aggregate,
  aggregationFor,
  computeFunnel,
  computeWinRate,
  indexMetricMeta,
  isImprovementSign,
  lastValue,
  pctChange,
  sliceWindow,
  slicePrevious,
} from './analytics';
import { formatCompact, formatDeltaPct, formatPct } from './format';

/**
 * "Foco del día" — produce una lista priorizada de alertas para que el
 * Jefe de Ventas salga de la pantalla sabiendo qué hacer.
 *
 * Tres objetivos guían este archivo:
 *
 *   1. Puntaje por métrica (consciente de la dirección, comparando contra
 *      el período anterior).
 *   2. Señales combinadas que no son una sola columna: win rate, cuello de
 *      funnel, alarmas de nivel absoluto (por ejemplo, una pila de stale).
 *   3. Selección estable de top-N con niveles de severidad, para que la UI
 *      pueda renderizar un foco distinto por dataset sin código a medida.
 *
 * El mismo código tiene que responder bien a los cuatro datasets — esa es
 * la idea. NO hay un solo "if dataset === 'A'".
 */

export interface FocusContext {
  dataset: Dataset;
  windowDays: number;
  /** Ventana de `windowDays` que termina en el día más reciente. */
  current: DayPoint[];
  /** Ventana de `windowDays` justo antes de `current`. */
  prior: DayPoint[];
}

export const buildFocusContext = (dataset: Dataset, windowDays = 30): FocusContext => ({
  dataset,
  windowDays,
  current: sliceWindow(dataset.days, windowDays),
  prior: slicePrevious(dataset.days, windowDays),
});

// ── Umbrales de severidad ─────────────────────────────────────────────────
// Valores ajustables — tenerlos nombrados y juntos hace que las reglas
// sean fáciles de revisar sin tener que perderse entre los if.

const THRESH = {
  metricCritical: 0.25,           // ≥25% peor vs período anterior → crítico
  metricWarning: 0.1,             // ≥10% peor → atención
  staleAbsoluteCritical: 150,     // >150 stale deals acumulados = alerta roja
  staleAbsoluteWarning: 90,
  responseTimeCritical: 60,       // promedio >1h al primer contacto
  responseTimeWarning: 45,
  funnelBottleneckRatio: 0.5,     // etapa más débil <50% de la siguiente
};

// ── Alerta por métrica ────────────────────────────────────────────────────

const severityForDelta = (deltaPct: number): Severity => {
  const a = Math.abs(deltaPct);
  if (a >= THRESH.metricCritical) return 'critical';
  if (a >= THRESH.metricWarning) return 'warning';
  return 'info';
};

const metricInsight = (ctx: FocusContext, key: MetricKey): Insight | null => {
  const meta = indexMetricMeta(ctx.dataset.metadata.metrics)[key];
  if (!meta) return null;

  const current = aggregate(ctx.current, key);
  const prior = aggregate(ctx.prior, key);
  const delta = pctChange(current, prior);

  if (delta == null || current == null) return null;

  const improving = isImprovementSign(delta, meta.direction);

  // Solo elevamos los movimientos negativos como alertas. Los deltas
  // positivos pueden volverse insights "positive" pero no deberían
  // desplazar a las prioridades reales.
  const severity = improving ? 'positive' : severityForDelta(delta);

  const aggLabel = aggregationFor(key) === 'sum' ? 'total' : 'promedio';
  const valueText =
    aggregationFor(key) === 'last'
      ? `${formatCompact(current)} ${meta.unit}`
      : `${formatCompact(current)} ${meta.unit} (${aggLabel}, ${ctx.windowDays}d)`;

  const direction = improving ? 'mejorando' : 'empeorando';
  const detail = `${valueText} · ${formatDeltaPct(delta)} vs los ${ctx.windowDays}d previos (${direction}).`;

  // Puntaje: solo los deltas "peores" suben en prioridad. A los positivos
  // se les da un puntaje pequeño para que aparezcan en la repisa de "va bien".
  const magnitude = Math.abs(delta);
  const score = improving ? -magnitude : magnitude * 100;

  // El título refleja la dirección real del cambio (sube/baja), no si es
  // bueno o malo — eso ya lo comunica el color de la card.
  const trendLabel = delta > 0 ? 'al alza' : 'a la baja';

  return {
    id: `metric:${key}`,
    severity,
    title: `${meta.label} ${trendLabel}`,
    detail,
    metric: key,
    score,
  };
};

// ── Señales combinadas ────────────────────────────────────────────────────

const winRateInsight = (ctx: FocusContext): Insight | null => {
  const current = computeWinRate(ctx.current);
  const prior = computeWinRate(ctx.prior);
  if (current == null) return null;
  const delta = pctChange(current, prior);

  // El win rate no aparece como fila en la metadata — más alto es mejor.
  const isWorse = delta != null && delta < 0;
  const a = delta != null ? Math.abs(delta) : 0;
  const severity: Severity =
    isWorse && a >= THRESH.metricCritical
      ? 'critical'
      : isWorse && a >= THRESH.metricWarning
        ? 'warning'
        : isWorse
          ? 'info'
          : 'positive';

  const detail = prior == null
    ? `${formatPct(current)} este período (sin referencia previa).`
    : `${formatPct(current)} este período vs ${formatPct(prior)} previo · ${formatDeltaPct(delta)}.`;

  return {
    id: 'composite:win_rate',
    severity,
    title: isWorse ? 'Win rate cayendo' : 'Tendencia de win rate',
    detail,
    score: isWorse ? a * 110 : -a, // las preocupaciones de win rate pesan un poco más que las métricas crudas
  };
};

const stalePileInsight = (ctx: FocusContext): Insight | null => {
  const lastStale = lastValue(ctx.current.map((d) => d.metrics.stale_deals));
  if (lastStale == null) return null;

  // Alerta de nivel absoluto: aunque el delta vs el período anterior sea
  // chico, una pila de 150+ stale deals significa que la atención del
  // equipo de ventas está sobrepasada para hoy.
  if (lastStale >= THRESH.staleAbsoluteCritical) {
    return {
      id: 'composite:stale_pile',
      severity: 'critical',
      title: `${formatCompact(lastStale)} stale deals acumulándose`,
      detail: `Deals abiertos hace más de 60 días. Acción: triage hoy — cerrar o descartar.`,
      metric: 'stale_deals',
      score: 95,
    };
  }
  if (lastStale >= THRESH.staleAbsoluteWarning) {
    return {
      id: 'composite:stale_pile',
      severity: 'warning',
      title: `${formatCompact(lastStale)} stale deals abiertos`,
      detail: 'Sobre el umbral de 90 — conviene una pasada de limpieza.',
      metric: 'stale_deals',
      score: 50,
    };
  }
  return null;
};

const responseTimeAbsoluteInsight = (ctx: FocusContext): Insight | null => {
  const value = aggregate(ctx.current, 'avg_response_time_min');
  if (value == null) return null;
  if (value >= THRESH.responseTimeCritical) {
    return {
      id: 'composite:response_time_abs',
      severity: 'critical',
      title: `Tiempo de respuesta en ${formatCompact(value)} min`,
      detail: 'Promedio sobre 60 min — los leads se enfrían rápido en B2B. Esto destruye la conversión.',
      metric: 'avg_response_time_min',
      score: 105,
    };
  }
  if (value >= THRESH.responseTimeWarning) {
    return {
      id: 'composite:response_time_abs',
      severity: 'warning',
      title: `Tiempo de respuesta subiendo: ${formatCompact(value)} min`,
      detail: 'Sobre 45 min — empuja a <30 min antes que arrastre el win rate.',
      metric: 'avg_response_time_min',
      score: 55,
    };
  }
  return null;
};

const funnelBottleneckInsight = (ctx: FocusContext): Insight | null => {
  const f = computeFunnel(ctx.current);
  const stages: { name: string; rate: number | null; key: MetricKey }[] = [
    { name: 'tráfico → lead', rate: f.rates.trafficToLead, key: 'leads_created' },
    { name: 'lead → calificado', rate: f.rates.leadToQualified, key: 'leads_qualified' },
    { name: 'calificado → deal', rate: f.rates.qualifiedToDeal, key: 'deals_created' },
    { name: 'deal → ganado', rate: f.rates.dealToWon, key: 'deals_won' },
  ];

  const valid = stages.filter((s): s is typeof s & { rate: number } => s.rate != null);
  if (valid.length < 2) return null;

  // Comparar contra su propia tasa del período anterior para llamarle cuello.
  const fp = computeFunnel(ctx.prior);
  const priorRates: Record<string, number | null> = {
    'tráfico → lead': fp.rates.trafficToLead,
    'lead → calificado': fp.rates.leadToQualified,
    'calificado → deal': fp.rates.qualifiedToDeal,
    'deal → ganado': fp.rates.dealToWon,
  };

  let worstDrop: { name: string; rate: number; prior: number | null; drop: number; key: MetricKey } | null = null;
  for (const s of valid) {
    const pr = priorRates[s.name];
    if (pr == null) continue;
    const drop = (pr - s.rate) / Math.max(pr, 1e-9); // positivo = empeoró
    if (drop > 0.1 && (worstDrop == null || drop > worstDrop.drop)) {
      worstDrop = { name: s.name, rate: s.rate, prior: pr, drop, key: s.key };
    }
  }

  if (worstDrop) {
    const severity: Severity = worstDrop.drop >= 0.25 ? 'critical' : 'warning';
    return {
      id: 'composite:funnel_bottleneck',
      severity,
      title: `Cuello en el funnel: ${worstDrop.name}`,
      detail: `Conversión ${formatPct(worstDrop.rate)} vs ${formatPct(worstDrop.prior)} previa — −${(worstDrop.drop * 100).toFixed(0)}% relativo.`,
      metric: worstDrop.key,
      score: 80 + worstDrop.drop * 50,
    };
  }
  return null;
};

// ── Compositor del top-N ──────────────────────────────────────────────────

/**
 * Arma el top-3 de la mañana. Estrategia:
 *   1. Generar todas las señales candidatas.
 *   2. Ordenar por puntaje descendente.
 *   3. Tomar los primeros 3 que sean al menos "warning". Si no hay
 *      suficientes, completar con "info" (un día tranquilo igual debe
 *      mostrar foco).
 *   4. Si todo está bien, mostrar hasta 3 "positive" para celebrar.
 */
export const computeFocus = (dataset: Dataset, windowDays = 30): Insight[] => {
  const ctx = buildFocusContext(dataset, windowDays);
  const meta = ctx.dataset.metadata.metrics;

  const candidates: Insight[] = [];

  for (const m of meta) {
    const ins = metricInsight(ctx, m.key);
    if (ins) candidates.push(ins);
  }

  for (const fn of [
    winRateInsight,
    stalePileInsight,
    responseTimeAbsoluteInsight,
    funnelBottleneckInsight,
  ]) {
    const ins = fn(ctx);
    if (ins) candidates.push(ins);
  }

  // Quitar repetidas: si la alerta absoluta de response_time es crítica,
  // descartamos la alerta por delta de la misma métrica (no queremos dos
  // cards diciendo lo mismo).
  const dedup: Insight[] = [];
  const seenMetric = new Set<string>();
  // Las combinadas primero (suelen tener mayor puntaje), luego por métrica.
  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (c.metric && seenMetric.has(c.metric)) continue;
    if (c.metric) seenMetric.add(c.metric);
    dedup.push(c);
  }

  const concerns = dedup.filter((c) => c.severity === 'critical' || c.severity === 'warning');
  if (concerns.length >= 3) return concerns.slice(0, 3);

  const fallback = dedup
    .filter((c) => !concerns.includes(c))
    .filter((c) => c.severity !== 'positive');
  return [...concerns, ...fallback].slice(0, 3);
};

/**
 * Lo positivo para la repisa de "Va bien" — qué está mejorando, ordenado.
 */
export const computePositives = (dataset: Dataset, windowDays = 30): Insight[] => {
  const ctx = buildFocusContext(dataset, windowDays);
  const meta = ctx.dataset.metadata.metrics;
  const positives: Insight[] = [];
  for (const m of meta) {
    const ins = metricInsight(ctx, m.key);
    if (ins && ins.severity === 'positive') positives.push(ins);
  }
  positives.sort((a, b) => a.score - b.score); // puntaje más negativo = mayor mejora
  return positives.slice(0, 3);
};

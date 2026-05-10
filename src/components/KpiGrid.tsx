import type { Dataset } from '../types';
import {
  aggregate,
  aggregationFor,
  isImprovementSign,
  pctChange,
  sliceWindow,
  slicePrevious,
  trendSeries,
} from '../lib/analytics';
import { KpiCard } from './KpiCard';

interface Props {
  dataset: Dataset;
  windowDays: number;
}

const aggLabel = (kind: 'sum' | 'avg' | 'last', days: number) => {
  switch (kind) {
    case 'sum':
      return `Total · ${days}d`;
    case 'avg':
      return `Promedio · ${days}d`;
    case 'last':
      return 'Fin del día';
  }
};

export const KpiGrid = ({ dataset, windowDays }: Props) => {
  const current = sliceWindow(dataset.days, windowDays);
  const prior = slicePrevious(dataset.days, windowDays);

  return (
    <section aria-labelledby="kpi-heading">
      <h2 id="kpi-heading" className="sr-only">
        Métricas clave
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {dataset.metadata.metrics.map((m) => {
          const cur = aggregate(current, m.key);
          const pri = aggregate(prior, m.key);
          const delta = pctChange(cur, pri);
          const improving = delta == null ? null : isImprovementSign(delta, m.direction);
          const kind = aggregationFor(m.key);

          return (
            <KpiCard
              key={m.key}
              meta={m}
              current={cur}
              prior={pri}
              deltaPct={delta}
              improving={improving}
              trend={trendSeries(current, m.key)}
              aggregationLabel={aggLabel(kind, windowDays)}
            />
          );
        })}
      </div>
    </section>
  );
};

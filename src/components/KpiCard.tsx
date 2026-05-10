import { Sparkline } from './Sparkline';
import type { MetricMeta } from '../types';
import { formatCompact, formatDeltaPct, formatUnit } from '../lib/format';

interface Props {
  meta: MetricMeta;
  current: number | null;
  prior: number | null;
  deltaPct: number | null;
  improving: boolean | null;
  trend: number[];
  aggregationLabel: string;
}

export const KpiCard = ({
  meta,
  current,
  deltaPct,
  improving,
  trend,
  aggregationLabel,
}: Props) => {
  const tone = improving == null ? 'neutral' : improving ? 'good' : 'bad';
  const deltaColor =
    improving == null
      ? 'text-slate-500'
      : improving
        ? 'text-emerald-600'
        : 'text-red-600';

  const isStock = meta.key === 'stale_deals';

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {meta.label}
          </h3>
          <p className="text-[11px] text-slate-400">{aggregationLabel}</p>
        </div>
        <Sparkline values={trend} tone={tone} />
      </header>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-slate-900">
          {isStock ? formatUnit(current, meta.unit) : `${formatCompact(current)}`}
        </span>
        {!isStock && (
          <span className="text-xs text-slate-500">{meta.unit}</span>
        )}
      </div>

      <div className="mt-1 flex items-center gap-2 text-xs">
        <span className={`font-medium tabular-nums ${deltaColor}`}>
          {deltaPct == null ? '—' : formatDeltaPct(deltaPct)}
        </span>
        <span className="text-slate-400">vs período anterior</span>
      </div>
    </article>
  );
};

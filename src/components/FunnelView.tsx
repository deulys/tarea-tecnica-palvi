import type { Dataset } from '../types';
import { computeFunnel, computeWinRate, sliceWindow, slicePrevious, pctChange } from '../lib/analytics';
import { formatCompact, formatPct, formatDeltaPct } from '../lib/format';

interface Props {
  dataset: Dataset;
  windowDays: number;
}

interface Stage {
  label: string;
  value: number;
  rate: number | null;
  priorRate: number | null;
}

export const FunnelView = ({ dataset, windowDays }: Props) => {
  const cur = sliceWindow(dataset.days, windowDays);
  const pri = slicePrevious(dataset.days, windowDays);
  const f = computeFunnel(cur);
  const fp = computeFunnel(pri);

  const stages: Stage[] = [
    { label: 'Tráfico', value: f.traffic, rate: null, priorRate: null },
    {
      label: 'Leads',
      value: f.leads,
      rate: f.rates.trafficToLead,
      priorRate: fp.rates.trafficToLead,
    },
    {
      label: 'Calificados',
      value: f.qualified,
      rate: f.rates.leadToQualified,
      priorRate: fp.rates.leadToQualified,
    },
    {
      label: 'Deals',
      value: f.deals,
      rate: f.rates.qualifiedToDeal,
      priorRate: fp.rates.qualifiedToDeal,
    },
    {
      label: 'Ganados',
      value: f.won,
      rate: f.rates.dealToWon,
      priorRate: fp.rates.dealToWon,
    },
  ];

  const max = Math.max(...stages.map((s) => s.value || 0)) || 1;
  const winRate = computeWinRate(cur);
  const priorWinRate = computeWinRate(pri);
  const winDelta = pctChange(winRate, priorWinRate);

  return (
    <section
      aria-labelledby="funnel-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-baseline justify-between">
        <h2 id="funnel-heading" className="text-base font-semibold text-slate-900">
          Funnel
        </h2>
        <div className="text-xs text-slate-500">
          Win rate ·{' '}
          <span className="font-semibold tabular-nums text-slate-900">
            {formatPct(winRate)}
          </span>{' '}
          {winDelta != null && (
            <span
              className={
                winDelta >= 0 ? 'text-emerald-600' : 'text-red-600'
              }
            >
              ({formatDeltaPct(winDelta)})
            </span>
          )}
        </div>
      </div>

      <ol className="space-y-2">
        {stages.map((s, i) => {
          const widthPct = Math.max(8, (s.value / max) * 100);
          const rateDelta =
            s.rate != null && s.priorRate != null
              ? (s.rate - s.priorRate) / Math.max(s.priorRate, 1e-9)
              : null;
          return (
            <li key={s.label} className="flex items-center gap-3">
              <div className="w-20 shrink-0 text-sm font-medium text-slate-700">
                {s.label}
              </div>
              <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-slate-100">
                <div
                  className="h-full rounded-md bg-indigo-500/90"
                  style={{ width: `${widthPct}%` }}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-white drop-shadow">
                  {formatCompact(s.value)}
                </span>
              </div>
              <div className="w-32 shrink-0 text-right text-xs text-slate-600">
                {i === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <>
                    <span className="font-medium tabular-nums text-slate-800">
                      {formatPct(s.rate)}
                    </span>
                    {rateDelta != null && (
                      <span
                        className={
                          'ml-1 ' +
                          (rateDelta >= 0 ? 'text-emerald-600' : 'text-red-600')
                        }
                      >
                        {formatDeltaPct(rateDelta)}
                      </span>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-xs text-slate-400">
        Las tasas de conversión comparan los últimos {windowDays}d contra los {windowDays}d previos.
      </p>
    </section>
  );
};

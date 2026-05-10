import type { Insight, Severity } from '../types';

interface Props {
  insights: Insight[];
  windowDays: number;
}

const styles: Record<Severity, { dot: string; bg: string; ring: string; label: string }> = {
  critical: { dot: 'bg-red-500', bg: 'bg-red-50', ring: 'ring-red-200', label: 'text-red-700' },
  warning: { dot: 'bg-amber-500', bg: 'bg-amber-50', ring: 'ring-amber-200', label: 'text-amber-700' },
  info: { dot: 'bg-slate-400', bg: 'bg-slate-50', ring: 'ring-slate-200', label: 'text-slate-700' },
  positive: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', ring: 'ring-emerald-200', label: 'text-emerald-700' },
};

const severityLabel: Record<Severity, string> = {
  critical: 'Crítico',
  warning: 'Atención',
  info: 'Info',
  positive: 'Va bien',
};

export const FocusCard = ({ insights, windowDays }: Props) => {
  return (
    <section
      aria-labelledby="focus-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-baseline justify-between">
        <h2 id="focus-heading" className="text-base font-semibold text-slate-900">
          Foco del día
        </h2>
        <span className="text-xs uppercase tracking-wide text-slate-400">
          últimos {windowDays}d vs {windowDays}d previos
        </span>
      </div>

      {insights.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nada urgente. Sigue como vas.
        </p>
      ) : (
        <ol className="space-y-3">
          {insights.map((ins, i) => {
            const s = styles[ins.severity];
            return (
              <li
                key={ins.id}
                className={`flex items-start gap-3 rounded-lg ${s.bg} p-3 ring-1 ${s.ring}`}
              >
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
                    <span className={`text-xs font-semibold uppercase tracking-wide ${s.label}`}>
                      {severityLabel[ins.severity]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                    {ins.title}
                  </p>
                  <p className="text-sm text-slate-600">{ins.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

interface Props {
  datasetIds: string[];
  selected: string;
  onSelect: (id: string) => void;
  windowDays: number;
  onWindowChange: (n: number) => void;
  asOfDate: string;
}

const WINDOWS = [7, 30, 90] as const;

export const Header = ({
  datasetIds,
  selected,
  onSelect,
  windowDays,
  onWindowChange,
  asOfDate,
}: Props) => {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Ventas · Reporte de la mañana
          </h1>
          <p className="text-sm text-slate-500">
            Al {new Date(asOfDate).toLocaleDateString('es-CL', { dateStyle: 'long' })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Dataset</span>
            <div role="tablist" aria-label="Dataset" className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {datasetIds.map((id) => {
                const active = id === selected;
                return (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => onSelect(id)}
                    className={
                      'rounded-md px-3 py-1 text-sm font-medium transition ' +
                      (active
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-900')
                    }
                  >
                    {id}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Ventana</span>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {WINDOWS.map((n) => {
                const active = n === windowDays;
                return (
                  <button
                    key={n}
                    onClick={() => onWindowChange(n)}
                    aria-pressed={active}
                    className={
                      'rounded-md px-2.5 py-1 text-sm font-medium transition ' +
                      (active
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-900')
                    }
                  >
                    {n}d
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

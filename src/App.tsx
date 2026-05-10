import { useEffect, useMemo, useState } from 'react';
import type { DatasetMap } from './types';
import { loadMetrics } from './data/loadMetrics';
import { Header } from './components/Header';
import { FocusCard } from './components/FocusCard';
import { KpiGrid } from './components/KpiGrid';
import { FunnelView } from './components/FunnelView';
import { computeFocus, computePositives } from './lib/focus';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: DatasetMap };

const App = () => {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [selected, setSelected] = useState<string | null>(null);
  // 7d por defecto: el brief pide "5 minutos en la mañana, foco hoy".
  // Una ventana semanal es la granularidad correcta para una rutina diaria;
  // 30d sirve más para una revisión mensual.
  const [windowDays, setWindowDays] = useState<number>(7);

  useEffect(() => {
    let alive = true;
    loadMetrics()
      .then((data) => {
        if (!alive) return;
        setLoad({ status: 'ready', data });
        const first = Object.keys(data)[0];
        if (first) setSelected(first);
      })
      .catch((e) =>
        alive ? setLoad({ status: 'error', message: (e as Error).message }) : undefined,
      );
    return () => {
      alive = false;
    };
  }, []);

  const dataset = useMemo(() => {
    if (load.status !== 'ready' || !selected) return null;
    return load.data[selected] ?? null;
  }, [load, selected]);

  const focus = useMemo(
    () => (dataset ? computeFocus(dataset, windowDays) : []),
    [dataset, windowDays],
  );
  const positives = useMemo(
    () => (dataset ? computePositives(dataset, windowDays) : []),
    [dataset, windowDays],
  );

  if (load.status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Cargando métricas…
      </div>
    );
  }

  if (load.status === 'error') {
    return (
      <div className="mx-auto max-w-xl p-8">
        <h1 className="mb-2 text-lg font-semibold text-slate-900">
          No se pudo cargar metrics.json
        </h1>
        <p className="text-sm text-slate-600">{load.message}</p>
        <pre className="mt-4 rounded-md bg-slate-900 p-3 text-xs text-slate-100">
          npm run setup /ruta/a/metrics.json
        </pre>
      </div>
    );
  }

  if (!dataset || !selected) return null;

  const datasetIds = Object.keys(load.data).sort();
  const asOf = dataset.days[dataset.days.length - 1]?.date ?? dataset.metadata.end_date;

  return (
    <div className="min-h-full">
      <Header
        datasetIds={datasetIds}
        selected={selected}
        onSelect={setSelected}
        windowDays={windowDays}
        onWindowChange={setWindowDays}
        asOfDate={asOf}
      />

      <main className="mx-auto grid max-w-6xl gap-5 px-6 py-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FocusCard insights={focus} windowDays={windowDays} />
        </div>
        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Va bien</h2>
          {positives.length === 0 ? (
            <p className="text-sm text-slate-500">
              Ninguna métrica mejora de forma relevante vs el período anterior.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {positives.map((p) => (
                <li key={p.id} className="rounded-md bg-emerald-50 p-2 ring-1 ring-emerald-100">
                  <p className="font-medium text-emerald-800">{p.title}</p>
                  <p className="text-emerald-700/80">{p.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="lg:col-span-3">
          <FunnelView dataset={dataset} windowDays={windowDays} />
        </div>

        <div className="lg:col-span-3">
          <KpiGrid dataset={dataset} windowDays={windowDays} />
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-10 pt-2 text-xs text-slate-400">
        Dataset {selected} · {dataset.metadata.start_date} → {dataset.metadata.end_date} ·{' '}
        {dataset.metadata.days} días
      </footer>
    </div>
  );
};

export default App;

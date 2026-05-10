import type { DatasetMap } from '../types';

/**
 * Carga metrics.json desde /public para que se pueda cambiar el archivo
 * sin tener que volver a compilar.
 *
 * Decisión: hacer fetch en tiempo de ejecución en lugar de
 * `import metrics from './metrics.json'`.
 * - El bundle queda más liviano.
 * - El evaluador puede cambiar el JSON sin tocar el código.
 * - Si alguien se saltó `npm run setup`, se muestra un mensaje claro.
 */
export const loadMetrics = async (): Promise<DatasetMap> => {
  const res = await fetch(`${import.meta.env.BASE_URL}metrics.json`);
  if (!res.ok) {
    throw new Error(
      `No se pudo cargar /metrics.json (HTTP ${res.status}). ` +
        `Corre primero "npm run setup <ruta-a-metrics.json>".`,
    );
  }
  const json = (await res.json()) as unknown;

  // Defensivo: validar la forma básica y ordenar los días ascendentemente.
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('metrics.json tiene una forma inesperada — se esperaba un objeto con datasets como llaves.');
  }
  const map = json as DatasetMap;
  for (const k of Object.keys(map)) {
    const ds = map[k];
    if (!ds?.metadata?.metrics || !Array.isArray(ds.days)) {
      throw new Error(
        `metrics.json["${k}"] no tiene metadata o days — corre "npm run setup <ruta>".`,
      );
    }
    ds.days.sort((a, b) => a.date.localeCompare(b.date));
  }
  return map;
};

/**
 * Helpers de formato — todo lo de unidades, locales y presentación de
 * números vive en un solo lugar.
 *
 * Decisión: presentar los números de forma compacta para que se puedan
 * leer de un vistazo en la mañana.
 */

const LOCALE = 'es-CL';

export const formatNumber = (value: number | null | undefined, fractionDigits = 0): string => {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

export const formatCompact = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return '—';
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });
  }
  return formatNumber(value, value % 1 === 0 ? 0 : 1);
};

export const formatPct = (
  ratio: number | null | undefined,
  fractionDigits = 1,
): string => {
  if (ratio == null || Number.isNaN(ratio)) return '—';
  return `${(ratio * 100).toFixed(fractionDigits)}%`;
};

export const formatDeltaPct = (
  ratio: number | null | undefined,
  fractionDigits = 0,
): string => {
  if (ratio == null || Number.isNaN(ratio)) return '—';
  const sign = ratio > 0 ? '+' : '';
  return `${sign}${(ratio * 100).toFixed(fractionDigits)}%`;
};

export const formatUnit = (value: number | null | undefined, unit: string): string => {
  if (value == null) return '—';
  if (unit === 'min') return `${formatCompact(value)} min`;
  if (unit === 'hours') return `${formatCompact(value)} h`;
  if (unit === 'days') return `${formatCompact(value)} d`;
  return formatCompact(value);
};

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString(LOCALE, {
    month: 'short',
    day: 'numeric',
  });
};

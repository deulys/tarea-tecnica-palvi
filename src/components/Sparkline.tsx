import { memo } from 'react';

interface Props {
  values: number[];
  width?: number;
  height?: number;
  /** Color del trazo: bueno (verde), malo (rojo) o neutral (gris). */
  tone?: 'good' | 'bad' | 'neutral';
}

/**
 * Sparkline pequeño inline. Path SVG, sin librería — así reservamos
 * Recharts para gráficos más grandes y ahorramos algunos cientos de KB
 * en cada uno de estos gráficos chicos.
 */
const SparklineImpl = ({ values, width = 96, height = 28, tone = 'neutral' }: Props) => {
  if (values.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  const path = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const stroke =
    tone === 'good' ? '#16a34a' : tone === 'bad' ? '#dc2626' : '#64748b';

  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
};

export const Sparkline = memo(SparklineImpl);

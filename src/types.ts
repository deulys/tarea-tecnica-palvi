export type Direction = 'higher_is_better' | 'lower_is_better';

export type MetricKey =
  | 'traffic'
  | 'leads_created'
  | 'leads_qualified'
  | 'deals_created'
  | 'deals_won'
  | 'deals_lost'
  | 'avg_response_time_min'
  | 'avg_deal_cycle_days'
  | 'stale_deals'
  | 'support_tickets_opened'
  | 'support_avg_resolution_hours';

export interface MetricMeta {
  key: MetricKey;
  label: string;
  unit: string;
  direction: Direction;
  description: string;
}

export type MetricValues = Partial<Record<MetricKey, number | null>>;

export interface DayPoint {
  date: string; // ISO aaaa-mm-dd
  metrics: MetricValues;
}

export interface DatasetMetadata {
  start_date: string;
  end_date: string;
  days: number;
  metrics: MetricMeta[];
}

export interface Dataset {
  metadata: DatasetMetadata;
  days: DayPoint[];
}

export type DatasetMap = Record<string, Dataset>;

export type Severity = 'critical' | 'warning' | 'info' | 'positive';

export interface Insight {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  metric?: MetricKey;
  /** Puntaje para ordenar las alertas — más alto = más urgente. */
  score: number;
}

export type AggregationKind = 'sum' | 'avg' | 'last';

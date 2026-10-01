import { uid } from '../../components/ui';
import type { RunPlan, RunStep } from '../types';

export const step = (kind: RunStep['kind'], by: RunStep['by'], value: number): RunStep => ({ id: uid(), kind, by, value });

/** warm-up, n × (work / rest), cool-down. The last rest is dropped. */
export function repeats(n: number, work: { by: RunStep['by']; value: number }, rest: { by: RunStep['by']; value: number }, warm = 600, cool = 300): RunStep[] {
  const steps: RunStep[] = [];
  if (warm) steps.push(step('warmup', 'time', warm));
  for (let i = 0; i < n; i++) {
    steps.push(step('work', work.by, work.value));
    if (i < n - 1) steps.push(step('rest', rest.by, rest.value));
  }
  if (cool) steps.push(step('cooldown', 'time', cool));
  return steps;
}

export const presetPlans = (): RunPlan[] => [
  { id: 'p-400', name: 'Ripetute 6 × 400 m', steps: repeats(6, { by: 'distance', value: 400 }, { by: 'time', value: 90 }) },
  { id: 'p-fartlek', name: 'Fartlek 10 × 1′ / 1′', steps: repeats(10, { by: 'time', value: 60 }, { by: 'time', value: 60 }) },
  { id: 'p-soglia', name: 'Soglia 4 × 4′', steps: repeats(4, { by: 'time', value: 240 }, { by: 'time', value: 120 }) },
  { id: 'p-1k', name: 'Ripetute 5 × 1 km', steps: repeats(5, { by: 'distance', value: 1000 }, { by: 'time', value: 120 }) },
];

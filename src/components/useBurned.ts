import { useEffect, useMemo } from 'react';
import { addDays } from '../lib/dates';
import { burnedOn, weightOn, type Burned } from '../lib/energy';
import { useStore } from '../lib/store/StoreContext';
import type { ISODate } from '../lib/types';

/** Calories burned on a day (workouts, runs, steps, other activities), with the right weight. */
export function useBurned(date: ISODate): Burned {
  const store = useStore();
  useEffect(() => {
    store.loadRange(addDays(date, -60), date);
  }, [date]);
  const day = store.day(date);
  const kg = weightOn((d) => store.day(d), date, store.settings);
  return useMemo(() => burnedOn(day, kg), [day, kg]);
}

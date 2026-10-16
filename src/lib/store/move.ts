import { addDays } from '../dates';
import type { DayEntry, ISODate, Module } from '../types';
import { uid } from '../../components/ui';

/** What can be moved to another day. */
export type MoveRef = { kind: 'module' | 'appointment' | 'todo'; id: string } | { kind: 'shift' | 'guardia' };

const days = (a: ISODate, b: ISODate) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5);

/** The item as it would be on the other day: a new id (so Google gets a fresh event and the old one goes), dates shifted. */
function relocate(item: Record<string, unknown>, shift: number): Record<string, unknown> {
  const out: Record<string, unknown> = { ...structuredClone(item), ...(item.id ? { id: uid() } : {}) };
  delete out.gcalEventId;
  delete out.gcalSkip;
  if (typeof out.startDate === 'string') out.startDate = addDays(out.startDate as ISODate, shift);
  if (typeof out.endDate === 'string') out.endDate = addDays(out.endDate as ISODate, shift);
  for (const k of ['startedAt', 'finishedAt'] as const) if (typeof out[k] === 'number') out[k] = (out[k] as number) + shift * 864e5;
  return out;
}

export function itemOf(d: DayEntry, ref: MoveRef): unknown {
  if (ref.kind === 'shift' || ref.kind === 'guardia') return d[ref.kind];
  const list = ref.kind === 'module' ? d.modules : ref.kind === 'appointment' ? d.appointments : d.todos;
  const id = 'id' in ref ? ref.id : '';
  return (list as { id: string }[]).find((x) => x.id === id);
}

/** Takes the item out of `from` and puts it into `to`; returns the moved copy's reference (for undo). */
export function takeOut(d: DayEntry, ref: MoveRef): DayEntry {
  if (!('id' in ref)) return { ...d, [ref.kind]: undefined };
  if (ref.kind === 'module') return { ...d, modules: d.modules.filter((x) => x.id !== ref.id) };
  if (ref.kind === 'appointment') return { ...d, appointments: d.appointments.filter((x) => x.id !== ref.id) };
  return { ...d, todos: d.todos.filter((x) => x.id !== ref.id) };
}

export function putIn(d: DayEntry, ref: MoveRef, item: unknown): DayEntry {
  if (ref.kind === 'shift' || ref.kind === 'guardia') return { ...d, [ref.kind]: item };
  if (ref.kind === 'module') return { ...d, modules: [...d.modules, item as Module] };
  if (ref.kind === 'appointment') return { ...d, appointments: [...d.appointments, item as DayEntry['appointments'][number]] };
  return { ...d, todos: [...d.todos, item as DayEntry['todos'][number]] };
}

/** The moved copy for the day `to`, and the reference to find it there. */
export function movedCopy(item: unknown, ref: MoveRef, from: ISODate, to: ISODate): { item: unknown; ref: MoveRef } {
  const copy = relocate(item as Record<string, unknown>, days(from, to));
  return { item: copy, ref: 'id' in ref ? { kind: ref.kind, id: copy.id as string } : ref };
}

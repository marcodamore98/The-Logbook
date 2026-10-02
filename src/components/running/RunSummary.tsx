import { useEffect, useMemo, useState } from 'react';
import { IconRun } from '../icons';
import { Field } from '../ui';
import { fmtDuration, fmtKm, fmtPaceSec, kmh, kmSplits, maxSpeedKmh } from '../../lib/running/geo';
import type { RunLap, RunModule, TrackPoint } from '../../lib/types';

export interface RunResult {
  title?: string;
  notes?: string;
  distanceM: number;
  maxSpeedKmh?: number;
  splits?: number[];
}

interface Props {
  elapsed: number;
  gpsDistanceM: number;
  useGps: boolean;
  track: TrackPoint[];
  laps: RunLap[];
  mode: 'continuous' | 'intervals';
  planName?: string;
  previous: RunModule[];
  onSave: (r: RunResult) => void;
  onDiscard: () => void;
}

/** The "well done" screen at the end of a run: numbers, records and splits. */
export function RunSummary({ elapsed, gpsDistanceM, useGps, track, laps, mode, planName, previous, onSave, onDiscard }: Props) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [manualKm, setManualKm] = useState('');

  useEffect(() => {
    document.documentElement.classList.add('modal-open');
    return () => document.documentElement.classList.remove('modal-open');
  }, []);

  const km = manualKm.trim() !== '' ? Number(manualKm.replace(',', '.')) || 0 : gpsDistanceM / 1000;
  const distanceM = Math.round(km * 1000);
  const splits = useMemo(() => kmSplits(track), [track]);
  const maxKmh = useMemo(() => maxSpeedKmh(track), [track]);
  const pace = km > 0 ? elapsed / km : 0;
  const bestKm = splits.length ? Math.min(...splits) : undefined;

  const prevRuns = previous.filter((m) => m.distanceM >= 1000 && m.durationSec > 0);
  const prevBestPace = prevRuns.length ? Math.min(...prevRuns.map((m) => m.durationSec / (m.distanceM / 1000))) : undefined;
  const prevLongest = previous.length ? Math.max(...previous.map((m) => m.distanceM)) : 0;
  const prevBestKm = previous.flatMap((m) => m.splits ?? []);
  const last = [...prevRuns][0];
  const lastPace = last ? last.durationSec / (last.distanceM / 1000) : undefined;

  const badges: string[] = [];
  if (prevRuns.length && km >= 1 && prevBestPace !== undefined && pace < prevBestPace) badges.push('Miglior passo medio');
  if (previous.length && distanceM > prevLongest && distanceM >= 1000) badges.push('Corsa più lunga');
  if (bestKm && prevBestKm.length && bestKm < Math.min(...prevBestKm)) badges.push('Miglior chilometro');

  const work = laps.filter((l) => l.kind === 'work');
  const workM = work.reduce((n, l) => n + l.meters, 0);
  const workS = work.reduce((n, l) => n + l.seconds, 0);

  const diff = km >= 1 && lastPace ? pace - lastPace : undefined;

  return (
    <div className="run-summary" role="dialog" aria-label="Riepilogo della corsa">
      <div className="run-summary-inner">
        <div className="run-win">
          <IconRun size={72} />
          <h2>Corsa completata!</h2>
          <p className="muted">{mode === 'intervals' ? planName ?? 'Intervalli' : 'Corsa continua'}</p>
          {badges.length > 0 && (
            <div className="run-badges">
              {badges.map((b) => (
                <span key={b} className="badge">
                  ★ {b}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="run-hero">
          <div>
            <span className="run-big">{useGps || manualKm ? fmtKm(distanceM) : '–'}</span>
            <span className="run-cap">km</span>
          </div>
          <div>
            <span className="run-big">{fmtDuration(elapsed)}</span>
            <span className="run-cap">tempo</span>
          </div>
        </div>

        <dl className="run-grid">
          <div>
            <dt>Passo medio</dt>
            <dd>{fmtPaceSec(pace)} <small>/km</small></dd>
          </div>
          <div>
            <dt>Velocità media</dt>
            <dd>{km > 0 ? kmh(distanceM, elapsed).toFixed(1).replace('.', ',') : '–'} <small>km/h</small></dd>
          </div>
          <div>
            <dt>Velocità massima</dt>
            <dd>{maxKmh ? maxKmh.toFixed(1).replace('.', ',') : '–'} <small>km/h</small></dd>
          </div>
          <div>
            <dt>Km più veloce</dt>
            <dd>{bestKm ? fmtDuration(bestKm) : '–'} <small>/km</small></dd>
          </div>
        </dl>

        {diff !== undefined && (
          <p className={`run-compare ${diff <= 0 ? 'better' : 'worse'}`}>
            {diff <= 0 ? '▲' : '▼'} {Math.abs(Math.round(diff))} s/km {diff <= 0 ? 'più veloce' : 'più lento'} dell’ultima corsa
          </p>
        )}

        {work.length > 0 && (
          <section>
            <h3 className="sub">Ripetute</h3>
            <table className="run-table">
              <thead>
                <tr><th>#</th><th>Tempo</th><th>Distanza</th><th>Passo</th></tr>
              </thead>
              <tbody>
                {work.map((l, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{fmtDuration(l.seconds)}</td>
                    <td>{l.meters} m</td>
                    <td>{l.meters >= 50 ? fmtPaceSec(l.seconds / (l.meters / 1000)) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {workM > 0 && <p className="muted small">Passo medio delle ripetute {fmtPaceSec(workS / (workM / 1000))} /km</p>}
          </section>
        )}

        {splits.length > 0 && (
          <section>
            <h3 className="sub">Chilometri</h3>
            <ul className="run-splits">
              {splits.map((sec, i) => (
                <li key={i} className={sec === bestKm ? 'best' : ''}>
                  <span>{i + 1}</span>
                  <span className="run-split-bar"><span style={{ width: `${Math.min(100, ((bestKm ?? sec) / sec) * 100)}%` }} /></span>
                  <span>{fmtDuration(sec)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="run-save">
          <div className="grid">
            <Field label="Titolo">
              <input value={title} placeholder="es. Giro del parco" onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Distanza (km)">
              <input inputMode="decimal" value={manualKm} placeholder={(gpsDistanceM / 1000).toFixed(2)} onChange={(e) => setManualKm(e.target.value.replace(/[^0-9.,]/g, ''))} />
            </Field>
            <Field label="Note" wide>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <div className="row">
            <button className="btn run-btn" onClick={() => onSave({ title: title.trim() || undefined, notes: notes.trim() || undefined, distanceM, maxSpeedKmh: maxKmh || undefined, splits: splits.length ? splits.map((x) => Math.round(x)) : undefined })}>
              Salva la corsa
            </button>
            <button className="btn-ghost" onClick={() => window.confirm('Scartare questa corsa?') && onDiscard()}>
              Scarta
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

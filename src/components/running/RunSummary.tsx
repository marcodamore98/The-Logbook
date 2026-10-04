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
        {/* "Back" must not throw away an unsaved run: it lands here and does nothing. */}
        <button type="button" data-back hidden tabIndex={-1} aria-hidden="true" />
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

        <div className="rs-hero">
          <span className="stat-label">Distanza totale</span>
          <span className="rs-hero-val">
            {useGps || manualKm ? fmtKm(distanceM) : '–'} <small>km</small>
          </span>
          {diff !== undefined && (
            <span className={`run-compare ${diff <= 0 ? 'better' : 'worse'}`}>
              {diff <= 0 ? '▲' : '▼'} {Math.abs(Math.round(diff))} s/km {diff <= 0 ? 'più veloce' : 'più lento'} dell’ultima corsa
            </span>
          )}
        </div>

        <div className="rs-tiles">
          <div className="stat-tile">
            <span className="stat-label">Tempo</span>
            <strong>{fmtDuration(elapsed)}</strong>
          </div>
          <div className="stat-tile">
            <span className="stat-label">Passo medio</span>
            <strong>
              {fmtPaceSec(pace)}
              <small> /km</small>
            </strong>
            <span className="muted small">{km > 0 ? `${kmh(distanceM, elapsed).toFixed(1).replace('.', ',')} km/h` : ''}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">Passo max</span>
            <strong className="hi">
              {maxKmh ? fmtPaceSec(3600 / maxKmh) : '–'}
              <small> /km</small>
            </strong>
            <span className="muted small">{maxKmh ? `${maxKmh.toFixed(1).replace('.', ',')} km/h` : ''}</span>
          </div>
        </div>

        {splits.length > 0 && (
          <section className="rs-list">
            <h3 className="rs-title">
              <i className="rs-dot" aria-hidden="true" /> Split al chilometro
            </h3>
            <ul className="rs-rows">
              {splits.map((sec, i) => (
                <li key={i} className={sec === bestKm && splits.length > 1 ? 'best' : ''}>
                  <span className="rs-idx">{i + 1}</span>
                  <span className="rs-main">
                    <strong>
                      {fmtDuration(sec)} <small>/km</small>
                    </strong>
                    {sec === bestKm && splits.length > 1 && <span className="rs-badge">⚡ Miglior split</span>}
                  </span>
                  <span className="run-split-bar">
                    <span style={{ width: `${Math.min(100, ((bestKm ?? sec) / sec) * 100)}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {work.length > 0 && (
          <section className="rs-list">
            <h3 className="rs-title">
              <i className="rs-dot lav" aria-hidden="true" /> Ripetute
            </h3>
            <ul className="rs-rows">
              {work.map((l, i) => {
                const p = l.meters >= 50 ? l.seconds / (l.meters / 1000) : Infinity;
                const best = work.length > 1 && p === Math.min(...work.map((x) => (x.meters >= 50 ? x.seconds / (x.meters / 1000) : Infinity)));
                return (
                  <li key={i} className={best ? 'best-lap' : ''}>
                    <span className="rs-idx lap">R{i + 1}</span>
                    <span className="rs-main">
                      <strong>
                        {l.meters} m in {fmtDuration(l.seconds)}
                      </strong>
                      <span className="muted small">{Number.isFinite(p) ? `${fmtPaceSec(p)} /km` : ''}</span>
                    </span>
                    {best && <span className="rs-badge amber">Ripetuta migliore</span>}
                  </li>
                );
              })}
            </ul>
            {workM > 0 && <p className="muted small">Passo medio delle ripetute {fmtPaceSec(workS / (workM / 1000))} /km</p>}
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

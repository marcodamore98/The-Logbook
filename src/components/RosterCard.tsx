import { useState } from 'react';
import { byCode, codeLabel, codeShort, IDLE_CODES, rosterFor, ROSTER_SELF } from '../lib/roster';
import type { ISODate } from '../lib/types';
import { GlyphPlus, IconPeople } from './icons';

/** Who does what today, from the department roster. */
export function RosterCard({ date, onJoin }: { date: ISODate; onJoin?: (names: string[]) => void }) {
  const roster = rosterFor(date);
  const [tab, setTab] = useState<'residents' | 'staff'>('residents');
  if (!roster) return null;
  const row = tab === 'residents' ? roster.residents : roster.staff;
  const groups = byCode(row);
  const mine = roster.residents[ROSTER_SELF] ?? [];
  const active = groups.filter(([c]) => !IDLE_CODES.has(c));
  // Someone on night duty is marked "/" for the day: list as idle only who has nothing else.
  const busy = new Set(active.flatMap(([, names]) => names));
  const idle = groups
    .filter(([c]) => IDLE_CODES.has(c))
    .map(([c, names]) => [c, names.filter((n) => !busy.has(n))] as [string, string[]])
    .filter(([, names]) => names.length > 0);

  return (
    <section className="card roster">
      <div className="card-head">
        <IconPeople />
        <h2>Tabellone</h2>
        <div className="segmented small" role="tablist">
          <button role="tab" aria-selected={tab === 'residents'} className={tab === 'residents' ? 'on' : ''} onClick={() => setTab('residents')}>
            Specializzandi
          </button>
          <button role="tab" aria-selected={tab === 'staff'} className={tab === 'staff' ? 'on' : ''} onClick={() => setTab('staff')}>
            Strutturati
          </button>
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="empty">Nessuna assegnazione per oggi.</p>
      ) : (
        <ul className="roster-list">
          {active.map(([code, names]) => {
            const others = names.filter((n) => !(tab === 'residents' && n === ROSTER_SELF));
            const isMine = mine.includes(code);
            return (
              <li key={code} className={isMine ? 'mine' : ''}>
                <span className="roster-code" title={codeLabel(code)}>
                  {codeShort(code)}
                </span>
                <span className="roster-names">
                  <span className="roster-label">{codeLabel(code)}</span>
                  {names.map((n) => (n === ROSTER_SELF && tab === 'residents' ? 'Tu' : n)).join(', ')}
                </span>
                {onJoin && others.length > 0 && (
                  <button
                    className="icon-btn small"
                    title="Aggiungi al mio turno"
                    aria-label={`Aggiungi ${others.join(', ')} ai colleghi del tuo turno`}
                    onClick={() => onJoin(others)}
                  >
                    <GlyphPlus />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {idle.length > 0 && (
        <p className="muted small">
          {idle.map(([code, names]) => `${codeLabel(code)}: ${names.map((n) => (n === ROSTER_SELF && tab === 'residents' ? 'tu' : n)).join(', ')}`).join(' · ')}
        </p>
      )}
    </section>
  );
}

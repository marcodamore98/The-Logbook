import { byCode, codeLabel, codeShort, IDLE_CODES, rosterFor, ROSTER_SELF } from '../lib/roster';
import type { ISODate } from '../lib/types';
import { GlyphPlus, GlyphSheriff, GlyphTrash, IconPeople } from './icons';
import { Card } from './ui';

interface Person {
  name: string;
  staff: boolean;
}

/** Who does what today: one list per activity, staff (★) first, then residents. */
export function RosterCard({ date, onJoin, onDelete }: { date: ISODate; onJoin?: (names: string[]) => void; onDelete?: () => void }) {
  const roster = rosterFor(date);
  if (!roster) return null;

  const people = new Map<string, Person[]>();
  const add = (row: Record<string, string[]>, staff: boolean) => {
    for (const [code, names] of byCode(row)) {
      if (!people.has(code)) people.set(code, []);
      people.get(code)!.push(...names.map((name) => ({ name, staff })));
    }
  };
  add(roster.staff, true);
  add(roster.residents, false);
  // byCode order for the merged set (guards and theatre first, idle last).
  const order = byCode(Object.fromEntries([...people.keys()].map((c, i) => [String(i), [c]])));
  const codes = order.map(([c]) => c);

  const mine = roster.residents[ROSTER_SELF] ?? [];
  const active = codes.filter((c) => !IDLE_CODES.has(c));
  const busy = new Set(active.flatMap((c) => people.get(c)!.map((p) => p.name)));
  const idle = codes
    .filter((c) => IDLE_CODES.has(c))
    .map((c) => [c, people.get(c)!.filter((p) => !busy.has(p.name))] as const)
    .filter(([, ps]) => ps.length > 0);

  const name = (p: Person) =>
    p.staff ? (
      <strong key={p.name} className="staff">
        <GlyphSheriff />
        {p.name}
      </strong>
    ) : (
      <span key={p.name} className={p.name === ROSTER_SELF ? 'me' : ''}>
        {p.name === ROSTER_SELF ? 'Tu' : p.name}
      </span>
    );

  return (
    <Card
      id="day.roster"
      print="lavoro"
      className="roster"
      defaultOpen={false}
      icon={<IconPeople />}
      title="Tabellone"
      actions={
        onDelete && (
          <button className="icon-btn small no-print" aria-label="Elimina il tabellone" onClick={onDelete}>
            <GlyphTrash />
          </button>
        )
      }
      summary={mine.length ? `Tu: ${mine.map(codeShort).join(' · ')} · ${active.length} attività` : `${active.length} attività`}
    >
      {active.length === 0 ? (
        <p className="empty">Nessuna assegnazione per oggi.</p>
      ) : (
        <ul className="roster-list">
          {active.map((code) => {
            const ps = people.get(code)!;
            const others = ps.filter((p) => p.name !== ROSTER_SELF).map((p) => p.name);
            return (
              <li key={code} className={mine.includes(code) ? 'mine' : ''}>
                <span className="roster-code" title={codeLabel(code)}>
                  {codeShort(code)}
                </span>
                <span className="roster-names">
                  <span className="roster-label">{codeLabel(code)}</span>
                  <span className="roster-people">{ps.map(name)}</span>
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
          {idle.map(([code, ps]) => `${codeLabel(code)}: ${ps.map((p) => (p.name === ROSTER_SELF ? 'tu' : p.name)).join(', ')}`).join(' · ')}
        </p>
      )}
    </Card>
  );
}

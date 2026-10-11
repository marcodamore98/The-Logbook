import { clinicalCases, clinicalLabels, surgeryCases } from '../../lib/worklog';
import { CLINICAL_ACTIVITIES, labelOf, PROCEDURES, SURGICAL_ROLES } from '../../lib/vocab';
import type { ClinicalModule, Colleague, SurgeryModule } from '../../lib/types';

const minutes = (m?: number) => (!m ? '' : m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
const ROLE_SHORT: Record<string, string> = { first: '1° operatore', 'first-tutored': '1° operatore con tutor', second: '2° operatore', assistant: 'Aiuto', observer: 'Osservatore' };

/** The operating list of the day at a glance: one row per patient, the main role in lime when first surgeon. */
export function SurgeryPeek({ m, colleagues }: { m: SurgeryModule; colleagues: Colleague[] }) {
  const cases = surgeryCases(m).filter((c) => c.procedures.some((p) => p.procedureId));
  if (!cases.length) return null;
  return (
    <div className="peek-rows">
      {cases.map((c, i) => {
        const ps = c.procedures.filter((p) => p.procedureId);
        const roles = [...new Set(ps.map((p) => p.role))];
        const role = roles.length === 1 ? roles[0] : roles.find((r) => r.startsWith('first')) ?? roles[0];
        const tutor = colleagues.find((x) => x.id === c.tutorId)?.name;
        return (
          <div key={c.id} className="peek-row">
            <div className="pr-top">
              <span className="pr-title">
                {cases.length > 1 && <span className="pr-pat">Paziente {i + 1}</span>}
                {labelOf(PROCEDURES, ps[0].procedureId)}
                {ps.length > 1 && <span className="pr-more"> + {ps.length - 1}</span>}
              </span>
              {role && <span className={`pr-role${role.startsWith('first') ? ' first' : ''}`}>{ROLE_SHORT[role] ?? labelOf(SURGICAL_ROLES, role)}</span>}
            </div>
            {(tutor || c.durationMin) && (
              <div className="pr-sub">
                <span>{tutor ? `Tutor: ${tutor}` : ''}</span>
                {c.durationMin ? <strong>{minutes(c.durationMin)}</strong> : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Patients seen in clinic or on the ward: one row per patient (or group), with the activities. */
export function ClinicalPeek({ m }: { m: ClinicalModule }) {
  const cases = clinicalCases(m).filter((c) => c.items.length);
  if (!cases.length) return null;
  const labels = clinicalLabels(cases);
  return (
    <div className="peek-rows">
      {cases.map((c, i) => (
        <div key={c.id} className="peek-row">
          <div className="pr-top">
            <span className="pr-title">{c.items.map((it) => labelOf(CLINICAL_ACTIVITIES, it.activityId)).join(' · ')}</span>
            <span className="pr-role">{labels[i]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

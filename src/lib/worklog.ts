// Surgical and clinical cards hold patients ("Paziente 1, 2…"), each with one or more
// procedures/activities. Cards saved before that had a single procedure or activity:
// they are read here as one patient, so every view and statistic sees one shape.

import type { ClinicalCase, ClinicalModule, Module, SurgeryCase, SurgeryModule } from './types';
import { CLINICAL_ACTIVITIES, labelOf, PROCEDURES, SURGICAL_ROLES } from './vocab';

export function surgeryCases(m: SurgeryModule): SurgeryCase[] {
  if (m.cases) return m.cases;
  if (!m.procedureId) return [];
  return [
    {
      id: `${m.id}-1`,
      procedures: [{ id: `${m.id}-p1`, procedureId: m.procedureId, role: m.role ?? 'assistant', approach: m.approach ?? 'na' }],
      setting: m.setting ?? 'elective',
      durationMin: m.durationMin,
      tutorId: m.tutorId,
      notes: m.notes,
      clavien: m.clavien,
    },
  ];
}

export function clinicalCases(m: ClinicalModule): ClinicalCase[] {
  if (m.cases) return m.cases;
  if (!m.activityId) return [];
  return [{ id: `${m.id}-1`, items: [{ id: `${m.id}-a1`, activityId: m.activityId }], count: m.count && m.count > 1 ? m.count : undefined, notes: m.notes }];
}

const hasComplication = (c: SurgeryCase) => !!c.clavien && c.clavien !== 'none';

/** Patients operated, procedures, operating minutes and complications of some cards. */
export function surgeryTotals(modules: Module[]) {
  let patients = 0;
  let procedures = 0;
  let minutes = 0;
  let complications = 0;
  for (const m of modules) {
    if (m.kind !== 'surgery') continue;
    for (const c of surgeryCases(m)) {
      const n = c.procedures.filter((p) => p.procedureId).length;
      if (!n) continue;
      patients++;
      procedures += n;
      minutes += c.durationMin ?? 0;
      if (hasComplication(c)) complications++;
    }
  }
  return { patients, procedures, minutes, complications };
}

/** Patients seen and activities done in some clinical cards. */
export function clinicalTotals(modules: Module[]) {
  let patients = 0;
  let activities = 0;
  for (const m of modules) {
    if (m.kind !== 'clinical') continue;
    for (const c of clinicalCases(m)) {
      if (!c.items.length) continue;
      const n = c.count ?? 1;
      patients += n;
      activities += n * c.items.length;
    }
  }
  return { patients, activities };
}

/** "Isterectomia radicale + 2" */
export function caseTitle(c: SurgeryCase): string {
  const named = c.procedures.filter((p) => p.procedureId);
  if (!named.length) return 'Nessuna procedura';
  return named.length === 1 ? labelOf(PROCEDURES, named[0].procedureId) : `${labelOf(PROCEDURES, named[0].procedureId)} + ${named.length - 1}`;
}

/** One line for the calendar and the closed card. */
export function surgerySummary(m: SurgeryModule): string {
  const cases = surgeryCases(m).filter((c) => c.procedures.some((p) => p.procedureId));
  if (!cases.length) return 'Nessun intervento';
  if (cases.length === 1) {
    const ps = cases[0].procedures.filter((p) => p.procedureId);
    const roles = [...new Set(ps.map((p) => labelOf(SURGICAL_ROLES, p.role)))];
    return [ps.map((p) => labelOf(PROCEDURES, p.procedureId)).join(' + '), roles.length === 1 ? roles[0] : ''].filter(Boolean).join(' · ');
  }
  const n = cases.reduce((a, c) => a + c.procedures.filter((p) => p.procedureId).length, 0);
  return `${cases.length} pazienti · ${n} procedure`;
}

/** "Paziente 3" or, for a row standing for several, "Pazienti 3–5". */
export function clinicalLabels(cases: ClinicalCase[]): string[] {
  let n = 1;
  return cases.map((c) => {
    const k = Math.max(1, c.count ?? 1);
    const label = k === 1 ? `Paziente ${n}` : `Pazienti ${n}–${n + k - 1}`;
    n += k;
    return label;
  });
}

export function clinicalSummary(m: ClinicalModule): string {
  const cases = clinicalCases(m).filter((c) => c.items.length);
  if (!cases.length) return 'Nessuna paziente';
  const t = clinicalTotals([m]);
  if (cases.length === 1 && cases[0].items.length === 1) {
    const what = labelOf(CLINICAL_ACTIVITIES, cases[0].items[0].activityId);
    return t.patients > 1 ? `${t.patients}× ${what}` : what;
  }
  return `${t.patients} ${t.patients === 1 ? 'paziente' : 'pazienti'} · ${t.activities} prestazioni`;
}

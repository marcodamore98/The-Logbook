// Icon set: Google Material Symbols (Rounded, the ones used by the Stitch designs) drawn in ink over a soft
// pastel disc (lime, lavender, mint, sky…). Each icon owns a pigment so areas are recognisable at a glance.
// Symbols are inlined as SVG paths (src/components/ms.ts), no icon font: they work offline.

import type { ReactNode } from 'react';
import { MS, type SymName } from './ms';

export type Pigment = 'ochre' | 'rose' | 'sage' | 'indigo' | 'teal' | 'terra' | 'plum' | 'sand' | 'sky';

/** A Material Symbol on its own (buttons, fields): takes the text colour. `fill` uses the filled variant when there is one. */
export function Sym({ name, size = 20, fill = false, className }: { name: SymName; size?: number; fill?: boolean; className?: string }) {
  const filled = `${name}-fill` as SymName;
  const d = fill && filled in MS ? MS[filled] : MS[name];
  return (
    <svg viewBox="0 -960 960 960" width={size} height={size} aria-hidden="true" fill="currentColor" className={`sym${className ? ` ${className}` : ''}`}>
      <path d={d} />
    </svg>
  );
}

function Art({ size = 36, pigment, sym, children }: { size?: number; pigment: Pigment; sym: SymName; children?: ReactNode }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className={`art-icon pigment-${pigment}`}>
      <circle cx="20" cy="20" r="18" className="wash" />
      <path className="ink" d={MS[sym]} transform="translate(9.5 9.5) scale(0.021875) translate(0 960)" />
      {children}
    </svg>
  );
}

type P = { size?: number };

export const IconMonth = (p: P) => <Art pigment="ochre" sym="calendar_month" {...p} />;
export const IconWeek = (p: P) => <Art pigment="sky" sym="view_week" {...p} />;
export const IconDay = (p: P) => <Art pigment="ochre" sym="light_mode" {...p} />;
export const IconShift = (p: P) => <Art pigment="rose" sym="medical_services" {...p} />;
export const IconSurgery = (p: P) => <Art pigment="terra" sym="surgical" {...p} />;
export const IconClinical = (p: P) => <Art pigment="rose" sym="stethoscope" {...p} />;
export const IconStudy = (p: P) => <Art pigment="indigo" sym="menu_book" {...p} />;
export const IconPhotos = (p: P) => <Art pigment="teal" sym="photo_library" {...p} />;
export const IconNote = (p: P) => <Art pigment="sand" sym="edit_note" {...p} />;
export const IconWorkout = (p: P) => <Art pigment="sage" sym="fitness_center" {...p} />;
export const IconRun = (p: P) => <Art pigment="terra" sym="directions_run" {...p} />;
export const IconOuting = (p: P) => <Art pigment="sage" sym="landscape" {...p} />;
export const IconTodo = (p: P) => <Art pigment="plum" sym="checklist" {...p} />;
export const IconAppointment = (p: P) => <Art pigment="sky" sym="event" {...p} />;
export const IconStats = (p: P) => <Art pigment="indigo" sym="bar_chart" {...p} />;
export const IconSettings = (p: P) => <Art pigment="sand" sym="settings" {...p} />;
export const IconSync = (p: P) => <Art pigment="teal" sym="sync" {...p} />;
export const IconPeople = (p: P) => <Art pigment="plum" sym="group" {...p} />;
export const IconMood = (p: P) => <Art pigment="ochre" sym="mood" {...p} />;
export const IconFood = (p: P) => <Art pigment="sage" sym="restaurant" {...p} />;
export const IconHeart = (p: P) => <Art pigment="rose" sym="favorite" {...p} />;
export const IconSteps = (p: P) => <Art pigment="ochre" sym="footprint" {...p} />;
export const IconSleep = (p: P) => <Art pigment="indigo" sym="bedtime" {...p} />;
export const IconWater = (p: P) => <Art pigment="teal" sym="water_drop" {...p} />;
export const IconScale = (p: P) => <Art pigment="plum" sym="monitor_weight" {...p} />;
export const IconFlame = (p: P) => <Art pigment="terra" sym="local_fire_department" {...p} />;
export const IconBolt = (p: P) => <Art pigment="ochre" sym="bolt" {...p} />;
export const IconTarget = (p: P) => <Art pigment="rose" sym="target" {...p} />;
export const IconTimer = (p: P) => <Art pigment="sky" sym="timer" {...p} />;
export const IconTrophy = (p: P) => <Art pigment="ochre" sym="trophy" {...p} />;
export const IconBreakfast = (p: P) => <Art pigment="ochre" sym="coffee" {...p} />;
export const IconLunch = (p: P) => <Art pigment="sage" sym="lunch_dining" {...p} />;
export const IconDinner = (p: P) => <Art pigment="indigo" sym="dinner_dining" {...p} />;
export const IconSnack = (p: P) => <Art pigment="terra" sym="cookie" {...p} />;
export const IconBarcode = (p: P) => <Art pigment="sky" sym="barcode_scanner" {...p} />;
export const IconCourse = (p: P) => <Art pigment="indigo" sym="school" {...p} />;
export const IconTravel = (p: P) => <Art pigment="sky" sym="luggage" {...p} />;

/** Calendar page showing today's day number. */
export const IconToday = ({ size = 36, day = new Date().getDate() }: { size?: number; day?: number }) => (
  <Art pigment="terra" sym="calendar_today" size={size}>
    <text x="20" y="27" textAnchor="middle" className="today-num">
      {day}
    </text>
  </Art>
);

// ---- Plain UI glyphs (no disc) ----

export const GlyphPrev = () => <Sym name="chevron_left" size={18} />;
export const GlyphNext = () => <Sym name="chevron_right" size={18} />;
export const GlyphPlus = () => <Sym name="add" size={18} />;
export const GlyphClose = () => <Sym name="close" size={18} />;
export const GlyphTrash = () => <Sym name="delete" size={18} />;
export const GlyphCheck = () => <Sym name="check" size={18} />;
export const GlyphDownload = () => <Sym name="download" size={18} />;
export const GlyphUpload = () => <Sym name="upload" size={18} />;
export const GlyphPrint = () => <Sym name="print" size={18} />;
export const GlyphEdit = () => <Sym name="edit" size={18} />;
export const GlyphFolder = () => <Sym name="folder" size={18} />;
export const GlyphMenu = () => <Sym name="menu" size={22} />;

/** Paperclip; with `crown` it marks a certificate (the Stitch "workspace premium" rosette, gold). */
export const GlyphClip = ({ crown = false }: { crown?: boolean }) => (crown ? <Sym name="workspace_premium" size={22} className="cert-glyph" /> : <Sym name="attach_file" size={22} />);

/** Sheriff's badge: marks staff physicians (strutturati) in the roster. */
export const GlyphSheriff = ({ size = 14 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="sheriff">
    <path
      d="M12 3.2l2.6 4.5 5.2.1-2.6 4.2 2.6 4.2-5.2.1L12 20.8l-2.6-4.5-5.2-.1 2.6-4.2-2.6-4.2 5.2-.1z"
      fill="currentColor"
    />
    <g fill="currentColor">
      <circle cx="12" cy="2.6" r="1.5" />
      <circle cx="20.4" cy="7.6" r="1.5" />
      <circle cx="20.4" cy="16.4" r="1.5" />
      <circle cx="12" cy="21.4" r="1.5" />
      <circle cx="3.6" cy="16.4" r="1.5" />
      <circle cx="3.6" cy="7.6" r="1.5" />
    </g>
    <circle cx="12" cy="12" r="2.6" fill="var(--surface)" />
  </svg>
);

/** Small front-and-back body, the shortcut to the muscle distribution. */
export const IconBody = () => (
  <svg viewBox="0 0 28 24" width={28} height={24} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="4" r="2" />
    <path d="M3.5 9c0-1.5 1.5-2.5 3.5-2.5S10.5 7.5 10.5 9v5l-1 8M3.5 9v5l1 8M7 14v8" />
    <circle cx="21" cy="4" r="2" />
    <path d="M17.5 9c0-1.5 1.5-2.5 3.5-2.5S24.5 7.5 24.5 9v5l-1 8M17.5 9v5l1 8M21 14v8" />
  </svg>
);


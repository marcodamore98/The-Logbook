// "Ink & wash" icon set: a fine hand-drawn ink line over a soft watercolor
// blot. Each icon owns a pigment so modules are recognisable at a glance.

import type { ReactNode, SVGProps } from 'react';

const BLOTS = [
  'M8.2 14.5C9.6 7.4 17.6 4.3 24.6 5.6c7.4 1.4 11.5 7.3 10.3 14.6-1.1 7.1-6.8 13.6-14.4 13.9-7.9.3-13.5-5.3-13.7-11.4-.1-2.9.7-5.6 1.4-8.2z',
  'M6.3 20.8c-.9-7.4 5.3-14.1 12.9-14.9 7.2-.8 14.6 3.5 15.3 10.9.8 7.9-4.4 16.3-12.8 16.6-8.1.3-14.6-5.3-15.4-12.6z',
  'M10.1 9.9c5-4.8 13.8-5.3 19.1-.6 5.1 4.5 6.6 12.5 2.5 18.1-4.3 5.8-12.6 7.8-18.6 4.2-6.4-3.8-8.1-16.6-3-21.7z',
];

export type Pigment = 'ochre' | 'rose' | 'sage' | 'indigo' | 'teal' | 'terra' | 'plum' | 'sand' | 'sky';

interface ArtProps extends SVGProps<SVGSVGElement> {
  size?: number;
  pigment: Pigment;
  blot?: 0 | 1 | 2;
  children: ReactNode;
}

function Art({ size = 36, pigment, blot = 0, children, ...rest }: ArtProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      className={`art-icon pigment-${pigment}`}
      {...rest}
    >
      <path d={BLOTS[blot]} className="wash" />
      <path d={BLOTS[(blot + 1) % 3]} className="wash wash-2" transform="translate(6 7) scale(.62)" />
      <g className="ink" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

type P = { size?: number };

export const IconMonth = (p: P) => (
  <Art pigment="ochre" blot={0} {...p}>
    <path d="M9.5 12.2c6.8-.4 14.3-.3 21 .1.6 5.6.5 13.2 0 18.6-6.9.4-14.3.4-20.9 0-.5-5.8-.6-12.8-.1-18.7z" />
    <path d="M9.7 17.4c6.9-.3 13.9-.2 20.8.1M15 9.5v4.7M25 9.4v4.8" />
    <path d="M14 22h.1M19 22h.1M24 22h.1M14 26.5h.1M19 26.5h.1" strokeWidth="2.2" />
  </Art>
);

export const IconWeek = (p: P) => (
  <Art pigment="sky" blot={1} {...p}>
    <path d="M8.5 11.5c7.8-.5 15.7-.4 23.2 0 .4 6 .4 11.9 0 17.4-7.6.5-15.5.5-23.1 0-.5-5.8-.5-11.6-.1-17.4z" />
    <path d="M14.6 11.8v16.9M20.2 11.6v17.2M25.8 11.8v16.9" strokeWidth="1.1" />
    <path d="M10.8 16h1.6M16.5 20h1.6M22 16h1.6M27.6 23h1.6" strokeWidth="2" />
  </Art>
);

export const IconDay = (p: P) => (
  <Art pigment="ochre" blot={2} {...p}>
    <circle cx="20" cy="20" r="5.6" />
    <path d="M20 7.5v3.4M20 29.2v3.3M7.5 20h3.4M29.1 20h3.4M11.1 11.2l2.4 2.4M26.5 26.6l2.4 2.3M28.9 11.1l-2.4 2.4M13.5 26.5l-2.4 2.4" />
  </Art>
);

export const IconShift = (p: P) => (
  <Art pigment="rose" blot={0} {...p}>
    <path d="M12 12.8c5.3-.4 10.6-.4 16 0 .5 5.8.5 12 0 17.6-5.3.4-10.7.4-16 0-.5-5.8-.5-11.8 0-17.6z" />
    <path d="M17.2 9.2c1.8-.3 3.8-.3 5.6 0v3.6h-5.6z" />
    <path d="M20 17.3v7.4M16.3 21h7.4" strokeWidth="2" />
  </Art>
);

export const IconSurgery = (p: P) => (
  <Art pigment="terra" blot={1} {...p}>
    <path d="M8.6 31.4c4.6-4.9 9.5-9.4 14.3-14" />
    <path d="M22.4 17.9c2.6-3.8 5.9-7.2 9.8-9.4-1.3 4.6-4.4 8.6-8.3 11.4" />
    <path d="M22.2 17.6l1.9 2.1" />
    <path d="M9.8 28.3l2.3 2.2" strokeWidth="1.1" />
  </Art>
);

export const IconClinical = (p: P) => (
  <Art pigment="rose" blot={2} {...p}>
    <path d="M12 8.6v7.2c0 4.1 2.8 6.8 6 6.8s6-2.7 6-6.8V8.6" />
    <path d="M10.4 8.6H13.4M22.6 8.6h3" />
    <path d="M18 22.6v2.8c0 3.6 2.6 6 5.7 6s5.6-2.4 5.6-6v-3.3" />
    <circle cx="29.3" cy="19.6" r="2.6" />
  </Art>
);

export const IconStudy = (p: P) => (
  <Art pigment="indigo" blot={0} {...p}>
    <path d="M20 13.2c-3.5-2.4-7.8-3.1-11.7-2.6v18.2c4-.4 8.1.2 11.7 2.6 3.6-2.4 7.7-3 11.7-2.6V10.6c-3.9-.5-8.2.2-11.7 2.6z" />
    <path d="M20 13.2v18.1" />
    <path d="M11.6 15.6c1.9 0 3.9.4 5.4 1.2M11.6 19.9c1.9 0 3.9.4 5.4 1.2M23 16.8c1.5-.8 3.5-1.2 5.4-1.2" strokeWidth="1.1" />
  </Art>
);

export const IconPhotos = (p: P) => (
  <Art pigment="teal" blot={1} {...p}>
    <path d="M8.3 14.6c7.8-.5 15.7-.5 23.4 0 .5 4.9.5 10.2 0 15-7.8.5-15.6.5-23.4 0-.5-4.8-.5-10.1 0-15z" />
    <path d="M14.6 14.4l1.8-3.3h7.2l1.8 3.3" />
    <circle cx="20" cy="22" r="4.4" />
    <path d="M27.8 17.5h.1" strokeWidth="2.2" />
  </Art>
);

export const IconNote = (p: P) => (
  <Art pigment="sand" blot={2} {...p}>
    <path d="M30.8 8.2c-6.2 2.3-11.6 7.4-15 13.6l2.6 2.6c6.1-3.4 11.2-8.8 12.4-16.2z" />
    <path d="M15.8 21.8c-1.1 2.3-2.2 4.6-3.2 7l2.3-.9M18.4 24.4l-3.5 3.5" />
    <path d="M9 32.2c3.6-.8 7.4-1 11.2-.6 2.4.3 4.5.2 6.6-.4" strokeWidth="1.1" />
  </Art>
);

export const IconWorkout = (p: P) => (
  <Art pigment="sage" blot={0} {...p}>
    <path d="M14.6 20h10.8" strokeWidth="2" />
    <path d="M11.4 13.4c1-.2 2.2-.2 3.2 0 .3 4.4.3 8.8 0 13.2-1 .2-2.2.2-3.2 0-.3-4.4-.3-8.8 0-13.2zM25.4 13.4c1-.2 2.2-.2 3.2 0 .3 4.4.3 8.8 0 13.2-1 .2-2.2.2-3.2 0-.3-4.4-.3-8.8 0-13.2z" />
    <path d="M8.3 16.3c.8-.1 1.6-.1 2.4 0 .2 2.5.2 5 0 7.4-.8.1-1.6.1-2.4 0-.2-2.4-.2-4.9 0-7.4zM29.3 16.3c.8-.1 1.6-.1 2.4 0 .2 2.5.2 5 0 7.4-.8.1-1.6.1-2.4 0-.2-2.4-.2-4.9 0-7.4z" />
  </Art>
);

export const IconOuting = (p: P) => (
  <Art pigment="sage" blot={1} {...p}>
    <path d="M6.8 30.6c3.7-6 7-11.7 10.4-17.2 2.3 3.4 4.3 6.8 6.2 10.3 1.3-2.2 2.6-4.1 4-5.8 2.3 4.2 4.4 8.3 5.9 12.7-8.8.4-17.7.4-26.5 0z" />
    <path d="M14.9 17.4c.9.8 2.1.9 3.1.2.8.8 1.6 1 2.5.6" strokeWidth="1.1" />
    <circle cx="27.8" cy="11.3" r="2.8" />
  </Art>
);

export const IconTodo = (p: P) => (
  <Art pigment="plum" blot={2} {...p}>
    <path d="M9.5 11.4c1.9-.2 3.9-.2 5.8 0 .2 1.9.2 3.9 0 5.8-1.9.2-3.9.2-5.8 0-.2-1.9-.2-3.9 0-5.8zM9.5 22.8c1.9-.2 3.9-.2 5.8 0 .2 1.9.2 3.9 0 5.8-1.9.2-3.9.2-5.8 0-.2-1.9-.2-3.9 0-5.8z" />
    <path d="M10.8 14.4l1.6 1.6 3.8-4.4" strokeWidth="1.6" />
    <path d="M19.4 14.4c3.7-.2 7.4-.2 11.2 0M19.4 25.8c3.7-.2 7.4-.2 11.2 0" />
  </Art>
);

export const IconAppointment = (p: P) => (
  <Art pigment="sky" blot={0} {...p}>
    <path d="M20 8.6c6.5 0 11.4 5 11.4 11.4S26.4 31.4 20 31.4 8.6 26.4 8.6 20 13.5 8.6 20 8.6z" />
    <path d="M20 13.2V20l4.5 3" />
  </Art>
);

export const IconStats = (p: P) => (
  <Art pigment="indigo" blot={1} {...p}>
    <path d="M8.5 31.2c7.7.3 15.4.3 23 0" />
    <path d="M12.3 27.8v-6.4M18.3 27.8V14.9M24.3 27.8v-9.2M30.2 27.8V10" strokeWidth="2.2" />
  </Art>
);

export const IconSettings = (p: P) => (
  <Art pigment="sand" blot={2} {...p}>
    <circle cx="20" cy="20" r="4" />
    <path d="M20 8.5v3.2M20 28.3v3.2M8.5 20h3.2M28.3 20h3.2M11.9 11.9l2.2 2.2M25.9 25.9l2.2 2.2M28.1 11.9l-2.2 2.2M14.1 25.9l-2.2 2.2" />
    <path d="M20 12.6c4.1 0 7.4 3.3 7.4 7.4s-3.3 7.4-7.4 7.4-7.4-3.3-7.4-7.4 3.3-7.4 7.4-7.4z" strokeWidth="1.1" />
  </Art>
);

export const IconSync = (p: P) => (
  <Art pigment="teal" blot={0} {...p}>
    <path d="M29.4 16.6c-1.4-4.2-5.2-7-9.6-7-4.7 0-8.6 3.2-9.7 7.6" />
    <path d="M29.8 10.8l-.3 5.9-5.8-.6" />
    <path d="M10.6 23.4c1.4 4.2 5.2 7 9.6 7 4.7 0 8.6-3.2 9.7-7.6" />
    <path d="M10.2 29.2l.3-5.9 5.8.6" />
  </Art>
);

export const IconPeople = (p: P) => (
  <Art pigment="plum" blot={1} {...p}>
    <circle cx="15.5" cy="15.2" r="4" />
    <path d="M8 30.3c.6-4.6 3.8-7.6 7.5-7.6s6.9 3 7.5 7.6" />
    <circle cx="26.2" cy="14.2" r="3.3" strokeWidth="1.2" />
    <path d="M24.6 21.4c3.8-.6 7 1.9 7.6 6.8" strokeWidth="1.2" />
  </Art>
);

export const IconMood = (p: P) => (
  <Art pigment="ochre" blot={1} {...p}>
    <path d="M20 8.6c6.5 0 11.4 5 11.4 11.4S26.4 31.4 20 31.4 8.6 26.4 8.6 20 13.5 8.6 20 8.6z" />
    <path d="M15.3 23.3c2.6 2.8 6.8 2.8 9.4 0" />
    <path d="M16 16.8h.1M24 16.8h.1" strokeWidth="2.3" />
  </Art>
);

// ---- Plain UI glyphs (no wash) ----

function Glyph({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export const GlyphPrev = () => <Glyph d="M14.5 6l-6 6 6 6" />;
export const GlyphNext = () => <Glyph d="M9.5 6l6 6-6 6" />;
export const GlyphPlus = () => <Glyph d="M12 5v14M5 12h14" />;
export const GlyphClose = () => <Glyph d="M6.5 6.5l11 11M17.5 6.5l-11 11" />;
export const GlyphTrash = () => <Glyph d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />;
export const GlyphCheck = () => <Glyph d="M5.5 12.5l4 4 9-9.5" />;
export const GlyphDownload = () => <Glyph d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" />;
export const GlyphUpload = () => <Glyph d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14" />;

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

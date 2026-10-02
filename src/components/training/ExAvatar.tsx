const PIGMENT: Record<string, string> = {
  Petto: 'rose', Dorsali: 'sky', Trapezi: 'sky', Lombari: 'sky', Spalle: 'plum', Bicipiti: 'ochre', Tricipiti: 'ochre', Avambracci: 'ochre',
  Quadricipiti: 'sage', Femorali: 'sage', Glutei: 'sage', Polpacci: 'sage', Adduttori: 'sage', Abduttori: 'sage',
  Addome: 'terra', Cardio: 'rose', 'Corpo intero': 'indigo',
};

export const pigmentOf = (muscle: string) => PIGMENT[muscle] ?? 'sand';

/** Round pastel badge standing in for an exercise picture: initials of the main muscle. */
export function ExAvatar({ muscle, size = 40 }: { muscle: string; size?: number }) {
  return (
    <span className={`ex-avatar pigment-${pigmentOf(muscle)}`} style={{ width: size, height: size, fontSize: size * 0.34 }} aria-hidden="true">
      {muscle.slice(0, 2)}
    </span>
  );
}

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { BodySidebar } from './components/BodySidebar';
import { GlyphClose, GlyphMenu, IconCourse, IconFood, IconMonth, IconNote, IconRun, IconSettings, IconStats, IconStudy, IconSync, IconToday, IconWeek, IconWorkout } from './components/icons';
import { useDrawer } from './components/useDrawer';
import { ActiveBar } from './components/training/ActiveBar';
import { UndoProvider } from './components/Undo';
import { ConfirmProvider } from './components/Confirm';
import { useCourseReminders } from './components/useCourseReminders';
import { RestTimerProvider } from './components/training/RestTimer';
import { firebaseConfigured, signIn, watchUser } from './lib/firebase';
import { cloudRepo } from './lib/store/cloud';
import { localRepo } from './lib/store/local';
import { StoreProvider, useStore } from './lib/store/StoreContext';
import { addDays, isoWeek, today } from './lib/dates';
import { runningWorkout } from './lib/training/analytics';
import DayPage from './pages/DayPage';
import { ScrollMemory, useBackClosesOverlays, useHierarchicalBack, useSheetSwipeDown } from './components/useAppGestures';

// The day page loads with the app; the other pages load the first time they are opened.
const MonthPage = lazy(() => import('./pages/CalendarPages').then((m) => ({ default: m.MonthPage })));
const WeekPage = lazy(() => import('./pages/CalendarPages').then((m) => ({ default: m.WeekPage })));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const ArchivePage = lazy(() => import('./pages/ArchivePage'));
const NotePage = lazy(() => import('./pages/NotePage'));
const DiaryPage = lazy(() => import('./pages/DiaryPage'));
const GymPage = lazy(() => import('./pages/GymPage'));
const NutritionPage = lazy(() => import('./pages/NutritionPage'));
const WorkoutPage = lazy(() => import('./pages/WorkoutPage'));
const RunPage = lazy(() => import('./pages/RunPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const StatsPage = lazy(() => import('./pages/StatsPage'));

const NAV = [
  { to: '/mese', label: 'Mese', Icon: IconMonth },
  { to: '/settimana', label: 'Settimana', Icon: IconWeek },
  { to: '/giorno', label: 'Oggi', Icon: IconToday },
  { to: '/diario', label: 'Diario', Icon: IconNote },
  { to: '/palestra', label: 'Palestra', Icon: IconWorkout },
  { to: '/corsa', label: 'Corsa', Icon: IconRun },
  { to: '/alimentazione', label: 'Alimentazione', Icon: IconFood },
  { to: '/corsi', label: 'Corsi e congressi', Icon: IconCourse },
  { to: '/archivio', label: 'Archivio', Icon: IconStudy },
  { to: '/statistiche', label: 'Statistiche', Icon: IconStats },
  { to: '/impostazioni', label: 'Impostazioni', Icon: IconSettings },
];

/** "Ieri", "Oggi", "Domani" or the date of the day being looked at. */
function dayLabel(date: string): string {
  const t = today();
  if (date === t) return 'Oggi';
  if (date === addDays(t, -1)) return 'Ieri';
  if (date === addDays(t, 1)) return 'Domani';
  return new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

function useCurrentTitle() {
  const loc = useLocation();
  if (loc.pathname.startsWith('/appunti/')) return 'Appunti';
  const nav = NAV.find((n) => loc.pathname.startsWith(n.to));
  if (!nav) return '';
  const date = loc.pathname.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (nav.to === '/giorno') return dayLabel(date ?? today());
  // Pages of a single day say which one: "Alimentazione · Domani".
  if ((nav.to === '/alimentazione' || nav.to === '/diario') && date) return `${nav.label} · ${dayLabel(date)}`;
  return nav.label;
}

/** Small facts shown at the right of some menu items. */
function useNavInfo(): Record<string, string | undefined> {
  const store = useStore();
  const d = today();
  const running = runningWorkout(store.day(d));
  const year = d.slice(0, 4);
  const ecm = store.allDays.reduce((n, day) => n + day.modules.reduce((a, m) => a + (m.kind === 'course' && m.endDate.startsWith(year) ? m.ecm ?? 0 : 0), 0), 0);
  const notes = store.allDays.reduce((n, day) => n + day.modules.filter((m) => m.kind === 'study').length + (day.looseNotes ?? []).filter((m) => !m.trashedAt).length, 0);
  const date = new Date(`${d}T12:00:00`);
  return {
    '/mese': date.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''),
    '/settimana': `Sett. ${isoWeek(d)}`,
    '/giorno': date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
    '/palestra': running ? running.title || 'In corso' : undefined,
    '/corsi': ecm ? `${ecm.toLocaleString('it-IT')} ECM ${year}` : undefined,
    '/archivio': notes ? `${notes} appunti` : undefined,
  };
}

function NavDrawer({ onClose, p, dragging }: { onClose: () => void; p: number; dragging: boolean }) {
  const loc = useLocation();
  const info = useNavInfo();
  const { gcal, settings } = useStore();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={`drawer-backdrop left${dragging ? ' dragging' : ''}`} style={{ background: `rgb(0 0 0 / ${0.4 * p})`, pointerEvents: p > 0.02 ? 'auto' : 'none' }} onClick={onClose}>
      <nav className="drawer nav-drawer" aria-label="Menu" onClick={(e) => e.stopPropagation()} style={{ transform: `translate3d(${(p - 1) * 100}%, 0, 0)` }}>
        <div className="nav-drawer-head">
          <h2 className="drawer-title">Menù</h2>
          <button className="icon-btn small" aria-label="Chiudi menu" onClick={onClose}>
            <GlyphClose />
          </button>
        </div>
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={() => `nav-item${loc.pathname.startsWith(to) ? ' active' : ''}`}
          >
            <Icon size={40} />
            <span className="nav-label">{label}</span>
            {info[to] && <span className={`nav-info${to === '/palestra' ? ' live' : ''}`}>{info[to]}</span>}
          </NavLink>
        ))}
        <div className="nav-foot">
          <i className={gcal.connected && settings.gcal.enabled ? 'on' : firebaseConfigured ? 'cloud' : ''} aria-hidden="true" />
          <span>
            {firebaseConfigured ? 'Dati sincronizzati tra i dispositivi' : 'Dati solo su questo dispositivo'}
            {gcal.configured && settings.gcal.enabled ? (gcal.connected ? ' · Google Calendar collegato' : ' · Google da ricollegare') : ''}
          </span>
        </div>
      </nav>
    </div>
  );
}

/** Small banner under the title bar: back to the day page (of the day being viewed, else today). */
function BackToDay() {
  const { pathname } = useLocation();
  // A note has its own back arrow.
  if (pathname === '/' || pathname.startsWith('/giorno') || pathname.startsWith('/appunti/')) return null;
  const date = pathname.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? today();
  return (
    <Link to={`/giorno/${date}`} className="back-day no-print">
      <span aria-hidden="true">‹</span> Pagina del giorno
    </Link>
  );
}

function Topbar({ onMenu, onSummary }: { onMenu: () => void; onSummary: () => void }) {
  const title = useCurrentTitle();
  return (
    <header className="topbar">
      <button className="brand brand-btn" onClick={onMenu} aria-label="Apri il menu">
        <GlyphMenu />
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={30} height={30} />
        <span className="brand-name">The Logbook</span>
      </button>
      {title && <span className="topbar-title">{title}</span>}
      <GoogleStatus />
      {/* Only with a mouse and a window too narrow for the fixed column: there is no edge to swipe from. */}
      <button className="btn-ghost small summary-toggle" onClick={onSummary} aria-label="Apri il riepilogo del giorno">
        <IconToday size={26} /> Riepilogo
      </button>
    </header>
  );
}

function GoogleStatus() {
  const { gcal, settings, connectGoogle } = useStore();
  if (!gcal.configured || !settings.gcal.enabled || gcal.connected) {
    return gcal.syncing ? <span className="sync-dot" title="Sincronizzazione con Google Calendar" /> : null;
  }
  return (
    <button className="btn-ghost small reconnect" onClick={connectGoogle} title="La sessione Google è scaduta: ricollegati per inviare a Calendar quello che hai aggiunto">
      <IconSync size={20} /> Ricollega Google
      {gcal.pending > 0 && <span className="reconnect-count" aria-label={`${gcal.pending} da inviare a Calendar`}>{gcal.pending}</span>}
    </button>
  );
}

function Shell({ userEmail }: { userEmail?: string }) {
  const menu = useDrawer('left');
  const summary = useDrawer('right');
  const menuOpen = menu.visible;
  const bodyOpen = summary.visible;
  useBackClosesOverlays();
  useSheetSwipeDown();
  useCourseReminders();

  // Keyboard: keep the focused field visible and give the page room to scroll.
  useEffect(() => {
    const isField = (t: EventTarget | null): t is HTMLElement => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && (t as HTMLInputElement).type !== 'checkbox';
    let timer = 0;
    const onIn = (e: FocusEvent) => {
      if (!isField(e.target)) return;
      document.body.classList.add('kb-open');
      const el = e.target;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320);
    };
    const onOut = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!isField(document.activeElement)) document.body.classList.remove('kb-open');
      }, 120);
    };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  // Day-page shortcuts (sleep, water, steps) open the day summary panel; on desktop it is always visible.
  useEffect(() => {
    const onOpen = () => {
      if (!window.matchMedia('(min-width: 1180px)').matches) summary.open();
    };
    window.addEventListener('logbook:open-body', onOpen);
    return () => window.removeEventListener('logbook:open-body', onOpen);
  }, [summary.open]);

  // The page behind a drawer must not scroll.
  useEffect(() => {
    document.documentElement.classList.toggle('scroll-locked', menuOpen || bodyOpen);
    return () => document.documentElement.classList.remove('scroll-locked');
  }, [menuOpen, bodyOpen]);

  return (
    <HashRouter>
      <RestTimerProvider>
        <UndoProvider>
        <ConfirmProvider>
        <div className="app">
          <Topbar onMenu={menu.open} onSummary={summary.open} />
          <div className="layout">
            <main>
              <ScrollMemory />
              <HierarchicalBack />
              <BackToDay />
              <Suspense fallback={<div className="page-loading" aria-label="Caricamento" />}>
              <Routes>
                <Route path="/" element={<Navigate to={`/giorno/${today()}`} replace />} />
                <Route path="/mese/:date?" element={<MonthPage />} />
                <Route path="/settimana/:date?" element={<WeekPage />} />
                <Route path="/giorno/:date?" element={<DayPage />} />
                <Route path="/diario/:date?" element={<DiaryPage />} />
                <Route path="/palestra" element={<GymPage />} />
                <Route path="/palestra/allenamento/:date/:id" element={<WorkoutPage />} />
                <Route path="/corsa" element={<RunPage />} />
                <Route path="/alimentazione/:date?" element={<NutritionPage />} />
                <Route path="/corsi/:sub?" element={<CoursesPage />} />
                <Route path="/archivio/:tab?/:folder?" element={<ArchivePage />} />
                <Route path="/appunti/:date/:id" element={<NotePage />} />
                <Route path="/statistiche" element={<StatsPage />} />
                <Route path="/impostazioni" element={<SettingsPage userEmail={userEmail} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
            </main>
            <div className="side-desktop">
              <BodySidebar />
            </div>
          </div>
          <ActiveBar />
          {menu.visible && <NavDrawer onClose={menu.close} p={menu.p} dragging={menu.dragging} />}
          {summary.visible && (
            <div
              className={`drawer-backdrop right${summary.dragging ? ' dragging' : ''}`}
              style={{ background: `rgb(0 0 0 / ${0.4 * summary.p})`, pointerEvents: summary.p > 0.02 ? 'auto' : 'none' }}
              onClick={summary.close}
            >
              <div className="drawer summary-drawer" onClick={(e) => e.stopPropagation()} style={{ transform: `translate3d(${(1 - summary.p) * 100}%, 0, 0)` }}>
                <BodySidebar onClose={summary.close} />
              </div>
            </div>
          )}
        </div>
        </ConfirmProvider>
        </UndoProvider>
      </RestTimerProvider>
    </HashRouter>
  );
}

/** Lives inside the router: Android back goes to the parent page (see lib/backNav). */
function HierarchicalBack() {
  useHierarchicalBack();
  return null;
}

function Login() {
  const [err, setErr] = useState<string>();
  return (
    <div className="login">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={72} height={72} />
      <h1>The Logbook</h1>
      <p className="muted">Il diario delle tue giornate: turni, sala operatoria, studio e tutto il resto.</p>
      <button className="btn" onClick={() => signIn().catch((e) => setErr(String(e.message ?? e)))}>
        Accedi con Google
      </button>
      {err && <p className="error small">{err}</p>}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(firebaseConfigured ? undefined : null);

  useEffect(() => (firebaseConfigured ? watchUser(setUser) : undefined), []);

  const repo = useMemo(() => (firebaseConfigured && user ? cloudRepo(user.uid) : localRepo), [user]);

  if (firebaseConfigured && user === undefined) return <div className="login muted">Caricamento…</div>;
  if (firebaseConfigured && !user) return <Login />;

  return (
    <StoreProvider key={repo.mode + (user?.uid ?? '')} repo={repo}>
      <Shell userEmail={user?.email ?? undefined} />
    </StoreProvider>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { BodySidebar } from './components/BodySidebar';
import { GlyphClose, GlyphMenu, IconFood, IconHeart, IconMonth, IconNote, IconRun, IconSettings, IconStats, IconSync, IconToday, IconWeek, IconWorkout } from './components/icons';
import { useDrawer } from './components/useDrawer';
import { ActiveBar } from './components/training/ActiveBar';
import { RestTimerProvider } from './components/training/RestTimer';
import { firebaseConfigured, signIn, watchUser } from './lib/firebase';
import { cloudRepo } from './lib/store/cloud';
import { localRepo } from './lib/store/local';
import { StoreProvider, useStore } from './lib/store/StoreContext';
import { today } from './lib/dates';
import { MonthPage, WeekPage } from './pages/CalendarPages';
import DayPage from './pages/DayPage';
import DiaryPage from './pages/DiaryPage';
import GymPage from './pages/GymPage';
import NutritionPage from './pages/NutritionPage';
import WorkoutPage from './pages/WorkoutPage';
import RunPage from './pages/RunPage';
import SettingsPage from './pages/SettingsPage';
import StatsPage from './pages/StatsPage';

const NAV = [
  { to: '/mese', label: 'Mese', Icon: IconMonth },
  { to: '/settimana', label: 'Settimana', Icon: IconWeek },
  { to: '/giorno', label: 'Oggi', Icon: IconToday },
  { to: '/diario', label: 'Diario', Icon: IconNote },
  { to: '/palestra', label: 'Palestra', Icon: IconWorkout },
  { to: '/corsa', label: 'Corsa', Icon: IconRun },
  { to: '/alimentazione', label: 'Alimentazione', Icon: IconFood },
  { to: '/statistiche', label: 'Statistiche', Icon: IconStats },
  { to: '/impostazioni', label: 'Impostazioni', Icon: IconSettings },
];

function useCurrentTitle() {
  const loc = useLocation();
  return NAV.find((n) => loc.pathname.startsWith(n.to))?.label ?? '';
}

function NavDrawer({ onClose, p, dragging }: { onClose: () => void; p: number; dragging: boolean }) {
  const loc = useLocation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={`drawer-backdrop left${dragging ? ' dragging' : ''}`} style={{ background: `rgb(0 0 0 / ${0.4 * p})`, pointerEvents: p > 0.02 ? 'auto' : 'none' }} onClick={onClose}>
      <nav className="drawer nav-drawer" aria-label="Menu" onClick={(e) => e.stopPropagation()} style={{ transform: `translate3d(${(p - 1) * 100}%, 0, 0)` }}>
        <div className="nav-drawer-head">
          <span className="brand">
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={30} height={30} />
            The Logbook
          </span>
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
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Small banner under the title bar: back to the day page (of the day being viewed, else today). */
function BackToDay() {
  const { pathname } = useLocation();
  if (pathname === '/' || pathname.startsWith('/giorno')) return null;
  const date = pathname.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? today();
  return (
    <Link to={`/giorno/${date}`} className="back-day no-print">
      <span aria-hidden="true">‹</span> Pagina del giorno
    </Link>
  );
}

function Topbar({ onMenu, onBody }: { onMenu: () => void; onBody: () => void }) {
  const title = useCurrentTitle();
  return (
    <header className="topbar">
      <button className="brand brand-btn" onClick={onMenu} aria-label="Apri il menu">
        <GlyphMenu />
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={28} height={28} />
        <span className="brand-name">The Logbook</span>
      </button>
      {title && <span className="topbar-title">{title}</span>}
      <GoogleStatus />
      <button className="btn-ghost small body-toggle" onClick={onBody} aria-label="Apri corpo e riepilogo">
        <IconHeart size={26} /> Corpo
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
    <button className="btn-ghost small reconnect" onClick={connectGoogle} title="La sessione Google è scaduta">
      <IconSync size={20} /> Ricollega Google
    </button>
  );
}

function Shell({ userEmail }: { userEmail?: string }) {
  const [bodyOpen, setBodyOpen] = useState(false);
  const menu = useDrawer();
  const menuOpen = menu.visible;

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

  // The page behind a drawer must not scroll.
  useEffect(() => {
    document.documentElement.classList.toggle('scroll-locked', menuOpen || bodyOpen);
    return () => document.documentElement.classList.remove('scroll-locked');
  }, [menuOpen, bodyOpen]);

  return (
    <HashRouter>
      <RestTimerProvider>
        <div className="app">
          <Topbar onMenu={menu.open} onBody={() => setBodyOpen(true)} />
          <div className="layout">
            <main>
              <BackToDay />
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
                <Route path="/statistiche" element={<StatsPage />} />
                <Route path="/impostazioni" element={<SettingsPage userEmail={userEmail} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <div className="side-desktop">
              <BodySidebar />
            </div>
          </div>
          <ActiveBar />
          {menu.visible && <NavDrawer onClose={menu.close} p={menu.p} dragging={menu.dragging} />}
          {bodyOpen && (
            <div className="drawer-backdrop" onClick={() => setBodyOpen(false)}>
              <div className="drawer" onClick={(e) => e.stopPropagation()}>
                <BodySidebar onClose={() => setBodyOpen(false)} />
              </div>
            </div>
          )}
        </div>
      </RestTimerProvider>
    </HashRouter>
  );
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

import { useEffect, useMemo, useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { IconDay, IconMonth, IconSettings, IconStats, IconSync, IconWeek } from './components/icons';
import { firebaseConfigured, signIn, watchUser } from './lib/firebase';
import { cloudRepo } from './lib/store/cloud';
import { localRepo } from './lib/store/local';
import { StoreProvider, useStore } from './lib/store/StoreContext';
import { today } from './lib/dates';
import { MonthPage, WeekPage } from './pages/CalendarPages';
import DayPage from './pages/DayPage';
import SettingsPage from './pages/SettingsPage';
import StatsPage from './pages/StatsPage';

const NAV = [
  { to: '/mese', label: 'Mese', Icon: IconMonth },
  { to: '/settimana', label: 'Settimana', Icon: IconWeek },
  { to: '/giorno', label: 'Oggi', Icon: IconDay },
  { to: '/statistiche', label: 'Statistiche', Icon: IconStats },
  { to: '/impostazioni', label: 'Impostazioni', Icon: IconSettings },
];

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
  return (
    <HashRouter>
      <div className="app">
        <header className="topbar">
          <span className="brand">
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={28} height={28} />
            The Logbook
          </span>
          <nav className="nav">
            {NAV.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <Icon size={30} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <GoogleStatus />
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Navigate to={`/giorno/${today()}`} replace />} />
            <Route path="/mese/:date?" element={<MonthPage />} />
            <Route path="/settimana/:date?" element={<WeekPage />} />
            <Route path="/giorno/:date?" element={<DayPage />} />
            <Route path="/statistiche" element={<StatsPage />} />
            <Route path="/impostazioni" element={<SettingsPage userEmail={userEmail} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
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

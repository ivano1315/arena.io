import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Home from './pages/Home';
import Characters from './pages/Characters';
import CharacterDetail from './pages/CharacterDetail';
import Updates from './pages/Updates';
import TeamBuilder from './pages/TeamBuilder';
import Meta from './pages/Meta';
import Ranking from './pages/Ranking';
import Trios from './pages/Trios';
import { useI18n, type Key, type Lang } from './lib/i18n';

const NAV: { to: string; key: Key; end?: boolean }[] = [
  { to: '/', key: 'nav.dashboard', end: true },
  { to: '/characters', key: 'nav.characters' },
  { to: '/ranking', key: 'nav.ranking' },
  { to: '/trios', key: 'nav.trios' },
  { to: '/meta', key: 'nav.meta' },
  { to: '/team-builder', key: 'nav.team' },
  { to: '/updates', key: 'nav.updates' },
];

const LANGS: { code: Lang; label: string; name: string }[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'pt', label: 'PT', name: 'Português' },
];

export default function App() {
  const { pathname } = useLocation();
  const { t, lang, setLang } = useI18n();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark">忍</span>
          <span>arena<em>.io</em></span>
        </NavLink>
        <nav className="topnav" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
        <div className="lang" role="group" aria-label={t('lang.switch')}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              className={lang === l.code ? 'on' : ''}
              onClick={() => setLang(l.code)}
              aria-pressed={lang === l.code}
              title={l.name}
              lang={l.code}
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/characters" element={<Characters />} />
          <Route path="/characters/:id" element={<CharacterDetail />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/trios" element={<Trios />} />
          <Route path="/meta" element={<Meta />} />
          <Route path="/team-builder" element={<TeamBuilder />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/updates/:slug" element={<Updates />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <footer className="footer">
        <p>{t('footer')}</p>
        {lang === 'pt' && <p>{t('note.english')}</p>}
      </footer>
    </div>
  );
}

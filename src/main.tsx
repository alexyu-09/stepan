import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import InventoryTracker from './components/InventoryTracker.tsx'
import Auth from './components/Auth.tsx'
import FlyteamParser from './components/FlyteamParser.tsx'

type Page = 'converter' | 'tracker' | 'flyteam';

function Shell() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [page, setPage] = useState<Page>(() => {
    const hash = window.location.hash.replace('#', '');
    return hash === 'tracker' ? 'tracker' : hash === 'flyteam' ? 'flyteam' : 'converter';
  });

  const navigate = (p: Page) => {
    setPage(p);
    window.location.hash = p === 'converter' ? '' : p;
  };

  if (!isAuthenticated) {
    return <Auth onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <>
      <nav className="main-nav">
        <div className="main-nav-inner">
          <div className="nav-brand">
            <span className="nav-logo">С</span>
            СТЕПАН
          </div>
          <div className="nav-tabs">
            <button
              className={`nav-tab ${page === 'converter' ? 'nav-tab-active' : ''}`}
              onClick={() => navigate('converter')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Конвертер
            </button>
            <button
              className={`nav-tab ${page === 'tracker' ? 'nav-tab-active' : ''}`}
              onClick={() => navigate('tracker')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Мониторинг
              <span className="nav-badge">NEW</span>
            </button>
            <button
              className={`nav-tab ${page === 'flyteam' ? 'nav-tab-active' : ''}`}
              onClick={() => navigate('flyteam')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Парсер
            </button>
          </div>
        </div>
      </nav>
      <div className="page-content">
        {page === 'converter' ? <App /> : page === 'tracker' ? <InventoryTracker /> : <FlyteamParser />}
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
)

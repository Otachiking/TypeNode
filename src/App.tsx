import React, { useState, useEffect } from 'react';
import { CapturePage } from './pages/CapturePage';
import { NowPage } from './pages/NowPage';
import { MapPage } from './pages/MapPage';
import { useToast } from './hooks/useTaskData';
import { seedDatabase, resetAndSeed } from './data/seedData';
import { Zap, Home, GitBranch, RotateCcw, Sun, Moon } from 'lucide-react';

type AppMode = 'capture' | 'now' | 'map';

function getInitialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem('tasknode-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'dark';
}

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('now');
  const [isSeeded, setIsSeeded] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const { toasts, showToast } = useToast();

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tasknode-theme', theme);
  }, [theme]);

  // Seed database on first load
  useEffect(() => {
    seedDatabase().then(() => setIsSeeded(true));
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleReset = async () => {
    if (confirm('Reset semua data dan seed ulang? Data yang ditambahkan manual akan hilang.')) {
      await resetAndSeed();
      showToast('🔄 Data di-reset — 17 task, 2 thread');
    }
  };

  if (!isSeeded) {
    return (
      <div className="app-layout">
        <main className="app-main">
          <div className="empty-state" style={{ minHeight: '100dvh' }}>
            <p className="empty-state-desc">Menyiapkan TaskNode...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <main className="app-main">
        {mode === 'capture' && <CapturePage showToast={showToast} />}
        {mode === 'now' && <NowPage showToast={showToast} />}
        {mode === 'map' && <MapPage />}
      </main>

      <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
        <button
          className={`nav-item ${mode === 'capture' ? 'active' : ''}`}
          onClick={() => setMode('capture')}
          id="nav-capture"
          aria-label="Capture mode"
        >
          <Zap size={20} />
          <span>Capture</span>
        </button>

        <button
          className={`nav-item ${mode === 'now' ? 'active' : ''}`}
          onClick={() => setMode('now')}
          id="nav-now"
          aria-label="Now mode"
        >
          <Home size={20} />
          <span>Now</span>
        </button>

        <button
          className={`nav-item ${mode === 'map' ? 'active' : ''}`}
          onClick={() => setMode('map')}
          id="nav-map"
          aria-label="Map mode"
        >
          <GitBranch size={20} />
          <span>Map</span>
        </button>

        <div className="nav-util">
          <button
            className="nav-item"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
            aria-label="Toggle theme"
            style={{ padding: 'var(--space-2)' }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            className="nav-item"
            onClick={handleReset}
            id="nav-reset"
            title="Reset & Seed ulang"
            aria-label="Reset data"
            style={{ opacity: 0.5, padding: 'var(--space-2)' }}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </nav>

      {/* Toast notifications (lower priority than undo toast) */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.exiting ? 'toast-exit' : ''}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;

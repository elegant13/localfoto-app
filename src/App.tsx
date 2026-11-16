import React, { useEffect, useState } from 'react';
import { Globe, Lock, Sun, Moon } from 'lucide-react';
import { profileRegistry } from './profiles/registry';
import { PhotoProfile } from './types/profile';
import { CameraViewfinder, CapturePayload } from './components/CameraViewfinder';
import { ExportModal } from './components/ExportModal';
import { HomePage } from './components/HomePage';
import { LocalFotoLogo } from './components/LocalFotoLogo';

export const App: React.FC = () => {
  const profiles = profileRegistry.getAll();
  const [activeProfile, setActiveProfile] = useState<PhotoProfile>(() =>
    profileRegistry.getDefault()
  );
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [capturePayload, setCapturePayload] = useState<CapturePayload | null>(
    null
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('localfoto_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0F1117' : '#F8FAFD');
    }
    try {
      window.localStorage.setItem('localfoto_theme', theme);
    } catch {
      // Ignore storage errors in private mode
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFD] text-[#1F1F1F] flex flex-col transition-colors duration-200">
      {/* Material Design 3 Top App Bar */}
      <header className="sticky top-0 z-30 bg-[#F8FAFD]/95 backdrop-blur-md border-b border-[#E1E3E1] transition-colors duration-200">
        <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setCapturePayload(null);
              setHasStarted(false);
            }}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
            title="Return to LocalFoto Home"
          >
            <LocalFotoLogo className="w-9 h-9 shrink-0 shadow-xs rounded-xl" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold tracking-tight text-[#1F1F1F] truncate">
                  LocalFoto
                </h1>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#E6F4EA] text-[#137333]">
                  <Lock className="w-2.5 h-2.5" />
                  Private
                </span>
              </div>
            </div>
          </button>

          {/* Right Controls: Jurisdiction Pill + Light/Dark Theme Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative flex items-center">
              <Globe className="w-3.5 h-3.5 text-[#0B57D0] absolute left-2.5 pointer-events-none" />
              <select
                id="profile-select"
                aria-label="Jurisdiction Profile"
                value={activeProfile.id}
                onChange={(e) =>
                  setActiveProfile(profileRegistry.get(e.target.value))
                }
                className="pl-7 pr-2.5 py-1.5 rounded-full bg-[#EDF2FA] text-[11px] font-semibold text-[#041E49] border border-[#C4C7C5]/60 focus:outline-none focus:ring-2 focus:ring-[#0B57D0] cursor-pointer transition max-w-[148px] truncate"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === 'light'
                  ? 'Switch to dark theme'
                  : 'Switch to light theme'
              }
              title={
                theme === 'light'
                  ? 'Switch to Dark Theme'
                  : 'Switch to Light Theme'
              }
              className="w-9 h-9 rounded-full bg-[#EDF2FA] border border-[#C4C7C5]/60 flex items-center justify-center text-[#041E49] cursor-pointer active:scale-95 transition"
              data-testid="theme-toggle-btn"
            >
              {theme === 'light' ? (
                <Moon className="w-4 h-4 text-[#0B57D0]" />
              ) : (
                <Sun className="w-4 h-4 text-[#FDD663]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Mobile-First Content Area */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-3">
        {!hasStarted ? (
          <HomePage
            profiles={profiles}
            activeProfile={activeProfile}
            onSelectProfile={(p) => setActiveProfile(p)}
            onGetStarted={() => setHasStarted(true)}
          />
        ) : !capturePayload ? (
          <CameraViewfinder
            activeProfile={activeProfile}
            onCaptureReady={(payload) => setCapturePayload(payload)}
          />
        ) : (
          <ExportModal
            profile={activeProfile}
            capture={capturePayload}
            onClose={() => setCapturePayload(null)}
          />
        )}
      </main>
    </div>
  );
};

export default App;

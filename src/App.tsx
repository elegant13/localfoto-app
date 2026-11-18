import React, { useEffect, useState } from 'react';
import { Globe, Lock, Sun, Moon, MessageSquare, WifiOff } from 'lucide-react';
import { profileRegistry } from './profiles/registry';
import { PhotoProfile } from './types/profile';
import { CameraViewfinder, CapturePayload } from './components/CameraViewfinder';
import { ExportModal } from './components/ExportModal';
import { HomePage } from './components/HomePage';
import { LocalFotoLogo } from './components/LocalFotoLogo';
import { AdminDashboard } from './components/AdminDashboard';
import { FeedbackSheet } from './components/FeedbackSheet';
import { PrivacySheet } from './components/PrivacySheet';
import {
  fetchPublicStats,
  PublicStats,
  submitFeedback,
  trackEvent,
} from './services/analyticsService';

export const App: React.FC = () => {
  const profiles = profileRegistry.getAll();
  const [activeProfile, setActiveProfile] = useState<PhotoProfile>(() =>
    profileRegistry.getDefault()
  );
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [capturePayload, setCapturePayload] = useState<CapturePayload | null>(
    null
  );
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.location.hash === '#admin';
    }
    return false;
  });
  const [publicStats, setPublicStats] = useState<PublicStats | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState<boolean>(false);
  const [privacyOpen, setPrivacyOpen] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [feedbackPromptMode, setFeedbackPromptMode] = useState<
    'general' | 'post_export'
  >('general');
  const [showRetakeReasonBar, setShowRetakeReasonBar] =
    useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('localfoto_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setIsAdminRoute(window.location.hash === '#admin');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    try {
      const alreadyTracked = window.sessionStorage.getItem('localfoto_visited');
      if (!alreadyTracked) {
        window.sessionStorage.setItem('localfoto_visited', '1');
        trackEvent('visit', activeProfile.id);
      }
    } catch {
      trackEvent('visit', activeProfile.id);
    }
    fetchPublicStats().then((stats) => {
      if (stats) setPublicStats(stats);
    });
  }, [activeProfile.id]);

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

  // Option 1: Trigger post-save/order feedback sheet once per session
  const handlePostExportAction = () => {
    try {
      const prompted = window.sessionStorage.getItem('localfoto_fb_prompted');
      if (prompted) return;
      window.sessionStorage.setItem('localfoto_fb_prompted', '1');
    } catch {
      // Proceed if sessionStorage is unavailable
    }
    window.setTimeout(() => {
      setFeedbackPromptMode('post_export');
      setFeedbackOpen(true);
    }, 600);
  };

  // Option 3: Capture non-blocking retake reason
  const handleRetakeReason = async (reason: string) => {
    setShowRetakeReasonBar(false);
    await submitFeedback('needs_work', `Retake reason: ${reason}`, activeProfile.id);
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFD] text-[#1F1F1F] flex flex-col transition-colors duration-200">
      {/* Material Design 3 Top App Bar */}
      <header className="sticky top-0 z-30 bg-[#F8FAFD]/95 backdrop-blur-md border-b border-[#E1E3E1] transition-colors duration-200">
        <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                if (window.location.hash === '#admin') {
                  window.location.hash = '';
                }
                setIsAdminRoute(false);
                setCapturePayload(null);
                setHasStarted(false);
                setShowRetakeReasonBar(false);
              }}
              className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
              title="Return to LocalFoto Home"
            >
              <LocalFotoLogo className="w-9 h-9 shrink-0 shadow-xs rounded-xl" />
              <h1 className="text-base font-extrabold tracking-tight text-[#1F1F1F] truncate">
                LocalFoto
              </h1>
            </button>
            <button
              type="button"
              onClick={() => setPrivacyOpen(true)}
              title="View On-Device Privacy Guarantee & Airplane Mode Test"
              aria-label="View On-Device Privacy Guarantee"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E6F4EA] hover:bg-[#CEEAD6] text-[#137333] cursor-pointer active:scale-95 transition shrink-0"
              data-testid="private-pill-btn"
            >
              {isOffline ? (
                <WifiOff className="w-2.5 h-2.5" />
              ) : (
                <Lock className="w-2.5 h-2.5" />
              )}
              <span>{isOffline ? 'Offline · Private' : 'Private'}</span>
            </button>
          </div>

          {/* Right Controls: Jurisdiction Pill + Feedback Icon + Theme Toggle */}
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
                className="pl-7 pr-2.5 py-1.5 rounded-full bg-[#EDF2FA] text-[11px] font-semibold text-[#041E49] border border-[#C4C7C5]/60 focus:outline-none focus:ring-2 focus:ring-[#0B57D0] cursor-pointer transition max-w-[132px] truncate"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* Option 2: Subtle Header Feedback Icon */}
            <button
              type="button"
              onClick={() => {
                setFeedbackPromptMode('general');
                setFeedbackOpen(true);
              }}
              aria-label="Share feedback"
              title="Share Feedback"
              className="w-9 h-9 rounded-full bg-[#EDF2FA] border border-[#C4C7C5]/60 flex items-center justify-center text-[#0B57D0] cursor-pointer active:scale-95 transition"
              data-testid="header-feedback-btn"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

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
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-3 flex flex-col">
        {isAdminRoute ? (
          <AdminDashboard
            onBack={() => {
              window.location.hash = '';
              setIsAdminRoute(false);
            }}
          />
        ) : !hasStarted ? (
          <HomePage
            profiles={profiles}
            activeProfile={activeProfile}
            onSelectProfile={(p) => setActiveProfile(p)}
            onGetStarted={() => setHasStarted(true)}
            publicStats={publicStats}
          />
        ) : !capturePayload ? (
          <CameraViewfinder
            activeProfile={activeProfile}
            onCaptureReady={(payload) => {
              setShowRetakeReasonBar(false);
              setCapturePayload(payload);
            }}
            showRetakeReasonBar={showRetakeReasonBar}
            onRetakeReason={handleRetakeReason}
            onDismissRetakeBar={() => setShowRetakeReasonBar(false)}
          />
        ) : (
          <ExportModal
            profile={activeProfile}
            capture={capturePayload}
            onClose={() => {
              setCapturePayload(null);
              setShowRetakeReasonBar(true);
            }}
            onActionCompleted={handlePostExportAction}
          />
        )}
      </main>

      {/* Option 1 & 2: Slide-Up Feedback Bottom Sheet */}
      <FeedbackSheet
        isOpen={feedbackOpen}
        title={
          feedbackPromptMode === 'post_export'
            ? 'Photo saved! How did it turn out?'
            : 'Share Feedback'
        }
        subtitle={
          feedbackPromptMode === 'post_export'
            ? '1-tap rating helps us improve LocalFoto'
            : 'Request a country or report an issue'
        }
        profileId={activeProfile.id}
        onClose={() => setFeedbackOpen(false)}
      />

      <PrivacySheet
        isOpen={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
      />
    </div>
  );
};

export default App;

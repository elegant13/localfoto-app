import React, { useState } from 'react';
import { Camera, Globe, Lock } from 'lucide-react';
import { profileRegistry } from './profiles/registry';
import { PhotoProfile } from './types/profile';
import { CameraViewfinder, CapturePayload } from './components/CameraViewfinder';
import { ExportModal } from './components/ExportModal';
import { HomePage } from './components/HomePage';

export const App: React.FC = () => {
  const profiles = profileRegistry.getAll();
  const [activeProfile, setActiveProfile] = useState<PhotoProfile>(() =>
    profileRegistry.getDefault()
  );
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [capturePayload, setCapturePayload] = useState<CapturePayload | null>(
    null
  );

  return (
    <div className="min-h-screen bg-[#F8FAFD] text-[#1F1F1F] flex flex-col">
      {/* Material Design 3 Top App Bar */}
      <header className="sticky top-0 z-30 bg-[#F8FAFD]/95 backdrop-blur-md border-b border-[#E1E3E1]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setCapturePayload(null);
              setHasStarted(false);
            }}
            className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
            title="Return to LocalFoto Home"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#D3E3FD] text-[#041E49] flex items-center justify-center shrink-0 shadow-xs">
              <Camera className="w-5 h-5 text-[#0B57D0]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-[#1F1F1F] truncate">
                  LocalFoto
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#E6F4EA] text-[#137333]">
                  <Lock className="w-3 h-3" />
                  On-Device
                </span>
              </div>
              <p className="text-xs text-[#444746] truncate">
                Passport Photo &amp; 4×6&quot; Store Print
              </p>
            </div>
          </button>

          {/* M3 Tonal Pill Selector for Jurisdiction Profile */}
          <div className="relative flex items-center shrink-0">
            <Globe className="w-4 h-4 text-[#0B57D0] absolute left-3 pointer-events-none" />
            <select
              id="profile-select"
              aria-label="Jurisdiction Profile"
              value={activeProfile.id}
              onChange={(e) =>
                setActiveProfile(profileRegistry.get(e.target.value))
              }
              className="pl-8 pr-3 py-2 rounded-full bg-[#EDF2FA] hover:bg-[#E4EBF5] text-xs font-medium text-[#041E49] border border-[#C4C7C5]/60 focus:outline-none focus:ring-2 focus:ring-[#0B57D0] cursor-pointer transition"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Mobile-First Content Area */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-4 pb-28 sm:pb-12">
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

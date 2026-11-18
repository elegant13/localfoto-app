import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Plane,
  Cpu,
  WifiOff,
  CheckCircle2,
  X,
} from 'lucide-react';

interface PrivacySheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacySheet: React.FC<PrivacySheetProps> = ({
  isOpen,
  onClose,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="On-Device Privacy Guarantee"
    >
      <div
        className="w-full max-w-md bg-white rounded-[28px] p-5 m3-elevation-3 border border-[#E1E3E1] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#E6F4EA] text-[#137333] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#1F1F1F]">
                100% On-Device Privacy
              </h3>
              <p className="text-xs text-[#444746]">
                0 photo bytes ever leave your device
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close privacy details"
            className="w-8 h-8 rounded-full bg-[#EDF2FA] text-[#444746] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Airplane Mode Proof Banner */}
        <div
          className={`p-3.5 rounded-2xl border space-y-1.5 ${
            !isOnline
              ? 'bg-[#E6F4EA] border-[#137333]/30 text-[#137333]'
              : 'bg-[#F3F6FC] border-[#0B57D0]/20 text-[#041E49]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              {!isOnline ? (
                <WifiOff className="w-4 h-4 shrink-0" />
              ) : (
                <Plane className="w-4 h-4 text-[#0B57D0] shrink-0" />
              )}
              <span>
                {!isOnline
                  ? 'Airplane Mode Active — Offline Verified'
                  : 'Prove It Yourself: Try Airplane Mode'}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                !isOnline
                  ? 'bg-[#137333] text-white'
                  : 'bg-[#D3E3FD] text-[#0B57D0]'
              }`}
            >
              {!isOnline ? 'Offline' : 'Online'}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed opacity-90">
            {!isOnline
              ? 'Your device is offline right now—camera capture, AI framing, and 4×6" sheet download continue running 100% locally.'
              : 'Turn on Airplane Mode or disconnect Wi-Fi after the page loads. Camera capture, AI checks, and 4×6" download still work with zero internet.'}
          </p>
        </div>

        {/* Core Privacy Guarantees */}
        <div className="space-y-2.5 text-xs">
          <div className="flex items-start gap-2.5">
            <Cpu className="w-4 h-4 text-[#0B57D0] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[#1F1F1F]">
                Processed in Browser Memory
              </div>
              <p className="text-[#444746] leading-relaxed">
                Face alignment, background checks, and 4×6&quot; compositing run
                locally via WebAssembly and{' '}
                <code className="text-[11px]">&lt;canvas&gt;</code>. Closing
                this tab clears everything.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[#1F1F1F]">
                No Accounts, Cookies, or Cloud Storage
              </div>
              <p className="text-[#444746] leading-relaxed">
                Only anonymous visit/photo counts (coarse ZIP) and optional
                nearby-store lookups ever touch the network.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-10 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white text-xs font-bold transition cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );
};

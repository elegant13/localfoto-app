import React from 'react';
import {
  Lock,
  Sun,
  Camera,
  MapPin,
  ArrowRight,
  Users,
} from 'lucide-react';
import { PhotoProfile } from '../types/profile';
import { PublicStats } from '../services/analyticsService';

interface HomePageProps {
  profiles: PhotoProfile[];
  activeProfile: PhotoProfile;
  onSelectProfile: (profile: PhotoProfile) => void;
  onGetStarted: () => void;
  publicStats?: PublicStats | null;
}

export const HomePage: React.FC<HomePageProps> = ({
  onGetStarted,
  publicStats,
}) => {
  const steps = [
    {
      icon: <Lock className="w-4 h-4 text-[#137333]" />,
      bg: 'bg-[#E6F4EA]',
      title: '100% On-Device Privacy',
      desc: 'Your pictures never leave your phone—all processing stays inside LocalFoto.',
    },
    {
      icon: <Sun className="w-4 h-4 text-[#8C4A00]" />,
      bg: 'bg-[#FEF7E0]',
      title: 'Stand ~2 ft from a White Wall',
      desc: 'Face a window or lamp so even light falls on the front of your face.',
    },
    {
      icon: <Camera className="w-4 h-4 text-[#0B57D0]" />,
      bg: 'bg-[#D3E3FD]',
      title: 'Voice-Guided Camera Capture',
      desc: 'Follow gentle audio cues, look directly into the camera lens, and let auto-shutter snap.',
    },
    {
      icon: <MapPin className="w-4 h-4 text-[#0B57D0]" />,
      bg: 'bg-[#D3E3FD]',
      title: 'Print a 4×6" at a Nearby Store (~$0.39)',
      desc: 'Find the nearest store by GPS or ZIP and open their website to order your print.',
    },
  ];

  return (
    <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-between gap-3">
      <div className="space-y-2.5">
        {/* Compact Header */}
        <div className="px-0.5 space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold text-[#1F1F1F] tracking-tight">
              How LocalFoto Works
            </h2>
            {publicStats && publicStats.totalVisitors > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EDF2FA] text-[#041E49] text-[11px] font-semibold shrink-0"
                data-testid="public-visitor-badge"
              >
                <Users className="w-3 h-3 text-[#0B57D0]" />
                {publicStats.totalVisitors.toLocaleString()} visitors
              </span>
            )}
          </div>
          <p className="text-xs text-[#444746]">
            Take biometric passport photos on your phone &amp; cut a 4×6&quot;
            print at home.
          </p>
        </div>

        {/* Single Compact Card with the 4 Core Points */}
        <div className="bg-white rounded-[24px] p-4 m3-elevation-1 border border-[#E1E3E1] space-y-3">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-xl ${step.bg} flex items-center justify-center shrink-0 mt-0.5`}
              >
                {step.icon}
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#1F1F1F]">
                  {step.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-[#444746] leading-snug">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Single Primary CTA */}
      <button
        type="button"
        onClick={onGetStarted}
        className="w-full h-12 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] active:bg-[#062E6F] text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
        data-testid="home-get-started-btn"
      >
        <span>Get Started</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

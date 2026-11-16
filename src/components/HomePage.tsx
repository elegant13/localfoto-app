import React from 'react';
import {
  Lock,
  Sun,
  Camera,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { PhotoProfile } from '../types/profile';

interface HomePageProps {
  profiles: PhotoProfile[];
  activeProfile: PhotoProfile;
  onSelectProfile: (profile: PhotoProfile) => void;
  onGetStarted: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onGetStarted }) => {
  const steps = [
    {
      icon: <Lock className="w-5 h-5 text-[#137333]" />,
      bg: 'bg-[#E6F4EA]',
      title: '100% On-Device Privacy',
      desc: 'Your pictures never leave your phone—all processing happens locally inside LocalFoto.',
    },
    {
      icon: <Sun className="w-5 h-5 text-[#B06000]" />,
      bg: 'bg-[#FEF7E0]',
      title: 'Stand ~2 ft from a White Wall',
      desc: 'Face a window or lamp so even light falls on the front of your face.',
    },
    {
      icon: <Camera className="w-5 h-5 text-[#0B57D0]" />,
      bg: 'bg-[#D3E3FD]',
      title: 'Guided Full-Screen Capture',
      desc: 'Align your face in the oval for auto-capture, or tap the shutter pill anytime.',
    },
    {
      icon: <MapPin className="w-5 h-5 text-[#0B57D0]" />,
      bg: 'bg-[#D3E3FD]',
      title: 'Print a 4×6" at a Nearby Store (~$0.39)',
      desc: 'Find the nearest photo store by GPS or ZIP and open their website to order your 4×6" print.',
    },
  ];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col justify-between min-h-[calc(100dvh-5.5rem)] py-2">
      <div className="space-y-4">
        {/* Minimalist Header */}
        <div className="px-1 space-y-1">
          <h2 className="text-2xl font-extrabold text-[#1F1F1F] tracking-tight">
            How LocalFoto Works
          </h2>
          <p className="text-xs text-[#444746]">
            Take biometric passport photos on your phone &amp; cut a 4×6&quot;
            print at home.
          </p>
        </div>

        {/* Single Clean Card with the 4 Core Points */}
        <div className="bg-white rounded-[28px] p-5 m3-elevation-1 border border-[#E1E3E1] space-y-4">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-2xl ${step.bg} flex items-center justify-center shrink-0 mt-0.5`}
              >
                {step.icon}
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-[#1F1F1F]">
                  {step.title}
                </h3>
                <p className="text-xs text-[#444746] leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Single Primary CTA */}
      <div className="pt-4">
        <button
          type="button"
          onClick={onGetStarted}
          className="w-full h-14 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] active:bg-[#062E6F] text-white font-bold text-base shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          data-testid="home-get-started-btn"
        >
          <span>Get Started</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

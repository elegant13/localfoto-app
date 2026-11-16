import React from 'react';
import {
  ShieldCheck,
  Lock,
  Camera,
  MapPin,
  Scissors,
  ArrowRight,
  ExternalLink,
  Smartphone,
  Sparkles,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { PhotoProfile } from '../types/profile';

interface HomePageProps {
  profiles: PhotoProfile[];
  activeProfile: PhotoProfile;
  onSelectProfile: (profile: PhotoProfile) => void;
  onGetStarted: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  profiles,
  activeProfile,
  onSelectProfile,
  onGetStarted,
}) => {
  return (
    <div className="w-full max-w-xl mx-auto space-y-5">
      {/* Material 3 Hero Card */}
      <div className="bg-gradient-to-br from-[#D3E3FD] via-[#E8F0FE] to-[#F3F6FC] rounded-[32px] p-6 sm:p-7 border border-[#C2D7FC] m3-elevation-1 space-y-5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 text-[#0B57D0] text-xs font-bold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>DIY Passport Photos • Print Locally for ~$0.39</span>
        </div>

        <div className="space-y-2.5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#041E49] tracking-tight leading-tight">
            Take your passport photo at home. Print a 4×6&quot; at a store near
            you.
          </h2>
          <p className="text-sm text-[#1F1F1F]/85 leading-relaxed">
            Use your phone&apos;s camera with real-time biometric alignment
            guides, get a print-ready <strong>4×6&quot; sheet</strong> with
            cutting lines, and order a standard print at your nearest local
            photo store to cut at home.
          </p>
        </div>

        {/* Document / Country Selector inside Hero */}
        <div className="bg-white/95 rounded-2xl p-3.5 border border-[#C2D7FC] space-y-1.5">
          <label
            htmlFor="home-profile-select"
            className="text-[11px] font-bold uppercase tracking-wider text-[#0B57D0] flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Select Document Specification</span>
          </label>
          <select
            id="home-profile-select"
            value={activeProfile.id}
            onChange={(e) => {
              const found = profiles.find((p) => p.id === e.target.value);
              if (found) onSelectProfile(found);
            }}
            className="w-full h-11 px-3 rounded-xl bg-[#F3F6FC] border border-[#C4C7C5] text-sm font-semibold text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#D3E3FD] cursor-pointer"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName} ({p.physicalSize.widthMm}×
                {p.physicalSize.heightMm} mm)
              </option>
            ))}
          </select>
        </div>

        {/* Desktop/Inline Get Started Button */}
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

      {/* Highlight 1: 100% On-Device Privacy Guarantee */}
      <div className="bg-[#E6F4EA]/75 rounded-[28px] p-5 border border-[#A8DAB5] space-y-3">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#137333] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#137333]">
              100% On-Device Privacy Guarantee
            </span>
            <h3 className="text-base sm:text-lg font-bold text-[#0D3B1E]">
              Your pictures never leave your phone
            </h3>
            <p className="text-xs sm:text-sm text-[#1F1F1F]/85 leading-relaxed">
              Within LocalFoto, your camera feed and photos are processed{' '}
              <strong>entirely on your own device</strong>. No biometric data or
              images are ever uploaded to a cloud server, stored in a database,
              or shared with third parties.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            'Zero Cloud Uploads',
            'No Account Needed',
            'Instant Local Cleanup',
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-white/90 rounded-xl px-2.5 py-2 border border-[#A8DAB5]/70 flex items-center gap-1.5 text-[11px] font-semibold text-[#137333]"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Highlight 2: Local Store Finder & Website Handoff */}
      <div className="bg-white rounded-[28px] p-5 m3-elevation-1 border border-[#E1E3E1] space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#D3E3FD] text-[#0B57D0] flex items-center justify-center shrink-0">
            <MapPin className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B57D0]">
              Local Store Finder &amp; Print Handoff
            </span>
            <h3 className="text-base sm:text-lg font-bold text-[#1F1F1F]">
              Find the nearest store &amp; order in minutes
            </h3>
            <p className="text-xs sm:text-sm text-[#444746] leading-relaxed">
              Once your 4×6&quot; sheet is ready, LocalFoto helps you locate the{' '}
              <strong>nearest photo printing store</strong> using your current
              location or ZIP code, saves the print-ready file to your phone,
              and{' '}
              <strong>
                navigates you directly to the store&apos;s website
              </strong>{' '}
              to place your order.
            </p>
          </div>
        </div>

        {/* Supported Store Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {[
            { name: 'Walgreens Photo', price: '$0.39' },
            { name: 'CVS Photo', price: '$0.39' },
            { name: 'Walmart Photo', price: '$0.25' },
            { name: 'Staples Print', price: '$0.49' },
          ].map((store, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F3F6FC] border border-[#D3E3FD] text-xs font-medium text-[#041E49]"
            >
              <span>{store.name}</span>
              <span className="text-[#137333] font-bold">{store.price}</span>
            </span>
          ))}
        </div>
      </div>

      {/* How It Works in 4 Simple Steps */}
      <div className="bg-white rounded-[28px] p-5 m3-elevation-1 border border-[#E1E3E1] space-y-4">
        <h3 className="text-base font-bold text-[#1F1F1F]">
          How LocalFoto Works
        </h3>

        <div className="space-y-3.5">
          {[
            {
              icon: <Smartphone className="w-5 h-5 text-[#0B57D0]" />,
              title: '1. Quick Lighting & Space Check',
              desc: 'Stand ~2 ft from a plain white wall with light facing you from the front.',
            },
            {
              icon: <Camera className="w-5 h-5 text-[#0B57D0]" />,
              title: '2. Guided Rear or Front Camera Capture',
              desc: 'Align your face in our full-screen biometric oval. Auto-shutter snaps the photo when aligned—or tap the shutter pill anytime.',
            },
            {
              icon: <ExternalLink className="w-5 h-5 text-[#0B57D0]" />,
              title: '3. Find a Nearby Store & Order Online',
              desc: 'Review your 300 DPI 4×6" sheet, pick a nearby store by GPS or ZIP code, and jump straight to their website to order a standard 4×6" print.',
            },
            {
              icon: <Scissors className="w-5 h-5 text-[#0B57D0]" />,
              title: '4. Pick Up & Cut at Home',
              desc: 'Verify the printed 1-inch ruler and cut along the light gray lines to get two official 2×2" passport photos.',
            },
          ].map((step, idx) => (
            <div key={idx} className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[#EDF2FA] flex items-center justify-center shrink-0 mt-0.5">
                {step.icon}
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-[#1F1F1F]">
                  {step.title}
                </h4>
                <p className="text-xs text-[#444746] leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Mobile Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-[#F8FAFD]/95 backdrop-blur-md border-t border-[#E1E3E1] p-4 sm:hidden">
        <div className="max-w-xl mx-auto">
          <button
            type="button"
            onClick={onGetStarted}
            className="w-full h-14 rounded-full bg-[#0B57D0] active:bg-[#0842A0] text-white font-bold text-base shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>Get Started</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

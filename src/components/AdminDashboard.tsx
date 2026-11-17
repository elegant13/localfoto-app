import React, { useEffect, useState, useCallback } from 'react';
import {
  Lock,
  Users,
  Camera,
  MapPin,
  MessageSquare,
  RefreshCw,
  ArrowLeft,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import {
  AdminStatsResponse,
  fetchAdminStats,
} from '../services/analyticsService';

interface AdminDashboardProps {
  onBack: () => void;
}

const SESSION_KEY = 'localfoto_admin_token';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authToken, setAuthToken] = useState<string>(() => {
    try {
      return window.sessionStorage.getItem(SESSION_KEY) || '';
    } catch {
      return '';
    }
  });
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadStats = useCallback(async (tokenToUse: string) => {
    if (!tokenToUse) return;
    setLoading(true);
    setErrorMsg(null);
    const res = await fetchAdminStats(tokenToUse);
    setLoading(false);
    if (res.ok && res.data) {
      setStats(res.data);
      try {
        window.sessionStorage.setItem(SESSION_KEY, tokenToUse);
      } catch {
        // Ignore storage errors
      }
    } else {
      setStats(null);
      setErrorMsg(res.error || 'Authentication failed.');
      if (res.status === 401) {
        setAuthToken('');
        try {
          window.sessionStorage.removeItem(SESSION_KEY);
        } catch {
          // Ignore storage errors
        }
      }
    }
  }, []);

  useEffect(() => {
    if (authToken) {
      loadStats(authToken);
    }
  }, [authToken, loadStats]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passwordInput.trim();
    if (!trimmed) return;
    setAuthToken(trimmed);
    loadStats(trimmed);
  };

  const handleLogout = () => {
    setAuthToken('');
    setStats(null);
    setPasswordInput('');
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4 py-2">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={onBack}
          className="h-9 px-3.5 rounded-full bg-[#EDF2FA] text-[#041E49] text-xs font-semibold flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to App
        </button>

        {stats && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => loadStats(authToken)}
              disabled={loading}
              className="h-9 px-3 rounded-full bg-[#EDF2FA] text-[#041E49] text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="h-9 px-3 rounded-full bg-[#EDF2FA] text-[#041E49] text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Lock
            </button>
          </div>
        )}
      </div>

      {/* Login Gate */}
      {!stats && (
        <form
          onSubmit={handleLogin}
          className="bg-white rounded-[28px] p-6 m3-elevation-1 border border-[#E1E3E1] space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#D3E3FD] text-[#0B57D0] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#1F1F1F]">
                Owner Metrics Sign-In
              </h2>
              <p className="text-xs text-[#444746]">
                Private ZIP-code analytics &amp; customer feedback
              </p>
            </div>
          </div>

          <input
            type="password"
            placeholder="Enter Admin Password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            className="w-full h-12 px-4 rounded-2xl bg-[#F3F6FC] border border-[#C4C7C5] text-sm text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0]"
            autoComplete="current-password"
          />

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-[#FEF7E0] border border-[#F59E0B]/40 text-xs text-[#8C4A00] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white font-bold text-sm shadow-md transition cursor-pointer"
          >
            {loading ? 'Verifying...' : 'Unlock Dashboard'}
          </button>
        </form>
      )}

      {/* Authenticated Dashboard */}
      {stats && (
        <div className="space-y-4">
          {/* KPI Row */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white rounded-2xl p-3.5 m3-elevation-1 border border-[#E1E3E1]">
              <Users className="w-4 h-4 text-[#0B57D0] mb-1" />
              <div className="text-xl font-extrabold text-[#1F1F1F]">
                {stats.totalVisitors}
              </div>
              <div className="text-[11px] text-[#444746]">Visitors</div>
            </div>
            <div className="bg-white rounded-2xl p-3.5 m3-elevation-1 border border-[#E1E3E1]">
              <Camera className="w-4 h-4 text-[#137333] mb-1" />
              <div className="text-xl font-extrabold text-[#1F1F1F]">
                {stats.totalPhotos}
              </div>
              <div className="text-[11px] text-[#444746]">Photos</div>
            </div>
            <div className="bg-white rounded-2xl p-3.5 m3-elevation-1 border border-[#E1E3E1]">
              <MessageSquare className="w-4 h-4 text-[#8C4A00] mb-1" />
              <div className="text-xl font-extrabold text-[#1F1F1F]">
                {stats.recentFeedback.length}
              </div>
              <div className="text-[11px] text-[#444746]">Feedback</div>
            </div>
          </div>

          {/* By Photo Profile */}
          <div className="bg-white rounded-[24px] p-4 m3-elevation-1 border border-[#E1E3E1] space-y-2.5">
            <h3 className="text-sm font-bold text-[#1F1F1F]">
              Photos by Country / Profile
            </h3>
            {stats.byProfile.length === 0 ? (
              <p className="text-xs text-[#444746]">No photo events yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats.byProfile.map((p) => (
                  <span
                    key={p.profile_id}
                    className="px-3 py-1 rounded-full bg-[#EDF2FA] text-[#041E49] text-xs font-semibold"
                  >
                    {p.profile_id}: {p.count}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Coarse ZIP-Code Locations */}
          <div className="bg-white rounded-[24px] p-4 m3-elevation-1 border border-[#E1E3E1] space-y-2.5">
            <h3 className="text-sm font-bold text-[#1F1F1F] flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#0B57D0]" />
              Top Locations (ZIP Level)
            </h3>
            {stats.byZip.length === 0 ? (
              <p className="text-xs text-[#444746]">No location data yet.</p>
            ) : (
              <div className="divide-y divide-[#E1E3E1] text-xs">
                {stats.byZip.map((row, idx) => (
                  <div
                    key={`${row.zip_code}-${idx}`}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[#1F1F1F]">
                        {row.zip_code}
                      </div>
                      <div className="text-[11px] text-[#444746] truncate">
                        {[row.city, row.region, row.country]
                          .filter((v) => v && v !== 'Unknown')
                          .join(', ') || 'Coarse Edge Location'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold text-[#0B57D0]">
                        {row.visits} visits
                      </span>
                      <span className="block text-[11px] text-[#137333]">
                        {row.photos} photos
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Customer Feedback Feed */}
          <div className="bg-white rounded-[24px] p-4 m3-elevation-1 border border-[#E1E3E1] space-y-2.5">
            <h3 className="text-sm font-bold text-[#1F1F1F]">
              Customer Feedback
            </h3>
            {stats.recentFeedback.length === 0 ? (
              <p className="text-xs text-[#444746]">No feedback yet.</p>
            ) : (
              <div className="space-y-2.5">
                {stats.recentFeedback.map((fb) => (
                  <div
                    key={fb.id}
                    className="p-3 rounded-2xl bg-[#F3F6FC] border border-[#E1E3E1] space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          fb.rating === 'great'
                            ? 'bg-[#E6F4EA] text-[#137333]'
                            : fb.rating === 'okay'
                            ? 'bg-[#FEF7E0] text-[#8C4A00]'
                            : 'bg-[#FCE8E6] text-[#B3261E]'
                        }`}
                      >
                        {fb.rating.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-[#444746]">
                        {fb.zip_code} • {fb.created_at.slice(0, 10)}
                      </span>
                    </div>
                    {fb.comment && (
                      <p className="text-[#1F1F1F] leading-relaxed">
                        {fb.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

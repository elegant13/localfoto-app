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
  Eye,
  EyeOff,
  Calendar,
} from 'lucide-react';
import {
  AdminStatsResponse,
  fetchAdminStats,
} from '../services/analyticsService';

interface AdminDashboardProps {
  onBack: () => void;
}

const SESSION_KEY = 'localfoto_admin_token';
const MIN_START_DATE = '2026-11-16';

function getUtcDateOffset(daysOffset = 0): string {
  const d = new Date(Date.now() + daysOffset * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function isOwnerRegion(
  zipCode?: string | null,
  city?: string | null,
  region?: string | null
): boolean {
  const zip = (zipCode || '').trim();
  const c = (city || '').toLowerCase();
  const r = (region || '').toLowerCase();
  return zip === '20105' || c.includes('arcola') || r.includes('arcola');
}

function formatFeedbackLocation(fb: {
  zip_code?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
}): string {
  const clean = (v?: string | null) => (v && v !== 'Unknown' ? v.trim() : '');
  const zip = clean(fb.zip_code);
  const city = clean(fb.city);
  const region = clean(fb.region);
  const country = clean(fb.country);

  const cityState = [city, region].filter(Boolean).join(', ');
  const geoWithCountry = cityState
    ? [cityState, country].filter(Boolean).join(', ')
    : '';

  if (zip && geoWithCountry) return `${zip} (${geoWithCountry})`;
  if (zip) return zip;
  if (geoWithCountry) return geoWithCountry;
  if (country) return country;
  return 'Unknown location';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>(MIN_START_DATE);
  const [endDate, setEndDate] = useState<string>(() => getUtcDateOffset(0));
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

  const loadStats = useCallback(
    async (tokenToUse: string, start = startDate, end = endDate) => {
      if (!tokenToUse) return;
      setLoading(true);
      setErrorMsg(null);
      const res = await fetchAdminStats(tokenToUse, start, end);
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
    },
    [startDate, endDate]
  );

  const applyDateRange = (newStart: string, newEnd: string) => {
    const safeStart = newStart < MIN_START_DATE ? MIN_START_DATE : newStart;
    const safeEnd = newEnd < safeStart ? safeStart : newEnd;
    setStartDate(safeStart);
    setEndDate(safeEnd);
    if (authToken) {
      loadStats(authToken, safeStart, safeEnd);
    }
  };

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

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter Admin Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full h-12 pl-4 pr-20 rounded-2xl bg-[#F3F6FC] border border-[#C4C7C5] text-sm text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0]"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-2.5 rounded-full bg-[#EDF2FA] hover:bg-[#E1E8F5] text-[#041E49] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              <span>{showPassword ? 'Hide' : 'Show'}</span>
            </button>
          </div>

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
          {/* Timeline Filter */}
          <div className="bg-white rounded-[24px] p-4 m3-elevation-1 border border-[#E1E3E1] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#1F1F1F] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#0B57D0]" />
                Timeline Filter
              </h3>
              <div className="flex items-center gap-1">
                {[
                  {
                    label: 'Since 11/16',
                    start: MIN_START_DATE,
                    end: getUtcDateOffset(0),
                  },
                  {
                    label: 'Today',
                    start: getUtcDateOffset(0),
                    end: getUtcDateOffset(0),
                  },
                  {
                    label: 'Yesterday',
                    start: getUtcDateOffset(-1),
                    end: getUtcDateOffset(-1),
                  },
                ].map((preset) => {
                  const active =
                    startDate === preset.start && endDate === preset.end;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyDateRange(preset.start, preset.end)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        active
                          ? 'bg-[#0B57D0] text-white'
                          : 'bg-[#EDF2FA] text-[#041E49] hover:bg-[#E1E8F5]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#444746]">
                  From
                </span>
                <input
                  type="date"
                  min={MIN_START_DATE}
                  max={getUtcDateOffset(0)}
                  value={startDate}
                  onChange={(e) =>
                    e.target.value && applyDateRange(e.target.value, endDate)
                  }
                  className="w-full h-9 px-2.5 rounded-xl bg-[#F3F6FC] border border-[#C4C7C5] text-xs text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0]"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#444746]">
                  To
                </span>
                <input
                  type="date"
                  min={startDate}
                  max={getUtcDateOffset(0)}
                  value={endDate}
                  onChange={(e) =>
                    e.target.value && applyDateRange(startDate, e.target.value)
                  }
                  className="w-full h-9 px-2.5 rounded-xl bg-[#F3F6FC] border border-[#C4C7C5] text-xs text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0]"
                />
              </label>
            </div>
          </div>

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
                {stats.externalPhotos}
              </div>
              <div className="text-[11px] text-[#444746]">Customer Photos</div>
              <div className="text-[10px] text-[#8C4A00] font-semibold mt-0.5">
                +{stats.ownerPhotos} owner (20105)
              </div>
            </div>
            <div className="bg-white rounded-2xl p-3.5 m3-elevation-1 border border-[#E1E3E1]">
              <MessageSquare className="w-4 h-4 text-[#8C4A00] mb-1" />
              <div className="text-xl font-extrabold text-[#1F1F1F]">
                {stats.recentFeedback.length}
              </div>
              <div className="text-[11px] text-[#444746]">Feedback</div>
            </div>
          </div>

          {/* Daily Timeline */}
          {stats.timeline && stats.timeline.length > 0 && (
            <div className="bg-white rounded-[24px] p-4 m3-elevation-1 border border-[#E1E3E1] space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#1F1F1F]">
                  Daily Breakdown
                </h3>
                <span className="text-[10px] text-[#444746]">
                  Tap a day to isolate
                </span>
              </div>
              <div className="divide-y divide-[#E1E3E1] text-xs">
                {stats.timeline.map((row) => {
                  const isSelectedSingleDay =
                    startDate === row.day && endDate === row.day;
                  return (
                    <button
                      key={row.day}
                      type="button"
                      onClick={() =>
                        isSelectedSingleDay
                          ? applyDateRange(MIN_START_DATE, getUtcDateOffset(0))
                          : applyDateRange(row.day, row.day)
                      }
                      className={`w-full py-2 px-2 -mx-2 rounded-xl flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                        isSelectedSingleDay
                          ? 'bg-[#D3E3FD]/50'
                          : 'hover:bg-[#F3F6FC]'
                      }`}
                    >
                      <span className="font-bold text-[#1F1F1F]">
                        {row.day}
                      </span>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="font-semibold text-[#0B57D0]">
                          {row.visits} visits
                        </span>
                        <span className="font-semibold text-[#137333]">
                          {row.externalPhotos} cust
                        </span>
                        {row.ownerPhotos > 0 && (
                          <span className="font-semibold text-[#8C4A00]">
                            +{row.ownerPhotos} own
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                {stats.byZip.map((row, idx) => {
                  const ownerRow = isOwnerRegion(
                    row.zip_code,
                    row.city,
                    row.region
                  );
                  return (
                    <div
                      key={`${row.zip_code}-${idx}`}
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[#1F1F1F] flex items-center gap-1.5">
                          <span>{row.zip_code}</span>
                          {ownerRow && (
                            <span className="px-1.5 py-0.5 rounded-full bg-[#FEF7E0] text-[#8C4A00] text-[10px] font-bold">
                              Owner
                            </span>
                          )}
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
                  );
                })}
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
                      <span className="text-[10px] text-[#444746] text-right">
                        {formatFeedbackLocation(fb)} • {fb.created_at.slice(0, 10)}
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

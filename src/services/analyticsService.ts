export type FeedbackRating = 'great' | 'okay' | 'needs_work';

export interface PublicStats {
  totalVisitors: number;
  totalPhotos: number;
}

export interface AdminStatsResponse {
  totalVisitors: number;
  totalPhotos: number;
  byProfile: { profile_id: string; count: number }[];
  byZip: {
    zip_code: string;
    city: string;
    region: string;
    country: string;
    visits: number;
    photos: number;
  }[];
  recentFeedback: {
    id: number;
    rating: FeedbackRating;
    comment: string;
    profile_id: string;
    zip_code: string;
    city: string;
    created_at: string;
  }[];
}

export async function trackEvent(
  eventType: 'visit' | 'photo_generated' | 'store_search',
  profileId: string,
  zipCode?: string
): Promise<void> {
  if (typeof fetch !== 'function') return;
  try {
    await fetch('/api/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventType, profileId, zipCode }),
      keepalive: true,
    });
  } catch {
    // Fail silently offline or in local dev without worker backend
  }
}

export async function fetchPublicStats(): Promise<PublicStats | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const res = await fetch('/api/stats/public');
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<PublicStats>;
    if (
      typeof data.totalVisitors === 'number' &&
      typeof data.totalPhotos === 'number'
    ) {
      return {
        totalVisitors: data.totalVisitors,
        totalPhotos: data.totalPhotos,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function submitFeedback(
  rating: FeedbackRating,
  comment: string,
  profileId: string
): Promise<boolean> {
  if (typeof fetch !== 'function') return false;
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating, comment, profileId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchAdminStats(
  password: string
): Promise<{
  ok: boolean;
  status: number;
  data?: AdminStatsResponse;
  error?: string;
}> {
  try {
    const res = await fetch('/api/stats/admin', {
      headers: {
        Authorization: `Bearer ${password}`,
      },
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      return {
        ok: false,
        status: res.status,
        error:
          errBody.error ||
          (res.status === 401
            ? 'Invalid admin password.'
            : 'Unable to load admin metrics.'),
      };
    }
    const data = (await res.json()) as AdminStatsResponse;
    return { ok: true, status: 200, data };
  } catch {
    return {
      ok: false,
      status: 0,
      error: 'Network error contacting /api/stats/admin.',
    };
  }
}
